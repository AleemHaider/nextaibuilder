<?php
/**
 * Homepage conversion blocks:
 *   nab/hero-proof   alumni faces + rating, refund and payment reassurance under the hero buttons
 *   nab/experience   what learning here looks like (AI-checked setup, live sessions,
 *                    AI helper, instructor review, certificate), drawn as small product UIs
 *   nab/guarantee    refund promise under the pricing cards
 *   nab/sticky-cta   bar that follows the visitor once the hero scrolls away
 *   nab/cta-actions  closing buttons for both formats
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Label + link for the primary "join" action (next live cohort, else courses).
 *
 * @return array{label:string,url:string,course:?array}
 */
function nab_primary_join() {
	$c = nab_flagship_course();
	if ( $c && 'recorded' !== $c['format'] && ! empty( $c['availability']['sold_out'] ) ) {
		$c = null;
	}
	$start = nab_next_start();
	if ( $c && 'recorded' !== $c['format'] ) {
		return array(
			/* translators: %s: date. */
			'label'  => $start ? sprintf( __( 'Join the %s cohort', 'nab-core' ), wp_date( 'M j', $start ) ) : __( 'Join the live cohort', 'nab-core' ),
			'url'    => $c['url'],
			'course' => $c,
		);
	}
	return array( 'label' => __( 'Browse courses', 'nab-core' ), 'url' => home_url( '/courses/' ), 'course' => $c );
}

/**
 * nab/hero-proof.
 *
 * @return string HTML.
 */
function nab_render_hero_proof() {
	$faces = array_slice( array_filter( nab_real_testimonials(), static fn( $q ) => '' !== $q[2] ), 0, 4 );
	$html  = '<div class="nab-proof">';
	if ( $faces ) {
		$html .= '<span class="nab-proof__faces">';
		foreach ( $faces as $q ) {
			$html .= '<img src="' . esc_url( nextaibuilder_image( 'testimonials/' . $q[2] ) ) . '" alt="" width="36" height="36" />';
		}
		$html .= '</span>';
	}
	if ( nab_demo_claims() ) {
		[ $rating, $count ] = nab_demo()['rating'];
		/* translators: 1: rating, 2: count. */
		$line = sprintf( __( '%1$s from %2$d student reviews', 'nab-core' ), number_format_i18n( $rating, 1 ), $count );
		$html .= '<span class="nab-proof__rating">' . nab_stars() . '<span>' . esc_html( $line ) . '</span></span>';
	} else {
		$html .= '<span class="nab-proof__rating"><span>' . esc_html__( 'Recommended by product leaders at Google and PreVeil', 'nab-core' ) . '</span></span>';
	}
	$html .= '<ul class="nab-proof__notes"><li>' . esc_html__( 'Full refund within 2 weeks', 'nab-core' ) . '</li><li>' . esc_html__( 'Pay in 3 monthly payments', 'nab-core' ) . '</li><li>' . esc_html__( 'Card or bank transfer', 'nab-core' ) . '</li></ul>';
	return $html . '</div>';
}

/**
 * nab/experience: a bento of small product UIs.
 *
 * @return string HTML.
 */
function nab_render_experience() {
	$c     = nab_flagship_course();
	$start = nab_next_start();
	$first = $c && $c['modules'] ? preg_replace( '/^(Week|Module)\s+\d+\s*[.:—–-]?\s*/u', '', $c['modules'][0]['title'] ) : __( 'AI-Native Development Foundations', 'nab-core' );
	$when  = $start ? wp_date( 'D, M j', $start ) : __( 'Every week', 'nab-core' );
	ob_start();
	?>
	<div class="nab-xp">
		<article class="nab-xp__tile nab-xp__tile--wide">
			<div class="nab-xp__text">
				<h3><?php esc_html_e( 'Your setup, checked by AI', 'nab-core' ); ?></h3>
				<p><?php esc_html_e( 'Install each tool with a short video, upload a screenshot, and get a pass or a specific fix in under a minute. No one starts week one with a broken laptop.', 'nab-core' ); ?></p>
			</div>
			<div class="nab-xp__ui nab-ui-steps" aria-hidden="true">
				<p class="is-done"><i></i><?php esc_html_e( 'Install Node.js', 'nab-core' ); ?><b><?php esc_html_e( 'Passed', 'nab-core' ); ?></b></p>
				<p class="is-done"><i></i><?php esc_html_e( 'Install Claude Code', 'nab-core' ); ?><b><?php esc_html_e( 'Passed', 'nab-core' ); ?></b></p>
				<p class="is-now"><i></i><?php esc_html_e( 'Authenticate your Anthropic account', 'nab-core' ); ?><b><?php esc_html_e( 'Checking…', 'nab-core' ); ?></b></p>
				<p class="nab-ui-steps__note"><?php esc_html_e( 'Screenshot shows “Logged in as maya@…”. Looks good.', 'nab-core' ); ?></p>
			</div>
		</article>
		<article class="nab-xp__tile">
			<div class="nab-xp__ui nab-ui-session" aria-hidden="true">
				<p class="nab-ui-session__when"><?php echo esc_html( $when ); ?> · 6:00 PM</p>
				<p class="nab-ui-session__title"><?php echo esc_html( $first ); ?></p>
				<span class="nab-ui-session__btn"><?php esc_html_e( 'Join live session', 'nab-core' ); ?></span>
			</div>
			<div class="nab-xp__text">
				<h3><?php esc_html_e( 'Build live, every week', 'nab-core' ); ?></h3>
				<p><?php esc_html_e( 'Three-hour sessions where you build alongside the instructor. Recordings are up within a day if you miss one.', 'nab-core' ); ?></p>
			</div>
		</article>
		<article class="nab-xp__tile">
			<div class="nab-xp__ui nab-ui-chat" aria-hidden="true">
				<p class="me"><?php esc_html_e( 'npm says EACCES when I install Claude Code', 'nab-core' ); ?></p>
				<p class="ai"><?php esc_html_e( 'That’s a folder permission issue. Run this once, then install again:', 'nab-core' ); ?> <code>npm config set prefix ~/.npm-global</code></p>
			</div>
			<div class="nab-xp__text">
				<h3><?php esc_html_e( 'Stuck at 11pm? Ask the AI helper', 'nab-core' ); ?></h3>
				<p><?php esc_html_e( 'Describe the error or paste a screenshot. It knows the step you’re on.', 'nab-core' ); ?></p>
			</div>
		</article>
		<article class="nab-xp__tile">
			<div class="nab-xp__ui nab-ui-review" aria-hidden="true">
				<p class="nab-ui-review__file">src/agents/triage.ts</p>
				<p class="nab-ui-review__note"><b>Aleem</b> <?php esc_html_e( 'Nice. Add a test for the empty inbox case before you ship.', 'nab-core' ); ?></p>
			</div>
			<div class="nab-xp__text">
				<h3><?php esc_html_e( 'Reviewed by your instructor', 'nab-core' ); ?></h3>
				<p><?php esc_html_e( 'Your homework is your product. Get direct feedback on it, not on toy exercises.', 'nab-core' ); ?></p>
			</div>
		</article>
		<article class="nab-xp__tile">
			<div class="nab-xp__ui nab-ui-cert" aria-hidden="true">
				<p class="nab-ui-cert__kicker"><?php esc_html_e( 'Certificate of completion', 'nab-core' ); ?></p>
				<p class="nab-ui-cert__name">Maya Okafor</p>
				<span class="nab-ui-cert__btn"><?php esc_html_e( 'Add to LinkedIn', 'nab-core' ); ?></span>
			</div>
			<div class="nab-xp__text">
				<h3><?php esc_html_e( 'Proof you shipped', 'nab-core' ); ?></h3>
				<p><?php esc_html_e( 'A verifiable certificate and a live product you can show in interviews and to customers.', 'nab-core' ); ?></p>
			</div>
		</article>
	</div>
	<?php
	return (string) ob_get_clean();
}

/**
 * nab/guarantee.
 *
 * @return string HTML.
 */
function nab_render_guarantee() {
	return '<div class="nab-guarantee"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="m8.5 12 2.5 2.5 4.5-5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg><p><b>' . esc_html__( 'Try it for two weeks.', 'nab-core' ) . '</b> ' . esc_html__( 'If the program isn’t right for you, ask within two weeks of the start date for a full refund. No questions asked.', 'nab-core' ) . ' <a href="' . esc_url( home_url( '/refund-policy/' ) ) . '">' . esc_html__( 'Refund policy', 'nab-core' ) . '</a></p></div>';
}

/**
 * nab/sticky-cta.
 *
 * @return string HTML.
 */
function nab_render_sticky_cta() {
	$join = nab_primary_join();
	$c    = $join['course'];
	if ( ! $c ) {
		return '';
	}
	$start = nab_next_start();
	$bits  = array();
	$bits[] = $start ? sprintf( /* translators: %s: date. */ __( 'Next cohort starts %s', 'nab-core' ), wp_date( 'F j', $start ) ) : get_the_title( $c['id'] );
	if ( $c['price'] ) {
		$bits[] = $c['installment_count'] ? sprintf( /* translators: 1: price, 2: count, 3: amount. */ __( '%1$s or %2$d × %3$s', 'nab-core' ), nab_money( $c['price'] ), $c['installment_count'], nab_money( $c['installment_amount'] ) ) : nab_money( $c['price'] );
	}
	$seats = $c['availability']['seats_left'] ?? null;
	if ( null !== $seats && $seats <= 10 ) {
		/* translators: %d: seats. */
		$bits[] = sprintf( _n( '%d seat left', '%d seats left', $seats, 'nab-core' ), $seats );
	}
	$html  = '<div class="nab-sticky" data-nab-sticky hidden><div class="nab-sticky__inner"><p>' . implode( '<span class="nab-sticky__sep" aria-hidden="true"> · </span>', array_map( static fn( $b ) => '<span class="nab-sticky__bit">' . esc_html( $b ) . '</span>', $bits ) ) . '</p>';
	$html .= '<a class="nab-btn" href="' . esc_url( $join['url'] ) . '"><span class="nab-sticky__long">' . esc_html__( 'Reserve your seat', 'nab-core' ) . '</span><span class="nab-sticky__short">' . esc_html__( 'Reserve', 'nab-core' ) . '</span></a><button type="button" class="nab-sticky__close" aria-label="' . esc_attr__( 'Hide', 'nab-core' ) . '">×</button></div></div>';
	$html .= '<script>(function(){var b=document.querySelector("[data-nab-sticky]");if(!b||!("IntersectionObserver"in window))return;try{if(sessionStorage.getItem("nabStickyOff"))return;}catch(e){}var hide=document.querySelectorAll(".nab-hero,.nab-pricing,.nab-cta,.nab-footer"),seen=new Set();var io=new IntersectionObserver(function(es){es.forEach(function(e){e.isIntersecting?seen.add(e.target):seen.delete(e.target)});b.hidden=seen.size>0;},{threshold:0});hide.forEach(function(el){io.observe(el)});b.querySelector(".nab-sticky__close").addEventListener("click",function(){b.remove();io.disconnect();try{sessionStorage.setItem("nabStickyOff","1")}catch(e){}});})();</script>';
	return $html;
}

/**
 * nab/cta-actions: closing buttons for both formats.
 *
 * @return string HTML.
 */
function nab_render_cta_actions() {
	$join  = nab_primary_join();
	$self  = nab_get_course_ids( 'recorded', 1 );
	$html  = '<p class="nab-cta__actions"><a class="nab-btn nab-btn--light" href="' . esc_url( $join['url'] ) . '">' . esc_html( $join['label'] ) . '</a>';
	$html .= $self ? '<a class="nab-btn nab-btn--clear" href="' . esc_url( get_permalink( $self[0] ) ) . '">' . esc_html__( 'Start self-paced today', 'nab-core' ) . '</a>' : '';
	return $html . '</p>';
}

add_action(
	'init',
	static function () {
		$blocks = array(
			'hero-proof'  => array( 'nab_render_hero_proof', __( 'Hero reassurance', 'nab-core' ) ),
			'experience'  => array( 'nab_render_experience', __( 'Learning experience', 'nab-core' ) ),
			'guarantee'   => array( 'nab_render_guarantee', __( 'Refund guarantee', 'nab-core' ) ),
			'sticky-cta'  => array( 'nab_render_sticky_cta', __( 'Sticky join bar', 'nab-core' ) ),
			'cta-actions' => array( 'nab_render_cta_actions', __( 'Closing buttons', 'nab-core' ) ),
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
