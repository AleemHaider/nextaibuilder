<?php
/**
 * One place that turns a Tutor LMS course + its WooCommerce product into the
 * data the theme renders, so cards, course pages, pricing and schema agree.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Published courses, optionally filtered by format.
 *
 * @param string $format recorded|live|combined or '' for all.
 * @param int    $limit  -1 for all.
 * @return int[] Course IDs.
 */
function nab_get_course_ids( $format = '', $limit = -1 ) {
	$ids = nab_query_course_ids( $format );
	$ids = array_values( array_filter( $ids, static fn( $id ) => ! nab_course_has_ended( $id ) ) );
	return $limit > 0 ? array_slice( $ids, 0, $limit ) : $ids;
}

/**
 * Whether a live/combined cohort's end date has passed.
 *
 * @param int $course_id Course ID.
 * @return bool
 */
function nab_course_has_ended( $course_id ) {
	$end = get_post_meta( $course_id, '_nab_end_date', true );
	return 'recorded' !== nab_course_format( $course_id ) && $end && strtotime( $end . ' 23:59:59' ) < time();
}

/**
 * Published course IDs in display order (including ended cohorts).
 *
 * @param string $format Format filter.
 * @return int[]
 */
function nab_query_course_ids( $format = '' ) {
	$limit = -1;
	$args = array(
		'post_type'      => 'courses',
		'post_status'    => 'publish',
		'posts_per_page' => $limit,
		'orderby'        => array(
			'menu_order' => 'ASC',
			'date'       => 'DESC',
		),
		'fields'         => 'ids',
		'no_found_rows'  => true,
	);
	if ( $format ) {
		$args['meta_query'] = array( // phpcs:ignore WordPress.DB.SlowDBQuery -- small table, few courses.
			array(
				'key'   => '_nab_format',
				'value' => $format,
			),
		);
	}
	return get_posts( $args );
}

/**
 * Count published courses per format.
 *
 * @return array<string, int>
 */
function nab_count_courses_by_format() {
	$counts = array_fill_keys( array_keys( nab_course_formats() ), 0 );
	foreach ( nab_get_course_ids() as $id ) {
		$format = nab_course_format( $id );
		++$counts[ $format ];
	}
	return $counts;
}

/**
 * A course's format, defaulting to recorded.
 *
 * @param int $course_id Course ID.
 * @return string
 */
function nab_course_format( $course_id ) {
	$format = get_post_meta( $course_id, '_nab_format', true );
	return array_key_exists( $format, nab_course_formats() ) ? $format : 'recorded';
}

/**
 * Lesson length in minutes, from our field or Tutor's video runtime.
 *
 * @param int $lesson_id Lesson ID.
 * @return int
 */
function nab_lesson_minutes( $lesson_id ) {
	$minutes = (int) get_post_meta( $lesson_id, '_nab_minutes', true );
	if ( $minutes ) {
		return $minutes;
	}
	$video = get_post_meta( $lesson_id, '_video', true );
	if ( is_array( $video ) && ! empty( $video['runtime'] ) ) {
		$rt = $video['runtime'];
		return (int) ( ( (int) ( $rt['hours'] ?? 0 ) ) * 60 + (int) ( $rt['minutes'] ?? 0 ) );
	}
	return 0;
}

/**
 * Modules (Tutor "topics") with their lessons.
 *
 * @param int $course_id Course ID.
 * @return array<int, array{title:string, lessons:array<int, array{title:string, minutes:int}>}>
 */
function nab_course_modules( $course_id ) {
	$modules = array();
	$topics  = get_posts(
		array(
			'post_type'      => 'topics',
			'post_parent'    => $course_id,
			'posts_per_page' => -1,
			'orderby'        => 'menu_order',
			'order'          => 'ASC',
		)
	);
	foreach ( $topics as $topic ) {
		$lessons = get_posts(
			array(
				'post_type'      => 'lesson',
				'post_parent'    => $topic->ID,
				'posts_per_page' => -1,
				'orderby'        => 'menu_order',
				'order'          => 'ASC',
			)
		);
		$modules[] = array(
			'title'   => get_the_title( $topic ),
			'lessons' => array_map(
				static fn( $lesson ) => array(
					'id'      => $lesson->ID,
					'title'   => get_the_title( $lesson ),
					'minutes' => nab_lesson_minutes( $lesson->ID ),
					'preview' => (bool) get_post_meta( $lesson->ID, '_is_preview', true ) || ( function_exists( 'nab_demo_on' ) && nab_demo_on() && 0 === (int) $lesson->menu_order && 0 === (int) get_post_field( 'menu_order', $topic->ID ) ), // DEMO: first lesson previewable.
				),
				$lessons
			),
		);
	}
	return $modules;
}

/**
 * Split one of Tutor's newline-separated course lists into items.
 *
 * @param int    $course_id Course ID.
 * @param string $key       Meta key.
 * @return string[]
 */
function nab_course_list_meta( $course_id, $key ) {
	$raw = (string) get_post_meta( $course_id, $key, true );
	return array_values( array_filter( array_map( 'trim', preg_split( '/\r\n|\r|\n/', $raw ) ) ) );
}

/**
 * Everything the theme needs about one course.
 *
 * @param int $course_id Course ID.
 * @return array<string, mixed>
 */
function nab_get_course( $course_id ) {
	$format     = nab_course_format( $course_id );
	$product_id = (int) get_post_meta( $course_id, '_tutor_course_product_id', true );
	$product    = $product_id && function_exists( 'wc_get_product' ) ? wc_get_product( $product_id ) : null;
	$price      = $product ? (float) $product->get_price() : 0.0;
	$count      = get_post_meta( $course_id, '_nab_installment_count', true );
	$count      = '' === $count ? 3 : (int) $count;
	$modules    = nab_course_modules( $course_id );
	$minutes    = 0;
	$lessons    = 0;
	foreach ( $modules as $module ) {
		$lessons += count( $module['lessons'] );
		$minutes += array_sum( array_column( $module['lessons'], 'minutes' ) );
	}
	$start = get_post_meta( $course_id, '_nab_start_date', true );
	$end   = get_post_meta( $course_id, '_nab_end_date', true );

	return array(
		'id'                 => $course_id,
		'title'              => get_the_title( $course_id ),
		'url'                => get_permalink( $course_id ),
		'excerpt'            => get_the_excerpt( $course_id ),
		'tagline'            => (string) get_post_meta( $course_id, '_nab_tagline', true ),
		'format'             => $format,
		'format_label'       => nab_course_formats()[ $format ],
		'image'              => get_the_post_thumbnail_url( $course_id, 'large' ),
		'product_id'         => $product ? $product_id : 0,
		'price'              => $price,
		'installment_count'  => $price > 0 && $count > 1 ? $count : 0,
		'installment_amount' => $price > 0 && $count > 1 ? (float) ceil( $price / $count ) : 0.0,
		'start_date'         => $start ? strtotime( $start ) : 0,
		'ended'              => 'recorded' !== $format && $end && strtotime( $end . ' 23:59:59' ) < time(),
		'schedule'           => (string) get_post_meta( $course_id, '_nab_schedule', true ),
		'seats'              => (int) get_post_meta( $course_id, '_nab_seats', true ),
		'refund_policy'      => (string) get_post_meta( $course_id, '_nab_refund_policy', true ),
		'availability'       => function_exists( 'nab_course_availability' ) ? nab_course_availability( $course_id ) : array( 'seats_left' => null, 'sold_out' => false, 'regular' => 0, 'founding_left' => 0 ),
		'modules'            => $modules,
		'lesson_count'       => $lessons,
		'hours'              => (int) round( $minutes / 60 ),
		'includes'           => nab_course_list_meta( $course_id, '_tutor_course_material_includes' ),
		'outcomes'           => nab_course_list_meta( $course_id, '_tutor_course_benefits' ),
		'requirements'       => nab_course_list_meta( $course_id, '_tutor_course_requirements' ),
		'audience'           => nab_course_list_meta( $course_id, '_tutor_course_target_audience' ),
	);
}

/**
 * Format a price with no decimals when it's a whole number ($3,000 not $3,000.00).
 *
 * @param float $amount Amount.
 * @return string Plain text.
 */
function nab_money( $amount ) {
	$amount   = (float) $amount;
	$symbol   = function_exists( 'get_woocommerce_currency_symbol' ) ? html_entity_decode( get_woocommerce_currency_symbol() ) : '$';
	$decimals = floor( $amount ) === $amount ? 0 : 2;
	return $symbol . number_format_i18n( $amount, $decimals );
}

/**
 * Short meta line for cards: "Self-paced · 10 lessons" or "Starts Nov 4 · 10 sessions".
 *
 * @param array $course From nab_get_course().
 * @return string
 */
function nab_course_meta_line( $course ) {
	$parts = array();
	if ( 'recorded' === $course['format'] ) {
		$parts[] = __( 'Self-paced', 'nab-core' );
	} elseif ( $course['start_date'] ) {
		/* translators: %s: start date. */
		$parts[] = sprintf( __( 'Starts %s', 'nab-core' ), wp_date( 'M j, Y', $course['start_date'] ) );
	} else {
		$parts[] = __( 'Next cohort date coming soon', 'nab-core' );
	}
	if ( $course['lesson_count'] ) {
		/* translators: %d: number of lessons. */
		$parts[] = sprintf( _n( '%d lesson', '%d lessons', $course['lesson_count'], 'nab-core' ), $course['lesson_count'] );
	}
	return implode( ' · ', $parts );
}
