<?php
/**
 * Dynamic blocks the theme's templates and patterns use for live course data.
 * They render on the server, so crawlers see the real courses and prices.
 *
 * nab/courses         Course card grid. {"limit":3,"format":"auto"}; "auto" reads ?format=.
 * nab/course-filters  Format filter pills for the catalog.
 * nab/hero-courses    Hero illustration with real course cards.
 * nab/pricing         Pay-in-full / installment tiles per course.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Format requested in the URL, if valid.
 *
 * @return string
 */
function nab_requested_format() {
	$format = isset( $_GET['format'] ) ? sanitize_key( wp_unslash( $_GET['format'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification -- read-only filter.
	return array_key_exists( $format, nab_course_formats() ) ? $format : '';
}

/**
 * One course card.
 *
 * @param array $c From nab_get_course().
 * @return string HTML.
 */
function nab_render_course_card( $c ) {
	$when  = 'recorded' === $c['format']
		? __( 'Self-paced', 'nab-core' )
		: ( $c['start_date'] ? sprintf( /* translators: %s: date. */ __( 'Starts %s', 'nab-core' ), wp_date( 'M j', $c['start_date'] ) ) : __( 'Dates announced soon', 'nab-core' ) );
	$cover = nab_course_cover( $c );
	ob_start();
	?>
	<article class="nab-course-card">
		<?php if ( $cover ) : ?>
			<div class="nab-course-card__cover"><img src="<?php echo esc_url( $cover ); ?>" alt="" width="1200" height="675" loading="lazy" /></div>
		<?php endif; ?>
		<div class="nab-course-card__body">
			<p class="nab-course-card__meta-top"><span class="nab-badge<?php echo 'recorded' === $c['format'] ? '' : ' nab-badge--live'; ?>"><?php echo esc_html( 'recorded' === $c['format'] ? __( 'Self-paced', 'nab-core' ) : $c['format_label'] ); ?></span><?php echo 'recorded' === $c['format'] ? '' : '<span>' . esc_html( $when ) . '</span>'; ?><?php echo $c['lesson_count'] ? '<span>' . esc_html( sprintf( /* translators: %d: sessions. */ _n( '%d session', '%d sessions', $c['lesson_count'], 'nab-core' ), $c['lesson_count'] ) ) . '</span>' : ''; ?><?php echo nab_availability_tag( $c ); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside. ?></p>
			<h3 class="nab-course-card__title"><a href="<?php echo esc_url( $c['url'] ); ?>"><?php echo esc_html( $c['title'] ); ?></a></h3>
			<?php if ( $c['tagline'] ) : ?>
				<p class="nab-course-card__tagline"><?php echo esc_html( $c['tagline'] ); ?></p>
			<?php endif; ?>
			<div class="nab-course-card__foot">
				<span><?php if ( $c['availability']['founding_left'] && $c['availability']['regular'] > $c['price'] ) : ?><s class="nab-strike"><?php echo esc_html( nab_money( $c['availability']['regular'] ) ); ?></s> <?php endif; ?><span class="nab-course-card__amount"><?php echo esc_html( $c['price'] > 0 ? nab_money( $c['price'] ) : __( 'Free', 'nab-core' ) ); ?></span>
				<?php if ( $c['installment_count'] ) : ?>
					<span class="nab-course-card__installment"><?php echo esc_html( sprintf( /* translators: 1: count, 2: amount. */ __( 'or %1$d × %2$s', 'nab-core' ), $c['installment_count'], nab_money( $c['installment_amount'] ) ) ); ?></span>
				<?php endif; ?></span>
				<span class="nab-course-card__go"><?php esc_html_e( 'View course', 'nab-core' ); ?></span>
			</div>
		</div>
	</article>
	<?php
	return (string) ob_get_clean();
}

/**
 * Cover image: the course's featured image, or a demo cover in demo mode.
 *
 * @param array $c From nab_get_course().
 * @return string URL or ''.
 */
function nab_course_cover( $c ) {
	if ( $c['image'] ) {
		return $c['image'];
	}
	if ( ! nab_demo_on() ) {
		return '';
	}
	if ( str_contains( $c['url'], 'build-production-ready' ) ) {
		return nab_demo_img( 'recorded' === $c['format'] ? 'cover-recorded.png' : 'cover-live.png' );
	}
	return nab_demo_img( 'cover-generic.png' );
}

/**
 * nab/courses
 *
 * @param array $atts Block attributes.
 * @return string HTML.
 */
function nab_render_block_courses( $atts ) {
	$atts   = wp_parse_args(
		(array) $atts,
		array(
			'limit'  => -1,
			'format' => '',
		)
	);
	$format = 'auto' === $atts['format'] ? nab_requested_format() : sanitize_key( $atts['format'] );
	$ids    = nab_get_course_ids( $format, (int) $atts['limit'] );
	if ( ! $ids ) {
		return '<p class="nab-course-card__tagline">' . esc_html__( 'No courses in this format right now. New cohorts are announced regularly.', 'nab-core' ) . '</p>';
	}
	$html = '<div class="nab-course-grid">';
	foreach ( $ids as $id ) {
		$html .= nab_render_course_card( nab_get_course( $id ) );
	}
	return $html . '</div>';
}

/**
 * nab/course-filters: only formats that actually have courses get a pill.
 *
 * @return string HTML.
 */
function nab_render_block_course_filters() {
	$counts  = nab_count_courses_by_format();
	$current = nab_requested_format();
	$base    = get_post_type_archive_link( 'courses' );
	$html    = '<nav class="nab-filters" aria-label="' . esc_attr__( 'Filter by format', 'nab-core' ) . '">';
	$html   .= sprintf(
		'<a href="%s"%s>%s<span>%d</span></a>',
		esc_url( $base ),
		'' === $current ? ' aria-current="page"' : '',
		esc_html__( 'All courses', 'nab-core' ),
		array_sum( $counts )
	);
	foreach ( nab_course_formats() as $slug => $label ) {
		if ( ! $counts[ $slug ] ) {
			continue;
		}
		$html .= sprintf(
			'<a href="%s"%s>%s<span>%d</span></a>',
			esc_url( add_query_arg( 'format', $slug, $base ) ),
			$slug === $current ? ' aria-current="page"' : '',
			esc_html( $label ),
			$counts[ $slug ]
		);
	}
	return $html . '</nav>';
}

/**
 * nab/hero-courses: decorative cards in the hero, linking to real courses.
 *
 * @return string HTML.
 */
function nab_render_block_hero_courses() {
	$ids  = nab_get_course_ids( '', 3 );
	$html = '<div class="nab-hero-art">';
	foreach ( $ids as $id ) {
		$c     = nab_get_course( $id );
		$html .= sprintf(
			'<a class="nab-hero-art__card" href="%1$s"><span class="nab-badge nab-badge--%2$s">%3$s</span><p class="nab-hero-art__title">%4$s</p><span class="nab-hero-art__meta">%5$s</span></a>',
			esc_url( $c['url'] ),
			esc_attr( $c['format'] ),
			esc_html( $c['format_label'] ),
			esc_html( $c['title'] ),
			esc_html( nab_course_meta_line( $c ) )
		);
	}
	$open = count( $ids );
	if ( $open ) {
		$html .= sprintf(
			'<div class="nab-hero-art__stat"><strong>%d</strong>%s</div>',
			$open,
			esc_html( _n( 'course open for enrollment', 'courses open for enrollment', $open, 'nab-core' ) )
		);
	}
	return $html . '</div>';
}

/**
 * nab/pricing: a row of tiles per course so every price is shown, not just the first.
 *
 * @return string HTML.
 */
function nab_render_block_pricing() {
	$html = '';
	foreach ( nab_get_course_ids() as $id ) {
		$c = nab_get_course( $id );
		if ( $c['price'] <= 0 ) {
			continue;
		}
		$html .= '<div class="nab-pricing-row">';
		$html .= sprintf( '<p class="nab-pricing-row__title">%s · %s</p>', esc_html( $c['format_label'] ), esc_html( $c['title'] ) );
		$html .= '<div class="nab-pricing-tiles">';
		$html .= sprintf(
			'<div class="nab-price-tile"><p class="nab-price-tile__label">%s</p><p class="nab-price-tile__amount">%s</p><p class="nab-price-tile__note">%s</p></div>',
			esc_html__( 'Pay in full', 'nab-core' ),
			esc_html( nab_money( $c['price'] ) ),
			esc_html__( 'One-time payment', 'nab-core' )
		);
		if ( $c['installment_count'] ) {
			$html .= sprintf(
				'<div class="nab-price-tile nab-price-tile--featured"><p class="nab-price-tile__label">%s</p><p class="nab-price-tile__amount">%s<small>/mo</small></p><p class="nab-price-tile__note">%s</p></div>',
				esc_html__( 'Installment plan', 'nab-core' ),
				esc_html( nab_money( $c['installment_amount'] ) ),
				/* translators: %d: number of monthly payments. */
				esc_html( sprintf( __( '× %d monthly payments, no extra cost', 'nab-core' ), $c['installment_count'] ) )
			);
		}
		$html .= sprintf( '<a class="nab-btn" href="%s">%s</a>', esc_url( $c['url'] ), esc_html__( 'View course', 'nab-core' ) );
		$html .= '</div></div>';
	}
	return $html;
}

/**
 * Register the dynamic blocks plus a tiny editor script that previews them.
 */
function nab_register_blocks() {
	wp_register_script(
		'nab-blocks-editor',
		plugins_url( 'assets/blocks-editor.js', NAB_CORE_DIR . 'nab-core.php' ),
		array( 'wp-blocks', 'wp-element', 'wp-server-side-render', 'wp-block-editor' ),
		NAB_CORE_VERSION,
		true
	);
	$blocks = array(
		'courses'        => array(
			'title'      => __( 'Course cards', 'nab-core' ),
			'callback'   => 'nab_render_block_courses',
			'attributes' => array(
				'limit'  => array(
					'type'    => 'number',
					'default' => -1,
				),
				'format' => array(
					'type'    => 'string',
					'default' => '',
				),
			),
		),
		'course-filters' => array(
			'title'    => __( 'Course format filters', 'nab-core' ),
			'callback' => 'nab_render_block_course_filters',
		),
		'hero-courses'   => array(
			'title'    => __( 'Hero course cards', 'nab-core' ),
			'callback' => 'nab_render_block_hero_courses',
		),
		'pricing'        => array(
			'title'    => __( 'Course pricing tiles', 'nab-core' ),
			'callback' => 'nab_render_block_pricing',
		),
	);
	foreach ( $blocks as $name => $block ) {
		register_block_type(
			'nab/' . $name,
			array(
				'api_version'     => 3,
				'title'           => $block['title'],
				'category'        => 'widgets',
				'attributes'      => $block['attributes'] ?? array(),
				'render_callback' => $block['callback'],
				'editor_script'   => 'nab-blocks-editor',
				'supports'        => array( 'html' => false ),
			)
		);
	}
}
add_action( 'init', 'nab_register_blocks' );

/**
 * The live course whose curriculum the homepage shows: the first open live
 * cohort, falling back to any open course.
 *
 * @return array|null From nab_get_course().
 */
function nab_flagship_course() {
	// Prefer a live cohort that hasn't started yet (or has no date yet).
	foreach ( nab_get_course_ids( 'live' ) as $id ) {
		$c = nab_get_course( $id );
		if ( ! $c['start_date'] || $c['start_date'] >= strtotime( 'today' ) ) {
			return $c;
		}
	}
	$ids = nab_get_course_ids();
	return $ids ? nab_get_course( $ids[0] ) : null;
}

/**
 * nab/ship-log: the curriculum rendered as a build log (hero visual).
 *
 * @return string HTML.
 */
function nab_render_block_ship_log() {
	$c = nab_flagship_course();
	if ( ! $c || ! $c['modules'] ) {
		return '';
	}
	$html = '<figure class="nab-shiplog" aria-label="' . esc_attr__( 'Course curriculum, week by week', 'nab-core' ) . '"><div class="nab-shiplog__bar"><span></span><span></span><span></span><b>your-product</b></div><ol class="nab-shiplog__body">';
	$i    = 0;
	foreach ( $c['modules'] as $module ) {
		$title = preg_replace( '/^(Week|Module)\s+\d+\s*[.:—–-]?\s*/u', '', $module['title'] );
		$html .= sprintf( '<li style="--i:%d"><span class="nab-shiplog__week">%s</span> %s', $i++, esc_html( sprintf( /* translators: %d: week number. */ __( 'week %d', 'nab-core' ), $i ) ), esc_html( $title ) );
		$html .= '<ul>';
		foreach ( array_slice( $module['lessons'], 0, 2 ) as $lesson ) {
			$html .= '<li>' . esc_html( preg_replace( '/^Session\s+\d+\s*[—–-]\s*/u', '', $lesson['title'] ) ) . '</li>';
		}
		$more = count( $module['lessons'] ) - 2;
		if ( $more > 0 ) {
			/* translators: %d: number of further sessions. */
			$html .= '<li class="nab-shiplog__more">' . esc_html( sprintf( _n( '%d more session', '%d more sessions', $more, 'nab-core' ), $more ) ) . '</li>';
		}
		$html .= '</ul></li>';
	}
	$html .= sprintf( '<li class="nab-shiplog__done" style="--i:%d"><span class="nab-shiplog__prompt">$</span> ship --prod <span class="nab-shiplog__ok">%s</span><span class="nab-shiplog__cursor" aria-hidden="true"></span></li>', $i, esc_html__( 'live for real users', 'nab-core' ) );
	return $html . '</ol></figure>';
}

/**
 * nab/format-compare: live cohort vs self-paced, side by side.
 *
 * @return string HTML.
 */
function nab_render_block_format_compare() {
	$cols = array();
	foreach ( array( 'live', 'recorded' ) as $format ) {
		$ids = nab_get_course_ids( $format, 1 );
		if ( $ids ) {
			$cols[ $format ] = nab_get_course( $ids[0] );
		}
	}
	if ( ! $cols ) {
		return '';
	}
	$rows = array(
		__( 'Price', 'nab-core' )        => static fn( $c ) => '<strong class="nab-compare__price">' . esc_html( nab_money( $c['price'] ) ) . '</strong>' . ( $c['installment_count'] ? '<span>' . esc_html( sprintf( /* translators: 1: count, 2: amount. */ __( 'or %1$d monthly payments of %2$s', 'nab-core' ), $c['installment_count'], nab_money( $c['installment_amount'] ) ) ) . '</span>' : '' ),
		__( 'Schedule', 'nab-core' )     => static fn( $c ) => esc_html( 'recorded' === $c['format'] ? __( 'Start today, go at your own pace', 'nab-core' ) : ( $c['start_date'] ? sprintf( /* translators: %s: date. */ __( 'Starts %s, live sessions weekly', 'nab-core' ), wp_date( 'F j', $c['start_date'] ) ) : __( 'Next start date announced soon', 'nab-core' ) ) ),
		__( 'Sessions', 'nab-core' )     => static fn( $c ) => esc_html( sprintf( /* translators: 1: lessons, 2: hours. */ __( '%1$d sessions, about %2$d hours', 'nab-core' ), $c['lesson_count'], $c['hours'] ) ),
		__( 'Instructor', 'nab-core' )   => static fn( $c ) => esc_html( 'recorded' === $c['format'] ? __( 'Recorded walkthroughs', 'nab-core' ) : __( 'Live Q&A and code reviews', 'nab-core' ) ),
		__( 'Refunds', 'nab-core' )      => static fn( $c ) => esc_html( $c['refund_policy'] ? $c['refund_policy'] : __( 'See refund policy', 'nab-core' ) ),
	);
	$html = '<div class="nab-compare" role="table" aria-label="' . esc_attr__( 'Compare course formats', 'nab-core' ) . '"><div class="nab-compare__row nab-compare__head" role="row"><span role="columnheader"></span>';
	foreach ( $cols as $c ) {
		$html .= sprintf( '<span role="columnheader"><b>%s</b><a href="%s">%s</a></span>', esc_html( 'recorded' === $c['format'] ? __( 'Self-paced', 'nab-core' ) : __( 'Live cohort', 'nab-core' ) ), esc_url( $c['url'] ), esc_html( $c['title'] ) );
	}
	$html .= '</div>';
	foreach ( $rows as $label => $cell ) {
		$html .= '<div class="nab-compare__row" role="row"><span role="rowheader">' . esc_html( $label ) . '</span>';
		foreach ( $cols as $c ) {
			$html .= '<span role="cell">' . $cell( $c ) . '</span>';
		}
		$html .= '</div>';
	}
	$html .= '<div class="nab-compare__row nab-compare__foot" role="row"><span></span>';
	foreach ( $cols as $c ) {
		$html .= sprintf( '<span role="cell"><a class="nab-btn%s" href="%s">%s</a></span>', 'recorded' === $c['format'] ? ' nab-btn--outline' : '', esc_url( $c['url'] ), esc_html( 'recorded' === $c['format'] ? __( 'Start self-paced', 'nab-core' ) : __( 'Join the live cohort', 'nab-core' ) ) );
	}
	return $html . '</div></div>';
}

add_action(
	'init',
	static function () {
		foreach ( array( 'ship-log' => 'nab_render_block_ship_log', 'format-compare' => 'nab_render_block_format_compare' ) as $name => $cb ) {
			register_block_type(
				'nab/' . $name,
				array(
					'api_version'     => 3,
					'title'           => 'ship-log' === $name ? __( 'Curriculum ship log', 'nab-core' ) : __( 'Format comparison', 'nab-core' ),
					'category'        => 'widgets',
					'render_callback' => $cb,
					'editor_script'   => 'nab-blocks-editor',
				)
			);
		}
	},
	20
);

/**
 * "Sold out" / "N seats left" / "Founding price: N left" tag.
 *
 * @param array $c Course.
 * @return string HTML.
 */
function nab_availability_tag( $c ) {
	$a = $c['availability'];
	if ( $a['sold_out'] ) {
		return '<span class="nab-tag nab-tag--out">' . esc_html__( 'Sold out', 'nab-core' ) . '</span>';
	}
	if ( $a['founding_left'] ) {
		/* translators: %d: seats. */
		return '<span class="nab-tag nab-tag--hot">' . esc_html( sprintf( _n( 'Founding price: %d seat left', 'Founding price: %d seats left', $a['founding_left'], 'nab-core' ), $a['founding_left'] ) ) . '</span>';
	}
	if ( null !== $a['seats_left'] && $a['seats_left'] <= 10 ) {
		/* translators: %d: seats. */
		return '<span class="nab-tag nab-tag--hot">' . esc_html( sprintf( _n( '%d seat left', '%d seats left', $a['seats_left'], 'nab-core' ), $a['seats_left'] ) ) . '</span>';
	}
	return '';
}
