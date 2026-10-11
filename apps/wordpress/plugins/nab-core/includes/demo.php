<?php
/**
 * DEMO CONTENT — placeholder data so the design can be reviewed before real
 * photos, projects and reviews exist. Everything here is invented.
 *
 * Shown only while the `nab_demo_content` option is "on":
 *   wp nab demo on|off
 * Admins see a bar on the front end while it's on. Turn it OFF before launch;
 * every caller falls back to real data (or hides the section) when it's off.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Whether demo content is switched on.
 *
 * @return bool
 */
function nab_demo_on() {
	return 'on' === get_option( 'nab_demo_content', 'off' );
}

/**
 * URL of a bundled demo image.
 *
 * @param string $file File in themes/nextaibuilder/assets/images/demo/.
 * @return string
 */
function nab_demo_img( $file ) {
	return get_theme_file_uri( 'assets/images/demo/' . $file );
}

/**
 * The demo data set. Real content replaces each key as it arrives.
 *
 * @return array<string, mixed>
 */
function nab_demo() {
	return array(
		'next_start'  => strtotime( '+24 days', strtotime( 'today' ) ),
		'instructor'  => array(
			'name'   => 'Aleem Haider',
			'role'   => 'Founder & lead instructor',
			'photo'  => nab_demo_img( 'instructor.png' ),
			'bio'    => 'Aleem has spent fifteen years shipping software products, most recently leading teams that put AI features in front of millions of users. He started nextaibuilder to teach the workflow he uses every day: plan with a spec, let agents do the building, and hold everything to production quality.',
			'facts'  => array( '15 years building software products', '400+ students taught', 'Builds with Claude Code daily' ),
		),
		'projects'    => array(
			array( 'Support triage agent', 'Reads every incoming ticket, drafts a reply and routes it to the right person.', 'Marcus P., operations lead', 'project-triage.png' ),
			array( 'PRD to Jira pipeline', 'Turns a product spec into an epic with sized, linked tickets in about a minute.', 'Priya K., senior PM', 'project-prd.png' ),
			array( 'Weekly business brief', 'Pulls sales, support and calendar data into a Monday-morning summary.', 'Sarah C., founder', 'project-brief.png' ),
			array( 'Code review assistant', 'Comments on every pull request with risks, missing tests and a summary.', 'James O., engineering lead', 'project-review.png' ),
			array( 'Lead research agent', 'Enriches new CRM leads with company facts and a suggested first message.', 'Dwayne R., solo operator', 'project-leads.png' ),
			array( 'Contract Q&A assistant', 'Answers questions about a contract library with cited clauses.', 'Emma V., indie hacker', 'project-contracts.png' ),
		),
		'reviews'     => array(
			array( 'Sarah Chen', 'Founder, Lumen Studio', 5, 'I got back three hours every Monday morning. The weekly brief Claude writes for me has replaced my entire prep ritual.' ),
			array( 'Marcus Patel', 'COO, Bright Logistics', 5, 'I shipped my first agent on day four. Two months in, it has handled 1,400 support emails.' ),
			array( 'Priya Krishnan', 'Senior PM, Helix Health', 5, 'PRD in Confluence on Tuesday, Jira tickets by Wednesday, three Figma flows by Friday. All before I wrote any code.' ),
		),
		'rating'      => array( 4.9, 126 ),
		'outcomes'    => array(
			'Set up a professional AI development workflow with Claude Code',
			'Write specs and prompts that agents can execute reliably',
			'Connect agents to real tools: Jira, Confluence, Slack and GitHub',
			'Test agents and add quality gates before anything reaches users',
			'Deploy your product to production with CI/CD',
			'Leave with a shipped project, a public repo and a release tag',
		),
		'audience'    => array(
			'Founders and business owners who want working AI, not slides',
			'Product managers who want to build what they spec',
			'Engineers moving from prompts to production agents',
		),
	);
}

/**
 * Front-end bar for admins while demo content is on.
 */
add_action(
	'wp_body_open',
	static function () {
		if ( nab_demo_on() && current_user_can( 'manage_options' ) ) {
			echo '<div class="nab-demo-bar" role="status">' . esc_html__( 'Demo content is on: reviews, projects, bio, dates and images marked as demo are placeholders. Turn off before launch with: wp nab demo off', 'nab-core' ) . '</div>';
		}
	}
);

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	/**
	 * Turn demo content on or off.
	 *
	 * ## OPTIONS
	 *
	 * <state>
	 * : on or off
	 *
	 * @param array $args Args.
	 */
	WP_CLI::add_command(
		'nab demo',
		static function ( $args ) {
			$state = 'on' === ( $args[0] ?? '' ) ? 'on' : 'off';
			update_option( 'nab_demo_content', $state );
			WP_CLI::success( 'Demo content ' . $state . '.' );
		}
	);
}

/**
 * Demo lesson body for lessons that have no content yet.
 *
 * @param string $content Post content.
 * @return string
 */
function nab_demo_lesson_content( $content ) {
	if ( ! nab_demo_on() || 'lesson' !== get_post_type() || trim( wp_strip_all_tags( $content ) ) ) {
		return $content;
	}
	return '<div class="nab-lesson-demo">'
		. '<div class="nab-lesson-demo__video" aria-label="' . esc_attr__( 'Lesson video', 'nab-core' ) . '"><span aria-hidden="true">▶</span></div>'
		. '<p>' . esc_html__( 'In this session you set up a professional AI development workflow and ship your first change with Claude Code. Watch the walkthrough, then follow the steps below on your own project.', 'nab-core' ) . '</p>'
		. '<h2>' . esc_html__( 'What you’ll do', 'nab-core' ) . '</h2><ol><li>' . esc_html__( 'Install Claude Code and connect it to your repository.', 'nab-core' ) . '</li><li>' . esc_html__( 'Write a short spec in docs/PRD.md for one small feature.', 'nab-core' ) . '</li><li>' . esc_html__( 'Ask Claude to build it with tests first, then review the diff.', 'nab-core' ) . '</li></ol>'
		. '<h2>' . esc_html__( 'Try it', 'nab-core' ) . '</h2><pre><code>claude "Read docs/PRD.md and build the onboarding checklist. Write tests first."</code></pre>'
		. '<p class="nab-notice">' . esc_html__( 'Homework: open a pull request with your feature and post the link in the cohort channel before the next session.', 'nab-core' ) . '</p>'
		. '</div>';
}
add_filter( 'the_content', 'nab_demo_lesson_content', 20 );
// Tutor hides the lesson tab when the lesson has no content; show it for the demo body.
add_filter( 'tutor_has_lesson_content', static fn( $has ) => $has || nab_demo_on(), 10, 1 );
