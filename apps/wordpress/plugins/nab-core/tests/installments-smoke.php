<?php
/**
 * Installment plan smoke test, runnable without Stripe:
 *   wp eval-file wp-content/plugins/nab-core/tests/installments-smoke.php
 *
 * Exercises: first payment → enrollment + schedule, failed charge → invoice +
 * grace, grace expiry → enrollment cancelled, late payment → restored.
 * Creates a throwaway student and orders, and deletes them at the end.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

$nab_fail = 0;
$nab_ok   = static function ( $cond, $label ) use ( &$nab_fail ) {
	WP_CLI::log( ( $cond ? 'PASS ' : 'FAIL ' ) . $label );
	$nab_fail += $cond ? 0 : 1;
};

// Tutor caches is_enrolled() per request and changes enrollment status with raw
// SQL (bypassing the post cache), so read the status straight from the table.
$nab_enrollment_status = static function ( $order_id ) {
	global $wpdb;
	$rows = (array) tutor_utils()->get_course_enrolled_ids_by_order_id( $order_id );
	return $rows ? (string) $wpdb->get_var( $wpdb->prepare( "SELECT post_status FROM {$wpdb->posts} WHERE ID = %d", (int) $rows[0]['enrolled_id'] ) ) : 'none';
};

$course_id  = get_page_by_path( 'build-production-ready-ai-agents-recorded', OBJECT, 'courses' )->ID;
$product_id = (int) get_post_meta( $course_id, '_tutor_course_product_id', true );
$product    = wc_get_product( $product_id );
$user_id    = wp_insert_user(
	array(
		'user_login' => 'nab_smoke_' . wp_generate_password( 6, false ),
		'user_pass'  => wp_generate_password(),
		'user_email' => 'smoke+' . time() . '@example.test',
		'role'       => 'customer',
	)
);

// 1. First installment order, as checkout would create it.
$order = wc_create_order( array( 'customer_id' => $user_id ) );
$order->set_billing_email( get_userdata( $user_id )->user_email );
$item_id = $order->add_product( $product, 1, array( 'subtotal' => 67, 'total' => 67 ) );
$item    = $order->get_item( $item_id );
$item->add_meta_data( '_nab_plan', 'installments', true );
$item->add_meta_data( '_nab_installments', 3, true );
$item->add_meta_data( '_nab_full_price', 200, true );
$item->add_meta_data( '_nab_course_id', $course_id, true );
$item->save();
$order->set_payment_method( 'stripe' );
$order->calculate_totals( false );
$order->save();
$order->payment_complete( 'test_txn' );
$order = wc_get_order( $order->get_id() );

$nab_ok( 67.0 === (float) $order->get_total(), 'first order charges $67' );
$nab_ok( 'active' === $order->get_meta( '_nab_plan_status' ), 'plan marked active after first payment' );
$nab_ok( (bool) as_next_scheduled_action( 'nab_charge_installment', array( $order->get_id(), 2 ), 'nab-installments' ), 'installment 2 scheduled' );
$nab_ok( (bool) as_next_scheduled_action( 'nab_charge_installment', array( $order->get_id(), 3 ), 'nab-installments' ), 'installment 3 scheduled' );
$when = as_next_scheduled_action( 'nab_charge_installment', array( $order->get_id(), 2 ), 'nab-installments' );
$nab_ok( abs( $when - ( time() + 30 * DAY_IN_SECONDS ) ) < 120, 'installment 2 is ~30 days out' );
$nab_ok( 'completed' === $nab_enrollment_status( $order->get_id() ), 'student enrolled after first payment' );

// Re-firing the status change must not double-schedule.
do_action( 'woocommerce_order_status_changed', $order->get_id(), 'processing', 'completed', $order );
$nab_ok( 1 === count( as_get_scheduled_actions( array( 'hook' => 'nab_charge_installment', 'args' => array( $order->get_id(), 2 ), 'status' => 'pending' ), 'ids' ) ), 'no duplicate schedule on re-fire' );

// 2. Installment 2 charge: no saved card → fails, invoice + grace.
$child = nab_charge_installment( $order->get_id(), 2 );
$nab_ok( $child && 'failed' === $child->get_status(), 'charge without saved card → installment order failed' );
$nab_ok( $child && 67.0 === (float) $child->get_total(), 'installment 2 is $67' );
$nab_ok( $child && 0 === count( $child->get_items() ), 'installment order has no course product line (no double enrollment)' );
$nab_ok( (bool) as_next_scheduled_action( 'nab_installment_grace', array( $order->get_id(), 2 ), 'nab-installments' ), 'grace check scheduled' );
$again = nab_charge_installment( $order->get_id(), 2 );
$nab_ok( $again && $again->get_id() === $child->get_id(), 'retry reuses the same installment order' );

// 3. Grace expires unpaid → enrollment cancelled.
nab_installment_grace( $order->get_id(), 2 );
$order = wc_get_order( $order->get_id() );
$nab_ok( 'defaulted' === $order->get_meta( '_nab_plan_status' ), 'plan defaulted after grace' );
$nab_ok( 'cancel' === $nab_enrollment_status( $order->get_id() ), 'enrollment cancelled after grace' );
$nab_ok( null === nab_charge_installment( $order->get_id(), 3 ), 'later installments skip while defaulted' );

// 4. Student pays the late installment via the emailed link → restored.
$child = wc_get_order( $child->get_id() );
$child->payment_complete( 'late_txn' );
$order = wc_get_order( $order->get_id() );
$nab_ok( 'active' === $order->get_meta( '_nab_plan_status' ), 'plan active again after late payment' );
$nab_ok( 'completed' === $nab_enrollment_status( $order->get_id() ), 'enrollment restored after late payment' );

// 5. Amounts always sum to the price.
$nab_ok( 200.0 === (float) array_sum( nab_installment_amounts( 200, 3 ) ), '$200 splits into 3 parts summing to $200' );

// Clean up.
foreach ( as_get_scheduled_actions( array( 'group' => 'nab-installments', 'status' => 'pending', 'per_page' => 50 ), 'ids' ) as $action_id ) {
	$args = ActionScheduler::store()->fetch_action( $action_id )->get_args();
	if ( (int) $args[0] === $order->get_id() ) {
		ActionScheduler::store()->cancel_action( $action_id );
	}
}
$child->delete( true );
$order->delete( true );
require_once ABSPATH . 'wp-admin/includes/user.php';
wp_delete_user( $user_id );

$nab_fail ? WP_CLI::error( "$nab_fail check(s) failed." ) : WP_CLI::success( 'All installment checks passed.' );
