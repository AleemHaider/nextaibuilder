<?php
/**
 * Sign-in for students coming from the old platform, which had no passwords
 * (Google/Apple only):
 * - "Continue with Google" (OAuth 2.0; Settings → nextaibuilder sign-in);
 * - "Email me a sign-in link" (single-use, 15 minutes, rate limited);
 * - regular password sign-in.
 * Page: /sign-in/ (block nab/sign-in).
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

const NAB_MAGIC_TTL = 15 * MINUTE_IN_SECONDS;

/**
 * Where to go after signing in (local URLs only).
 *
 * @return string
 */
function nab_signin_redirect() {
	$to = isset( $_REQUEST['redirect_to'] ) ? esc_url_raw( wp_unslash( $_REQUEST['redirect_to'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification -- validated below.
	return wp_validate_redirect( $to, home_url( '/dashboard/' ) );
}

/**
 * Sign-in URL with an optional return path.
 *
 * @param string $redirect Where to land afterwards.
 * @return string
 */
function nab_signin_url( $redirect = '' ) {
	return add_query_arg( $redirect ? array( 'redirect_to' => rawurlencode( $redirect ) ) : array(), home_url( '/sign-in/' ) );
}

/* ---------------- Magic link ---------------- */

/**
 * Email a one-time sign-in link. Same response whether or not the account exists.
 */
function nab_handle_magic_request() {
	check_admin_referer( 'nab_magic' );
	$email    = isset( $_POST['email'] ) ? sanitize_email( wp_unslash( $_POST['email'] ) ) : '';
	$redirect = nab_signin_redirect();
	$back     = add_query_arg( array( 'nab_signin' => 'sent', 'redirect_to' => rawurlencode( $redirect ) ), home_url( '/sign-in/' ) );
	$user     = $email ? get_user_by( 'email', $email ) : false;

	// One link per address per minute, and at most 10 requests per IP per hour.
	$ip_key = 'nab_magic_ip_' . md5( isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : '' );
	$ip_hit = (int) get_transient( $ip_key );
	set_transient( $ip_key, $ip_hit + 1, HOUR_IN_SECONDS );
	if ( $ip_hit >= 10 || ( $email && get_transient( 'nab_magic_' . md5( strtolower( $email ) ) ) ) ) {
		wp_safe_redirect( $back );
		exit;
	}
	if ( $email ) {
		set_transient( 'nab_magic_' . md5( strtolower( $email ) ), 1, MINUTE_IN_SECONDS );
	}

	if ( $user && ! get_user_meta( $user->ID, '_nab_disabled', true ) ) {
		$token = wp_generate_password( 40, false );
		update_user_meta(
			$user->ID,
			'_nab_magic',
			array(
				'hash'     => wp_hash_password( $token ),
				'expires'  => time() + NAB_MAGIC_TTL,
				'redirect' => $redirect,
			)
		);
		$link = add_query_arg( 'nab_magic', $user->ID . '.' . $token, home_url( '/sign-in/' ) );
		nab_send_email(
			$user->user_email,
			__( 'Your nextaibuilder sign-in link', 'nab-core' ),
			sprintf(
				'<p>%s</p><p><a href="%s" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#4a9ad4;color:#0d1a3a;font-weight:700;text-decoration:none">%s</a></p><p style="color:#717182;font-size:13px">%s</p>',
				esc_html__( 'Click the button to sign in. The link works once and expires in 15 minutes.', 'nab-core' ),
				esc_url( $link ),
				esc_html__( 'Sign in to nextaibuilder', 'nab-core' ),
				esc_html__( 'If you didn’t ask for this, you can ignore this email.', 'nab-core' )
			)
		);
	}
	wp_safe_redirect( $back );
	exit;
}
add_action( 'admin_post_nopriv_nab_magic', 'nab_handle_magic_request' );
add_action( 'admin_post_nab_magic', 'nab_handle_magic_request' );

/**
 * Consume a magic link: ?nab_magic=<user_id>.<token>.
 */
function nab_consume_magic_link() {
	if ( empty( $_GET['nab_magic'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification -- the token is the credential.
		return;
	}
	[ $user_id, $token ] = array_pad( explode( '.', sanitize_text_field( wp_unslash( $_GET['nab_magic'] ) ), 2 ), 2, '' ); // phpcs:ignore WordPress.Security.NonceVerification
	$user_id = absint( $user_id );
	$saved   = $user_id ? get_user_meta( $user_id, '_nab_magic', true ) : null;
	$valid   = is_array( $saved ) && $saved['expires'] > time() && $token && wp_check_password( $token, $saved['hash'] ) && ! get_user_meta( $user_id, '_nab_disabled', true );
	if ( $user_id ) {
		delete_user_meta( $user_id, '_nab_magic' ); // Single use, even when the attempt fails.
	}
	if ( ! $valid ) {
		wp_safe_redirect( add_query_arg( 'nab_signin', 'expired', home_url( '/sign-in/' ) ) );
		exit;
	}
	wp_set_current_user( $user_id );
	wp_set_auth_cookie( $user_id, true );
	do_action( 'wp_login', get_userdata( $user_id )->user_login, get_userdata( $user_id ) );
	wp_safe_redirect( wp_validate_redirect( $saved['redirect'], home_url( '/dashboard/' ) ) );
	exit;
}
add_action( 'template_redirect', 'nab_consume_magic_link', 1 );

/* ---------------- Google ---------------- */

/**
 * Google OAuth client settings.
 *
 * @return array{client_id:string, client_secret:string}
 */
function nab_google_settings() {
	return wp_parse_args( (array) get_option( 'nab_google_oauth', array() ), array( 'client_id' => '', 'client_secret' => '' ) );
}

/**
 * OAuth redirect URI to register in Google Cloud.
 *
 * @return string
 */
function nab_google_redirect_uri() {
	return home_url( '/sign-in/google/' );
}

add_action(
	'init',
	static function () {
		add_rewrite_rule( '^sign-in/google/?$', 'index.php?nab_google=1', 'top' );
	}
);
add_filter(
	'query_vars',
	static function ( $vars ) {
		$vars[] = 'nab_google';
		return $vars;
	}
);

/**
 * /sign-in/google/: start the flow, or handle Google's callback.
 */
function nab_google_route() {
	if ( ! get_query_var( 'nab_google' ) ) {
		return;
	}
	$cfg  = nab_google_settings();
	$fail = static function ( $why ) {
		wp_safe_redirect( add_query_arg( 'nab_signin', $why, home_url( '/sign-in/' ) ) );
		exit;
	};
	if ( ! $cfg['client_id'] || ! $cfg['client_secret'] ) {
		$fail( 'google_off' );
	}

	// phpcs:disable WordPress.Security.NonceVerification -- OAuth state parameter is the CSRF check.
	if ( empty( $_GET['code'] ) ) {
		$state = wp_generate_password( 32, false );
		set_transient( 'nab_gstate_' . $state, nab_signin_redirect(), 10 * MINUTE_IN_SECONDS );
		wp_redirect( // phpcs:ignore WordPress.Security.SafeRedirect -- Google's fixed OAuth endpoint.
			add_query_arg(
				array(
					'client_id'     => rawurlencode( $cfg['client_id'] ),
					'redirect_uri'  => rawurlencode( nab_google_redirect_uri() ),
					'response_type' => 'code',
					'scope'         => rawurlencode( 'openid email profile' ),
					'state'         => $state,
					'prompt'        => 'select_account',
				),
				'https://accounts.google.com/o/oauth2/v2/auth'
			)
		);
		exit;
	}
	$state    = sanitize_text_field( wp_unslash( $_GET['state'] ?? '' ) );
	$redirect = $state ? get_transient( 'nab_gstate_' . $state ) : false;
	delete_transient( 'nab_gstate_' . $state );
	if ( false === $redirect ) {
		$fail( 'google_failed' );
	}
	$token = wp_remote_post(
		'https://oauth2.googleapis.com/token',
		array(
			'timeout' => 15,
			'body'    => array(
				'code'          => sanitize_text_field( wp_unslash( $_GET['code'] ) ),
				'client_id'     => $cfg['client_id'],
				'client_secret' => $cfg['client_secret'],
				'redirect_uri'  => nab_google_redirect_uri(),
				'grant_type'    => 'authorization_code',
			),
		)
	);
	// phpcs:enable WordPress.Security.NonceVerification
	$id_token = is_wp_error( $token ) ? '' : ( json_decode( wp_remote_retrieve_body( $token ), true )['id_token'] ?? '' );
	// Google validates the ID token's signature and expiry for us here.
	$info = $id_token ? wp_remote_get( 'https://oauth2.googleapis.com/tokeninfo?id_token=' . rawurlencode( $id_token ), array( 'timeout' => 15 ) ) : null;
	$info = $info && ! is_wp_error( $info ) ? json_decode( wp_remote_retrieve_body( $info ), true ) : array();
	if ( empty( $info['email'] ) || 'true' !== (string) ( $info['email_verified'] ?? '' ) || ( $info['aud'] ?? '' ) !== $cfg['client_id'] ) {
		$fail( 'google_failed' );
	}

	$user = get_user_by( 'email', $info['email'] );
	if ( ! $user ) {
		$login   = sanitize_user( strstr( $info['email'], '@', true ), true );
		$login   = username_exists( $login ) ? $login . '-' . wp_generate_password( 4, false ) : $login;
		$user_id = wp_insert_user(
			array(
				'user_login'   => $login,
				'user_email'   => $info['email'],
				'user_pass'    => wp_generate_password( 32 ),
				'first_name'   => $info['given_name'] ?? '',
				'last_name'    => $info['family_name'] ?? '',
				'display_name' => $info['name'] ?? $login,
				'role'         => 'customer',
			)
		);
		if ( is_wp_error( $user_id ) ) {
			$fail( 'google_failed' );
		}
		$user = get_userdata( $user_id );
	}
	if ( get_user_meta( $user->ID, '_nab_disabled', true ) ) {
		$fail( 'disabled' );
	}
	update_user_meta( $user->ID, '_nab_oauth_provider', 'google' );
	update_user_meta( $user->ID, '_nab_oauth_id', (string) $info['sub'] );
	wp_set_current_user( $user->ID );
	wp_set_auth_cookie( $user->ID, true );
	do_action( 'wp_login', $user->user_login, $user );
	wp_safe_redirect( wp_validate_redirect( $redirect, home_url( '/dashboard/' ) ) );
	exit;
}
add_action( 'template_redirect', 'nab_google_route', 1 );

/* ---------------- Sign-in page + settings ---------------- */

/**
 * The sign-in panel (block nab/sign-in).
 *
 * @return string HTML.
 */
function nab_render_sign_in() {
	if ( is_user_logged_in() ) {
		return '<div class="nab-card nab-signin"><p>' . esc_html__( 'You’re signed in.', 'nab-core' ) . '</p><a class="nab-btn" href="' . esc_url( home_url( '/dashboard/' ) ) . '">' . esc_html__( 'Go to my dashboard', 'nab-core' ) . '</a></div>';
	}
	$redirect = nab_signin_redirect();
	$flag     = isset( $_GET['nab_signin'] ) ? sanitize_key( wp_unslash( $_GET['nab_signin'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification -- display only.
	$notices  = array(
		'sent'          => array( 'success', __( 'If an account exists for that email, a sign-in link is on its way. Check your inbox (and spam).', 'nab-core' ) ),
		'expired'       => array( 'error', __( 'That sign-in link is invalid or has expired. Request a new one below.', 'nab-core' ) ),
		'google_failed' => array( 'error', __( 'Google sign-in didn’t complete. Please try again.', 'nab-core' ) ),
		'google_off'    => array( 'error', __( 'Google sign-in isn’t available right now. Use an email link instead.', 'nab-core' ) ),
		'disabled'      => array( 'error', __( 'This account has been deactivated. Contact us if you think this is a mistake.', 'nab-core' ) ),
	);
	ob_start();
	echo '<div class="nab-card nab-signin">';
	if ( isset( $notices[ $flag ] ) ) {
		printf( '<p class="nab-notice nab-notice--%s">%s</p>', esc_attr( $notices[ $flag ][0] ), esc_html( $notices[ $flag ][1] ) );
	}
	if ( nab_google_settings()['client_id'] ) {
		printf(
			'<a class="nab-btn nab-btn--outline nab-signin__google" href="%s"><svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>%s</a><p class="nab-signin__or"><span>%s</span></p>',
			esc_url( add_query_arg( 'redirect_to', rawurlencode( $redirect ), nab_google_redirect_uri() ) ),
			esc_html__( 'Continue with Google', 'nab-core' ),
			esc_html__( 'or', 'nab-core' )
		);
	}
	?>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="nab-receipt__form">
		<input type="hidden" name="action" value="nab_magic" />
		<input type="hidden" name="redirect_to" value="<?php echo esc_attr( $redirect ); ?>" />
		<?php wp_nonce_field( 'nab_magic' ); ?>
		<label for="nab-magic-email"><strong><?php esc_html_e( 'Email me a sign-in link', 'nab-core' ); ?></strong></label>
		<input id="nab-magic-email" type="email" name="email" autocomplete="email" spellcheck="false" required placeholder="you@example.com" />
		<button class="nab-btn" type="submit"><?php esc_html_e( 'Send link', 'nab-core' ); ?></button>
	</form>
	<details class="nab-signin__password">
		<summary><?php esc_html_e( 'Sign in with a password instead', 'nab-core' ); ?></summary>
		<?php
		wp_login_form(
			array(
				'redirect'       => $redirect,
				'label_username' => __( 'Email', 'nab-core' ),
				'remember'       => true,
			)
		);
		?>
		<p><a href="<?php echo esc_url( wp_lostpassword_url() ); ?>"><?php esc_html_e( 'Forgot your password?', 'nab-core' ); ?></a></p>
	</details>
	<?php
	echo '</div>';
	return (string) ob_get_clean();
}

add_action(
	'init',
	static function () {
		register_block_type(
			'nab/sign-in',
			array(
				'api_version'     => 3,
				'title'           => __( 'Sign-in panel', 'nab-core' ),
				'category'        => 'widgets',
				'render_callback' => 'nab_render_sign_in',
				'editor_script'   => 'nab-blocks-editor',
			)
		);
	},
	20
);

/**
 * Send logged-out visitors of the student dashboard to /sign-in/.
 */
function nab_dashboard_requires_signin() {
	if ( ! is_user_logged_in() && is_page() && (int) get_queried_object_id() === (int) tutor_utils()->get_option( 'tutor_dashboard_page_id' ) ) {
		wp_safe_redirect( nab_signin_url( home_url( '/dashboard/' ) ) );
		exit;
	}
}
add_action( 'template_redirect', 'nab_dashboard_requires_signin', 2 );

/**
 * Settings → nextaibuilder sign-in (Google OAuth client).
 */
add_action(
	'admin_menu',
	static function () {
		add_options_page(
			__( 'nextaibuilder settings', 'nab-core' ),
			__( 'nextaibuilder', 'nab-core' ),
			'manage_options',
			'nab-sign-in',
			static function () {
				$cfg = nab_google_settings();
				echo '<div class="wrap"><h1>' . esc_html__( 'nextaibuilder settings', 'nab-core' ) . '</h1><form method="post" action="options.php">';
				settings_fields( 'nab_sign_in' );
				echo '<h2>Google</h2><p>' . esc_html__( 'Create an OAuth client (type: Web application) in Google Cloud Console and add this authorized redirect URI:', 'nab-core' ) . ' <code>' . esc_html( nab_google_redirect_uri() ) . '</code></p>';
				echo '<table class="form-table"><tr><th><label for="nab-gid">Client ID</label></th><td><input id="nab-gid" class="regular-text" name="nab_google_oauth[client_id]" value="' . esc_attr( $cfg['client_id'] ) . '" /></td></tr>';
				echo '<tr><th><label for="nab-gsec">Client secret</label></th><td><input id="nab-gsec" type="password" class="regular-text" name="nab_google_oauth[client_secret]" value="' . esc_attr( $cfg['client_secret'] ) . '" autocomplete="off" /></td></tr></table>';
				do_settings_sections( 'nab-sign-in' );
				submit_button();
				echo '</form></div>';
			}
		);
	}
);
add_action(
	'admin_init',
	static function () {
		register_setting(
			'nab_sign_in',
			'nab_google_oauth',
			array(
				'type'              => 'array',
				'sanitize_callback' => static fn( $v ) => array(
					'client_id'     => sanitize_text_field( $v['client_id'] ?? '' ),
					'client_secret' => sanitize_text_field( $v['client_secret'] ?? '' ),
				),
			)
		);
	}
);
