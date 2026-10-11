<?php
/**
 * Things carried over from the old platform: imported payment history,
 * redirects from old URLs, and accounts that were deactivated there.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Read-only ledger of payments made on the old platform.
 */
add_action(
	'init',
	static function () {
		register_post_type(
			'nab_legacy_payment',
			array(
				'labels'       => array(
					'name'          => __( 'Imported payments', 'nab-core' ),
					'singular_name' => __( 'Imported payment', 'nab-core' ),
				),
				'public'       => false,
				'show_ui'      => true,
				'show_in_menu' => 'woocommerce',
				'supports'     => array( 'title', 'author' ),
				'capabilities' => array( 'create_posts' => 'do_not_allow' ),
				'map_meta_cap' => true,
			)
		);
	}
);

add_filter(
	'manage_nab_legacy_payment_posts_columns',
	static fn() => array(
		'title'       => __( 'Payment', 'nab-core' ),
		'nab_student' => __( 'Student', 'nab-core' ),
		'nab_course'  => __( 'Course', 'nab-core' ),
		'nab_amount'  => __( 'Amount (as stored)', 'nab-core' ),
		'date'        => __( 'Date', 'nab-core' ),
	)
);

add_action(
	'manage_nab_legacy_payment_posts_custom_column',
	static function ( $column, $post_id ) {
		if ( 'nab_student' === $column ) {
			$user = get_userdata( (int) get_post_field( 'post_author', $post_id ) );
			echo $user ? '<a href="' . esc_url( get_edit_user_link( $user->ID ) ) . '">' . esc_html( $user->display_name ) . '</a>' : '—';
		} elseif ( 'nab_course' === $column ) {
			$course = (int) get_post_meta( $post_id, '_nab_course_id', true );
			echo $course ? esc_html( get_the_title( $course ) ) : '—';
		} elseif ( 'nab_amount' === $column ) {
			echo esc_html( trim( get_post_meta( $post_id, '_nab_amount', true ) . ' ' . strtoupper( (string) get_post_meta( $post_id, '_nab_currency', true ) ) ) );
		}
	},
	10,
	2
);

/**
 * Old URLs → new ones (301).
 */
function nab_old_url_redirects() {
	if ( ! is_404() ) {
		return;
	}
	$path = (string) wp_parse_url( isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '', PHP_URL_PATH );
	$path = untrailingslashit( $path );
	$map  = array(
		'#^/(?:student/dashboard|dashboard|login|signup|student/courses|courses/my)$#' => home_url( '/dashboard/' ),
		'#^/student/(?:badges|milestones|certificate|completion)$#'                      => home_url( '/setup/' ),
		'#^/(?:student/)?steps(?:/.*)?$#'                                                 => home_url( '/setup/' ),
		'#^/(?:privacy|terms)$#'                                                          => home_url( '/' ),
	);
	foreach ( $map as $pattern => $target ) {
		if ( preg_match( $pattern, $path ) ) {
			wp_safe_redirect( $target, 301 );
			exit;
		}
	}
	// /checkout/<slug> and /manual-payment/<slug> → the course page.
	if ( preg_match( '#^/(?:checkout|manual-payment)/([a-z0-9-]+)$#', $path, $m ) ) {
		$course = get_page_by_path( $m[1], OBJECT, 'courses' );
		if ( $course ) {
			wp_safe_redirect( get_permalink( $course ), 301 );
			exit;
		}
	}
}
add_action( 'template_redirect', 'nab_old_url_redirects', 5 );

/**
 * Accounts deactivated on the old platform can't sign in.
 *
 * @param WP_User|WP_Error|null $user Authenticated user.
 * @return WP_User|WP_Error|null
 */
function nab_block_disabled_users( $user ) {
	if ( $user instanceof WP_User && get_user_meta( $user->ID, '_nab_disabled', true ) ) {
		return new WP_Error( 'nab_disabled', __( 'This account has been deactivated. Contact us if you think this is a mistake.', 'nab-core' ) );
	}
	return $user;
}
add_filter( 'authenticate', 'nab_block_disabled_users', 100 );

/**
 * Deleting a user should take their enrollments and step submissions with it;
 * Tutor leaves enrollment rows behind, which inflates course student counts.
 *
 * @param int $user_id User being deleted.
 */
function nab_delete_user_learning_data( $user_id ) {
	$ids = get_posts(
		array(
			'post_type'      => array( 'tutor_enrolled', 'nab_submission' ),
			'post_status'    => 'any',
			'author'         => $user_id,
			'posts_per_page' => -1,
			'fields'         => 'ids',
		)
	);
	foreach ( $ids as $id ) {
		wp_delete_post( $id, true );
	}
}
add_action( 'delete_user', 'nab_delete_user_learning_data' );

/**
 * Local development only: with NAB_MAIL_LOG defined (set in .wp-env.json),
 * write outgoing emails to wp-content/nab-mail.log instead of sending them.
 */
if ( defined( 'NAB_MAIL_LOG' ) && NAB_MAIL_LOG && 'production' !== wp_get_environment_type() ) {
	add_filter(
		'pre_wp_mail',
		static function ( $short, $atts ) {
			$to = is_array( $atts['to'] ) ? implode( ', ', $atts['to'] ) : $atts['to'];
			file_put_contents( WP_CONTENT_DIR . '/nab-mail.log', sprintf( "=== %s\nTo: %s\nSubject: %s\n%s\n\n", gmdate( 'c' ), $to, $atts['subject'], wp_strip_all_tags( preg_replace( '#<a [^>]*href="([^"]+)"[^>]*>#', '[$1] ', $atts['message'] ) ) ), FILE_APPEND ); // phpcs:ignore WordPress.WP.AlternativeFunctions
			return true;
		},
		5,
		2
	);
}
