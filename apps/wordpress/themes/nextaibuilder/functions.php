<?php
/**
 * nextaibuilder theme setup.
 *
 * @package nextaibuilder
 */

defined( 'ABSPATH' ) || exit;

define( 'NEXTAIBUILDER_VERSION', wp_get_theme()->get( 'Version' ) );

require_once get_theme_file_path( 'inc/shell.php' );

/**
 * Theme supports.
 */
function nextaibuilder_setup() {
	add_theme_support( 'wp-block-styles' );
	add_theme_support( 'editor-styles' );
	add_editor_style( 'assets/css/theme.css' );
}
add_action( 'after_setup_theme', 'nextaibuilder_setup' );

/**
 * Front-end styles and the small FAQ/nav script.
 */
function nextaibuilder_enqueue() {
	wp_enqueue_style(
		'nextaibuilder',
		get_theme_file_uri( 'assets/css/theme.css' ),
		array(),
		(string) filemtime( get_theme_file_path( 'assets/css/theme.css' ) )
	);
	wp_enqueue_script( 'nextaibuilder-ui', get_theme_file_uri( 'assets/js/ui.js' ), array(), (string) filemtime( get_theme_file_path( 'assets/js/ui.js' ) ), array( 'strategy' => 'defer', 'in_footer' => true ) );
}
add_action( 'wp_enqueue_scripts', 'nextaibuilder_enqueue' );

/**
 * Pattern category for the site's own sections.
 */
function nextaibuilder_pattern_categories() {
	register_block_pattern_category(
		'nextaibuilder',
		array( 'label' => __( 'nextaibuilder', 'nextaibuilder' ) )
	);
}
add_action( 'init', 'nextaibuilder_pattern_categories' );

/**
 * Favicons and social-share defaults. Per-page titles and descriptions come
 * from WordPress itself; nab-core adds structured data.
 */
function nextaibuilder_head_meta() {
	$img = get_theme_file_uri( 'assets/images/' );
	// Inter carries every heading and paragraph; fetch it before the CSS asks for it.
	printf( '<link rel="preload" href="%s" as="font" type="font/woff2" crossorigin />' . "\n", esc_url( get_theme_file_uri( 'assets/fonts/inter.woff2' ) ) );
	printf( '<link rel="icon" type="image/svg+xml" href="%s" />' . "\n", esc_url( $img . 'favicon.svg' ) );
	printf( '<link rel="apple-touch-icon" sizes="180x180" href="%s" />' . "\n", esc_url( $img . 'apple-touch-icon.png' ) );
	echo '<meta name="theme-color" content="#ffffff" />' . "\n";
}
add_action( 'wp_head', 'nextaibuilder_head_meta', 2 );

/**
 * URL of a bundled theme image, for use inside patterns.
 *
 * @param string $file Path relative to assets/images.
 * @return string
 */
function nextaibuilder_image( $file ) {
	return get_theme_file_uri( 'assets/images/' . ltrim( $file, '/' ) );
}

/**
 * WooCommerce auto-inserts a mini-cart and an account icon into the header.
 * Courses are bought one at a time from the course page, and the nav already
 * has "Sign in" (→ the student dashboard), so drop both.
 *
 * @param string[] $hooked Hooked block types.
 * @return string[]
 */
function nextaibuilder_remove_mini_cart( $hooked ) {
	return array_values( array_diff( (array) $hooked, array( 'woocommerce/mini-cart', 'woocommerce/customer-account' ) ) );
}
add_filter( 'hooked_block_types', 'nextaibuilder_remove_mini_cart', 20 );
