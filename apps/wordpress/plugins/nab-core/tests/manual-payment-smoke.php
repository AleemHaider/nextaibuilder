<?php
/**
 * Bank transfer review smoke test (no browser):
 *   wp eval-file wp-content/plugins/nab-core/tests/manual-payment-smoke.php
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

$nab_fail = 0;
$nab_ok   = static function ( $cond, $label ) use ( &$nab_fail ) {
	WP_CLI::log( ( $cond ? 'PASS ' : 'FAIL ' ) . $label );
	$nab_fail += $cond ? 0 : 1;
};
$nab_enrollment_status = static function ( $order_id ) {
	global $wpdb;
	$rows = (array) tutor_utils()->get_course_enrolled_ids_by_order_id( $order_id );
	return $rows ? (string) $wpdb->get_var( $wpdb->prepare( "SELECT post_status FROM {$wpdb->posts} WHERE ID = %d", (int) $rows[0]['enrolled_id'] ) ) : 'none';
};
wp_set_current_user( 1 );

$course_id = get_page_by_path( 'build-production-ready-ai-agents-live', OBJECT, 'courses' )->ID;
$product   = wc_get_product( (int) get_post_meta( $course_id, '_tutor_course_product_id', true ) );
$user_id   = wp_insert_user(
	array(
		'user_login' => 'nab_bank_' . wp_generate_password( 6, false ),
		'user_pass'  => wp_generate_password(),
		'user_email' => 'bank+' . time() . '@example.test',
		'role'       => 'customer',
	)
);
$order = wc_create_order( array( 'customer_id' => $user_id ) );
$order->add_product( $product, 1 );
$order->set_billing_email( get_userdata( $user_id )->user_email );
$order->set_payment_method( 'bacs' );
$order->calculate_totals( false );
$order->save();
$order->update_status( 'on-hold' );

$nab_ok( nab_order_accepts_receipt( wc_get_order( $order->get_id() ) ), 'on-hold bank order accepts a receipt' );
$nab_ok( 'completed' !== $nab_enrollment_status( $order->get_id() ), 'no access before payment is confirmed' );

// Simulate an upload (the browser path was tested by hand).
$order = wc_get_order( $order->get_id() );
$order->update_meta_data( '_nab_receipt_file', 'order-test.png' );
$order->update_meta_data( '_nab_receipt_status', 'pending' );
$order->save();
$nab_ok( in_array( $order->get_id(), array_map( static fn( $o ) => $o->get_id(), nab_pending_receipt_orders() ), true ), 'appears in Receipts to review' );
$nab_ok( ! nab_order_accepts_receipt( $order ), 'no second upload while one is pending' );

nab_reject_receipt( $order, 'Amount does not match' );
$order = wc_get_order( $order->get_id() );
$nab_ok( 'pending' === $order->get_status() && 'rejected' === $order->get_meta( '_nab_receipt_status' ), 'reject → order pending, receipt rejected' );
$nab_ok( 'Amount does not match' === $order->get_meta( '_nab_receipt_reject_reason' ), 'reject reason stored for the student' );
$nab_ok( nab_order_accepts_receipt( $order ), 'student can upload again after rejection' );
$nab_ok( 'completed' !== $nab_enrollment_status( $order->get_id() ), 'still no access after rejection' );

$order->update_meta_data( '_nab_receipt_status', 'pending' );
$order->save();
nab_approve_receipt( $order );
$order = wc_get_order( $order->get_id() );
$nab_ok( 'completed' === $order->get_status(), 'approve → order completed' );
$nab_ok( 'completed' === $nab_enrollment_status( $order->get_id() ), 'approve → enrollment active' );
$nab_ok( ! in_array( $order->get_id(), array_map( static fn( $o ) => $o->get_id(), nab_pending_receipt_orders() ), true ), 'removed from Receipts to review' );

$order->delete( true );
require_once ABSPATH . 'wp-admin/includes/user.php';
wp_delete_user( $user_id );
$nab_fail ? WP_CLI::error( "$nab_fail check(s) failed." ) : WP_CLI::success( 'All bank transfer checks passed.' );
