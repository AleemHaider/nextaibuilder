<?php
/**
 * Admin conveniences: a dashboard overview widget and the welcome email sent
 * when an enrollment becomes active (with the community/Slack link).
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Dashboard widget: what needs attention + enrollments per course.
 */
add_action(
	'wp_dashboard_setup',
	static function () {
		if ( ! current_user_can( 'nab_manage_students' ) && ! current_user_can( 'nab_manage_payments' ) ) {
			return;
		}
		wp_add_dashboard_widget(
			'nab_overview',
			__( 'nextaibuilder overview', 'nab-core' ),
			static function () {
				$receipts = function_exists( 'nab_pending_receipt_orders' ) ? count( nab_pending_receipt_orders() ) : 0;
				$shots    = function_exists( 'nab_submissions_needing_review' ) ? count( nab_submissions_needing_review() ) : 0;
				echo '<ul>';
				printf( '<li><a href="%s">%s</a></li>', esc_url( admin_url( 'admin.php?page=nab-receipts' ) ), esc_html( sprintf( /* translators: %d: count. */ _n( '%d bank transfer receipt to review', '%d bank transfer receipts to review', $receipts, 'nab-core' ), $receipts ) ) );
				printf( '<li><a href="%s">%s</a></li>', esc_url( admin_url( 'edit.php?post_type=nab_step&page=nab-step-reviews' ) ), esc_html( sprintf( /* translators: %d: count. */ _n( '%d setup screenshot to review', '%d setup screenshots to review', $shots, 'nab-core' ), $shots ) ) );
				echo '</ul><table class="widefat striped"><thead><tr><th>' . esc_html__( 'Course', 'nab-core' ) . '</th><th>' . esc_html__( 'Active students', 'nab-core' ) . '</th></tr></thead><tbody>';
				foreach ( nab_query_course_ids() as $id ) { // Include ended cohorts here.
					printf( '<tr><td><a href="%s">%s</a> <small>%s</small></td><td>%d</td></tr>', esc_url( get_permalink( $id ) ), esc_html( get_the_title( $id ) ), esc_html( nab_course_formats()[ nab_course_format( $id ) ] ), count( nab_broadcast_audience( $id ) ) );
				}
				echo '</tbody></table>';
			}
		);
	}
);

/**
 * Welcome email when an enrollment becomes active (once per enrollment).
 *
 * @param int    $enroll_id  Enrollment post.
 * @param string $new_status New status.
 */
function nab_welcome_email( $enroll_id, $new_status ) {
	if ( 'completed' !== $new_status || get_post_meta( $enroll_id, '_nab_welcomed', true ) ) {
		return;
	}
	$enroll = get_post( $enroll_id );
	$user   = $enroll ? get_userdata( (int) $enroll->post_author ) : false;
	if ( ! $user ) {
		return;
	}
	update_post_meta( $enroll_id, '_nab_welcomed', time() );
	$slack = (string) get_option( 'nab_community_url', '' );
	$first = $user->first_name ? $user->first_name : $user->display_name;
	$steps = array(
		sprintf( '<a href="%s">%s</a>', esc_url( home_url( '/setup/' ) ), esc_html__( 'Set up your AI tools', 'nab-core' ) ) . ' — ' . esc_html__( 'guided steps, each checked from a screenshot.', 'nab-core' ),
		sprintf( '<a href="%s">%s</a>', esc_url( tutor_utils()->get_tutor_dashboard_page_permalink( 'enrolled-courses' ) ), esc_html__( 'Open your course', 'nab-core' ) ),
	);
	if ( $slack ) {
		$steps[] = sprintf( '<a href="%s">%s</a>', esc_url( $slack ), esc_html__( 'Join the community on Slack', 'nab-core' ) );
	}
	nab_send_email(
		$user->user_email,
		/* translators: %s: course title. */
		sprintf( __( 'You’re in: %s', 'nab-core' ), get_the_title( $enroll->post_parent ) ),
		/* translators: %s: first name. */
		'<p>' . esc_html( sprintf( __( 'Welcome, %s!', 'nab-core' ), $first ) ) . '</p><p>' . esc_html__( 'Here’s how to get started:', 'nab-core' ) . '</p><ol><li>' . implode( '</li><li>', $steps ) . '</li></ol><p>' . esc_html__( 'You can sign in any time with Google or an email link.', 'nab-core' ) . '</p>'
	);
}
add_action( 'tutor/course/enrol_status_change/after', 'nab_welcome_email', 10, 2 );

/**
 * Community link field on the sign-in settings page.
 */
add_action(
	'admin_init',
	static function () {
		register_setting( 'nab_sign_in', 'nab_community_url', array( 'type' => 'string', 'sanitize_callback' => 'esc_url_raw' ) );
		add_settings_section( 'nab_community', __( 'Community', 'nab-core' ), '__return_false', 'nab-sign-in' );
		add_settings_field(
			'nab_community_url',
			__( 'Slack invite link', 'nab-core' ),
			static fn() => printf( '<input class="regular-text" type="url" name="nab_community_url" value="%s" /><p class="description">%s</p>', esc_attr( (string) get_option( 'nab_community_url', '' ) ), esc_html__( 'Included in the welcome email new students get when their enrollment becomes active.', 'nab-core' ) ),
			'nab-sign-in',
			'nab_community'
		);
	}
);
