<?php
/**
 * Batch 3 (admin) smoke test:
 *   wp eval-file wp-content/plugins/nab-core/tests/batch3-smoke.php
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

// Run an admin-post handler; its redirect is turned into an exception so exit never runs.
$post = static function ( $action, $fields, $nonce_action ) {
	$_POST    = $fields + array( 'action' => $action, '_wpnonce' => wp_create_nonce( $nonce_action ) );
	$_REQUEST = $_POST;
	$to       = '';
	$stop     = static function ( $loc ) {
		throw new RuntimeException( $loc ); // phpcs:ignore WordPress.Security.EscapeOutput
	};
	add_filter( 'wp_redirect', $stop, -999 );
	try {
		do_action( ( is_user_logged_in() ? 'admin_post_' : 'admin_post_nopriv_' ) . $action );
	} catch ( RuntimeException $e ) {
		$to = $e->getMessage();
	}
	remove_filter( 'wp_redirect', $stop, -999 );
	$_POST    = array();
	$_REQUEST = array();
	return $to;
};
$enroll_status = static fn( $course, $uid ) => $wpdb->get_var( $wpdb->prepare( "SELECT post_status FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_parent = %d AND post_author = %d", $course, $uid ) );

$courses = nab_query_course_ids();
$course  = get_page_by_path( 'build-production-ready-ai-agents-recorded', OBJECT, 'courses' )->ID;
$other   = (int) current( array_diff( $courses, array( $course ) ) );
$tag     = wp_generate_password( 5, false, false );

// Roles.
$ok( get_role( 'nab_support' )->has_cap( 'nab_manage_students' ) && ! get_role( 'nab_support' )->has_cap( 'nab_manage_payments' ), 'support role: students yes, payments no' );
$ok( get_role( 'nab_finance' )->has_cap( 'nab_manage_payments' ) && ! get_role( 'nab_finance' )->has_cap( 'nab_review_steps' ), 'finance role: payments yes, step review no' );
$ok( get_role( 'administrator' )->has_cap( 'nab_view_reports' ), 'administrator has all nab caps' );

// Health.
$student = wp_insert_user( array( 'user_login' => 'b3_' . $tag, 'user_pass' => 'Right-pass-' . $tag, 'user_email' => "b3+$tag@example.test", 'first_name' => 'Dee', 'role' => 'customer' ) );
$enroll  = tutor_utils()->do_enroll( $course, 0, $student );
tutor_utils()->course_enrol_status_change( $enroll, 'completed' );
$age = static function ( $days ) use ( $wpdb, $enroll, $student ) {
	$when = gmdate( 'Y-m-d H:i:s', time() - $days * DAY_IN_SECONDS );
	$wpdb->update( $wpdb->posts, array( 'post_date_gmt' => $when ), array( 'ID' => $enroll ) );
	$wpdb->update( $wpdb->users, array( 'user_registered' => $when ), array( 'ID' => $student ) );
	clean_post_cache( $enroll );
	clean_user_cache( $student );
	return nab_student_row( get_userdata( $student ) );
};
$ok( 'on_track' === $age( 1 )['health'], 'new student is on track' );
$ok( 'at_risk' === $age( 8 )['health'], '8 quiet days = at risk' );
$ok( 'blocked' === $age( 15 )['health'], '15 quiet days with setup left = blocked' );
$ok( in_array( $student, wp_list_pluck( nab_students( "b3+$tag" ), 'ID' ), true ), 'search finds the student' );

// Student actions as an administrator.
wp_set_current_user( 1 );
$before = $mails( 'Checking in' );
$to     = $post( 'nab_student_action', array( 'user' => $student, 'op' => 'nudge' ), 'nab_student_' . $student );
$ok( str_contains( $to, 'nudge_sent' ) && $mails( 'Checking in' ) === $before + 1, 'nudge sends an email' );

if ( $other ) {
	$post( 'nab_student_action', array( 'user' => $student, 'op' => 'enroll', 'course' => $other ), 'nab_student_' . $student );
	$ok( 'completed' === $enroll_status( $other, $student ), 'manual enroll into a second course' );
	$wpdb->delete( $wpdb->posts, array( 'post_type' => 'tutor_enrolled', 'post_parent' => $other, 'post_author' => $student ) );
	$post( 'nab_student_action', array( 'user' => $student, 'op' => 'transfer', 'course' => $other ), 'nab_student_' . $student );
	$ok( 'completed' === $enroll_status( $other, $student ) && null === $enroll_status( $course, $student ), 'transfer moves the enrollment' );
	$wpdb->update( $wpdb->posts, array( 'post_parent' => $course ), array( 'ID' => $enroll ) );
	clean_post_cache( $enroll );
}

$lesson = (int) current( nab_course_lesson_ids( $course ) );
update_user_meta( $student, '_tutor_completed_lesson_id_' . $lesson, time() );
update_user_meta( $student, '_nab_steps', array( 1 => 'done' ) );
$post( 'nab_student_action', array( 'user' => $student, 'op' => 'reset' ), 'nab_student_' . $student );
$ok( ! get_user_meta( $student, '_tutor_completed_lesson_id_' . $lesson, true ) && ! get_user_meta( $student, '_nab_steps', true ), 'reset clears lessons and steps' );

// Non-staff are refused.
$plain = wp_insert_user( array( 'user_login' => 'b3p_' . $tag, 'user_pass' => wp_generate_password(), 'user_email' => "b3p+$tag@example.test", 'role' => 'customer' ) );
wp_set_current_user( $plain );
$die = static function () {
	return static function () {
		throw new RuntimeException( 'died' );
	};
};
add_filter( 'wp_die_handler', $die, 999 );
$to = $post( 'nab_student_action', array( 'user' => $student, 'op' => 'nudge' ), 'nab_student_' . $student );
$ok( 'died' === $to, 'customers cannot use student actions' );
remove_filter( 'wp_die_handler', $die, 999 );
wp_set_current_user( 1 );

// Invites.
$before = $mails( 'invited' );
$post( 'nab_invite', array( 'emails' => "Ivy Ng <ivy+$tag@example.test>, junk-address", 'course' => $course ), 'nab_invite' );
$invited = get_user_by( 'email', "ivy+$tag@example.test" );
$ok( $invited && 'Ivy' === $invited->first_name, 'invite creates the account with a name' );
$ok( $invited && 'completed' === $enroll_status( $course, $invited->ID ), 'invite enrolls in the chosen course' );
$magic = $invited ? get_user_meta( $invited->ID, '_nab_magic', true ) : null;
$ok( is_array( $magic ) && $magic['expires'] > time() + 6 * DAY_IN_SECONDS, 'invite sign-in link lasts 7 days' );
$ok( $mails( 'invited' ) === $before + 1, 'one invite email (bad address skipped)' );

// Admissions.
wp_set_current_user( 0 );
$_SERVER['REMOTE_ADDR'] = '203.0.113.' . wp_rand( 1, 250 );
$apps   = static fn() => (int) $wpdb->get_var( "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'nab_application'" );
$before = $apps();
$sent   = $mails( 'New application' );
$to     = $post( 'nab_apply', array( 'full_name' => 'Ana Lee', 'email' => "ana+$tag@example.test", 'phone' => '+1 555 0100', 'track' => '6-month track' ), 'nab_apply' );
$ok( str_contains( $to, 'applied=yes' ) && $apps() === $before + 1, 'application saved' );
$ok( $mails( 'New application' ) === $sent + 1 && $mails( 'received your application' ) > 0, 'team and applicant emailed' );
$to = $post( 'nab_apply', array( 'full_name' => 'Bot', 'email' => "bot+$tag@example.test", 'phone' => '1', 'website' => 'spam.example' ), 'nab_apply' );
$ok( $apps() === $before + 1, 'honeypot submissions are dropped' );
$to = $post( 'nab_apply', array( 'full_name' => 'No Phone', 'email' => "np+$tag@example.test" ), 'nab_apply' );
$ok( str_contains( $to, 'applied=error' ), 'missing phone is rejected' );
for ( $i = 0; $i < 4; $i++ ) {
	$to = $post( 'nab_apply', array( 'full_name' => "R$i", 'email' => "r$i+$tag@example.test", 'phone' => '1' ), 'nab_apply' );
}
$ok( str_contains( $to, 'applied=slow' ), 'sixth application from one IP within 15 minutes is refused' );
$ok( str_contains( nab_render_admissions_form( array( 'tracks' => 'A, B' ) ), '<option>B</option>' ), 'form renders tracks' );

// Lockout.
$login = 'b3_' . $tag;
for ( $i = 0; $i < 5; $i++ ) {
	wp_authenticate( $login, 'wrong' );
}
$ok( is_wp_error( wp_authenticate( $login, 'Right-pass-' . $tag ) ) && 'nab_locked' === wp_authenticate( $login, 'Right-pass-' . $tag )->get_error_code(), '5 failures lock out even the right password' );
delete_transient( nab_lock_key( $login ) );
$ok( wp_authenticate( $login, 'Right-pass-' . $tag ) instanceof WP_User, 'sign-in works once the lock clears' );

// Staff two-factor.
if ( ! defined( 'NAB_FORCE_2FA' ) ) {
	define( 'NAB_FORCE_2FA', true );
}
$ok( nab_requires_2fa( 1 ) && ! nab_requires_2fa( $student ), 'two-factor required for staff, not students' );
$ok( in_array( 'Two_Factor_Email', (array) apply_filters( 'two_factor_enabled_providers_for_user', array(), 1 ), true ), 'email code is enabled for staff' );

// Reports.
$sub = wp_insert_post( array( 'post_type' => 'nab_submission', 'post_status' => 'private', 'post_parent' => (int) current( nab_get_steps() )->ID, 'post_author' => $student, 'post_title' => 'r' ) );
update_post_meta( $sub, '_nab_status', 'approved' );
update_post_meta( $sub, '_nab_ml_passed', 1 );
update_post_meta( $sub, '_nab_reviewed_by', 1 );
wp_set_current_user( 1 );
ob_start();
nab_render_reports();
$html = ob_get_clean();
$ok( str_contains( $html, get_the_title( $course ) ) && str_contains( $html, 'Pass rate' ), 'reports list courses and steps' );
$ok( (bool) preg_match( '/matched the admin’s decision \d+% of the time/', $html ), 'AI vs admin agreement shown' );

// Clean up.
foreach ( array( $student, $plain, $invited ? $invited->ID : 0 ) as $uid ) {
	if ( $uid ) {
		require_once ABSPATH . 'wp-admin/includes/user.php';
		wp_delete_user( $uid );
	}
}
wp_delete_post( $sub, true );
foreach ( get_posts( array( 'post_type' => 'nab_application', 'post_status' => 'private', 'posts_per_page' => -1, 'meta_key' => '_nab_email', 'meta_value' => "ana+$tag@example.test" ) ) as $a ) { // phpcs:ignore WordPress.DB.SlowDBQuery
	wp_delete_post( $a->ID, true );
}
$wpdb->query( "DELETE p FROM {$wpdb->posts} p JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = '_nab_email' WHERE p.post_type = 'nab_application' AND m.meta_value LIKE '%+{$tag}@example.test'" ); // phpcs:ignore WordPress.DB

WP_CLI::log( $nab_fail ? "$nab_fail FAILED" : 'ALL PASSED' );
