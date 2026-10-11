<?php
/**
 * Batch 1 parity features smoke test:
 *   wp eval-file wp-content/plugins/nab-core/tests/batch1-smoke.php
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
$status_of = static fn( $id ) => (string) $wpdb->get_var( $wpdb->prepare( "SELECT post_status FROM {$wpdb->posts} WHERE ID = %d", $id ) );

$course = get_page_by_path( 'build-production-ready-ai-agents-recorded', OBJECT, 'courses' )->ID;
$user   = wp_insert_user( array( 'user_login' => 'b1_' . wp_generate_password( 5, false ), 'user_pass' => wp_generate_password(), 'user_email' => 'b1+' . time() . '@example.test', 'first_name' => 'Bee', 'role' => 'customer' ) );
$enroll = tutor_utils()->do_enroll( $course, 0, $user );
tutor_utils()->course_enrol_status_change( $enroll, 'completed' );

// Lesson gating.
$lessons = nab_course_lesson_ids( $course );
$ok( count( $lessons ) >= 3, 'course has lessons in order' );
$ok( ! nab_lesson_locked( $lessons[0], $user ), 'first lesson open' );
$ok( nab_lesson_locked( $lessons[1], $user ), 'second lesson locked until first is done' );
$ok( false === apply_filters( 'tutor_validate_lesson_complete', true, $user, $lessons[1] ), 'completing out of order is refused' );

// Notifications: enrollment produced one.
$notes = (array) get_user_meta( $user, '_nab_notifications', true );
$ok( $notes && 'enrolled' === $notes[0]['type'], 'enrollment notification created' );
$ok( nab_unread_count( $user ) >= 1, 'unread count works' );

// Complete all lessons → certificate.
foreach ( $lessons as $l ) {
	update_user_meta( $user, '_tutor_completed_lesson_id_' . $l, time() );
}
nab_on_lesson_completed( end( $lessons ), $user ); // Tutor's own handler redirects, so call ours directly.
$certs = (array) get_user_meta( $user, '_nab_course_certificates', true );
$ok( 1 === count( $certs ) && (int) $certs[0]['course_id'] === (int) $course, 'course certificate issued on completion' );
nab_issue_course_certificate( $course, $user );
$ok( 1 === count( (array) get_user_meta( $user, '_nab_course_certificates', true ) ), 'certificate not duplicated' );
$ok( in_array( $certs[0]['token'], get_user_meta( $user, '_nab_certificate_token' ), true ), 'certificate token indexed for /verify/' );

// Live sessions + paid-up gating.
$live    = get_page_by_path( 'build-production-ready-ai-agents-live', OBJECT, 'courses' )->ID;
$session = wp_insert_post( array( 'post_type' => 'nab_session', 'post_status' => 'publish', 'post_title' => 'Test session' ) );
update_post_meta( $session, '_nab_course_id', $live );
update_post_meta( $session, '_nab_starts', wp_date( 'Y-m-d\TH:i', strtotime( '+2 days' ) ) );
update_post_meta( $session, '_nab_zoom_url', 'https://zoom.example/j/123' );
$ok( 1 === count( nab_course_sessions( $live ) ), 'session listed for its course' );
$ok( ! in_array( $live, nab_active_course_ids( $user ), true ), 'not enrolled in live course → no join link access' );
$html_public = nab_render_session_list( nab_course_sessions( $live ), false );
$ok( ! str_contains( $html_public, 'zoom.example' ), 'public schedule hides the join link' );
$ok( str_contains( nab_render_session_list( nab_course_sessions( $live ), true ), 'zoom.example' ), 'enrolled view shows the join link' );
wp_delete_post( $session, true );

// Seats and founding price.
update_post_meta( $live, '_nab_seats', nab_enrolled_count( $live ) + 1 );
$ok( 1 === nab_course_availability( $live )['seats_left'] && ! nab_course_availability( $live )['sold_out'], 'one seat left' );
$seat = tutor_utils()->do_enroll( $live, 0, $user ); // Take the last seat.
$ok( nab_course_availability( $live )['sold_out'], 'sold out at capacity' );
$pid = (int) get_post_meta( $live, '_tutor_course_product_id', true );
$ok( false === apply_filters( 'woocommerce_add_to_cart_validation', true, $pid, 1 ), 'sold-out cohort cannot be added to cart' );
delete_post_meta( $live, '_nab_seats' );
update_post_meta( $live, '_nab_regular_price', 3500 );
update_post_meta( $live, '_nab_founding_seats', nab_enrolled_count( $live ) + 5 );
$ok( 3000.0 === (float) wc_get_product( $pid )->get_price(), 'founding price while founding seats remain' );
update_post_meta( $live, '_nab_founding_seats', nab_enrolled_count( $live ) );
$ok( 3500.0 === (float) wc_get_product( $pid )->get_price(), 'regular price once founding seats are gone' );
$p = wc_get_product( $pid );
$p->set_price( 1000 );
$ok( 1000.0 === (float) $p->get_price(), 'installment price set by cart is not overridden' );
delete_post_meta( $live, '_nab_regular_price' );
delete_post_meta( $live, '_nab_founding_seats' );

// Flash offer cookie.
update_option( 'nab_flash_percent', 25 );
$start               = (string) ( time() - 60 );
$_COOKIE['nab_promo'] = $start . '.' . wp_hash( 'nab_promo' . $start );
$ok( nab_flash_seconds_left() > 7000, 'flash window open for a fresh visitor' );
$_COOKIE['nab_promo'] = $start . '.forged';
$ok( 0 === nab_flash_seconds_left(), 'forged flash cookie ignored' );
update_option( 'nab_flash_percent', 0 );
unset( $_COOKIE['nab_promo'] );

// Calls: rating maths.
$staff = 1;
$call  = wp_insert_post( array( 'post_type' => 'nab_call', 'post_status' => 'private', 'post_author' => $user, 'post_title' => 't' ) );
update_post_meta( $call, '_nab_staff', $staff );
update_post_meta( $call, '_nab_student', $user );
update_post_meta( $call, '_nab_status', 'completed' );
update_post_meta( $call, '_nab_rating', 4 );
update_post_meta( $call, '_nab_review', 'Helpful' );
$r = nab_staff_rating( $staff );
$ok( $r['count'] >= 1 && $r['avg'] > 0, 'instructor rating computed from completed calls' );
wp_delete_post( $call, true );

require_once ABSPATH . 'wp-admin/includes/user.php';
wp_delete_user( $user );
$ok( '' === $status_of( $enroll ), 'deleting the user removes the enrollment' );
$nab_fail ? WP_CLI::error( "$nab_fail check(s) failed." ) : WP_CLI::success( 'All batch 1 checks passed.' );
