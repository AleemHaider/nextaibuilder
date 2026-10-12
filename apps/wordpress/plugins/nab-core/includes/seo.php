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
	$description = function_exists( 'nab_seo_description' ) ? nab_seo_description( nab_meta_description() ) : nab_meta_description();
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
	$graph = function_exists( 'nab_enrich_graph' ) ? nab_enrich_graph( $graph ) : $graph;
	if ( $graph && ( ! function_exists( 'nab_should_noindex' ) || ! nab_should_noindex() ) ) {
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
	header( 'X-Robots-Tag: noindex' );
	$lines   = array( '# nextaibuilder', '', '> ' . NAB_SITE_DESCRIPTION, '' );
	$lines[] = 'nextaibuilder teaches founders, product managers and engineers to plan, build and deploy their own AI product with Claude Code and the Anthropic Claude API, in a five-week live cohort or a self-paced course. Every student works on their own product; setup steps are checked by AI from screenshots, and an instructor reviews work every week.';
	$lines[] = '';
	$lines[] = '## Courses';
	foreach ( nab_get_course_ids() as $id ) {
		$c     = nab_get_course( $id );
		$facts = array( $c['format_label'] );
		if ( $c['modules'] ) {
			$facts[] = count( $c['modules'] ) . ' weeks, ' . (int) $c['lesson_count'] . ' sessions';
		}
		if ( $c['price'] ) {
			$facts[] = nab_money( $c['price'] ) . ( $c['installment_count'] ? ' or ' . $c['installment_count'] . ' monthly payments' : '' );
		}
		if ( $c['start_date'] ) {
			$facts[] = 'starts ' . wp_date( 'F j, Y', $c['start_date'] );
		}
		$lines[] = sprintf( '- [%s](%s): %s. %s', $c['title'], $c['url'], implode( ', ', $facts ), $c['tagline'] );
		foreach ( $c['modules'] as $i => $m ) {
			$lines[] = sprintf( '  - Week %d: %s (%s)', $i + 1, preg_replace( '/^(Week|Module)\s+\d+\s*[.:—–-]?\s*/u', '', $m['title'] ), implode( '; ', array_map( static fn( $l ) => preg_replace( '/^Session\s+\d+\s*[—–-]\s*/u', '', $l['title'] ), $m['lessons'] ) ) );
		}
	}
	$lines[] = '';
	$lines[] = '## Key pages';
	$lines[] = '- [All courses](' . get_post_type_archive_link( 'courses' ) . '): live cohorts and self-paced courses';
	foreach ( array( 'about' => 'About nextaibuilder and the instructor', 'apply' => 'Apply to the Agentic AI Engineer program', 'refund-policy' => 'Refund policy: full refund within 2 weeks' ) as $slug => $label ) {
		$page = get_page_by_path( $slug );
		if ( $page && 'publish' === $page->post_status ) {
			$lines[] = sprintf( '- [%s](%s)', $label, get_permalink( $page ) );
		}
	}
	$posts = get_posts( array( 'post_type' => 'post', 'posts_per_page' => 100 ) );
	if ( $posts ) {
		$lines[] = '';
		$lines[] = '## Guides and resources';
		foreach ( $posts as $post ) {
			$lines[] = sprintf( '- [%s](%s): %s', get_the_title( $post ), get_permalink( $post ), wp_strip_all_tags( get_the_excerpt( $post ) ) );
		}
	}
	if ( function_exists( 'nab_faq_items' ) ) {
		$lines[] = '';
		$lines[] = '## FAQ';
		foreach ( nab_faq_items() as $q ) {
			$lines[] = '- ' . $q[0] . ' ' . $q[1];
		}
	}
	echo html_entity_decode( wp_strip_all_tags( implode( "\n", $lines ) ), ENT_QUOTES | ENT_HTML5, 'UTF-8' ) . "\n"; // phpcs:ignore WordPress.Security.EscapeOutput -- text/plain response.
	exit;
}
add_action( 'template_redirect', 'nab_maybe_render_llms' );

// Keep /llms.txt exactly as-is (no trailing-slash redirect).
add_filter(
	'redirect_canonical',
	static fn( $redirect ) => get_query_var( 'nab_llms' ) ? false : $redirect
);
