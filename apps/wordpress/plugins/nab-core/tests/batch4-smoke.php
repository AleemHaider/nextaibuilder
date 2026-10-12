<?php
/**
 * Batch 4 (account, analytics, app manifest, instructor links, setup done) smoke test:
 *   wp eval-file wp-content/plugins/nab-core/tests/batch4-smoke.php
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
$tag    = wp_generate_password( 5, false, false );
$course = get_page_by_path( 'build-production-ready-ai-agents-recorded', OBJECT, 'courses' )->ID;
$head   = static function () {
	ob_start();
	do_action( 'wp_head' );
	return ob_get_clean();
};

// Self-serve delete.
$student = wp_insert_user( array( 'user_login' => 'b4_' . $tag, 'user_pass' => wp_generate_password(), 'user_email' => "b4+$tag@example.test", 'role' => 'customer' ) );
$enroll  = tutor_utils()->do_enroll( $course, 0, $student );
tutor_utils()->course_enrol_status_change( $enroll, 'completed' );
nab_notify( $student, 'info', 'Hello', '', '' );
$sub = wp_insert_post( array( 'post_type' => 'nab_submission', 'post_status' => 'private', 'post_author' => $student, 'post_title' => 's' ) );
wp_set_current_user( $student );
$ok( str_contains( nab_render_delete_account(), NAB_DELETE_PHRASE ), 'students see the delete-account card' );
wp_set_current_user( 1 );
$ok( '' === nab_render_delete_account() && ! nab_delete_account( 1 ), 'staff cannot self-delete' );
$ok( nab_delete_account( $student ) && ! get_userdata( $student ), 'student account deleted' );
$ok( ! get_post( $sub ), 'setup screenshots removed' );
$ok( ! $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_author = %d", $student ) ), 'enrollments removed' );

// GA4.
update_option( 'nab_ga4_id', 'G-TEST12345' );
wp_set_current_user( 0 );
$ok( str_contains( $head(), 'gtag/js?id=G-TEST12345' ), 'GA4 tag for visitors' );
wp_set_current_user( 1 );
$ok( ! str_contains( $head(), 'gtag/js' ), 'no GA4 tag for staff' );
delete_option( 'nab_ga4_id' );
wp_set_current_user( 0 );
$ok( ! str_contains( $head(), 'gtag/js' ), 'no GA4 tag when the ID is empty' );
$ok( str_contains( $head(), 'rel="manifest"' ), 'manifest linked' );
$res = wp_remote_get( 'http://localhost/manifest.webmanifest' );
$man = json_decode( wp_remote_retrieve_body( $res ), true );
$ok( is_wp_error( $res ) || ( 'standalone' === ( $man['display'] ?? '' ) && 2 === count( $man['icons'] ?? array() ) ), 'manifest served (skipped if the container can’t reach itself)' );
$ok( is_file( get_theme_file_path( 'assets/images/icon-512.png' ) ), '512px app icon exists' );

// Instructor links.
$author = get_user_by( 'login', 'aleem' );
if ( $author ) {
	$prev_bio = get_user_meta( $author->ID, '_tutor_profile_bio', true );
	$prev_li  = get_user_meta( $author->ID, '_tutor_profile_linkedin', true );
	update_user_meta( $author->ID, '_tutor_profile_bio', $prev_bio ? $prev_bio : 'Bio' );
	update_user_meta( $author->ID, '_tutor_profile_linkedin', 'https://www.linkedin.com/in/example' );
	$ok( str_contains( nab_render_instructor_block(), 'linkedin.com/in/example' ), 'instructor LinkedIn link shown' );
	update_user_meta( $author->ID, '_tutor_profile_linkedin', 'javascript:alert(1)' );
	$ok( ! str_contains( nab_render_instructor_block(), 'javascript:' ), 'unsafe links dropped' );
	update_user_meta( $author->ID, '_tutor_profile_linkedin', $prev_li );
	update_user_meta( $author->ID, '_tutor_profile_bio', $prev_bio );
} else {
	$ok( true, 'instructor links (no aleem user, skipped)' );
}

// Setup complete card.
$s2 = wp_insert_user( array( 'user_login' => 'b4s_' . $tag, 'user_pass' => wp_generate_password(), 'user_email' => "b4s+$tag@example.test", 'role' => 'customer' ) );
$e2 = tutor_utils()->do_enroll( $course, 0, $s2 );
tutor_utils()->course_enrol_status_change( $e2, 'completed' );
foreach ( nab_get_steps() as $s ) {
	nab_set_step_status( $s2, $s->ID, 'complete' );
}
wp_set_current_user( $s2 );
$html = nab_render_setup_steps();
$ok( str_contains( $html, 'You’re all set up' ) && str_contains( $html, 'Next up:' ), 'setup done card points to the next lesson' );
wp_set_current_user( 0 );
require_once ABSPATH . 'wp-admin/includes/user.php';
wp_delete_user( $s2 );

WP_CLI::log( $nab_fail ? "$nab_fail FAILED" : 'ALL PASSED' );
