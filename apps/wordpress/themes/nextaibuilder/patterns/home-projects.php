<?php
/**
 * Title: What students build
 * Slug: nextaibuilder/home-projects
 * Categories: nextaibuilder
 *
 * @package nextaibuilder
 */

// Real projects aren't in yet: the cards only render with demo claims on, so hide the whole section otherwise.
if ( ! function_exists( 'nab_demo_claims' ) || ! nab_demo_claims() ) {
	return;
}
?>
<!-- wp:group {"tagName":"section","className":"nab-band ","layout":{"type":"constrained","contentSize":"1200px"}} -->
<section class="wp-block-group nab-band ">
	<!-- wp:group {"className":"nab-band__head","layout":{"type":"default"}} -->
	<div class="wp-block-group nab-band__head">
		<!-- wp:paragraph {"className":"nab-kicker"} -->
		<p class="nab-kicker">Student projects</p>
		<!-- /wp:paragraph -->
		<!-- wp:heading -->
		<h2 class="wp-block-heading">Real products, shipped in five weeks</h2>
		<!-- /wp:heading -->
		<!-- wp:paragraph {"className":"nab-lede"} -->
		<p class="nab-lede">Every student leaves with something running for real users. A few recent examples.</p>
		<!-- /wp:paragraph -->
	</div>
	<!-- /wp:group -->
	<!-- wp:nab/projects /-->
</section>
<!-- /wp:group -->
