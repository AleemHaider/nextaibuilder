<?php
/**
 * One student experience: Tutor's dashboard and lessons inside the site's
 * header/footer, without Tutor's tour or unused features, and WooCommerce's
 * "My account" folded into the dashboard (order pages stay for receipts).
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Tutor settings this site relies on (applied by `wp nab seed`, and on admin load
 * if missing).
 */
function nab_apply_tutor_shell_settings() {
	$opt = (array) get_option( 'tutor_option', array() );
	$want = array(
		'show_dashboard_site_header' => 'on',
		'show_dashboard_site_footer' => 'on',
		'show_learning_site_header'  => 'on',
		'show_learning_site_footer'  => 'off',
		'enable_wishlist'            => 'off',
		'enable_q_and_a_on_course'   => 'off',
	);
	if ( array_intersect_assoc( $want, $opt ) !== $want ) {
		update_option( 'tutor_option', array_merge( $opt, $want ) );
	}
}
add_action( 'admin_init', 'nab_apply_tutor_shell_settings' );

/**
 * Never show Tutor's product tour (it demos a stock photography course).
 */
add_filter(
	'get_user_metadata',
	static function ( $value, $object_id, $meta_key ) {
		return '_tutor_tour_completed' === $meta_key ? array( true ) : $value;
	},
	10,
	3
);

/**
 * Dashboard menu: drop features this school doesn't use; add Orders.
 *
 * @param array $items Nav items.
 * @return array
 */
function nab_dashboard_nav( $items ) {
	foreach ( array( 'discussions', 'wishlist', 'quiz-attempts', 'my-quiz-attempts', 'question-answer', 'reviews', 'announcements' ) as $key ) {
		unset( $items[ $key ] );
	}
	if ( function_exists( 'wc_get_account_endpoint_url' ) ) {
		$items['nab-orders'] = array(
			'title' => __( 'Orders & receipts', 'nab-core' ),
			'icon'  => 'billing',
			'url'   => wc_get_account_endpoint_url( 'orders' ),
		);
	}
	return $items;
}
add_filter( 'tutor_dashboard/nav_items', 'nab_dashboard_nav', 20 );

/**
 * Header for signed-in visitors: "Sign in" → "My learning", "Get started" → "Dashboard".
 *
 * @param string $html  Block HTML.
 * @param array  $block Block.
 * @return string
 */
function nab_header_for_signed_in( $html, $block ) {
	if ( ! is_user_logged_in() ) {
		return $html;
	}
	$class = (string) ( $block['attrs']['className'] ?? '' );
	if ( 'core/navigation-link' === $block['blockName'] && str_contains( $class, 'nab-nav__signin' ) ) {
		return str_replace( '>Sign in<', '>' . esc_html__( 'My learning', 'nab-core' ) . '<', $html );
	}
	if ( 'core/buttons' === $block['blockName'] && str_contains( $class, 'nab-header__cta' ) ) {
		return str_replace(
			array( 'href="/courses/"', '>Get started<' ),
			array( 'href="' . esc_url( home_url( '/dashboard/' ) ) . '"', '>' . esc_html__( 'Dashboard', 'nab-core' ) . '<' ),
			$html
		);
	}
	return $html;
}
add_filter( 'render_block', 'nab_header_for_signed_in', 10, 2 );

/**
 * WooCommerce "My account": only the parts students need. The account home
 * goes to the dashboard; orders (with receipt upload) and payment details stay.
 */
add_filter(
	'woocommerce_account_menu_items',
	static function ( $items ) {
		unset( $items['downloads'], $items['edit-address'], $items['dashboard'] );
		return array( 'nab-dashboard' => __( 'Back to dashboard', 'nab-core' ) ) + $items;
	}
);
add_filter(
	'woocommerce_get_endpoint_url',
	static function ( $url, $endpoint ) {
		return 'nab-dashboard' === $endpoint ? home_url( '/dashboard/' ) : $url;
	},
	10,
	2
);
add_action(
	'template_redirect',
	static function () {
		if ( function_exists( 'is_account_page' ) && is_account_page() && is_user_logged_in() && ! is_wc_endpoint_url() ) {
			wp_safe_redirect( home_url( '/dashboard/' ) );
			exit;
		}
	}
);

// Tutor's registration pages show "Access Denied" (accounts are made at checkout
// or by invite), so send anyone who lands there to sign-in.
add_action(
	'template_redirect',
	static function () {
		if ( is_page( array( 'student-registration', 'instructor-registration' ) ) ) {
			wp_safe_redirect( home_url( is_user_logged_in() ? '/dashboard/' : '/sign-in/' ) );
			exit;
		}
	}
);

// Wide code blocks scroll sideways; make them reachable by keyboard so the
// overflow can be scrolled without a mouse.
$nab_focusable_pre = static fn( $html ) => is_string( $html ) && str_contains( $html, '<pre' ) ? preg_replace( '/<pre(?![^>]*tabindex)/', '<pre tabindex="0"', $html ) : $html;
add_filter( 'the_content', $nab_focusable_pre, 20 );
add_filter( 'render_block_core/code', $nab_focusable_pre );
add_filter( 'render_block_core/preformatted', $nab_focusable_pre );

// Tutor's dashboard has no page heading; give screen readers one.
add_action(
	'tutor_dashboard/before/wrap',
	static function () {
		echo '<h1 class="screen-reader-text">' . esc_html__( 'Your dashboard', 'nab-core' ) . '</h1>';
	}
);

// Name the header menu so it's distinguishable from Tutor's and the footer's navigation.
add_filter(
	'render_block_core/navigation',
	static function ( $html, $block ) {
		return str_contains( (string) ( $block['attrs']['className'] ?? '' ), 'nab-nav' ) && ! str_contains( $html, 'aria-label="' . __( 'Main', 'nab-core' ) . '"' )
			? preg_replace( '/<nav /', '<nav aria-label="' . esc_attr__( 'Main', 'nab-core' ) . '" ', $html, 1 )
			: $html;
	},
	10,
	2
);
