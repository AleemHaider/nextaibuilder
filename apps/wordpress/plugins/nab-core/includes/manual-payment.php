<?php
/**
 * Bank transfer with receipt upload and admin approval.
 *
 * Uses WooCommerce's built-in "Direct bank transfer" (bacs) gateway, which puts
 * orders on hold and shows the bank details. We add:
 * - a receipt upload form on the thank-you page and My Account order page;
 * - private storage (not the public media library), admin-only download;
 * - an Approve / Reject box on the order screen and a "Receipts to review" list;
 * - emails: admin on upload, student on rejection (approval sends WooCommerce's
 *   normal "order complete" email, and Tutor activates the enrollment).
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

const NAB_RECEIPT_MAX_BYTES = 10 * MB_IN_BYTES;

/**
 * Allowed receipt types: extension => mime.
 *
 * @return array<string, string>
 */
function nab_receipt_types() {
	return array(
		'jpg'  => 'image/jpeg',
		'jpeg' => 'image/jpeg',
		'png'  => 'image/png',
		'webp' => 'image/webp',
		'pdf'  => 'application/pdf',
	);
}

/**
 * Private receipts directory, created with a deny-all .htaccess.
 * On nginx, also deny /wp-content/uploads/nab-receipts/ in the server config.
 *
 * @return string Absolute path with trailing slash.
 */
function nab_receipts_dir() {
	$dir = trailingslashit( wp_upload_dir()['basedir'] ) . 'nab-receipts/';
	if ( ! is_dir( $dir ) ) {
		wp_mkdir_p( $dir );
		file_put_contents( $dir . '.htaccess', "Require all denied\nDeny from all\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		file_put_contents( $dir . 'index.php', "<?php\n// Silence.\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	}
	return $dir;
}

/**
 * Whether the customer can upload a receipt for this order right now.
 *
 * @param WC_Order $order Order.
 * @return bool
 */
function nab_order_accepts_receipt( $order ) {
	return 'bacs' === $order->get_payment_method()
		&& $order->has_status( array( 'on-hold', 'pending', 'failed' ) )
		&& 'pending' !== $order->get_meta( '_nab_receipt_status' );
}

/**
 * Receipt panel for the customer: upload form, or the review status.
 *
 * @param int $order_id Order ID.
 */
function nab_render_receipt_panel( $order_id ) {
	$order = wc_get_order( $order_id );
	if ( ! $order || 'bacs' !== $order->get_payment_method() || (int) $order->get_customer_id() !== get_current_user_id() ) {
		return;
	}
	$status = $order->get_meta( '_nab_receipt_status' );
	echo '<section class="nab-card nab-receipt" style="padding:1.75rem;margin:2rem 0">';
	echo '<h2 class="nab-section-title">' . esc_html__( 'Payment receipt', 'nab-core' ) . '</h2>';

	if ( isset( $_GET['nab_receipt'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification -- display-only flag after redirect.
		$flag = sanitize_key( wp_unslash( $_GET['nab_receipt'] ) ); // phpcs:ignore WordPress.Security.NonceVerification
		$msgs = array(
			'uploaded' => array( 'success', __( 'Thanks! Your receipt was uploaded. We usually confirm within one business day and will email you when your enrollment is active.', 'nab-core' ) ),
			'type'     => array( 'error', __( 'That file type isn’t supported. Upload a JPG, PNG, WebP or PDF.', 'nab-core' ) ),
			'size'     => array( 'error', __( 'That file is larger than 10 MB.', 'nab-core' ) ),
			'error'    => array( 'error', __( 'The upload failed. Please try again.', 'nab-core' ) ),
		);
		if ( isset( $msgs[ $flag ] ) ) {
			printf( '<p class="nab-notice nab-notice--%s">%s</p>', esc_attr( $msgs[ $flag ][0] ), esc_html( $msgs[ $flag ][1] ) );
		}
	}

	if ( 'pending' === $status ) {
		echo '<p>' . esc_html__( 'Your receipt is being reviewed. We’ll email you as soon as your payment is confirmed.', 'nab-core' ) . '</p>';
	} elseif ( 'approved' === $status || $order->is_paid() ) {
		echo '<p>' . esc_html__( 'Payment confirmed. You’re all set.', 'nab-core' ) . '</p>';
	}

	if ( 'rejected' === $status ) {
		echo '<p class="nab-notice nab-notice--error">' . esc_html__( 'We couldn’t confirm your last receipt:', 'nab-core' ) . ' ' . esc_html( $order->get_meta( '_nab_receipt_reject_reason' ) ) . '</p>';
	}

	if ( nab_order_accepts_receipt( $order ) ) {
		// WooCommerce only prints the bank details on the thank-you page; repeat them here.
		if ( doing_action( 'woocommerce_view_order' ) ) {
			$gateways = WC()->payment_gateways()->payment_gateways();
			if ( isset( $gateways['bacs'] ) ) {
				$gateways['bacs']->thankyou_page( $order->get_id() );
			}
		}
		printf(
			/* translators: %s: amount. */
			'<p>' . esc_html__( 'After you transfer %s using our bank details, upload a screenshot or PDF of the transfer confirmation. Include the order number in your transfer reference.', 'nab-core' ) . '</p>',
			'<strong>' . wp_kses_post( $order->get_formatted_order_total() ) . '</strong>'
		);
		?>
		<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data" class="nab-receipt__form">
			<input type="hidden" name="action" value="nab_upload_receipt" />
			<input type="hidden" name="order_id" value="<?php echo esc_attr( $order->get_id() ); ?>" />
			<?php wp_nonce_field( 'nab_upload_receipt_' . $order->get_id() ); ?>
			<label for="nab-receipt-file"><strong><?php esc_html_e( 'Receipt file', 'nab-core' ); ?></strong> <span class="nab-course-card__meta"><?php esc_html_e( 'JPG, PNG, WebP or PDF, up to 10 MB', 'nab-core' ); ?></span></label>
			<input id="nab-receipt-file" type="file" name="receipt" accept=".jpg,.jpeg,.png,.webp,.pdf" required />
			<label for="nab-receipt-ref"><?php esc_html_e( 'Transaction reference (optional)', 'nab-core' ); ?></label>
			<input id="nab-receipt-ref" type="text" name="reference" maxlength="100" />
			<label for="nab-receipt-note"><?php esc_html_e( 'Note (optional)', 'nab-core' ); ?></label>
			<textarea id="nab-receipt-note" name="note" rows="2" maxlength="500"></textarea>
			<button type="submit" class="nab-btn"><?php esc_html_e( 'Upload receipt', 'nab-core' ); ?></button>
		</form>
		<?php
	}
	echo '</section>';
}
add_action( 'woocommerce_thankyou_bacs', 'nab_render_receipt_panel', 20 );
add_action( 'woocommerce_view_order', 'nab_render_receipt_panel', 5 );

/**
 * Handle the receipt upload.
 */
function nab_handle_receipt_upload() {
	$order_id = isset( $_POST['order_id'] ) ? absint( $_POST['order_id'] ) : 0;
	check_admin_referer( 'nab_upload_receipt_' . $order_id );
	$order = wc_get_order( $order_id );
	if ( ! $order || ! is_user_logged_in() || (int) $order->get_customer_id() !== get_current_user_id() ) {
		wp_die( esc_html__( 'You can’t upload a receipt for this order.', 'nab-core' ), 403 );
	}
	$back = $order->get_view_order_url();
	if ( ! nab_order_accepts_receipt( $order ) ) {
		wp_safe_redirect( $back );
		exit;
	}

	$file = $_FILES['receipt'] ?? null; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- validated below.
	if ( ! $file || UPLOAD_ERR_OK !== (int) $file['error'] || ! is_uploaded_file( $file['tmp_name'] ) ) {
		wp_safe_redirect( add_query_arg( 'nab_receipt', 'error', $back ) );
		exit;
	}
	if ( (int) $file['size'] > NAB_RECEIPT_MAX_BYTES ) {
		wp_safe_redirect( add_query_arg( 'nab_receipt', 'size', $back ) );
		exit;
	}
	// Check the real content type, not the browser-supplied one.
	$check = wp_check_filetype_and_ext( $file['tmp_name'], sanitize_file_name( $file['name'] ), nab_receipt_types() );
	if ( empty( $check['ext'] ) || empty( $check['type'] ) ) {
		wp_safe_redirect( add_query_arg( 'nab_receipt', 'type', $back ) );
		exit;
	}

	$name = sprintf( 'order-%d-%s.%s', $order_id, wp_generate_password( 16, false ), $check['ext'] );
	$dest = nab_receipts_dir() . $name;
	if ( ! move_uploaded_file( $file['tmp_name'], $dest ) ) {
		wp_safe_redirect( add_query_arg( 'nab_receipt', 'error', $back ) );
		exit;
	}
	$old = $order->get_meta( '_nab_receipt_file' );
	if ( $old && file_exists( nab_receipts_dir() . basename( $old ) ) ) {
		wp_delete_file( nab_receipts_dir() . basename( $old ) );
	}

	$order->update_meta_data( '_nab_receipt_file', $name );
	$order->update_meta_data( '_nab_receipt_mime', $check['type'] );
	$order->update_meta_data( '_nab_receipt_original', sanitize_file_name( $file['name'] ) );
	$order->update_meta_data( '_nab_receipt_uploaded', time() );
	$order->update_meta_data( '_nab_receipt_note', isset( $_POST['note'] ) ? sanitize_textarea_field( wp_unslash( $_POST['note'] ) ) : '' );
	$order->update_meta_data( '_nab_receipt_status', 'pending' );
	$order->update_meta_data( '_nab_receipt_reference', isset( $_POST['reference'] ) ? sanitize_text_field( wp_unslash( $_POST['reference'] ) ) : '' );
	$order->delete_meta_data( '_nab_receipt_reject_reason' );
	$order->save();
	if ( ! $order->has_status( 'on-hold' ) ) {
		$order->update_status( 'on-hold', __( 'Bank transfer receipt uploaded, awaiting review.', 'nab-core' ) );
	} else {
		$order->add_order_note( __( 'Bank transfer receipt uploaded, awaiting review.', 'nab-core' ) );
	}

	nab_send_email(
		get_option( 'admin_email' ),
		/* translators: %d: order number. */
		sprintf( __( 'Receipt to review: order #%d', 'nab-core' ), $order_id ),
		sprintf(
			'<p>%s</p><p><a href="%s">%s</a></p>',
			esc_html(
				sprintf(
					/* translators: 1: customer name, 2: amount. */
					__( '%1$s uploaded a bank transfer receipt for %2$s.', 'nab-core' ),
					$order->get_formatted_billing_full_name(),
					wp_strip_all_tags( wc_price( $order->get_total(), array( 'currency' => $order->get_currency() ) ) )
				)
			),
			esc_url( $order->get_edit_order_url() ),
			esc_html__( 'Review and approve', 'nab-core' )
		)
	);

	wp_safe_redirect( add_query_arg( 'nab_receipt', 'uploaded', $back ) );
	exit;
}
add_action( 'admin_post_nab_upload_receipt', 'nab_handle_receipt_upload' );

/**
 * Admin-only receipt download.
 */
function nab_handle_receipt_download() {
	$order_id = isset( $_GET['order_id'] ) ? absint( $_GET['order_id'] ) : 0;
	check_admin_referer( 'nab_receipt_' . $order_id );
	if ( ! current_user_can( 'nab_manage_payments' ) ) {
		wp_die( '', 403 );
	}
	$order = wc_get_order( $order_id );
	$file  = $order ? nab_receipts_dir() . basename( (string) $order->get_meta( '_nab_receipt_file' ) ) : '';
	if ( ! $file || ! is_file( $file ) ) {
		wp_die( esc_html__( 'Receipt not found.', 'nab-core' ), 404 );
	}
	nocache_headers();
	header( 'Content-Type: ' . $order->get_meta( '_nab_receipt_mime' ) );
	header( 'Content-Disposition: inline; filename="' . sanitize_file_name( $order->get_meta( '_nab_receipt_original' ) ) . '"' );
	header( 'X-Content-Type-Options: nosniff' );
	header( 'Content-Length: ' . filesize( $file ) );
	readfile( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	exit;
}
add_action( 'admin_post_nab_receipt', 'nab_handle_receipt_download' );

/**
 * Approve: mark paid and completed so Tutor activates the enrollment.
 *
 * @param WC_Order $order Order.
 */
function nab_approve_receipt( $order ) {
	$order->update_meta_data( '_nab_receipt_status', 'approved' );
	$order->update_meta_data( '_nab_receipt_reviewed_by', get_current_user_id() );
	$order->update_meta_data( '_nab_receipt_reviewed_at', time() );
	$order->save();
	$order->payment_complete();
	$order = wc_get_order( $order->get_id() );
	if ( ! $order->has_status( 'completed' ) ) {
		$order->update_status( 'completed', __( 'Bank transfer receipt approved.', 'nab-core' ) );
	} else {
		$order->add_order_note( __( 'Bank transfer receipt approved.', 'nab-core' ) );
	}
}

/**
 * Reject: ask the student to upload again, with the reason.
 *
 * @param WC_Order $order  Order.
 * @param string   $reason Shown to the student.
 */
function nab_reject_receipt( $order, $reason ) {
	if ( function_exists( 'nab_notify' ) ) {
		nab_notify( $order->get_customer_id(), 'receipt_rejected', __( 'We couldn’t confirm your payment', 'nab-core' ), $reason, $order->get_view_order_url() );
	}
	$order->update_meta_data( '_nab_receipt_status', 'rejected' );
	$order->update_meta_data( '_nab_receipt_reject_reason', $reason );
	$order->update_meta_data( '_nab_receipt_reviewed_by', get_current_user_id() );
	$order->update_meta_data( '_nab_receipt_reviewed_at', time() );
	$order->save();
	$order->update_status( 'pending', sprintf( 'Bank transfer receipt rejected: %s', $reason ) );
	nab_send_email(
		$order->get_billing_email(),
		__( 'We couldn’t confirm your payment', 'nab-core' ),
		sprintf(
			'<p>%s</p><p><strong>%s</strong> %s</p><p><a href="%s">%s</a></p>',
			/* translators: %d: order number. */
			esc_html( sprintf( __( 'We reviewed the receipt you uploaded for order #%d but couldn’t confirm the payment.', 'nab-core' ), $order->get_id() ) ),
			esc_html__( 'Reason:', 'nab-core' ),
			esc_html( $reason ),
			esc_url( $order->get_view_order_url() ),
			esc_html__( 'Upload a new receipt', 'nab-core' )
		)
	);
}

/**
 * Approve / reject form posts from the order screen.
 */
function nab_handle_receipt_review() {
	$order_id = isset( $_POST['order_id'] ) ? absint( $_POST['order_id'] ) : 0;
	check_admin_referer( 'nab_review_receipt_' . $order_id );
	if ( ! current_user_can( 'nab_manage_payments' ) ) {
		wp_die( '', 403 );
	}
	$order    = wc_get_order( $order_id );
	$decision = isset( $_POST['decision'] ) ? sanitize_key( wp_unslash( $_POST['decision'] ) ) : '';
	if ( $order && 'pending' === $order->get_meta( '_nab_receipt_status' ) ) {
		if ( 'approve' === $decision ) {
			nab_approve_receipt( $order );
		} elseif ( 'reject' === $decision ) {
			$reason = isset( $_POST['reason'] ) ? sanitize_textarea_field( wp_unslash( $_POST['reason'] ) ) : '';
			nab_reject_receipt( $order, $reason ? $reason : __( 'The receipt was unreadable or didn’t match the order amount.', 'nab-core' ) );
		}
	}
	$back = isset( $_POST['_back'] ) ? esc_url_raw( wp_unslash( $_POST['_back'] ) ) : '';
	wp_safe_redirect( $back ? $back : $order->get_edit_order_url() );
	exit;
}
add_action( 'admin_post_nab_review_receipt', 'nab_handle_receipt_review' );

/**
 * Review controls: preview link, details, approve/reject.
 *
 * @param WC_Order $order Order.
 * @param string   $back  Where to return after the decision.
 */
function nab_render_review_controls( $order, $back = '' ) {
	$status = $order->get_meta( '_nab_receipt_status' );
	if ( ! $order->get_meta( '_nab_receipt_file' ) ) {
		echo '<p>' . esc_html__( 'No receipt uploaded yet.', 'nab-core' ) . '</p>';
		return;
	}
	$url = wp_nonce_url( admin_url( 'admin-post.php?action=nab_receipt&order_id=' . $order->get_id() ), 'nab_receipt_' . $order->get_id() );
	printf(
		'<p><a class="button" href="%s" target="_blank" rel="noopener">%s</a></p><p>%s<br>%s</p>',
		esc_url( $url ),
		esc_html__( 'Open receipt', 'nab-core' ),
		/* translators: %s: date. */
		esc_html( sprintf( __( 'Uploaded %s', 'nab-core' ), wp_date( 'M j, Y g:i a', (int) $order->get_meta( '_nab_receipt_uploaded' ) ) ) ),
		esc_html( trim( ( $order->get_meta( '_nab_receipt_reference' ) ? __( 'Ref:', 'nab-core' ) . ' ' . $order->get_meta( '_nab_receipt_reference' ) . ' — ' : '' ) . (string) $order->get_meta( '_nab_receipt_note' ) ) )
	);
	if ( 'pending' !== $status ) {
		/* translators: %s: status. */
		echo '<p><strong>' . esc_html( sprintf( __( 'Status: %s', 'nab-core' ), $status ) ) . '</strong></p>';
		return;
	}
	?>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="nab_review_receipt" />
		<input type="hidden" name="order_id" value="<?php echo esc_attr( $order->get_id() ); ?>" />
		<input type="hidden" name="_back" value="<?php echo esc_attr( $back ); ?>" />
		<?php wp_nonce_field( 'nab_review_receipt_' . $order->get_id() ); ?>
		<p><button class="button button-primary" name="decision" value="approve"><?php esc_html_e( 'Approve and enroll', 'nab-core' ); ?></button></p>
		<p><label><?php esc_html_e( 'Rejection reason (sent to the student)', 'nab-core' ); ?><br><textarea name="reason" rows="2" style="width:100%"></textarea></label></p>
		<p><button class="button" name="decision" value="reject"><?php esc_html_e( 'Reject', 'nab-core' ); ?></button></p>
	</form>
	<?php
}

/**
 * Meta box on the order edit screen (classic and HPOS).
 */
function nab_receipt_meta_box() {
	$screen = class_exists( '\Automattic\WooCommerce\Internal\DataStores\Orders\CustomOrdersTableController' )
		&& function_exists( 'wc_get_page_screen_id' ) ? wc_get_page_screen_id( 'shop-order' ) : 'shop_order';
	add_meta_box(
		'nab-receipt',
		__( 'Bank transfer receipt', 'nab-core' ),
		static function ( $post_or_order ) {
			$order = $post_or_order instanceof WC_Order ? $post_or_order : wc_get_order( $post_or_order->ID );
			if ( $order && 'bacs' === $order->get_payment_method() ) {
				nab_render_review_controls( $order );
			} else {
				echo '<p>' . esc_html__( 'Not a bank transfer order.', 'nab-core' ) . '</p>';
			}
		},
		$screen,
		'side',
		'high'
	);
}
add_action( 'add_meta_boxes', 'nab_receipt_meta_box' );

/**
 * WooCommerce → Receipts to review.
 */
function nab_receipts_menu() {
	$count = count( nab_pending_receipt_orders() );
	add_submenu_page(
		'woocommerce',
		__( 'Receipts to review', 'nab-core' ),
		__( 'Receipts to review', 'nab-core' ) . ( $count ? ' <span class="awaiting-mod">' . (int) $count . '</span>' : '' ),
		'nab_manage_payments',
		'nab-receipts',
		'nab_render_receipts_page'
	);
}
add_action( 'admin_menu', 'nab_receipts_menu', 60 );

/**
 * Orders with an uploaded receipt awaiting review, oldest first.
 *
 * @return WC_Order[]
 */
function nab_pending_receipt_orders() {
	return wc_get_orders(
		array(
			'limit'      => 100,
			'orderby'    => 'date',
			'order'      => 'ASC',
			'meta_key'   => '_nab_receipt_status', // phpcs:ignore WordPress.DB.SlowDBQuery -- admin screen; works on both order stores.
			'meta_value' => 'pending', // phpcs:ignore WordPress.DB.SlowDBQuery
		)
	);
}

/**
 * Review list page.
 */
function nab_render_receipts_page() {
	$back = admin_url( 'admin.php?page=nab-receipts' );
	echo '<div class="wrap"><h1>' . esc_html__( 'Receipts to review', 'nab-core' ) . '</h1>';
	$orders = nab_pending_receipt_orders();
	if ( ! $orders ) {
		echo '<p>' . esc_html__( 'Nothing to review. 🎉', 'nab-core' ) . '</p></div>';
		return;
	}
	echo '<table class="widefat striped"><thead><tr><th>' . esc_html__( 'Order', 'nab-core' ) . '</th><th>' . esc_html__( 'Student', 'nab-core' ) . '</th><th>' . esc_html__( 'Items', 'nab-core' ) . '</th><th>' . esc_html__( 'Amount', 'nab-core' ) . '</th><th>' . esc_html__( 'Receipt', 'nab-core' ) . '</th></tr></thead><tbody>';
	foreach ( $orders as $order ) {
		$items = array_map( static fn( $i ) => $i->get_name(), array_values( $order->get_items( array( 'line_item', 'fee' ) ) ) );
		echo '<tr><td><a href="' . esc_url( $order->get_edit_order_url() ) . '">#' . (int) $order->get_id() . '</a></td>';
		echo '<td>' . esc_html( $order->get_formatted_billing_full_name() ) . '<br><small>' . esc_html( $order->get_billing_email() ) . '</small></td>';
		echo '<td>' . esc_html( implode( ', ', $items ) ) . '</td>';
		echo '<td>' . wp_kses_post( $order->get_formatted_order_total() ) . '</td><td style="min-width:260px">';
		nab_render_review_controls( $order, $back );
		echo '</td></tr>';
	}
	echo '</tbody></table></div>';
}

/**
 * Send a branded HTML email through WooCommerce's mailer.
 *
 * @param string $to      Recipient.
 * @param string $subject Subject.
 * @param string $html    Body HTML (already escaped).
 */
function nab_send_email( $to, $subject, $html ) {
	$mailer = WC()->mailer();
	$mailer->send( $to, $subject, $mailer->wrap_message( $subject, $html ) );
}
