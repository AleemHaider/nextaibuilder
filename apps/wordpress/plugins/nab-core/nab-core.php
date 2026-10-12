<?php
/**
 * Plugin Name: nextaibuilder Core
 * Description: Site-specific functionality for nextaibuilder: course formats and pricing display, catalog, course pages, SEO and crawler files.
 * Version: 0.1.0
 * Requires at least: 6.6
 * Requires PHP: 8.1
 * Requires Plugins: woocommerce, tutor
 * Author: nextaibuilder
 * Text Domain: nab-core
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

define( 'NAB_CORE_VERSION', '0.1.0' );
define( 'NAB_CORE_DIR', plugin_dir_path( __FILE__ ) );

require_once NAB_CORE_DIR . 'includes/course-meta.php';
require_once NAB_CORE_DIR . 'includes/roles.php';
require_once NAB_CORE_DIR . 'includes/demo.php';
require_once NAB_CORE_DIR . 'includes/course-data.php';
require_once NAB_CORE_DIR . 'includes/blocks.php';
require_once NAB_CORE_DIR . 'includes/blocks-home.php';
require_once NAB_CORE_DIR . 'includes/course-page.php';
require_once NAB_CORE_DIR . 'includes/seo.php';
require_once NAB_CORE_DIR . 'includes/routing.php';
require_once NAB_CORE_DIR . 'includes/installments.php';
require_once NAB_CORE_DIR . 'includes/checkout.php';
require_once NAB_CORE_DIR . 'includes/manual-payment.php';
require_once NAB_CORE_DIR . 'includes/setup-steps.php';
require_once NAB_CORE_DIR . 'includes/vision.php';
require_once NAB_CORE_DIR . 'includes/paddle.php';
require_once NAB_CORE_DIR . 'includes/legacy.php';
require_once NAB_CORE_DIR . 'includes/login.php';
require_once NAB_CORE_DIR . 'includes/broadcast.php';
require_once NAB_CORE_DIR . 'includes/admin-overview.php';
require_once NAB_CORE_DIR . 'includes/student-area.php';
require_once NAB_CORE_DIR . 'includes/notifications.php';
require_once NAB_CORE_DIR . 'includes/lms.php';
require_once NAB_CORE_DIR . 'includes/sessions.php';
require_once NAB_CORE_DIR . 'includes/troubleshoot.php';
require_once NAB_CORE_DIR . 'includes/calls.php';
require_once NAB_CORE_DIR . 'includes/promos.php';
require_once NAB_CORE_DIR . 'includes/automation.php';
require_once NAB_CORE_DIR . 'includes/students-admin.php';
require_once NAB_CORE_DIR . 'includes/reports.php';
require_once NAB_CORE_DIR . 'includes/admissions.php';
require_once NAB_CORE_DIR . 'includes/security.php';
require_once NAB_CORE_DIR . 'includes/account.php';
require_once NAB_CORE_DIR . 'includes/blocks-landing.php';
require_once NAB_CORE_DIR . 'includes/blocks-content.php';
require_once NAB_CORE_DIR . 'includes/seo-plus.php';

if ( defined( 'WP_CLI' ) && WP_CLI ) {
	require_once NAB_CORE_DIR . 'cli/class-nab-seed-command.php';
	require_once NAB_CORE_DIR . 'cli/class-nab-import-command.php';
}
