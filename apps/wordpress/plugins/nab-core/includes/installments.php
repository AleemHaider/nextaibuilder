<?php
/**
 * 3-month installment plans without WooCommerce Subscriptions.
 *
 * Flow:
 * 1. "Pay in installments" adds the course with nab_plan=installments; the cart
 *    charges installment 1 only, and Stripe is told to save the card.
 * 2. When that order is paid, Tutor enrolls the student as usual and we schedule
 *    installments 2..N (Action Scheduler) every NAB_INSTALLMENT_INTERVAL_DAYS.
 * 3. Each later installment is its own order (a fee line, not the course product,
 *    so Tutor doesn't enroll twice) charged off-session to the saved card.
 * 4. If a charge fails, the student gets the order's pay link by email and
 *    NAB_INSTALLMENT_GRACE_DAYS to pay; after that their enrollment is cancelled.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

const NAB_INSTALLMENT_INTERVAL_DAYS = 30;
const NAB_INSTALLMENT_GRACE_DAYS    = 3; // 72 hours, as on the old platform.

/**
 * Course ID linked to a WooCommerce product, or 0.
 *
 * @param int $product_id Product ID.
 * @return int
 */
function nab_course_id_for_product( $product_id ) {
	$ids = get_posts(
		array(
			'post_type'      => 'courses',
			'posts_per_page' => 1,
			'fields'         => 'ids',
			'meta_key'       => '_tutor_course_product_id', // phpcs:ignore WordPress.DB.SlowDBQuery -- one lookup per cart item.
			'meta_value'     => $product_id, // phpcs:ignore WordPress.DB.SlowDBQuery
		)
	);
	return $ids ? (int) $ids[0] : 0;
}

/**
 * Split a total into N installment amounts that add up exactly:
 * 200 / 3 → [67, 67, 66].
 *
 * @param float $total Course price.
 * @param int   $count Number of installments.
 * @return float[]
 */
function nab_installment_amounts( $total, $count ) {
	$cents = (int) round( $total * 100 );
	$each  = (int) ( ceil( $cents / $count / 100 ) * 100 );
	$out   = array();
	for ( $i = 1; $i <= $count; $i++ ) {
		$amount = $i < $count ? $each : $cents - $each * ( $count - 1 );
		$out[]  = $amount / 100;
	}
	return $out;
}

/**
 * Show the installment button only when Stripe can take card payments.
 */
add_filter(
	'nab_installments_enabled',
	static function () {
		$gateways = function_exists( 'WC' ) ? WC()->payment_gateways()->payment_gateways() : array();
		return isset( $gateways['stripe'] ) && 'yes' === $gateways['stripe']->enabled;
	}
);

/**
 * Tag the cart item with the plan from ?nab_plan=installments.
 *
 * @param array $data       Cart item data.
 * @param int   $product_id Product ID.
 * @return array
 */
function nab_cart_item_plan( $data, $product_id ) {
	$plan = isset( $_GET['nab_plan'] ) ? sanitize_key( wp_unslash( $_GET['nab_plan'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification -- add-to-cart link, no state change beyond the cart.
	if ( 'installments' !== $plan ) {
		return $data;
	}
	$course_id = nab_course_id_for_product( $product_id );
	$count     = $course_id ? nab_get_course( $course_id )['installment_count'] : 0;
	if ( $count > 1 ) {
		$data['nab_plan']         = 'installments';
		$data['nab_installments'] = $count;
		$data['nab_course_id']    = $course_id;
		$data['nab_full_price']   = (float) wc_get_product( $product_id )->get_regular_price();
	}
	return $data;
}
add_filter( 'woocommerce_add_cart_item_data', 'nab_cart_item_plan', 10, 2 );

/**
 * Switching plans: drop the course already in the cart instead of erroring with
 * "you cannot add another" (products are sold individually).
 *
 * @param bool $passed     Validation result.
 * @param int  $product_id Product being added.
 * @return bool
 */
function nab_replace_course_in_cart( $passed, $product_id ) {
	if ( WC()->cart && nab_course_id_for_product( $product_id ) ) {
		foreach ( WC()->cart->get_cart() as $key => $item ) {
			if ( (int) $item['product_id'] === (int) $product_id ) {
				WC()->cart->remove_cart_item( $key );
			}
		}
	}
	return $passed;
}
add_filter( 'woocommerce_add_to_cart_validation', 'nab_replace_course_in_cart', 5, 2 );

/**
 * Charge only the first installment at checkout.
 *
 * @param WC_Cart $cart Cart.
 */
function nab_cart_installment_price( $cart ) {
	foreach ( $cart->get_cart() as $item ) {
		if ( 'installments' === ( $item['nab_plan'] ?? '' ) ) {
			$amounts = nab_installment_amounts( (float) $item['nab_full_price'], (int) $item['nab_installments'] );
			$item['data']->set_price( $amounts[0] );
			// Show it as a plan, not a discount: no struck-through price / "Save $X".
			$item['data']->set_regular_price( $amounts[0] );
			$item['data']->set_sale_price( '' );
		}
	}
}
add_action( 'woocommerce_before_calculate_totals', 'nab_cart_installment_price', 20 );

/**
 * Explain the plan in the cart and checkout.
 *
 * @param array $item_data Display rows.
 * @param array $item      Cart item.
 * @return array
 */
function nab_cart_installment_label( $item_data, $item ) {
	if ( 'installments' !== ( $item['nab_plan'] ?? '' ) ) {
		return $item_data;
	}
	$count   = (int) $item['nab_installments'];
	$amounts = nab_installment_amounts( (float) $item['nab_full_price'], $count );
	$rest    = array_slice( $amounts, 1 );
	$item_data[] = array(
		'key'   => __( 'Payment plan', 'nab-core' ),
		'value' => sprintf(
			/* translators: 1: today amount, 2: later amounts, 3: interval days. */
			__( '%1$s today, then %2$s, one every %3$d days. Your card is saved for these payments.', 'nab-core' ),
			nab_money( $amounts[0] ),
			wp_sprintf_l( '%l', array_map( 'nab_money', $rest ) ),
			NAB_INSTALLMENT_INTERVAL_DAYS
		),
	);
	return $item_data;
}
add_filter( 'woocommerce_get_item_data', 'nab_cart_installment_label', 10, 2 );

/**
 * Copy the plan onto the order line item.
 *
 * @param WC_Order_Item_Product $line Order item.
 * @param string                $key  Cart key.
 * @param array                 $item Cart item.
 */
function nab_order_item_plan( $line, $key, $item ) {
	if ( 'installments' === ( $item['nab_plan'] ?? '' ) ) {
		$line->add_meta_data( '_nab_plan', 'installments', true );
		$line->add_meta_data( '_nab_installments', (int) $item['nab_installments'], true );
		$line->add_meta_data( '_nab_full_price', (float) $item['nab_full_price'], true );
		$line->add_meta_data( '_nab_course_id', (int) $item['nab_course_id'], true );
	}
}
add_action( 'woocommerce_checkout_create_order_line_item', 'nab_order_item_plan', 10, 3 );

/**
 * The installment line item of an order, if any.
 *
 * @param WC_Order $order Order.
 * @return WC_Order_Item_Product|null
 */
function nab_order_plan_item( $order ) {
	foreach ( $order->get_items() as $item ) {
		if ( 'installments' === $item->get_meta( '_nab_plan' ) ) {
			return $item;
		}
	}
	return null;
}

/**
 * Tell Stripe to keep the card when the order is an installment plan.
 *
 * @param bool       $force    Current value.
 * @param int|string $order_id Order ID.
 * @return bool
 */
function nab_force_save_card( $force, $order_id = 0 ) {
	if ( $order_id ) {
		$order = wc_get_order( $order_id );
		return $force || ( $order && nab_order_plan_item( $order ) );
	}
	if ( WC()->cart ) {
		foreach ( WC()->cart->get_cart() as $item ) {
			if ( 'installments' === ( $item['nab_plan'] ?? '' ) ) {
				return true;
			}
		}
	}
	return $force;
}
add_filter( 'wc_stripe_force_save_payment_method', 'nab_force_save_card', 10, 2 );
add_filter( 'wc_stripe_force_save_source', 'nab_force_save_card', 10, 2 );

/**
 * Once the first installment is paid, schedule the rest. Idempotent.
 *
 * @param int    $order_id Order ID.
 * @param string $from     Old status.
 * @param string $to       New status.
 */
function nab_schedule_installments( $order_id, $from, $to ) {
	if ( ! in_array( $to, array( 'processing', 'completed' ), true ) ) {
		return;
	}
	$order = wc_get_order( $order_id );
	$item  = $order ? nab_order_plan_item( $order ) : null;
	if ( ! $item || $order->get_meta( '_nab_installments_scheduled' ) ) {
		return;
	}
	$count = (int) $item->get_meta( '_nab_installments' );
	$paid  = $order->get_date_paid() ? $order->get_date_paid()->getTimestamp() : time();
	for ( $n = 2; $n <= $count; $n++ ) {
		as_schedule_single_action( $paid + ( $n - 1 ) * NAB_INSTALLMENT_INTERVAL_DAYS * DAY_IN_SECONDS, 'nab_charge_installment', array( $order_id, $n ), 'nab-installments' );
	}
	$order->update_meta_data( '_nab_installments_scheduled', time() );
	$order->update_meta_data( '_nab_plan_status', 'active' );
	$order->add_order_note( sprintf( 'Installment plan: 1 of %d paid. Remaining payments scheduled every %d days.', $count, NAB_INSTALLMENT_INTERVAL_DAYS ) );
	$order->save();
}
add_action( 'woocommerce_order_status_changed', 'nab_schedule_installments', 20, 3 );

/**
 * Charge installment N for a plan, creating its order. Safe to re-run.
 *
 * @param int $parent_id First-installment order ID.
 * @param int $n         Installment number (2..count).
 * @return WC_Order|null The installment order.
 */
function nab_charge_installment( $parent_id, $n ) {
	$parent = wc_get_order( $parent_id );
	$item   = $parent ? nab_order_plan_item( $parent ) : null;
	if ( ! $item || 'active' !== $parent->get_meta( '_nab_plan_status' ) ) {
		return null;
	}
	$count   = (int) $item->get_meta( '_nab_installments' );
	$amounts = nab_installment_amounts( (float) $item->get_meta( '_nab_full_price' ), $count );
	$amount  = $amounts[ $n - 1 ] ?? 0;
	if ( ! $amount ) {
		return null;
	}

	$order = null;
	$existing_id = (int) $parent->get_meta( '_nab_installment_' . $n . '_order' );
	if ( $existing_id ) {
		$order = wc_get_order( $existing_id );
		if ( $order && $order->is_paid() ) {
			return $order;
		}
	}
	if ( ! $order ) {
		$order = wc_create_order(
			array(
				'customer_id' => $parent->get_customer_id(),
				'parent'      => $parent_id,
			)
		);
		$fee = new WC_Order_Item_Fee();
		/* translators: 1: number, 2: total, 3: course name. */
		$fee->set_name( sprintf( __( 'Installment %1$d of %2$d: %3$s', 'nab-core' ), $n, $count, get_the_title( (int) $item->get_meta( '_nab_course_id' ) ) ) );
		$fee->set_amount( $amount );
		$fee->set_total( $amount );
		$fee->set_tax_status( 'none' );
		$order->add_item( $fee );
		$order->set_address( $parent->get_address( 'billing' ), 'billing' );
		$order->set_currency( $parent->get_currency() );
		$order->set_payment_method( $parent->get_payment_method() );
		$order->set_payment_method_title( $parent->get_payment_method_title() );
		$order->update_meta_data( '_nab_installment_parent', $parent_id );
		$order->update_meta_data( '_nab_installment_number', $n );
		$order->calculate_totals( false );
		$order->save();
		$parent->update_meta_data( '_nab_installment_' . $n . '_order', $order->get_id() );
		$parent->save();
	}

	// Bank-transfer plans can't be charged automatically: send a "payment due"
	// invoice with the bank details and receipt upload, and start the grace period.
	if ( 'bacs' === $parent->get_payment_method() ) {
		if ( ! $order->get_meta( '_nab_invoice_sent' ) ) {
			$order->update_meta_data( '_nab_invoice_sent', time() );
			$order->save();
			$order->add_order_note( 'Installment due: invoice with bank details sent.' );
			$mailer = WC()->mailer()->get_emails();
			if ( isset( $mailer['WC_Email_Customer_Invoice'] ) ) {
				$mailer['WC_Email_Customer_Invoice']->trigger( $order->get_id(), $order );
			}
		}
		if ( ! as_next_scheduled_action( 'nab_installment_grace', array( $parent_id, $n ), 'nab-installments' ) ) {
			as_schedule_single_action( time() + NAB_INSTALLMENT_GRACE_DAYS * DAY_IN_SECONDS, 'nab_installment_grace', array( $parent_id, $n ), 'nab-installments' );
		}
		return $order;
	}

	$result = nab_stripe_charge_saved_card( $parent, $order );
	if ( true === $result ) {
		$parent->add_order_note( sprintf( 'Installment %d of %d paid (order #%d).', $n, $count, $order->get_id() ) );
		return $order;
	}

	$order->update_status( 'failed', 'Automatic installment charge failed: ' . $result );
	$parent->add_order_note( sprintf( 'Installment %d failed (%s). Pay link emailed; enrollment ends in %d days if unpaid.', $n, $result, NAB_INSTALLMENT_GRACE_DAYS ) );
	$mailer = WC()->mailer()->get_emails();
	if ( isset( $mailer['WC_Email_Customer_Invoice'] ) ) {
		$mailer['WC_Email_Customer_Invoice']->trigger( $order->get_id(), $order );
	}
	if ( ! as_next_scheduled_action( 'nab_installment_grace', array( $parent_id, $n ), 'nab-installments' ) ) {
		as_schedule_single_action( time() + NAB_INSTALLMENT_GRACE_DAYS * DAY_IN_SECONDS, 'nab_installment_grace', array( $parent_id, $n ), 'nab-installments' );
	}
	return $order;
}
add_action( 'nab_charge_installment', 'nab_charge_installment', 10, 2 );

/**
 * Off-session charge of the card saved on the first order.
 *
 * @param WC_Order $parent First order (holds Stripe customer + payment method).
 * @param WC_Order $order  Installment order to pay.
 * @return true|string True on success, otherwise the reason.
 */
function nab_stripe_charge_saved_card( $parent, $order ) {
	if ( ! class_exists( 'WC_Stripe_API' ) ) {
		return 'Stripe gateway not active';
	}
	$customer = $parent->get_meta( '_stripe_customer_id' );
	$method   = $parent->get_meta( '_stripe_source_id' );
	if ( ! $customer || ! $method ) {
		return 'No saved card on the first order';
	}
	$response = WC_Stripe_API::request(
		array(
			'amount'         => (int) round( (float) $order->get_total() * 100 ),
			'currency'       => strtolower( $order->get_currency() ),
			'customer'       => $customer,
			'payment_method' => $method,
			'off_session'    => 'true',
			'confirm'        => 'true',
			'description'    => wp_strip_all_tags( implode( ', ', array_map( static fn( $i ) => $i->get_name(), $order->get_items( 'fee' ) ) ) ),
			'metadata'       => array(
				'order_id'        => $order->get_id(),
				'parent_order_id' => $parent->get_id(),
			),
		),
		'payment_intents'
	);
	if ( ! empty( $response->error ) ) {
		return $response->error->message ?? 'Card declined';
	}
	if ( 'succeeded' !== ( $response->status ?? '' ) ) {
		return 'Payment needs customer action (' . ( $response->status ?? 'unknown' ) . ')';
	}
	$order->update_meta_data( '_stripe_customer_id', $customer );
	$order->update_meta_data( '_stripe_source_id', $method );
	$order->update_meta_data( '_stripe_intent_id', $response->id );
	$order->payment_complete( $response->latest_charge ?? $response->id );
	return true;
}

/**
 * End of grace period: cancel the enrollment if the installment is still unpaid.
 *
 * @param int $parent_id First order ID.
 * @param int $n         Installment number.
 */
function nab_installment_grace( $parent_id, $n ) {
	$parent = wc_get_order( $parent_id );
	$order  = $parent ? wc_get_order( (int) $parent->get_meta( '_nab_installment_' . $n . '_order' ) ) : null;
	if ( ! $parent || ! $order || $order->is_paid() ) {
		return;
	}
	// A receipt is waiting for admin review: don't cut access, check again later.
	if ( 'pending' === $order->get_meta( '_nab_receipt_status' ) ) {
		as_schedule_single_action( time() + 2 * DAY_IN_SECONDS, 'nab_installment_grace', array( $parent_id, $n ), 'nab-installments' );
		return;
	}
	foreach ( (array) tutor_utils()->get_course_enrolled_ids_by_order_id( $parent_id ) as $row ) {
		tutor_utils()->course_enrol_status_change( (int) ( is_array( $row ) ? $row['enrolled_id'] : $row->enrolled_id ), 'cancel' );
	}
	$parent->update_meta_data( '_nab_plan_status', 'defaulted' );
	if ( function_exists( 'nab_send_email' ) ) {
		nab_send_email(
			$parent->get_billing_email(),
			__( 'Your course access is paused', 'nab-core' ),
			'<p>' . esc_html( sprintf( /* translators: %d: installment. */ __( 'Installment %d is still unpaid, so we’ve paused your course access. Pay it any time to restore access straight away; your progress is kept.', 'nab-core' ), $n ) ) . '</p><p><a href="' . esc_url( $order->get_checkout_payment_url() ) . '">' . esc_html__( 'Pay now', 'nab-core' ) . '</a></p>'
		);
	}
	$parent->add_order_note( sprintf( 'Installment %d unpaid after %d days: enrollment cancelled.', $n, NAB_INSTALLMENT_GRACE_DAYS ) );
	$parent->save(); // Remaining scheduled charges skip themselves while the plan isn't active.
}
add_action( 'nab_installment_grace', 'nab_installment_grace', 10, 2 );

/**
 * When any installment order gets paid (automatically or late via the emailed
 * link): close out the plan after the last one, and restore a cancelled enrollment.
 *
 * @param int $order_id Paid order.
 */
function nab_installment_paid_late( $order_id ) {
	$order     = wc_get_order( $order_id );
	$parent_id = $order ? (int) $order->get_meta( '_nab_installment_parent' ) : 0;
	$parent    = $parent_id ? wc_get_order( $parent_id ) : null;
	if ( ! $parent ) {
		return;
	}
	$item = nab_order_plan_item( $parent );
	if ( $item && (int) $order->get_meta( '_nab_installment_number' ) === (int) $item->get_meta( '_nab_installments' ) && 'active' === $parent->get_meta( '_nab_plan_status' ) ) {
		$parent->update_meta_data( '_nab_plan_status', 'paid' );
		$parent->save();
	}
	if ( 'defaulted' !== $parent->get_meta( '_nab_plan_status' ) ) {
		return;
	}
	foreach ( (array) tutor_utils()->get_course_enrolled_ids_by_order_id( $parent_id ) as $row ) {
		tutor_utils()->course_enrol_status_change( (int) ( is_array( $row ) ? $row['enrolled_id'] : $row->enrolled_id ), 'completed' );
	}
	$parent->update_meta_data( '_nab_plan_status', 'active' );
	$parent->add_order_note( sprintf( 'Late installment paid (order #%d): enrollment restored.', $order_id ) );
	$parent->save();
}
add_action( 'woocommerce_payment_complete', 'nab_installment_paid_late' );
