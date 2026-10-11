<?php
/**
 * Course page as a sales page: gradient hero with cover, then outcomes,
 * audience, dated syllabus, projects, instructor and reviews beside a sticky
 * enroll box (a bottom bar on phones). The theme's tutor/single-course.php
 * wraps this in the site header and footer.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Whether the current user is already enrolled.
 *
 * @param int $course_id Course ID.
 * @return bool
 */
function nab_user_enrolled( $course_id ) {
	if ( ! is_user_logged_in() ) {
		return false;
	}
	if ( class_exists( '\Tutor\Models\EnrollmentModel' ) ) {
		return (bool) \Tutor\Models\EnrollmentModel::is_enrolled( $course_id, get_current_user_id() );
	}
	return false;
}

/**
 * Checkout link for a course's product.
 *
 * @param array  $c    From nab_get_course().
 * @param string $plan full|installments.
 * @return string
 */
function nab_checkout_url( $c, $plan = 'full' ) {
	if ( ! $c['product_id'] || ! function_exists( 'wc_get_checkout_url' ) ) {
		return '';
	}
	$args = array( 'add-to-cart' => $c['product_id'] );
	if ( 'full' !== $plan ) {
		$args['nab_plan'] = $plan;
	}
	return add_query_arg( $args, wc_get_checkout_url() );
}

/**
 * Small inline icon (lucide paths) for the meta row.
 *
 * @param string $name calendar|clock|layers.
 * @return string SVG.
 */
function nab_icon( $name ) {
	$paths = array(
		'calendar' => '<rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
		'clock'    => '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
		'layers'   => '<path d="m12 2 10 5-10 5L2 7z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
	);
	return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $paths[ $name ] . '</svg>';
}

/**
 * Full course page body.
 *
 * @param int $course_id Course ID.
 * @return string HTML.
 */
function nab_render_course_page( $course_id ) {
	$c        = nab_get_course( $course_id );
	$demo     = nab_demo_on() ? nab_demo() : null;
	$enrolled = nab_user_enrolled( $course_id );
	$live     = 'recorded' !== $c['format'];
	$start    = $c['start_date'] ? $c['start_date'] : ( $live && $demo && nab_demo_claims() ? $demo['next_start'] : 0 );
	$outcomes = $c['outcomes'] ? $c['outcomes'] : ( $demo ? $demo['outcomes'] : array() );
	$audience = $c['audience'] ? $c['audience'] : ( $demo ? $demo['audience'] : array() );
	$cover    = nab_course_cover( $c );
	$content  = apply_filters( 'the_content', get_post_field( 'post_content', $course_id ) );
	$author   = get_userdata( (int) get_post_field( 'post_author', $course_id ) );
	$weeks    = count( $c['modules'] );

	ob_start();
	?>
	<section class="nab-cp-hero">
		<div class="nab-mesh" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
		<div class="nab-wrap">
			<div>
				<nav class="nab-crumbs" aria-label="<?php esc_attr_e( 'Breadcrumb', 'nab-core' ); ?>"><a href="<?php echo esc_url( get_post_type_archive_link( 'courses' ) ); ?>"><?php esc_html_e( 'Courses', 'nab-core' ); ?></a> / <span aria-current="page"><?php echo esc_html( $live ? __( 'Live cohort', 'nab-core' ) : __( 'Self-paced', 'nab-core' ) ); ?></span></nav>
				<span class="nab-badge<?php echo $live ? ' nab-badge--live' : ''; ?>"><?php echo esc_html( $live ? __( 'Live cohort', 'nab-core' ) : __( 'Self-paced course', 'nab-core' ) ); ?></span>
				<h1><?php echo esc_html( $c['title'] ); ?></h1>
				<?php if ( $c['tagline'] ) : ?>
					<p class="nab-cp-tagline"><?php echo esc_html( $c['tagline'] ); ?></p>
				<?php endif; ?>
				<ul class="nab-cp-meta">
					<li><?php echo nab_icon( 'calendar' ); // phpcs:ignore WordPress.Security.EscapeOutput -- static SVG. ?><?php echo esc_html( $live ? ( $start ? sprintf( /* translators: %s: date. */ __( 'Starts %s', 'nab-core' ), wp_date( 'F j, Y', $start ) ) : __( 'Dates announced soon', 'nab-core' ) ) : __( 'Start any time', 'nab-core' ) ); ?></li>
					<?php if ( $weeks ) : ?>
						<li><?php echo nab_icon( 'layers' ); // phpcs:ignore WordPress.Security.EscapeOutput ?><?php echo esc_html( sprintf( /* translators: 1: weeks, 2: sessions. */ __( '%1$d weeks, %2$d sessions', 'nab-core' ), $weeks, $c['lesson_count'] ) ); ?></li>
					<?php endif; ?>
					<?php if ( $c['hours'] ) : ?>
						<li><?php echo nab_icon( 'clock' ); // phpcs:ignore WordPress.Security.EscapeOutput ?><?php echo esc_html( sprintf( /* translators: %d: hours. */ __( 'About %d hours', 'nab-core' ), $c['hours'] ) ); ?></li>
					<?php endif; ?>
					<?php if ( $author ) : ?>
						<li><?php echo $demo ? '<img src="' . esc_url( $demo['instructor']['photo'] ) . '" alt="" width="28" height="28" />' : ''; ?><?php echo esc_html( sprintf( /* translators: %s: name. */ __( 'With %s', 'nab-core' ), $author->display_name ) ); ?></li>
					<?php endif; ?>
					<?php if ( $demo && nab_demo_claims() ) : ?>
						<li><span class="nab-cp-stars" aria-hidden="true">★★★★★</span><?php echo esc_html( sprintf( /* translators: 1: rating, 2: count. */ __( '%1$s (%2$d reviews)', 'nab-core' ), number_format_i18n( $demo['rating'][0], 1 ), $demo['rating'][1] ) ); ?></li>
					<?php endif; ?>
				</ul>
				<div class="nab-cp-actions">
					<?php echo nab_course_primary_action( $c, $enrolled ); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside. ?>
					<?php if ( ! $enrolled && ! $c['ended'] && $c['installment_count'] ) : ?>
						<small><?php echo esc_html( sprintf( /* translators: 1: count, 2: amount. */ __( 'or %1$d monthly payments of %2$s', 'nab-core' ), $c['installment_count'], nab_money( $c['installment_amount'] ) ) ); ?></small>
					<?php endif; ?>
				</div>
			</div>
			<?php if ( $cover ) : ?>
				<div class="nab-cp-cover"><img src="<?php echo esc_url( $cover ); ?>" alt="" width="1200" height="675" /></div>
			<?php endif; ?>
		</div>
	</section>

	<div class="nab-wrap nab-cp-body">
		<div class="nab-cp-main">
			<?php if ( $outcomes ) : ?>
				<section>
					<h2><?php esc_html_e( 'What you’ll learn', 'nab-core' ); ?></h2>
					<ul class="nab-checks"><?php foreach ( $outcomes as $o ) : ?><li><?php echo esc_html( $o ); ?></li><?php endforeach; ?></ul>
				</section>
			<?php endif; ?>

			<?php if ( trim( wp_strip_all_tags( $content ) ) ) : ?>
				<section>
					<h2><?php esc_html_e( 'About this course', 'nab-core' ); ?></h2>
					<div class="nab-prose"><?php echo wp_kses_post( $content ); ?></div>
					<?php if ( $audience ) : ?>
						<h3 style="margin:2rem 0 1rem;font-size:1.25rem;font-weight:500"><?php esc_html_e( 'Who it’s for', 'nab-core' ); ?></h3>
						<ul class="nab-checks" style="grid-template-columns:1fr"><?php foreach ( $audience as $a ) : ?><li><?php echo esc_html( $a ); ?></li><?php endforeach; ?></ul>
					<?php endif; ?>
				</section>
			<?php endif; ?>

			<?php if ( $c['modules'] ) : ?>
				<section class="nab-syllabus">
					<h2><?php esc_html_e( 'Syllabus', 'nab-core' ); ?></h2>
					<?php foreach ( $c['modules'] as $i => $m ) : ?>
						<?php
						$title = preg_replace( '/^(Week|Module)\s+\d+\s*[.:—–-]?\s*/u', '', $m['title'] );
						$mins  = array_sum( array_column( $m['lessons'], 'minutes' ) );
						?>
						<details<?php echo 0 === $i ? ' open' : ''; ?>>
							<summary>
								<b><?php echo esc_html( sprintf( /* translators: %d: week. */ __( 'Week %d', 'nab-core' ), $i + 1 ) ); ?><?php echo ( $live && $start ) ? '<small>' . esc_html( wp_date( 'M j', strtotime( '+' . ( $i * 7 ) . ' days', $start ) ) ) . '</small>' : ''; ?></b>
								<span><?php echo esc_html( $title ); ?></span>
								<em><?php echo esc_html( sprintf( /* translators: %d: sessions. */ _n( '%d session', '%d sessions', count( $m['lessons'] ), 'nab-core' ), count( $m['lessons'] ) ) . ( $mins ? ' · ' . sprintf( '%dh', round( $mins / 60 ) ) : '' ) ); ?></em>
							</summary>
							<ol>
								<?php foreach ( $m['lessons'] as $l ) : ?>
									<li><span><?php echo esc_html( preg_replace( '/^Session\s+\d+\s*[—–-]\s*/u', '', $l['title'] ) ); ?><?php echo ! empty( $l['preview'] ) ? ' <a class="nab-preview-link" href="' . esc_url( nab_preview_url( $l['id'] ) ) . '">' . esc_html__( 'Watch free', 'nab-core' ) . '</a>' : ''; ?></span><?php echo $l['minutes'] ? '<small>' . esc_html( sprintf( '%d min', $l['minutes'] ) ) . '</small>' : ''; ?></li>
								<?php endforeach; ?>
							</ol>
						</details>
					<?php endforeach; ?>
				</section>
			<?php endif; ?>

			<?php $sessions = $live && function_exists( 'nab_course_sessions' ) ? nab_course_sessions( $course_id ) : array(); ?>
			<?php if ( $sessions ) : ?>
				<section>
					<h2><?php esc_html_e( 'Live session schedule', 'nab-core' ); ?></h2>
					<?php echo nab_render_session_list( $sessions, false ); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside. ?>
					<p class="nab-buy__policy" style="text-align:left"><?php esc_html_e( 'Join links are shared with enrolled students. Every session is recorded.', 'nab-core' ); ?></p>
				</section>
			<?php endif; ?>

			<?php if ( $demo && nab_demo_claims() ) : ?>
				<section>
					<h2><?php esc_html_e( 'What students have built', 'nab-core' ); ?></h2>
					<div class="nab-projects">
						<?php foreach ( array_slice( $demo['projects'], 0, 4 ) as $p ) : ?>
							<figure class="nab-project"><div class="nab-project__img"><img src="<?php echo esc_url( nab_demo_img( $p[3] ) ); ?>" alt="" width="1200" height="800" loading="lazy" /></div><figcaption><h3><?php echo esc_html( $p[0] ); ?></h3><p><?php echo esc_html( $p[1] ); ?></p></figcaption></figure>
						<?php endforeach; ?>
					</div>
				</section>
			<?php endif; ?>

			<section>
				<h2><?php esc_html_e( 'Your instructor', 'nab-core' ); ?></h2>
				<?php echo nab_render_instructor_block(); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside. ?>
			</section>

			<section>
				<h2><?php esc_html_e( 'Reviews', 'nab-core' ); ?></h2>
				<?php echo nab_render_reviews(); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside. ?>
			</section>
		</div>

		<aside class="nab-cp-aside">
			<div class="nab-buy">
				<?php if ( $enrolled ) : ?>
					<p class="nab-buy__price" style="font-size:1.75rem"><?php esc_html_e( 'You’re enrolled', 'nab-core' ); ?></p>
					<p class="nab-buy__alt"><?php esc_html_e( 'Pick up where you left off.', 'nab-core' ); ?></p>
				<?php elseif ( $c['ended'] ) : ?>
					<p class="nab-buy__price" style="font-size:1.75rem"><?php esc_html_e( 'This cohort has ended', 'nab-core' ); ?></p>
					<p class="nab-buy__alt"><?php esc_html_e( 'Enrollment is closed. See what’s open now.', 'nab-core' ); ?></p>
				<?php else : ?>
					<p class="nab-buy__price"><?php if ( $c['availability']['founding_left'] && $c['availability']['regular'] > $c['price'] ) : ?><s class="nab-strike"><?php echo esc_html( nab_money( $c['availability']['regular'] ) ); ?></s> <?php endif; ?><?php echo esc_html( nab_money( $c['price'] ) ); ?></p>
					<?php echo nab_availability_tag( $c ); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside. ?>
					<p class="nab-buy__alt"><?php echo esc_html( $c['installment_count'] ? sprintf( /* translators: 1: count, 2: amount. */ __( 'or %1$d monthly payments of %2$s', 'nab-core' ), $c['installment_count'], nab_money( $c['installment_amount'] ) ) : __( 'One-time payment', 'nab-core' ) ); ?></p>
				<?php endif; ?>
				<?php echo nab_course_primary_action( $c, $enrolled, true ); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside. ?>
				<?php if ( ! $enrolled && ! $c['ended'] && $c['installment_count'] && apply_filters( 'nab_installments_enabled', false, $c ) ) : ?>
					<a class="nab-btn nab-btn--outline" href="<?php echo esc_url( nab_checkout_url( $c, 'installments' ) ); ?>"><?php echo esc_html( sprintf( /* translators: %d: count. */ __( 'Pay in %d installments', 'nab-core' ), $c['installment_count'] ) ); ?></a>
				<?php endif; ?>
				<?php if ( $c['refund_policy'] && ! $enrolled ) : ?>
					<p class="nab-buy__policy"><?php echo esc_html( $c['refund_policy'] ); ?></p>
				<?php endif; ?>
				<?php if ( $c['includes'] ) : ?>
					<ul class="nab-buy__list">
						<li class="nab-buy__head" style="padding:0"><?php esc_html_e( 'What’s included', 'nab-core' ); ?></li>
						<?php foreach ( $c['includes'] as $item ) : ?>
							<li><?php echo esc_html( $item ); ?></li>
						<?php endforeach; ?>
					</ul>
				<?php endif; ?>
			</div>
		</aside>
	</div>

	<?php if ( ! $enrolled && ! $c['ended'] && $c['price'] > 0 ) : ?>
		<div class="nab-cp-bar"><span><b class="nab-num"><?php echo esc_html( nab_money( $c['price'] ) ); ?></b><?php echo $c['installment_count'] ? '<small>' . esc_html( sprintf( /* translators: 1: count, 2: amount. */ __( 'or %1$d × %2$s a month', 'nab-core' ), $c['installment_count'], nab_money( $c['installment_amount'] ) ) ) . '</small>' : ''; ?></span><a class="nab-btn" href="<?php echo esc_url( nab_checkout_url( $c ) ); ?>"><?php esc_html_e( 'Enroll now', 'nab-core' ); ?></a></div>
	<?php endif; ?>
	<?php
	return (string) ob_get_clean();
}

/**
 * The main button: enroll / go to course / browse open courses.
 *
 * @param array $c        Course.
 * @param bool  $enrolled Enrolled?
 * @param bool  $block    Full width.
 * @return string HTML.
 */
function nab_course_primary_action( $c, $enrolled, $block = false ) {
	$cls = 'nab-btn' . ( $block ? ' nab-btn--block' : '' );
	if ( $enrolled ) {
		return '<a class="' . $cls . '" href="' . esc_url( tutor_utils()->get_tutor_dashboard_page_permalink( 'enrolled-courses' ) ) . '">' . esc_html__( 'Go to my course', 'nab-core' ) . '</a>';
	}
	if ( ! empty( $c['availability']['sold_out'] ) ) {
		return '<span class="' . $cls . ' nab-btn--outline" aria-disabled="true">' . esc_html__( 'Sold out', 'nab-core' ) . '</span>';
	}
	if ( $c['ended'] || $c['price'] <= 0 ) {
		return '<a class="' . $cls . '" href="' . esc_url( get_post_type_archive_link( 'courses' ) ) . '">' . esc_html__( 'Browse open courses', 'nab-core' ) . '</a>';
	}
	/* translators: %s: price. */
	return '<a class="' . $cls . '" href="' . esc_url( nab_checkout_url( $c ) ) . '">' . esc_html( sprintf( __( 'Enroll for %s', 'nab-core' ), nab_money( $c['price'] ) ) ) . '</a>';
}
