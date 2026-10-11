<?php
/**
 * Title: FAQ
 * Slug: nextaibuilder/home-faq
 * Categories: nextaibuilder, text
 * Description: Frequently asked questions as expandable rows.
 *
 * @package nextaibuilder
 */

$nab_faq = array(
	array( 'What is the difference between recorded and live cohorts?', 'Recorded courses are self-paced: watch the video lessons any time and rewatch as often as you like. Live cohorts run on a fixed schedule with real-time instructor sessions, Q&A and peer collaboration. Both follow the same curriculum.' ),
	array( 'Can I pay in installments?', 'Yes. Every course offers a 3-installment plan at no extra cost. The first payment is taken at checkout and the other two 30 and 60 days later.' ),
	array( 'Can I pay by bank transfer?', 'Yes. Choose bank transfer at checkout and upload your payment receipt. We confirm it and activate your enrollment, usually within one business day.' ),
	array( 'Do I get lifetime access to course materials?', 'Yes. Once enrolled you keep access to all course materials, including updates to the curriculum.' ),
	array( 'What if I miss a live session?', 'Every live session is recorded and posted to your student dashboard within 24 hours.' ),
	array( 'What tools do I need to get started?', 'A computer and an internet connection. The guided setup steps walk you through installing everything else, and our AI checks each step from a screenshot.' ),
	array( 'Is there a refund policy?', 'Yes. You get a full refund within 2 weeks of the cohort start date, no questions asked. See the refund policy page for details.' ),
);
?>
<!-- wp:group {"tagName":"section","className":"nab-band nab-faq","layout":{"type":"constrained","contentSize":"1180px"}} -->
<section class="wp-block-group nab-band nab-faq">
	<!-- wp:columns {"className":"nab-faq__grid"} -->
	<div class="wp-block-columns nab-faq__grid">
		<!-- wp:column {"width":"34%"} -->
		<div class="wp-block-column" style="flex-basis:34%">
			<!-- wp:paragraph {"className":"nab-kicker"} -->
			<p class="nab-kicker">FAQ</p>
			<!-- /wp:paragraph -->
			<!-- wp:heading -->
			<h2 class="wp-block-heading">Questions before you join</h2>
			<!-- /wp:heading -->
		</div>
		<!-- /wp:column -->
		<!-- wp:column -->
		<div class="wp-block-column">
			<?php foreach ( $nab_faq as $nab_item ) : ?>
			<!-- wp:details -->
			<details class="wp-block-details"><summary><?php echo esc_html( $nab_item[0] ); ?></summary>
				<!-- wp:paragraph -->
				<p><?php echo esc_html( $nab_item[1] ); ?></p>
				<!-- /wp:paragraph -->
			</details>
			<!-- /wp:details -->
			<?php endforeach; ?>
		</div>
		<!-- /wp:column -->
	</div>
	<!-- /wp:columns -->
</section>
<!-- /wp:group -->
