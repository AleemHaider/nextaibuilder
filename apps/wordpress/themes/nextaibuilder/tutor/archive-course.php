<?php
/**
 * Course catalog at /courses/. Overrides Tutor LMS's archive template.
 *
 * @package nextaibuilder
 */

defined( 'ABSPATH' ) || exit;

$nextaibuilder_main = do_blocks(
	'<!-- wp:group {"tagName":"section","className":"nab-catalog-hero","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|50"}}},"layout":{"type":"constrained","contentSize":"1200px"}} -->
<section class="wp-block-group nab-catalog-hero" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--50)">
<!-- wp:html --><div class="nab-mesh" aria-hidden="true"><i></i><i></i><i></i><i></i></div><!-- /wp:html -->
<!-- wp:heading {"level":1,"fontSize":"2xl","style":{"position":{"type":""}}} --><h1 class="wp-block-heading has-2-xl-font-size" style="position:relative">Courses</h1><!-- /wp:heading -->
<!-- wp:paragraph {"className":"nab-lede"} --><p class="nab-lede" style="position:relative">Live cohorts and self-paced courses for building and shipping production AI products with Claude.</p><!-- /wp:paragraph -->
<!-- wp:html --><div style="position:relative"><!-- /wp:html -->
<!-- wp:nab/course-filters /-->
<!-- wp:html --></div><!-- /wp:html -->
</section>
<!-- /wp:group -->
<!-- wp:group {"tagName":"section","style":{"spacing":{"padding":{"top":"var:preset|spacing|40","bottom":"var:preset|spacing|70"}}},"layout":{"type":"constrained","contentSize":"1200px"}} -->
<section class="wp-block-group" style="padding-top:var(--wp--preset--spacing--40);padding-bottom:var(--wp--preset--spacing--70)">
<!-- wp:html --><h2 class="screen-reader-text">Course list</h2><!-- /wp:html -->
<!-- wp:nab/courses {"format":"auto"} /-->
</section>
<!-- /wp:group -->
<!-- wp:pattern {"slug":"nextaibuilder/cta"} /-->'
);

nextaibuilder_render_shell( $nextaibuilder_main );
