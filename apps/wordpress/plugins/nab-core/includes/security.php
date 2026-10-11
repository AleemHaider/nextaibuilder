<?php
/**
 * Sign-in security.
 *
 * - Lockout: 5 failed password attempts for the same account from the same IP
 *   lock that pair out for 15 minutes.
 * - Staff two-factor: with the Two Factor plugin active, anyone who can edit
 *   posts or holds a nab_* capability must enter an emailed code after their
 *   password. Off on local environments unless NAB_FORCE_2FA is true, so
 *   development sign-ins stay one step.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

const NAB_LOGIN_MAX_FAILS = 5;
const NAB_LOGIN_LOCK_MIN  = 15;

/**
 * Transient key for one account + IP pair.
 *
 * @param string $login Username or email as typed.
 * @return string
 */
function nab_lock_key( $login ) {
	$ip = sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ?? '' ) );
	return 'nab_fail_' . md5( strtolower( trim( (string) $login ) ) . '|' . $ip );
}

add_filter(
	'authenticate',
	static function ( $user, $login ) {
		if ( $login && (int) get_transient( nab_lock_key( $login ) ) >= NAB_LOGIN_MAX_FAILS ) {
			return new WP_Error( 'nab_locked', sprintf( /* translators: %d: minutes. */ __( 'Too many failed sign-in attempts. Try again in %d minutes, or reset your password.', 'nab-core' ), NAB_LOGIN_LOCK_MIN ) );
		}
		return $user;
	},
	30,
	2
);

add_action(
	'wp_login_failed',
	static function ( $login ) {
		$key = nab_lock_key( $login );
		$n   = (int) get_transient( $key ) + 1;
		set_transient( $key, $n, NAB_LOGIN_LOCK_MIN * MINUTE_IN_SECONDS );
		if ( NAB_LOGIN_MAX_FAILS === $n && function_exists( 'nab_log' ) ) {
			nab_log( sprintf( 'Sign-in locked for %d minutes after %d failed attempts: %s', NAB_LOGIN_LOCK_MIN, $n, $login ) );
		}
	}
);

add_action(
	'wp_login',
	static function ( $login ) {
		delete_transient( nab_lock_key( $login ) );
	}
);

/**
 * Whether the user is staff who must use two-factor.
 *
 * @param int $user_id User.
 * @return bool
 */
function nab_requires_2fa( $user_id ) {
	if ( 'local' === wp_get_environment_type() && ! ( defined( 'NAB_FORCE_2FA' ) && NAB_FORCE_2FA ) ) {
		return false;
	}
	$user = get_userdata( $user_id );
	if ( ! $user ) {
		return false;
	}
	if ( $user->has_cap( 'edit_posts' ) ) {
		return true;
	}
	foreach ( nab_caps() as $cap ) {
		if ( $user->has_cap( $cap ) ) {
			return true;
		}
	}
	return false;
}

add_filter(
	'two_factor_enabled_providers_for_user',
	static function ( $providers, $user_id ) {
		if ( nab_requires_2fa( $user_id ) && ! in_array( 'Two_Factor_Email', (array) $providers, true ) ) {
			$providers   = (array) $providers;
			$providers[] = 'Two_Factor_Email';
		}
		return $providers;
	},
	10,
	2
);

add_filter(
	'two_factor_primary_provider_for_user',
	static function ( $provider, $user_id ) {
		return ( ! $provider && nab_requires_2fa( $user_id ) ) ? 'Two_Factor_Email' : $provider;
	},
	10,
	2
);
