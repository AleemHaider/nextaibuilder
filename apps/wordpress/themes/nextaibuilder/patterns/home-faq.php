<?php
/**
 * Title: FAQ
 * Slug: nextaibuilder/home-faq
 * Categories: nextaibuilder, text
 * Description: Frequently asked questions as expandable rows.
 *
 * @package nextaibuilder
 */

$nab_faq = function_exists( 'nab_faq_items' ) ? nab_faq_items() : array();
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
