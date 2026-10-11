<?php
/**
 * Setup steps smoke test (no API key needed: submissions go to human review):
 *   wp eval-file wp-content/plugins/nab-core/tests/setup-steps-smoke.php
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

$nab_fail = 0;
$nab_ok   = static function ( $cond, $label ) use ( &$nab_fail ) {
	WP_CLI::log( ( $cond ? 'PASS ' : 'FAIL ' ) . $label );
	$nab_fail += $cond ? 0 : 1;
};

$steps = nab_get_steps();
$nab_ok( count( $steps ) >= 2, 'at least two setup steps exist' );
$user_id = wp_insert_user(
	array(
		'user_login' => 'nab_steps_' . wp_generate_password( 6, false ),
		'user_pass'  => wp_generate_password(),
		'user_email' => 'steps+' . time() . '@example.test',
		'role'       => 'subscriber',
	)
);
$nab_ok( ! nab_user_can_do_steps( $user_id ), 'not enrolled → no setup steps' );

// Enroll via Tutor directly.
$course_id = get_page_by_path( 'build-production-ready-ai-agents-recorded', OBJECT, 'courses' )->ID;
$enroll_id = tutor_utils()->do_enroll( $course_id, 0, $user_id );
tutor_utils()->course_enrol_status_change( $enroll_id, 'completed' );
$nab_ok( nab_user_can_do_steps( $user_id ), 'enrolled → setup steps available' );

$progress = nab_step_progress( $user_id );
$first    = $steps[0]->ID;
$second   = $steps[1]->ID;
$nab_ok( 'in_progress' === $progress[ $first ]['status'], 'step 1 open' );
$nab_ok( 'locked' === $progress[ $second ]['status'], 'step 2 locked' );

// Simulate a screenshot submission for step 1 (upload path is HTTP-only).
$make = static function ( $step_id ) use ( $user_id ) {
	$sid = wp_insert_post( array( 'post_type' => 'nab_submission', 'post_status' => 'private', 'post_author' => $user_id, 'post_parent' => $step_id, 'post_title' => 'test' ) );
	update_post_meta( $sid, '_nab_file', 'none.png' );
	update_post_meta( $sid, '_nab_mime', 'image/png' );
	update_post_meta( $sid, '_nab_status', 'pending' );
	nab_set_step_status( $user_id, $step_id, 'pending_review' );
	return $sid;
};
$sid = $make( $first );
$saved_key = getenv( 'ANTHROPIC_API_KEY' );
putenv( 'ANTHROPIC_API_KEY=' );
nab_validate_submission( $sid );
$nab_ok( 'human_review' === get_post_meta( $sid, '_nab_status', true ), 'no API key → human review' );
$nab_ok( in_array( $sid, wp_list_pluck( nab_submissions_needing_review(), 'ID' ), true ), 'shows in admin review queue' );
$nab_ok( 'pending_review' === nab_step_progress( $user_id )[ $first ]['status'], 'step 1 shows "checking"' );

// Admin rejects → student can retry, step 2 still locked.
wp_set_current_user( 1 );
nab_decide_submission( $sid, 'rejected', 'Terminal not visible', 'admin' );
$p = nab_step_progress( $user_id );
$nab_ok( 'override_fail' === $p[ $first ]['status'] && 'locked' === $p[ $second ]['status'], 'reject → retry allowed, next still locked' );
$nab_ok( 2 === (int) $p[ $first ]['attempts'] || 1 === (int) $p[ $first ]['attempts'], 'attempt counted' );

// Retry and approve → step 2 unlocks, first badge.
$sid2 = $make( $first );
nab_decide_submission( $sid2, 'approved', '', 'admin' );
$p = nab_step_progress( $user_id );
$nab_ok( nab_step_status_is_done( $p[ $first ]['status'] ) && 'in_progress' === $p[ $second ]['status'], 'approve → step 2 unlocks' );
$nab_ok( isset( ( (array) get_user_meta( $user_id, '_nab_badges', true ) )['first-step'] ), '"First Step" badge awarded' );
$nab_ok( ! get_user_meta( $user_id, '_nab_certificate', true ), 'no certificate yet' );

// Complete the rest with the AI path decision → certificate.
foreach ( array_slice( $steps, 1 ) as $step ) {
	nab_decide_submission( $make( $step->ID ), 'approved', 'Looks good', 'ai' );
}
$badges = (array) get_user_meta( $user_id, '_nab_badges', true );
$nab_ok( isset( $badges['halfway'], $badges['setup-complete'] ), 'all badges awarded' );
$cert = get_user_meta( $user_id, '_nab_certificate', true );
$nab_ok( is_array( $cert ) && 20 === strlen( $cert['token'] ), 'certificate issued' );
// The public /verify/<token>/ page is checked over HTTP from the host (the CLI container can't reach the site).

// Clean up.
putenv( 'ANTHROPIC_API_KEY=' . $saved_key );
foreach ( get_posts( array( 'post_type' => 'nab_submission', 'post_status' => 'any', 'author' => $user_id, 'posts_per_page' => -1, 'fields' => 'ids' ) ) as $id ) {
	wp_delete_post( $id, true );
}
require_once ABSPATH . 'wp-admin/includes/user.php';
wp_delete_user( $user_id );
$nab_fail ? WP_CLI::error( "$nab_fail check(s) failed." ) : WP_CLI::success( 'All setup step checks passed.' );
