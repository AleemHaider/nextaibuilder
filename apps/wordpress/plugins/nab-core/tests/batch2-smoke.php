<?php
/**
 * Batch 2 (automation) smoke test:
 *   wp eval-file wp-content/plugins/nab-core/tests/batch2-smoke.php
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

$nab_fail = 0;
$ok       = static function ( $cond, $label ) use ( &$nab_fail ) {
	WP_CLI::log( ( $cond ? 'PASS ' : 'FAIL ' ) . $label );
	$nab_fail += $cond ? 0 : 1;
};
global $wpdb;
$mails = static fn( $subject_like ) => (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'nab_email_log' AND post_title LIKE %s", '%' . $wpdb->esc_like( $subject_like ) . '%' ) );

$course = get_page_by_path( 'build-production-ready-ai-agents-recorded', OBJECT, 'courses' )->ID;
$user   = wp_insert_user( array( 'user_login' => 'b2_' . wp_generate_password( 5, false ), 'user_pass' => wp_generate_password(), 'user_email' => 'b2+' . time() . '@example.test', 'first_name' => 'Cee', 'role' => 'customer' ) );
$enroll = tutor_utils()->do_enroll( $course, 0, $user );
tutor_utils()->course_enrol_status_change( $enroll, 'completed' );
// Pretend they enrolled 8 days ago with no activity.
$wpdb->update( $wpdb->posts, array( 'post_date_gmt' => gmdate( 'Y-m-d H:i:s', time() - 8 * DAY_IN_SECONDS ) ), array( 'ID' => $enroll ) );
clean_post_cache( $enroll );
$wpdb->update( $wpdb->users, array( 'user_registered' => gmdate( 'Y-m-d H:i:s', time() - 8 * DAY_IN_SECONDS ) ), array( 'ID' => $user ) );
clean_user_cache( $user );

$before_nudge = $mails( 'Still with us' );
$before_setup = $mails( 'setup' );
nab_daily();
$ok( $mails( 'Still with us' ) === $before_nudge + 1, 're-engagement nudge sent after 7+ quiet days' );
$ok( 2 === (int) get_post_meta( $enroll, '_nab_nudge_level', true ), 'nudge level recorded' );
$ok( $mails( 'setup' ) > $before_setup, 'setup reminder sent for unfinished steps' );
nab_daily();
$ok( $mails( 'Still with us' ) === $before_nudge + 1, 'no duplicate nudge on the next day' );

// Preferences: opted-out students are skipped.
update_user_meta( $user, '_nab_prefs', array( 'progress_updates' => false, 'setup_reminders' => false ) );
delete_post_meta( $enroll, '_nab_nudge_level' );
delete_user_meta( $user, '_nab_setup_nudge' );
$n = $mails( 'Still with us' );
nab_daily();
$ok( $mails( 'Still with us' ) === $n, 'opted-out student gets no nudge' );
$ok( ! nab_wants( $user, 'setup_reminders' ) && nab_wants( $user, 'tips' ), 'preferences default on, honour opt-outs' );

// Installment reminder 3 days ahead.
$order = wc_create_order( array( 'customer_id' => $user ) );
$order->set_billing_email( get_userdata( $user )->user_email );
$iid  = $order->add_product( wc_get_product( (int) get_post_meta( $course, '_tutor_course_product_id', true ) ), 1, array( 'subtotal' => 67, 'total' => 67 ) );
$item = $order->get_item( $iid );
$item->add_meta_data( '_nab_plan', 'installments', true );
$item->add_meta_data( '_nab_installments', 3, true );
$item->add_meta_data( '_nab_full_price', 200, true );
$item->save();
$order->save();
as_schedule_single_action( time() + 2 * DAY_IN_SECONDS, 'nab_charge_installment', array( $order->get_id(), 2 ), 'nab-installments' );
$r = $mails( 'is due soon' );
nab_daily();
$ok( $mails( 'is due soon' ) === $r + 1, 'installment reminder sent 3 days ahead' );
nab_daily();
$ok( $mails( 'is due soon' ) === $r + 1, 'installment reminder sent only once' );
as_unschedule_all_actions( 'nab_charge_installment', array( $order->get_id(), 2 ), 'nab-installments' );
$order->delete( true );

$ok( 3 === NAB_INSTALLMENT_GRACE_DAYS, 'grace period is 72 hours' );
$ok( $mails( '' ) > 0, 'emails are logged' );

require_once ABSPATH . 'wp-admin/includes/user.php';
wp_delete_user( $user );
$nab_fail ? WP_CLI::error( "$nab_fail check(s) failed." ) : WP_CLI::success( 'All batch 2 checks passed.' );
