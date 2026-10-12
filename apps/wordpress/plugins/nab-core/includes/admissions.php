<?php
/**
 * Admissions applications (the old sdk.nextaibuilder.com "Agentic AI Engineer"
 * program form): block nab/admissions-form, stored as private posts, listed
 * under Users → Admissions with CSV export. The applicant gets a welcome email
 * and the team gets a notification (Settings → nextaibuilder → Admissions email).
 * Limit: 5 applications per 15 minutes per IP; honeypot for bots.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	static function () {
		register_post_type( 'nab_application', array( 'label' => __( 'Applications', 'nab-core' ), 'public' => false, 'show_ui' => false ) );
		register_block_type(
			'nab/admissions-form',
			array(
				'api_version'     => 3,
				'title'           => __( 'Admissions form', 'nab-core' ),
				'category'        => 'widgets',
				'attributes'      => array( 'tracks' => array( 'type' => 'string', 'default' => '6-month track, 1-year track' ) ),
				'render_callback' => 'nab_render_admissions_form',
				'editor_script'   => 'nab-blocks-editor',
			)
		);
	},
	20
);

/**
 * The form.
 *
 * @param array $atts Block attributes.
 * @return string HTML.
 */
function nab_render_admissions_form( $atts ) {
	$tracks = array_filter( array_map( 'trim', explode( ',', (string) ( $atts['tracks'] ?? '' ) ) ) );
	$flag   = sanitize_key( $_GET['applied'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification
	if ( 'yes' === $flag ) {
		return '<div class="nab-card" style="padding:2rem"><p class="nab-notice nab-notice--success" style="margin:0">' . esc_html__( 'Thanks! Your application is in. We’ve emailed you a confirmation and will be in touch within two working days.', 'nab-core' ) . '</p></div>';
	}
	$html = '<form class="nab-card nab-apply" method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="nab_apply" />' . wp_nonce_field( 'nab_apply', '_wpnonce', true, false );
	if ( in_array( $flag, array( 'error', 'slow' ), true ) ) {
		$html .= '<p class="nab-notice nab-notice--error">' . esc_html( 'slow' === $flag ? __( 'Too many applications from this connection. Please try again in a few minutes.', 'nab-core' ) : __( 'Please fill in your name, a valid email and a phone number.', 'nab-core' ) ) . '</p>';
	}
	$html .= '<label>' . esc_html__( 'Full name', 'nab-core' ) . '<input name="full_name" required maxlength="120" autocomplete="name" /></label>';
	$html .= '<label>' . esc_html__( 'Email', 'nab-core' ) . '<input type="email" name="email" required autocomplete="email" spellcheck="false" placeholder="you@company.com" /></label>';
	$html .= '<label>' . esc_html__( 'Phone', 'nab-core' ) . '<input type="tel" name="phone" required maxlength="30" autocomplete="tel" /></label>';
	if ( $tracks ) {
		$html .= '<label>' . esc_html__( 'Track', 'nab-core' ) . '<select name="track">';
		foreach ( $tracks as $t ) {
			$html .= '<option>' . esc_html( $t ) . '</option>';
		}
		$html .= '</select></label>';
	}
	$html .= '<label>' . esc_html__( 'Anything we should know? (optional)', 'nab-core' ) . '<textarea name="message" rows="3" maxlength="1000" autocomplete="off"></textarea></label>';
	$html .= '<label class="screen-reader-text" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off" /></label>';
	return $html . '<button class="nab-btn">' . esc_html__( 'Apply now', 'nab-core' ) . '</button></form>';
}

$nab_apply = static function () {
	check_admin_referer( 'nab_apply' );
	$back = wp_get_referer() ? remove_query_arg( 'applied', wp_get_referer() ) : home_url( '/' );
	if ( ! empty( $_POST['website'] ) ) { // Honeypot.
		wp_safe_redirect( add_query_arg( 'applied', 'yes', $back ) );
		exit;
	}
	$ip   = 'nab_apply_' . md5( sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ?? '' ) ) );
	$hits = (int) get_transient( $ip );
	if ( $hits >= 5 ) {
		wp_safe_redirect( add_query_arg( 'applied', 'slow', $back ) );
		exit;
	}
	set_transient( $ip, $hits + 1, 15 * MINUTE_IN_SECONDS );
	$name  = sanitize_text_field( wp_unslash( $_POST['full_name'] ?? '' ) );
	$email = sanitize_email( wp_unslash( $_POST['email'] ?? '' ) );
	$phone = sanitize_text_field( wp_unslash( $_POST['phone'] ?? '' ) );
	if ( ! $name || ! is_email( $email ) || ! $phone ) {
		wp_safe_redirect( add_query_arg( 'applied', 'error', $back ) );
		exit;
	}
	$track = sanitize_text_field( wp_unslash( $_POST['track'] ?? '' ) );
	$id    = wp_insert_post( array( 'post_type' => 'nab_application', 'post_status' => 'private', 'post_title' => $name, 'post_content' => sanitize_textarea_field( wp_unslash( $_POST['message'] ?? '' ) ) ) );
	foreach ( array( 'email' => $email, 'phone' => $phone, 'track' => $track, 'source' => $back ) as $k => $v ) {
		update_post_meta( $id, '_nab_' . $k, $v );
	}
	nab_send_email( $email, __( 'We received your application', 'nab-core' ), '<p>' . esc_html( sprintf( /* translators: %s: name. */ __( 'Hi %s, thanks for applying. Our team will review your application and get back to you within two working days.', 'nab-core' ), $name ) ) . '</p>' );
	nab_send_email( (string) get_option( 'nab_admissions_email', get_option( 'admin_email' ) ), sprintf( /* translators: %s: name. */ __( 'New application: %s', 'nab-core' ), $name ), '<p>' . esc_html( "$name · $email · $phone · $track" ) . '</p><p><a href="' . esc_url( admin_url( 'users.php?page=nab-admissions' ) ) . '">' . esc_html__( 'View applications', 'nab-core' ) . '</a></p>' );
	wp_safe_redirect( add_query_arg( 'applied', 'yes', $back ) );
	exit;
};
add_action( 'admin_post_nab_apply', $nab_apply );
add_action( 'admin_post_nopriv_nab_apply', $nab_apply );

add_action(
	'admin_menu',
	static function () {
		add_users_page(
			__( 'Admissions', 'nab-core' ),
			__( 'Admissions', 'nab-core' ),
			'nab_manage_students',
			'nab-admissions',
			static function () {
				$apps = get_posts( array( 'post_type' => 'nab_application', 'post_status' => 'private', 'posts_per_page' => 500 ) );
				echo '<div class="wrap"><h1 class="wp-heading-inline">' . esc_html__( 'Admissions', 'nab-core' ) . '</h1> <a class="page-title-action" href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=nab_apps_csv' ), 'nab_apps_csv' ) ) . '">' . esc_html__( 'Export CSV', 'nab-core' ) . '</a><table class="widefat striped" style="margin-top:1rem"><thead><tr><th>' . esc_html__( 'Date', 'nab-core' ) . '</th><th>' . esc_html__( 'Name', 'nab-core' ) . '</th><th>' . esc_html__( 'Email', 'nab-core' ) . '</th><th>' . esc_html__( 'Phone', 'nab-core' ) . '</th><th>' . esc_html__( 'Track', 'nab-core' ) . '</th><th>' . esc_html__( 'Message', 'nab-core' ) . '</th></tr></thead><tbody>';
				foreach ( $apps as $a ) {
					echo '<tr><td>' . esc_html( get_the_date( 'M j, Y', $a ) ) . '</td><td>' . esc_html( $a->post_title ) . '</td><td>' . esc_html( get_post_meta( $a->ID, '_nab_email', true ) ) . '</td><td>' . esc_html( get_post_meta( $a->ID, '_nab_phone', true ) ) . '</td><td>' . esc_html( get_post_meta( $a->ID, '_nab_track', true ) ) . '</td><td>' . esc_html( wp_trim_words( $a->post_content, 20 ) ) . '</td></tr>';
				}
				echo $apps ? '' : '<tr><td colspan="6">' . esc_html__( 'No applications yet.', 'nab-core' ) . '</td></tr>';
				echo '</tbody></table></div>';
			}
		);
	}
);

add_action(
	'admin_post_nab_apps_csv',
	static function () {
		check_admin_referer( 'nab_apps_csv' );
		if ( ! current_user_can( 'nab_manage_students' ) ) {
			wp_die( '', 403 );
		}
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="applications-' . gmdate( 'Y-m-d' ) . '.csv"' );
		$out = fopen( 'php://output', 'w' ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		fputcsv( $out, array( 'Date', 'Name', 'Email', 'Phone', 'Track', 'Message', 'Source' ) );
		foreach ( get_posts( array( 'post_type' => 'nab_application', 'post_status' => 'private', 'posts_per_page' => -1 ) ) as $a ) {
			fputcsv( $out, array( $a->post_date, $a->post_title, get_post_meta( $a->ID, '_nab_email', true ), get_post_meta( $a->ID, '_nab_phone', true ), get_post_meta( $a->ID, '_nab_track', true ), $a->post_content, get_post_meta( $a->ID, '_nab_source', true ) ) );
		}
		fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		exit;
	}
);

add_action(
	'admin_init',
	static function () {
		register_setting( 'nab_sign_in', 'nab_admissions_email', array( 'type' => 'string', 'sanitize_callback' => 'sanitize_email' ) );
		add_settings_section( 'nab_admissions', __( 'Admissions', 'nab-core' ), '__return_false', 'nab-sign-in' );
		add_settings_field( 'nab_admissions_email', __( 'Send new applications to', 'nab-core' ), static fn() => printf( '<input type="email" class="regular-text" name="nab_admissions_email" value="%s" placeholder="%s" />', esc_attr( (string) get_option( 'nab_admissions_email', '' ) ), esc_attr( (string) get_option( 'admin_email' ) ) ), 'nab-sign-in', 'nab_admissions' );
	}
);
