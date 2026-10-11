<?php
/**
 * Account extras:
 * - Self-serve account deletion (students only; staff are removed by an admin).
 *   The student types DELETE MY ACCOUNT; WordPress's personal data erasers run
 *   (WooCommerce anonymises orders it must keep), then the user is deleted.
 * - Google Analytics 4: Settings → nextaibuilder → Measurement ID. Not loaded
 *   for signed-in staff.
 * - Web app manifest so the site can be installed to a phone's home screen.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

const NAB_DELETE_PHRASE = 'DELETE MY ACCOUNT';

/**
 * Whether this user may delete their own account.
 *
 * @param int $user_id User.
 * @return bool
 */
function nab_can_self_delete( $user_id ) {
	$user = get_userdata( $user_id );
	if ( ! $user || $user->has_cap( 'edit_posts' ) ) {
		return false;
	}
	foreach ( nab_caps() as $cap ) {
		if ( $user->has_cap( $cap ) ) {
			return false;
		}
	}
	return true;
}

/**
 * Delete-account card (shown under email preferences on /notifications/).
 *
 * @return string HTML.
 */
function nab_render_delete_account() {
	$uid = get_current_user_id();
	if ( ! nab_can_self_delete( $uid ) ) {
		return '';
	}
	$err  = 'phrase' === sanitize_key( $_GET['nab_delete'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification
	$html = '<section id="delete-account" class="nab-card nab-danger" style="padding:1.75rem;margin-top:1.5rem"><h2 style="font-size:1.375rem;font-weight:400;margin:0 0 .25rem">' . esc_html__( 'Delete your account', 'nab-core' ) . '</h2>';
	$html .= '<p style="margin:0 0 1rem;color:var(--muted);font-size:.9375rem">' . esc_html__( 'This removes your profile, course progress, setup screenshots, certificates and notifications. You’ll lose access to every course. Order records are kept without your personal details where the law requires. This can’t be undone.', 'nab-core' ) . '</p>';
	$html .= $err ? '<p class="nab-notice nab-notice--error">' . esc_html( sprintf( /* translators: %s: phrase. */ __( 'Type %s exactly to confirm.', 'nab-core' ), NAB_DELETE_PHRASE ) ) . '</p>' : '';
	$html .= '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" data-confirm="' . esc_attr__( 'Delete your account and all your progress now? This can’t be undone.', 'nab-core' ) . '"><input type="hidden" name="action" value="nab_delete_account" />' . wp_nonce_field( 'nab_delete_account', '_wpnonce', true, false );
	$html .= '<label style="display:block;margin-bottom:.75rem">' . esc_html( sprintf( /* translators: %s: phrase. */ __( 'Type %s to confirm', 'nab-core' ), NAB_DELETE_PHRASE ) ) . '<input name="confirm" autocomplete="off" style="display:block;width:100%;max-width:320px;margin-top:.375rem" /></label>';
	return $html . '<button class="nab-btn nab-btn--danger">' . esc_html__( 'Delete my account', 'nab-core' ) . '</button></form></section>';
}

/**
 * Erase personal data and delete the user.
 *
 * @param int $user_id User.
 * @return bool
 */
function nab_delete_account( $user_id ) {
	$user = get_userdata( $user_id );
	if ( ! $user || ! nab_can_self_delete( $user_id ) ) {
		return false;
	}
	foreach ( (array) apply_filters( 'wp_privacy_personal_data_erasers', array() ) as $eraser ) {
		if ( empty( $eraser['callback'] ) || ! is_callable( $eraser['callback'] ) ) {
			continue;
		}
		for ( $page = 1; $page <= 50; $page++ ) {
			$res = call_user_func( $eraser['callback'], $user->user_email, $page );
			if ( ! is_array( $res ) || ! empty( $res['done'] ) ) {
				break;
			}
		}
	}
	// Setup screenshots live outside the media library.
	foreach ( get_posts( array( 'post_type' => 'nab_submission', 'post_status' => 'any', 'author' => $user_id, 'posts_per_page' => -1, 'fields' => 'ids' ) ) as $sid ) {
		$file = function_exists( 'nab_step_uploads_dir' ) ? nab_step_uploads_dir() . basename( (string) get_post_meta( $sid, '_nab_file', true ) ) : '';
		if ( $file && is_file( $file ) ) {
			wp_delete_file( $file );
		}
		wp_delete_post( $sid, true );
	}
	nab_log( 'A student deleted their account', array( 'student_id' => $user_id ) );
	require_once ABSPATH . 'wp-admin/includes/user.php';
	return wp_delete_user( $user_id );
}

add_action(
	'admin_post_nab_delete_account',
	static function () {
		check_admin_referer( 'nab_delete_account' );
		$uid = get_current_user_id();
		if ( NAB_DELETE_PHRASE !== trim( sanitize_text_field( wp_unslash( $_POST['confirm'] ?? '' ) ) ) ) {
			wp_safe_redirect( add_query_arg( 'nab_delete', 'phrase', home_url( '/notifications/#delete-account' ) ) );
			exit;
		}
		if ( ! nab_can_self_delete( $uid ) ) {
			wp_die( esc_html__( 'Staff accounts are removed by an administrator.', 'nab-core' ), 403 );
		}
		$email = get_userdata( $uid )->user_email;
		wp_logout();
		nab_delete_account( $uid );
		nab_send_email( $email, __( 'Your account has been deleted', 'nab-core' ), '<p>' . esc_html__( 'Your nextaibuilder account and personal data have been deleted. If this wasn’t you, reply to this email.', 'nab-core' ) . '</p>' );
		wp_safe_redirect( home_url( '/?account=deleted' ) );
		exit;
	}
);

/* ---------------- Google Analytics 4 ---------------- */

add_action(
	'admin_init',
	static function () {
		register_setting( 'nab_sign_in', 'nab_ga4_id', array( 'type' => 'string', 'sanitize_callback' => static fn( $v ) => preg_match( '/^G-[A-Z0-9]{4,15}$/', strtoupper( trim( (string) $v ) ) ) ? strtoupper( trim( (string) $v ) ) : '' ) );
		add_settings_section( 'nab_analytics', __( 'Analytics', 'nab-core' ), '__return_false', 'nab-sign-in' );
		add_settings_field( 'nab_ga4_id', __( 'Google Analytics 4 measurement ID', 'nab-core' ), static fn() => printf( '<input class="regular-text" name="nab_ga4_id" value="%s" placeholder="G-XXXXXXXXXX" /><p class="description">%s</p>', esc_attr( (string) get_option( 'nab_ga4_id', '' ) ), esc_html__( 'Leave empty to turn analytics off. Staff visits are not tracked.', 'nab-core' ) ), 'nab-sign-in', 'nab_analytics' );
	}
);

add_action(
	'wp_head',
	static function () {
		$id = (string) get_option( 'nab_ga4_id', '' );
		if ( ! $id || current_user_can( 'edit_posts' ) ) {
			return;
		}
		printf( "<script async src=\"https://www.googletagmanager.com/gtag/js?id=%1\$s\"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','%1\$s');</script>\n", esc_attr( $id ) );
	},
	1
);

/* ---------------- Web app manifest ---------------- */

add_action(
	'parse_request',
	static function ( $wp ) {
		if ( 'manifest.webmanifest' !== $wp->request ) {
			return;
		}
		$img = get_theme_file_uri( 'assets/images/' );
		header( 'Content-Type: application/manifest+json; charset=utf-8' );
		header( 'Cache-Control: public, max-age=86400' );
		echo wp_json_encode(
			array(
				'name'             => 'nextaibuilder',
				'short_name'       => 'nextaibuilder',
				'description'      => get_bloginfo( 'description' ),
				'start_url'        => '/dashboard/?source=pwa',
				'scope'            => '/',
				'display'          => 'standalone',
				'background_color' => '#ffffff',
				'theme_color'      => '#14213d',
				'icons'            => array(
					array( 'src' => $img . 'icon-192.png', 'sizes' => '192x192', 'type' => 'image/png' ),
					array( 'src' => $img . 'icon-512.png', 'sizes' => '512x512', 'type' => 'image/png' ),
				),
			),
			JSON_UNESCAPED_SLASHES
		);
		exit;
	},
	0
);

add_action(
	'wp_head',
	static function () {
		echo '<link rel="manifest" href="' . esc_url( home_url( '/manifest.webmanifest' ) ) . '" />' . "\n";
	},
	2
);
