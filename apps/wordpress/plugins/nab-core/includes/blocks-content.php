<?php
/**
 * Blocks for the free-content pages: the Guides learning path, article cards
 * for archives and the About page, and reading time.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Guides in the order a beginner should read them (slugs). Guides not listed
 * here appear under "More guides".
 *
 * @return string[]
 */
function nab_guide_path_slugs() {
	return array( 'claude-api-tutorial', 'build-ai-agent-with-claude', 'mcp-explained', 'ship-production-ai-product-claude-api' );
}

/**
 * Minutes to read a post, at 220 words a minute.
 *
 * @param WP_Post|int $post Post.
 * @return int
 */
function nab_reading_minutes( $post ) {
	$words = str_word_count( wp_strip_all_tags( (string) get_post_field( 'post_content', $post ) ) );
	return max( 1, (int) ceil( $words / 220 ) );
}

/**
 * Short summary for a card.
 *
 * @param WP_Post $post Post.
 * @param int     $words Word limit.
 * @return string
 */
function nab_card_excerpt( $post, $words = 28 ) {
	$text = has_excerpt( $post ) ? $post->post_excerpt : $post->post_content;
	return wp_trim_words( wp_strip_all_tags( strip_shortcodes( $text ) ), $words, '…' );
}

/**
 * Meta line: reading time and date.
 *
 * @param WP_Post $post Post.
 * @return string HTML.
 */
function nab_card_meta( $post ) {
	return '<p class="nab-post-card__meta"><span>' . esc_html(
		/* translators: %d: minutes. */
		sprintf( _n( '%d min read', '%d min read', nab_reading_minutes( $post ), 'nab-core' ), nab_reading_minutes( $post ) )
	) . '</span><time datetime="' . esc_attr( get_the_date( 'c', $post ) ) . '">' . esc_html( get_the_date( '', $post ) ) . '</time></p>';
}

/**
 * One article card.
 *
 * @param WP_Post $post     Post.
 * @param string  $heading  Heading tag.
 * @return string HTML.
 */
function nab_render_post_card( $post, $heading = 'h3' ) {
	$cat = get_the_category( $post->ID );
	return '<article class="nab-post-card">'
		. ( $cat ? '<p class="nab-post-card__cat">' . esc_html( $cat[0]->name ) . '</p>' : '' )
		. '<' . $heading . ' class="nab-post-card__title"><a href="' . esc_url( get_permalink( $post ) ) . '">' . esc_html( get_the_title( $post ) ) . '</a></' . $heading . '>'
		. '<p class="nab-post-card__text">' . esc_html( nab_card_excerpt( $post ) ) . '</p>'
		. nab_card_meta( $post )
		. '</article>';
}

/**
 * Published posts in a category, newest first.
 *
 * @param string $slug  Category slug.
 * @param int    $count How many (-1 for all).
 * @return WP_Post[]
 */
function nab_category_posts( $slug, $count = -1 ) {
	return get_posts(
		array(
			'category_name'  => $slug,
			'posts_per_page' => $count,
			'post_status'    => 'publish',
			'no_found_rows'  => true,
		)
	);
}

/**
 * nab/guide-path: the Guides reading order, as numbered steps.
 *
 * @return string HTML.
 */
function nab_render_guide_path() {
	if ( is_archive() && ! is_category( 'guides' ) ) {
		return '';
	}
	$steps = array();
	foreach ( nab_guide_path_slugs() as $slug ) {
		$post = get_page_by_path( $slug, OBJECT, 'post' );
		if ( $post && 'publish' === $post->post_status ) {
			$steps[] = $post;
		}
	}
	if ( ! $steps ) {
		return '';
	}
	$levels = array( __( 'Start here', 'nab-core' ), __( 'Then', 'nab-core' ), __( 'Then', 'nab-core' ), __( 'Finally', 'nab-core' ) );
	$html   = '<div class="nab-path-wrap"><h2 class="nab-section-title">' . esc_html__( 'A reading path from first API call to production', 'nab-core' ) . '</h2>'
		. '<p class="nab-section-text">' . esc_html__( 'New to the Claude API? Read these in order. Each one builds on the last and ends with working code.', 'nab-core' ) . '</p><ol class="nab-path">';
	foreach ( $steps as $i => $post ) {
		$html .= '<li class="nab-path__step' . ( 0 === $i ? ' nab-path__step--first' : '' ) . '">'
			. '<span class="nab-path__num" aria-hidden="true">' . ( $i + 1 ) . '</span>'
			. '<div class="nab-path__body"><p class="nab-path__label">' . esc_html( $levels[ min( $i, 3 ) ] ) . '</p>'
			. '<h3 class="nab-path__title"><a href="' . esc_url( get_permalink( $post ) ) . '">' . esc_html( get_the_title( $post ) ) . '</a></h3>'
			. '<p class="nab-path__text">' . esc_html( nab_card_excerpt( $post, 34 ) ) . '</p>'
			. nab_card_meta( $post )
			. '</div></li>';
	}
	return $html . '</ol></div>';
}

/**
 * nab/post-cards: article cards.
 * - On an archive: the archive's posts (on Guides, those not in the path).
 * - With a "category" attribute: that category's newest posts ("count", default 3).
 *
 * @param array $atts Block attributes.
 * @return string HTML.
 */
function nab_render_post_cards( $atts ) {
	$atts = wp_parse_args( (array) $atts, array( 'category' => '', 'count' => 3, 'title' => '' ) );
	if ( $atts['category'] ) {
		$posts = nab_category_posts( sanitize_key( $atts['category'] ), (int) $atts['count'] );
	} elseif ( is_archive() ) {
		global $wp_query;
		$posts = $wp_query->posts;
		if ( is_category( 'guides' ) ) {
			$posts = array_values( array_filter( $posts, static fn( $p ) => ! in_array( $p->post_name, nab_guide_path_slugs(), true ) ) );
		}
	} else {
		return '';
	}
	if ( ! $posts ) {
		return '';
	}
	if ( ! $atts['title'] && is_category( 'guides' ) ) {
		$atts['title'] = __( 'More guides', 'nab-core' );
	}
	$html = $atts['title'] ? '<h2 class="nab-section-title">' . esc_html( $atts['title'] ) . '</h2>' : '';
	if ( ! $atts['title'] && is_archive() ) {
		// Keep heading levels in order for screen readers (h1 → h2 → card h3).
		$html = '<h2 class="screen-reader-text">' . esc_html__( 'All articles', 'nab-core' ) . '</h2>';
	}
	$html .= '<div class="nab-post-cards">';
	foreach ( $posts as $post ) {
		$html .= nab_render_post_card( $post );
	}
	return $html . '</div>';
}

/**
 * nab/archive-head: archive title, description and a link to the other free
 * content section.
 *
 * @return string HTML.
 */
function nab_render_archive_head() {
	if ( ! is_archive() ) {
		return '';
	}
	$term  = get_queried_object();
	$count = $term instanceof WP_Term ? (int) $term->count : 0;
	$html  = '<header class="nab-archive-head"><p class="nab-kicker">' . esc_html__( 'Free resources', 'nab-core' ) . '</p>';
	$html .= '<h1 class="nab-archive-head__title">' . esc_html( single_term_title( '', false ) ? single_term_title( '', false ) : get_the_archive_title() ) . '</h1>';
	$desc  = $term instanceof WP_Term ? wp_strip_all_tags( term_description( $term ) ) : '';
	if ( $desc ) {
		$html .= '<p class="nab-lede">' . esc_html( $desc ) . '</p>';
	}
	$other = is_category( 'guides' ) ? 'resources' : ( is_category( 'resources' ) ? 'guides' : '' );
	$links = array();
	if ( $count ) {
		/* translators: %d: number of articles. */
		$links[] = '<span>' . esc_html( sprintf( _n( '%d article', '%d articles', $count, 'nab-core' ), $count ) ) . '</span>';
	}
	if ( $other && get_category_by_slug( $other ) ) {
		$links[] = '<a href="' . esc_url( get_category_link( get_category_by_slug( $other ) ) ) . '">' . esc_html( 'guides' === $other ? __( 'Browse the guides', 'nab-core' ) : __( 'Browse checklists and references', 'nab-core' ) ) . '</a>';
	}
	if ( $links ) {
		$html .= '<p class="nab-archive-head__meta">' . implode( '', $links ) . '</p>';
	}
	return $html . '</header>';
}

/**
 * nab/archive-extra: the other free-content section under an archive
 * (checklists under Guides, guides under Resources).
 *
 * @return string HTML.
 */
function nab_render_archive_extra() {
	if ( is_category( 'guides' ) ) {
		return nab_render_post_cards( array( 'category' => 'resources', 'count' => 3, 'title' => __( 'Checklists and references', 'nab-core' ) ) );
	}
	if ( is_category( 'resources' ) ) {
		return nab_render_post_cards( array( 'category' => 'guides', 'count' => 3, 'title' => __( 'Step-by-step guides', 'nab-core' ) ) );
	}
	return '';
}

add_action(
	'init',
	static function () {
		$blocks = array(
			'archive-extra' => array( 'nab_render_archive_extra', __( 'Related free content', 'nab-core' ) ),
			'guide-path'   => array( 'nab_render_guide_path', __( 'Guides learning path', 'nab-core' ) ),
			'post-cards'   => array( 'nab_render_post_cards', __( 'Article cards', 'nab-core' ) ),
			'archive-head' => array( 'nab_render_archive_head', __( 'Archive header', 'nab-core' ) ),
		);
		foreach ( $blocks as $name => [ $cb, $title ] ) {
			register_block_type(
				'nab/' . $name,
				array(
					'api_version'     => 3,
					'title'           => $title,
					'category'        => 'widgets',
					'render_callback' => $cb,
					'attributes'      => array(
						'category' => array( 'type' => 'string', 'default' => '' ),
						'count'    => array( 'type' => 'number', 'default' => 3 ),
						'title'    => array( 'type' => 'string', 'default' => '' ),
					),
				)
			);
		}
	}
);
