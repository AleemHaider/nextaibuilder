<?php
/**
 * Title: About page
 * Slug: nextaibuilder/about
 * Categories: nextaibuilder
 * Description: Mission, how we teach, the five-week path, instructor, reviews and free guides.
 *
 * @package nextaibuilder
 */

?>
<!-- wp:group {"tagName":"section","className":"nab-about-hero","layout":{"type":"constrained","contentSize":"1180px"}} -->
<section class="wp-block-group nab-about-hero">
	<!-- wp:group {"className":"nab-about-hero__text","layout":{"type":"default"}} -->
	<div class="wp-block-group nab-about-hero__text">
		<!-- wp:paragraph {"className":"nab-kicker"} -->
		<p class="nab-kicker">About nextaibuilder</p>
		<!-- /wp:paragraph -->
		<!-- wp:heading {"level":1,"className":"nab-about-hero__title"} -->
		<h1 class="wp-block-heading nab-about-hero__title">We teach builders to ship real AI products</h1>
		<!-- /wp:heading -->
		<!-- wp:paragraph {"className":"nab-lede"} -->
		<p class="nab-lede">nextaibuilder is a cohort-based school for founders, product managers and engineers. In live sessions and real projects, you learn the workflow we use every day: plan with a spec, let AI agents do the building, and hold everything to production quality.</p>
		<!-- /wp:paragraph -->
		<!-- wp:buttons {"className":"nab-about-hero__actions"} -->
		<div class="wp-block-buttons nab-about-hero__actions">
			<!-- wp:button -->
			<div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="/courses/build-production-ready-ai-agents-live/">See the live cohort</a></div>
			<!-- /wp:button -->
			<!-- wp:button {"className":"is-style-outline"} -->
			<div class="wp-block-button is-style-outline"><a class="wp-block-button__link wp-element-button" href="/guides/">Read the free guides</a></div>
			<!-- /wp:button -->
		</div>
		<!-- /wp:buttons -->
		<!-- wp:nab/hero-proof /-->
	</div>
	<!-- /wp:group -->
	<!-- wp:html -->
	<aside class="nab-glance" aria-label="The live cohort at a glance">
		<p class="nab-glance__title">The live cohort at a glance</p>
		<dl>
			<div><dt>5</dt><dd>weeks, building your own product</dd></div>
			<div><dt>10</dt><dd>live sessions, 3 hours each</dd></div>
			<div><dt>24h</dt><dd>until each session recording is up</dd></div>
			<div><dt>14</dt><dd>days to ask for a full refund</dd></div>
		</dl>
		<p class="nab-glance__alt">Prefer your own pace? <a href="/courses/build-production-ready-ai-agents-recorded/">Take the self-paced course</a>.</p>
	</aside>
	<!-- /wp:html -->
</section>
<!-- /wp:group -->

<!-- wp:group {"tagName":"section","className":"nab-band","layout":{"type":"constrained","contentSize":"1180px"}} -->
<section class="wp-block-group nab-band">
	<!-- wp:group {"className":"nab-about-why","layout":{"type":"default"}} -->
	<div class="wp-block-group nab-about-why">
		<!-- wp:heading {"className":"nab-section-title"} -->
		<h2 class="wp-block-heading nab-section-title">Why we started</h2>
		<!-- /wp:heading -->
		<!-- wp:group {"className":"nab-about-why__text","layout":{"type":"default"}} -->
		<div class="wp-block-group nab-about-why__text">
			<!-- wp:paragraph -->
			<p>Most AI courses stop at a demo. You watch someone call a model, copy the notebook, and end up with nothing you can put in front of users.</p>
			<!-- /wp:paragraph -->
			<!-- wp:paragraph -->
			<p>We built nextaibuilder around the part that is actually hard: turning an idea into a product that runs in production. Every cohort works on its own product, with tests, quality gates and a real deployment, and an instructor reviews the work every week.</p>
			<!-- /wp:paragraph -->
		</div>
		<!-- /wp:group -->
	</div>
	<!-- /wp:group -->
</section>
<!-- /wp:group -->

<!-- wp:group {"tagName":"section","className":"nab-band nab-band--soft","layout":{"type":"constrained","contentSize":"1180px"}} -->
<section class="wp-block-group nab-band nab-band--soft">
	<!-- wp:group {"className":"nab-band__head","layout":{"type":"default"}} -->
	<div class="wp-block-group nab-band__head">
		<!-- wp:heading -->
		<h2 class="wp-block-heading">How we teach</h2>
		<!-- /wp:heading -->
		<!-- wp:paragraph {"className":"nab-lede"} -->
		<p class="nab-lede">Four rules shape every cohort and every lesson.</p>
		<!-- /wp:paragraph -->
	</div>
	<!-- /wp:group -->
	<!-- wp:html -->
	<ul class="nab-principles">
		<li><h3>Build, don’t just watch</h3><p>Every cohort ends with a deployed, production-grade project with a public repo and a release tag, not a certificate you forget about.</p></li>
		<li><h3>Learn alongside other builders</h3><p>Live sessions, weekly homework on your own product and direct feedback. You learn faster next to people who share your goals.</p></li>
		<li><h3>Current tools, updated every cohort</h3><p>Claude Code, the Claude API, tool use and MCP. The curriculum changes as the tools change, so nothing you learn is stale.</p></li>
		<li><h3>Clear, fair pricing</h3><p>Pay in full or in 3 monthly payments, by card or bank transfer. A full refund within 2 weeks if it isn’t right for you.</p></li>
	</ul>
	<!-- /wp:html -->
</section>
<!-- /wp:group -->

<!-- wp:group {"tagName":"section","className":"nab-band","layout":{"type":"constrained","contentSize":"1180px"}} -->
<section class="wp-block-group nab-band">
	<!-- wp:group {"className":"nab-band__head","layout":{"type":"default"}} -->
	<div class="wp-block-group nab-band__head">
		<!-- wp:heading -->
		<h2 class="wp-block-heading">From idea to production in five weeks</h2>
		<!-- /wp:heading -->
		<!-- wp:paragraph {"className":"nab-lede"} -->
		<p class="nab-lede">The live cohort runs ten 3-hour sessions. Each week adds one layer to the product you are building.</p>
		<!-- /wp:paragraph -->
	</div>
	<!-- /wp:group -->
	<!-- wp:html -->
	<ol class="nab-weeks">
		<li><span class="nab-weeks__n">Week 1</span><h3>AI-native development foundations</h3><p>Set up Claude Code and a spec-first workflow on your own repository.</p></li>
		<li><span class="nab-weeks__n">Week 2</span><h3>Design your AI agent</h3><p>Decide what your agent does, which tools it needs and where a person stays in the loop.</p></li>
		<li><span class="nab-weeks__n">Week 3</span><h3>Connect real tools</h3><p>Wire the agent to Jira, Confluence, Slack and GitHub with tool use and MCP.</p></li>
		<li><span class="nab-weeks__n">Week 4</span><h3>Design to code, with quality gates</h3><p>Turn Figma designs into code and add tests that catch regressions before users do.</p></li>
		<li><span class="nab-weeks__n">Week 5</span><h3>Ship to production</h3><p>Deploy with CI/CD and present your working product at the capstone.</p></li>
	</ol>
	<!-- /wp:html -->
	<!-- wp:paragraph {"className":"nab-about-more"} -->
	<p class="nab-about-more"><a href="/courses/build-production-ready-ai-agents-live/#syllabus">See the full syllabus</a></p>
	<!-- /wp:paragraph -->
</section>
<!-- /wp:group -->

<!-- wp:group {"tagName":"section","className":"nab-band nab-band--soft","layout":{"type":"constrained","contentSize":"1180px"}} -->
<section class="wp-block-group nab-band nab-band--soft">
	<!-- wp:nab/instructor /-->
</section>
<!-- /wp:group -->

<!-- wp:group {"tagName":"section","className":"nab-band","layout":{"type":"constrained","contentSize":"1180px"}} -->
<section class="wp-block-group nab-band">
	<!-- wp:group {"className":"nab-band__head","layout":{"type":"default"}} -->
	<div class="wp-block-group nab-band__head">
		<!-- wp:heading -->
		<h2 class="wp-block-heading">What students say</h2>
		<!-- /wp:heading -->
		<!-- wp:paragraph {"className":"nab-lede"} -->
		<p class="nab-lede">From founders, product managers and engineers who went through the program.</p>
		<!-- /wp:paragraph -->
	</div>
	<!-- /wp:group -->
	<!-- wp:nab/reviews /-->
</section>
<!-- /wp:group -->

<!-- wp:group {"tagName":"section","className":"nab-band nab-band--soft","layout":{"type":"constrained","contentSize":"1180px"}} -->
<section class="wp-block-group nab-band nab-band--soft">
	<!-- wp:group {"className":"nab-band__head","layout":{"type":"default"}} -->
	<div class="wp-block-group nab-band__head">
		<!-- wp:heading -->
		<h2 class="wp-block-heading">Start with the free guides</h2>
		<!-- /wp:heading -->
		<!-- wp:paragraph {"className":"nab-lede"} -->
		<p class="nab-lede">Practical, code-first guides to the Claude API, AI agents and MCP. <a href="/guides/">See all guides</a>.</p>
		<!-- /wp:paragraph -->
	</div>
	<!-- /wp:group -->
	<!-- wp:nab/post-cards {"category":"guides","count":3} /-->
</section>
<!-- /wp:group -->

<!-- wp:pattern {"slug":"nextaibuilder/cta"} /-->
