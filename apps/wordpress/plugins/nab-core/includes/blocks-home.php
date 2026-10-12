<?php
/**
 * Homepage and course-page sections (server-rendered blocks):
 * nab/hero-visual, nab/projects, nab/timeline, nab/instructor, nab/pricing-cards,
 * nab/reviews. Real data first; demo data (demo.php) only while demo mode is on.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Next live start date: the flagship course's date, else the demo date.
 *
 * @return int Timestamp or 0.
 */
function nab_next_start() {
	$c = nab_flagship_course();
	if ( $c && $c['start_date'] && $c['start_date'] >= strtotime( 'today' ) ) {
		return $c['start_date'];
	}
	return nab_demo_claims() ? nab_demo()['next_start'] : 0;
}

/**
 * nab/hero-visual: layered product composite (Claude Code session, a student
 * project, lesson progress). Coded UI, not a photo.
 *
 * @return string HTML.
 */
function nab_render_hero_visual() {
	$c       = nab_flagship_course();
	$lessons = array();
	if ( $c ) {
		foreach ( array_slice( $c['modules'], 0, 3 ) as $i => $m ) {
			$lessons[] = array( $i + 1, preg_replace( '/^(Week|Module)\s+\d+\s*[.:—–-]?\s*/u', '', $m['title'] ) );
		}
	}
	ob_start();
	?>
	<div class="nab-visual" aria-hidden="true">
		<div class="nab-visual__term">
			<div class="nab-visual__bar"><span></span><span></span><span></span><b>claude — your-product</b></div>
			<div class="nab-visual__code">
				<p><span class="p">$</span> claude</p>
				<p class="u">› Read docs/PRD.md and build the onboarding flow. Write tests first.</p>
				<p class="a">● Reading docs/PRD.md (3 user stories, 9 acceptance criteria)</p>
				<p class="a">● Creating src/onboarding/checklist.tsx</p>
				<p class="a">● Writing tests/onboarding.test.ts — 12 tests</p>
				<p class="ok">✓ 12 passed · ready for review</p>
			</div>
		</div>
		<div class="nab-visual__toast"><span>✓</span><p><b><?php esc_html_e( 'Instructor review', 'nab-core' ); ?></b><?php esc_html_e( 'Ship it. Clean tests and a clear PRD.', 'nab-core' ); ?></p></div>
		<?php if ( $lessons ) : ?>
			<div class="nab-visual__progress">
				<p class="nab-visual__label"><?php esc_html_e( 'Your progress', 'nab-core' ); ?></p>
				<?php foreach ( $lessons as $n => $l ) : ?>
					<p class="<?php echo 0 === $n ? 'done' : ( 1 === $n ? 'now' : '' ); ?>"><span><?php echo (int) $l[0]; ?></span><?php echo esc_html( $l[1] ); ?></p>
				<?php endforeach; ?>
			</div>
		<?php endif; ?>
	</div>
	<?php
	return (string) ob_get_clean();
}

/**
 * nab/projects: what students build (demo until real projects exist).
 *
 * @return string HTML.
 */
function nab_render_projects() {
	if ( ! nab_demo_claims() ) {
		return '';
	}
	$html = '<div class="nab-projects">';
	foreach ( nab_demo()['projects'] as $p ) {
		$html .= sprintf(
			'<figure class="nab-project"><div class="nab-project__img"><img src="%s" alt="%s" width="1200" height="800" loading="lazy" /></div><figcaption><h3>%s</h3><p>%s</p><span>%s</span></figcaption></figure>',
			esc_url( nab_demo_img( $p[3] ) ),
			/* translators: %s: project name. */
			esc_attr( sprintf( __( 'Screenshot of %s', 'nab-core' ), $p[0] ) ),
			esc_html( $p[0] ),
			esc_html( $p[1] ),
			/* translators: %s: student. */
			esc_html( sprintf( __( 'Built by %s', 'nab-core' ), $p[2] ) )
		);
	}
	return $html . '</div>';
}

/**
 * nab/timeline: the flagship course, week by week (real curriculum).
 *
 * @return string HTML.
 */
function nab_render_timeline() {
	$c = nab_flagship_course();
	if ( ! $c || ! $c['modules'] ) {
		return '';
	}
	$start = nab_next_start();
	$last  = count( $c['modules'] ) - 1;
	$html  = '<ol class="nab-tl">';
	foreach ( $c['modules'] as $i => $m ) {
		$title    = preg_replace( '/^(Week|Module)\s+\d+\s*[.:—–-]?\s*/u', '', $m['title'] );
		$when     = $start ? wp_date( 'M j', strtotime( '+' . ( $i * 7 ) . ' days', $start ) ) : '';
		$sessions = '';
		foreach ( $m['lessons'] as $l ) {
			$mins      = (int) ( $l['minutes'] ?? 0 );
			$len       = $mins ? ( $mins >= 60 && 0 === $mins % 60 ? sprintf( /* translators: %d: hours. */ __( '%d h', 'nab-core' ), $mins / 60 ) : sprintf( /* translators: %d: minutes. */ __( '%d min', 'nab-core' ), $mins ) ) : '';
			$sessions .= '<li><span>' . esc_html( preg_replace( '/^Session\s+\d+\s*[—–-]\s*/u', '', $l['title'] ) ) . '</span>' . ( $len ? '<span class="nab-tl__len">' . esc_html( $len ) . '</span>' : '' ) . '</li>';
		}
		$html .= sprintf(
			'<li class="nab-tl__week%1$s"><span class="nab-tl__node" aria-hidden="true">%2$d</span><div class="nab-tl__card"><p class="nab-tl__meta">%3$s</p><h3>%4$s</h3><ul class="nab-tl__sessions">%5$s</ul>%6$s</div></li>',
			$i === $last ? ' is-final' : '',
			$i + 1,
			/* translators: %d: week number. */
			esc_html( sprintf( __( 'Week %d', 'nab-core' ), $i + 1 ) . ( $when ? ' · ' . $when : '' ) ),
			esc_html( $title ),
			$sessions,
			$i === $last ? '<p class="nab-tl__finish">' . esc_html__( 'You ship your product', 'nab-core' ) . '</p>' : ''
		);
	}
	return $html . '</ol>';
}

/**
 * nab/timeline-intro: pinned summary + join button beside the timeline.
 *
 * @return string HTML.
 */
function nab_render_timeline_intro() {
	$c = nab_flagship_course();
	if ( ! $c ) {
		return '';
	}
	$facts = array(
		/* translators: %d: weeks. */
		sprintf( _n( '%d week', '%d weeks', count( $c['modules'] ), 'nab-core' ), count( $c['modules'] ) ),
		/* translators: %d: sessions. */
		sprintf( _n( '%d session', '%d sessions', (int) $c['lesson_count'], 'nab-core' ), (int) $c['lesson_count'] ),
	);
	if ( $c['hours'] ) {
		/* translators: %d: hours. */
		$facts[] = sprintf( __( 'about %d hours', 'nab-core' ), (int) $c['hours'] );
	}
	$join = function_exists( 'nab_primary_join' ) ? nab_primary_join() : array( 'label' => __( 'Browse courses', 'nab-core' ), 'url' => home_url( '/courses/' ) );
	return '<ul class="nab-tl-facts">' . implode( '', array_map( static fn( $f ) => '<li>' . esc_html( $f ) . '</li>', $facts ) ) . '</ul><p class="nab-tl-cta"><a class="nab-btn" href="' . esc_url( $join['url'] ) . '">' . esc_html( $join['label'] ) . '</a> <a class="nab-tl-syllabus" href="' . esc_url( $c['url'] ) . '#syllabus">' . esc_html__( 'Full syllabus', 'nab-core' ) . '</a></p>';
}

/**
 * nab/instructor: photo, bio and facts (demo bio/photo until real ones arrive).
 *
 * @return string HTML.
 */
function nab_render_instructor_block() {
	$author = nab_instructor_user();
	$real   = $author ? (string) get_user_meta( $author->ID, '_tutor_profile_bio', true ) : '';
	$demo   = nab_demo_claims() ? nab_demo()['instructor'] : null;
	$name   = $author ? $author->display_name : 'Aleem Haider';
	$role   = $author ? (string) get_user_meta( $author->ID, '_tutor_profile_job_title', true ) : '';
	$bio    = $demo ? $demo['bio'] : $real;
	$photo  = $demo ? $demo['photo'] : '';
	if ( ! $bio ) {
		return '';
	}
	$html = '<div class="nab-instructor">';
	$html .= $photo ? '<img class="nab-instructor__photo" src="' . esc_url( $photo ) . '" alt="' . esc_attr( $name ) . '" width="800" height="1000" loading="lazy" />' : '';
	$html .= '<div class="nab-instructor__text"><p class="nab-kicker">' . esc_html__( 'Your instructor', 'nab-core' ) . '</p><h2>' . esc_html( $name ) . '</h2><p class="nab-instructor__role">' . esc_html( $role ? $role : ( $demo['role'] ?? '' ) ) . '</p><p class="nab-instructor__bio">' . esc_html( $bio ) . '</p>';
	if ( $demo ) {
		$html .= '<ul class="nab-instructor__facts">' . implode( '', array_map( static fn( $f ) => '<li>' . esc_html( $f ) . '</li>', $demo['facts'] ) ) . '</ul>';
	}
	$links = array();
	foreach ( array( 'linkedin' => 'LinkedIn', 'twitter' => 'X', 'github' => 'GitHub', 'website' => __( 'Website', 'nab-core' ) ) as $key => $label ) {
		$url = $author ? (string) get_user_meta( $author->ID, '_tutor_profile_' . $key, true ) : '';
		if ( $url && wp_http_validate_url( $url ) ) {
			$links[] = '<a href="' . esc_url( $url ) . '" rel="noopener me" target="_blank">' . esc_html( $label ) . '</a>';
		}
	}
	$html .= $links ? '<p class="nab-instructor__links">' . implode( '', $links ) . '</p>' : '';
	return $html . '</div></div>';
}

/**
 * nab/pricing-cards: live (featured, dark) and self-paced, with plan details.
 *
 * @return string HTML.
 */
function nab_render_pricing_cards() {
	$cards = array();
	foreach ( array( 'live', 'recorded' ) as $format ) {
		$ids = 'live' === $format ? array_filter( array( nab_flagship_course()['id'] ?? 0 ) ) : nab_get_course_ids( $format, 1 );
		if ( $ids ) {
			$cards[] = nab_get_course( reset( $ids ) );
		}
	}
	if ( ! $cards ) {
		return '';
	}
	$start = nab_next_start();
	$html  = '<div class="nab-pricing">';
	foreach ( $cards as $c ) {
		$live  = 'recorded' !== $c['format'];
		$when  = $live ? ( $start ? sprintf( /* translators: %s: date. */ __( 'Next cohort starts %s', 'nab-core' ), wp_date( 'F j', $start ) ) : __( 'Next cohort dates announced soon', 'nab-core' ) ) : __( 'Start today, learn at your own pace', 'nab-core' );
		$items = $c['includes'] ? $c['includes'] : array();
		$html .= sprintf(
			'<article class="nab-price%1$s"><p class="nab-price__name">%2$s</p><p class="nab-price__when">%3$s</p><p class="nab-price__amount">%4$s</p><p class="nab-price__plan">%5$s</p><a class="nab-btn%6$s" href="%7$s">%8$s</a><ul>%9$s</ul></article>',
			$live ? ' nab-price--featured' : '',
			esc_html( $live ? __( 'Live cohort', 'nab-core' ) : __( 'Self-paced', 'nab-core' ) ),
			esc_html( $when ),
			esc_html( nab_money( $c['price'] ) ),
			esc_html( $c['installment_count'] ? sprintf( /* translators: 1: count, 2: amount. */ __( 'or %1$d monthly payments of %2$s', 'nab-core' ), $c['installment_count'], nab_money( $c['installment_amount'] ) ) : __( 'One-time payment', 'nab-core' ) ),
			$live ? ' nab-btn--light' : '',
			esc_url( $c['url'] ),
			esc_html( $live ? __( 'Join the live cohort', 'nab-core' ) : __( 'Start self-paced', 'nab-core' ) ),
			implode( '', array_map( static fn( $i ) => '<li>' . esc_html( $i ) . '</li>', $items ) )
		);
	}
	return $html . '</div>';
}

/**
 * Real alumni quotes (kept here so homepage and course pages share them).
 *
 * @return array<int, array{0:string,1:string,2:string,3:string}>
 */
function nab_real_testimonials() {
	return array(
		array( 'Gregg Laroche', 'VP Product Management, PreVeil', 'gregg-laroche.webp', 'I have run product teams for twenty years and this is the first course that actually changed how my engineers and I work together. The Reviewer agent is in every PR we ship now.' ),
		array( 'Gabor Mayer', 'Product Manager, Google', 'gabor-mayer.webp', 'Certifications do not move careers. Shipped products do. By the Capstone you have a public repo, a live AI feature and a release tag.' ),
		array( 'Orsolya Meckl', 'Product Owner, Orshe', 'orsolya-meckl.webp', 'I came in skeptical and left with a Jira epic, a Confluence PRD and Figma flows for a product I had been stuck on for months.' ),
		array( 'Giuseppe Spanò', 'Software Engineer', 'giuseppe-spano.webp', 'I built three agents in four weeks. My triage agent has been running on its own for two months.' ),
		array( 'Danny Chevilly', 'IT Consultant, Inventio IT A/S', 'danny-chevilly.webp', 'The n8n + LangGraph hybrid is now the backbone of three of my clients. What used to be a custom integration project is a one-week build.' ),
		array( 'Shamik', 'Founder', '', 'By Lesson 11 my one annoying Friday task was a scheduled agent, and I had my Friday afternoons back.' ),
	);
}

/**
 * Company of a reviewer, from their role line ("VP Product, PreVeil" → "PreVeil").
 *
 * @param string $role Role line.
 * @return string
 */
function nab_review_company( $role ) {
	$parts = array_map( 'trim', explode( ',', $role ) );
	return count( $parts ) > 1 ? end( $parts ) : '';
}

/**
 * One reviewer avatar (photo or initials).
 *
 * @param array $q   Quote row.
 * @param int   $px  Size.
 * @return string HTML.
 */
function nab_review_avatar( $q, $px = 44 ) {
	if ( $q[2] && function_exists( 'nextaibuilder_image' ) ) {
		return '<img class="nab-rv__avatar" src="' . esc_url( nextaibuilder_image( 'testimonials/' . $q[2] ) ) . '" alt="" width="' . $px . '" height="' . $px . '" loading="lazy" />';
	}
	$initials = implode( '', array_map( static fn( $w ) => mb_substr( $w, 0, 1 ), array_slice( explode( ' ', $q[0] ), 0, 2 ) ) );
	return '<span class="nab-rv__avatar nab-rv__avatar--initials" aria-hidden="true" style="width:' . $px . 'px;height:' . $px . 'px">' . esc_html( $initials ) . '</span>';
}

/**
 * Five-star row (decorative; the rating is stated in text where it matters).
 *
 * @return string HTML.
 */
function nab_stars() {
	return '<span class="nab-rv__stars" aria-hidden="true">' . str_repeat( '<svg viewBox="0 0 20 20"><path d="M10 1.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L10 14.9l-5.2 2.7 1-5.8L1.5 7.7l5.9-.9z"/></svg>', 5 ) . '</span>';
}

/**
 * nab/reviews: a featured spotlight (with the rating summary in demo mode),
 * then an even grid of review cards. Real testimonials first.
 *
 * @return string HTML.
 */
function nab_render_reviews() {
	$quotes = nab_real_testimonials();
	if ( nab_demo_claims() ) {
		foreach ( nab_demo()['reviews'] as $r ) {
			$quotes[] = array( $r[0], $r[1], '', $r[3] );
		}
	}
	$feature = array_shift( $quotes );

	$html  = '<div class="nab-rv">';
	$html .= '<div class="nab-rv__top">';
	$html .= '<figure class="nab-rv__spot">' . nab_stars() . '<blockquote>' . esc_html( $feature[3] ) . '</blockquote><figcaption>' . nab_review_avatar( $feature, 56 ) . '<span><b>' . esc_html( $feature[0] ) . '</b><small>' . esc_html( $feature[1] ) . '</small></span></figcaption></figure>';
	if ( nab_demo_claims() ) {
		[ $rating, $count ] = nab_demo()['rating'];
		$bars = array( 5 => 92, 4 => 6, 3 => 2, 2 => 0, 1 => 0 );
		$html .= '<div class="nab-rv__summary"><p class="nab-rv__score">' . esc_html( number_format_i18n( $rating, 1 ) ) . '</p>' . nab_stars() . '<p class="nab-rv__count">' . esc_html( sprintf( /* translators: %d: count. */ __( 'Average from %d student reviews', 'nab-core' ), $count ) ) . '</p><ul class="nab-rv__bars">';
		foreach ( $bars as $stars => $pct ) {
			$html .= '<li><span>' . (int) $stars . '★</span><i><b style="width:' . (int) $pct . '%"></b></i><span>' . (int) $pct . '%</span></li>';
		}
		$html .= '</ul></div>';
	}
	$html .= '</div><div class="nab-rv__grid">';
	foreach ( $quotes as $q ) {
		$html .= '<figure class="nab-rv__card">' . nab_stars() . '<blockquote>' . esc_html( $q[3] ) . '</blockquote><figcaption>' . nab_review_avatar( $q ) . '<span><b>' . esc_html( $q[0] ) . '</b><small>' . esc_html( $q[1] ) . '</small></span></figcaption></figure>';
	}
	return $html . '</div></div>';
}

add_action(
	'init',
	static function () {
		$blocks = array(
			'hero-visual'   => array( 'nab_render_hero_visual', __( 'Hero product visual', 'nab-core' ) ),
			'projects'      => array( 'nab_render_projects', __( 'Student projects', 'nab-core' ) ),
			'timeline'      => array( 'nab_render_timeline', __( 'Curriculum timeline', 'nab-core' ) ),
			'timeline-intro' => array( 'nab_render_timeline_intro', __( 'Curriculum summary', 'nab-core' ) ),
			'instructor'    => array( 'nab_render_instructor_block', __( 'Instructor', 'nab-core' ) ),
			'pricing-cards' => array( 'nab_render_pricing_cards', __( 'Pricing cards', 'nab-core' ) ),
			'reviews'       => array( 'nab_render_reviews', __( 'Reviews', 'nab-core' ) ),
		);
		foreach ( $blocks as $name => [ $cb, $title ] ) {
			register_block_type(
				'nab/' . $name,
				array(
					'api_version'     => 3,
					'title'           => $title,
					'category'        => 'widgets',
					'render_callback' => $cb,
					'editor_script'   => 'nab-blocks-editor',
				)
			);
		}
	},
	20
);
