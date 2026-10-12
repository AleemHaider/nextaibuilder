<?php
/**
 * Clean URLs that match the old site: /guides/ and /resources/ for the two
 * article categories, and 301s from the old static .html article URLs.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Article categories served at the site root.
 *
 * @return string[]
 */
function nab_root_categories() {
	return array( 'guides', 'resources' );
}

/**
 * /guides/ and /resources/ (with pagination) map to their category archive.
 */
function nab_category_rewrites() {
	$cats = implode( '|', nab_root_categories() );
	add_rewrite_rule( "^({$cats})/?$", 'index.php?category_name=$matches[1]', 'top' );
	add_rewrite_rule( "^({$cats})/page/([0-9]+)/?$", 'index.php?category_name=$matches[1]&paged=$matches[2]', 'top' );
}
add_action( 'init', 'nab_category_rewrites' );

/**
 * Point category links at the short URLs.
 *
 * @param string  $link Term link.
 * @param WP_Term $term Term.
 * @return string
 */
function nab_category_link( $link, $term ) {
	if ( 'category' === $term->taxonomy && in_array( $term->slug, nab_root_categories(), true ) ) {
		return home_url( '/' . $term->slug . '/' );
	}
	return $link;
}
add_filter( 'term_link', 'nab_category_link', 10, 2 );

/**
 * 301 old URLs: /guides/<slug>.html and /resources/<slug>.html.
 */
function nab_legacy_redirects() {
	if ( ! is_404() ) {
		return;
	}
	$path = wp_parse_url( isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '', PHP_URL_PATH );
	if ( ! $path || ! preg_match( '#^/(?:guides|resources)/([a-z0-9-]+)\.html$#', $path, $m ) ) {
		return;
	}
	$post = get_page_by_path( $m[1], OBJECT, 'post' );
	if ( $post && 'publish' === $post->post_status ) {
		wp_safe_redirect( get_permalink( $post ), 301 );
		exit;
	}
}
add_action( 'template_redirect', 'nab_legacy_redirects' );

/**
 * Courses are sold through the course pages, so WooCommerce's shop and
 * product pages redirect to the catalog / the matching course.
 */
function nab_redirect_shop() {
	if ( function_exists( 'is_shop' ) && is_shop() ) {
		wp_safe_redirect( get_post_type_archive_link( 'courses' ), 301 );
		exit;
	}
	if ( function_exists( 'is_product' ) && is_product() ) {
		$course_id = nab_course_id_for_product( get_queried_object_id() );
		wp_safe_redirect( $course_id ? get_permalink( $course_id ) : get_post_type_archive_link( 'courses' ), 301 );
		exit;
	}
}
add_action( 'template_redirect', 'nab_redirect_shop' );
