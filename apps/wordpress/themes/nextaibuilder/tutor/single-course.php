<?php
/**
 * Course page. Overrides Tutor LMS's single-course template with the
 * nextaibuilder layout from nab-core.
 *
 * @package nextaibuilder
 */

defined( 'ABSPATH' ) || exit;

the_post();
$nextaibuilder_main = function_exists( 'nab_render_course_page' )
	? nab_render_course_page( get_the_ID() )
	: apply_filters( 'the_content', get_the_content() );

nextaibuilder_render_shell( $nextaibuilder_main );
