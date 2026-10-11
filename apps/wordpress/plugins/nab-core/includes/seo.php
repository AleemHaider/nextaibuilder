<?php
/**
 * Search and AI-crawler basics WordPress core doesn't output: meta
 * description, Open Graph/Twitter tags, JSON-LD and /llms.txt.
 * Canonical URLs, robots.txt and XML sitemaps come from core.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

const NAB_SITE_DESCRIPTION = 'Live and recorded cohorts that teach you to ship production AI products with the Anthropic Claude API, from prompts to pipelines.';

/**
 * Description for the current request.
 *
 * @return string
 */
function nab_meta_description() {
	if ( is_front_page() ) {
		return NAB_SITE_DESCRIPTION;
	}
	if ( is_post_type_archive( 'courses' ) ) {
		return __( 'Browse nextaibuilder’s live cohorts and self-paced courses on building and shipping production AI products with the Claude API.', 'nab-core' );
	}
	if ( is_singular( 'courses' ) ) {
		$tagline = get_post_meta( get_the_ID(), '_nab_tagline', true );
		if ( $tagline ) {
			return $tagline;
		}
	}
	if ( is_singular() ) {
		$excerpt = get_the_excerpt();
		if ( $excerpt ) {
			return wp_trim_words( wp_strip_all_tags( $excerpt ), 30, '…' );
		}
	}
	if ( is_category() || is_tag() || is_tax() ) {
		$desc = term_description();
		if ( $desc ) {
			return wp_trim_words( wp_strip_all_tags( $desc ), 30, '…' );
		}
	}
	return NAB_SITE_DESCRIPTION;
}

/**
 * Meta description, social tags and JSON-LD in <head>.
 */
function nab_output_head_meta() {
	$title       = wp_get_document_title();
	$description = nab_meta_description();
	$url         = is_singular() ? get_permalink() : home_url( add_query_arg( array() ) );
	$image       = is_singular() && has_post_thumbnail() ? get_the_post_thumbnail_url( null, 'large' ) : get_theme_file_uri( 'assets/images/og-image.png' );

	printf( '<meta name="description" content="%s" />' . "\n", esc_attr( $description ) );
	$tags = array(
		'og:type'        => is_singular( 'post' ) ? 'article' : 'website',
		'og:site_name'   => 'nextaibuilder',
		'og:title'       => $title,
		'og:description' => $description,
		'og:url'         => $url,
		'og:image'       => $image,
	);
	foreach ( $tags as $property => $content ) {
		printf( '<meta property="%s" content="%s" />' . "\n", esc_attr( $property ), esc_attr( $content ) );
	}
	echo '<meta name="twitter:card" content="summary_large_image" />' . "\n";

	$graph = array();
	if ( is_front_page() ) {
		$graph[] = array(
			'@type'       => 'EducationalOrganization',
			'@id'         => home_url( '/#organization' ),
			'name'        => 'nextaibuilder',
			'url'         => home_url( '/' ),
			'logo'        => get_theme_file_uri( 'assets/images/apple-touch-icon.png' ),
			'description' => NAB_SITE_DESCRIPTION,
		);
	}
	if ( is_singular( 'courses' ) && function_exists( 'nab_get_course' ) ) {
		$c      = nab_get_course( get_the_ID() );
		$course = array(
			'@type'       => 'Course',
			'name'        => $c['title'],
			'description' => $description,
			'url'         => $c['url'],
			'provider'    => array(
				'@type' => 'Organization',
				'name'  => 'nextaibuilder',
				'url'   => home_url( '/' ),
			),
		);
		if ( $c['price'] > 0 ) {
			$course['offers'] = array(
				'@type'         => 'Offer',
				'category'      => 'Paid',
				'price'         => $c['price'],
				'priceCurrency' => function_exists( 'get_woocommerce_currency' ) ? get_woocommerce_currency() : 'USD',
				'url'           => $c['url'],
			);
		}
		$course['hasCourseInstance'] = array(
			'@type'          => 'CourseInstance',
			'courseMode'     => 'Online',
			'courseWorkload' => $c['hours'] ? 'PT' . $c['hours'] . 'H' : null,
			'startDate'      => $c['start_date'] ? wp_date( 'Y-m-d', $c['start_date'] ) : null,
		);
		$course['hasCourseInstance'] = array_filter( $course['hasCourseInstance'] );
		$graph[]                     = $course;
	}
	if ( is_singular( 'post' ) ) {
		$graph[] = array(
			'@type'         => 'Article',
			'headline'      => get_the_title(),
			'description'   => $description,
			'url'           => get_permalink(),
			'datePublished' => get_the_date( 'c' ),
			'dateModified'  => get_the_modified_date( 'c' ),
			'author'        => array(
				'@type' => 'Organization',
				'name'  => 'nextaibuilder',
			),
		);
	}
	if ( $graph ) {
		printf(
			'<script type="application/ld+json">%s</script>' . "\n",
			wp_json_encode(
				array(
					'@context' => 'https://schema.org',
					'@graph'   => $graph,
				),
				JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG
			)
		);
	}
}
add_action( 'wp_head', 'nab_output_head_meta', 3 );

/**
 * Serve /llms.txt: a plain-text map of courses and articles for AI crawlers.
 */
function nab_llms_rewrite() {
	add_rewrite_rule( '^llms\.txt$', 'index.php?nab_llms=1', 'top' );
}
add_action( 'init', 'nab_llms_rewrite' );

add_filter(
	'query_vars',
	static function ( $vars ) {
		$vars[] = 'nab_llms';
		return $vars;
	}
);

/**
 * Print llms.txt when requested.
 */
function nab_maybe_render_llms() {
	if ( ! get_query_var( 'nab_llms' ) ) {
		return;
	}
	header( 'Content-Type: text/plain; charset=utf-8' );
	$lines   = array( '# nextaibuilder', '', '> ' . NAB_SITE_DESCRIPTION, '', 'Home: ' . home_url( '/' ), '' );
	$lines[] = '## Courses';
	foreach ( nab_get_course_ids() as $id ) {
		$c       = nab_get_course( $id );
		$lines[] = sprintf( '- [%s (%s)](%s): %s', $c['title'], $c['format_label'], $c['url'], $c['tagline'] );
	}
	$posts = get_posts(
		array(
			'post_type'      => 'post',
			'posts_per_page' => 100,
		)
	);
	if ( $posts ) {
		$lines[] = '';
		$lines[] = '## Guides and resources';
		foreach ( $posts as $post ) {
			$lines[] = sprintf( '- [%s](%s): %s', get_the_title( $post ), get_permalink( $post ), wp_strip_all_tags( get_the_excerpt( $post ) ) );
		}
	}
	echo wp_strip_all_tags( implode( "\n", $lines ) ) . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput -- text/plain response.
	exit;
}
add_action( 'template_redirect', 'nab_maybe_render_llms' );

// Keep /llms.txt exactly as-is (no trailing-slash redirect).
add_filter(
	'redirect_canonical',
	static fn( $redirect ) => get_query_var( 'nab_llms' ) ? false : $redirect
);
