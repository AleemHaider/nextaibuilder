<?php
/**
 * Staff roles and permissions (the old platform's sub-admin permissions).
 *
 * Capabilities used by nextaibuilder admin screens:
 *   nab_manage_students  Students screen, invites, nudges, progress resets
 *   nab_review_steps     Setup step review queue
 *   nab_send_messages    Email students (broadcast)
 *   nab_manage_payments  Receipts to review, imported payments, orders
 *   nab_view_reports     Reports
 * Administrators get all of them. Roles: Course manager, Student support, Finance.
 * Re-applied whenever NAB_ROLES_VERSION changes.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

const NAB_ROLES_VERSION = 1;

/**
 * Custom capabilities.
 *
 * @return string[]
 */
function nab_caps() {
	return array( 'nab_manage_students', 'nab_review_steps', 'nab_send_messages', 'nab_manage_payments', 'nab_view_reports' );
}

add_action(
	'init',
	static function () {
		if ( (int) get_option( 'nab_roles_version' ) === NAB_ROLES_VERSION ) {
			return;
		}
		foreach ( array( 'administrator', 'shop_manager' ) as $r ) {
			$role = get_role( $r );
			if ( $role ) {
				foreach ( nab_caps() as $cap ) {
					$role->add_cap( $cap );
				}
			}
		}
		$base = array( 'read' => true, 'upload_files' => true );
		remove_role( 'nab_course_manager' );
		add_role(
			'nab_course_manager',
			__( 'Course manager', 'nab-core' ),
			$base + array(
				'edit_posts' => true, 'edit_others_posts' => true, 'publish_posts' => true, 'delete_posts' => true,
				'edit_pages' => true, 'edit_others_pages' => true, 'publish_pages' => true,
				'edit_tutor_course' => true, 'edit_tutor_courses' => true, 'edit_others_tutor_courses' => true, 'publish_tutor_courses' => true,
				'nab_view_reports' => true,
			)
		);
		remove_role( 'nab_support' );
		add_role(
			'nab_support',
			__( 'Student support', 'nab-core' ),
			$base + array( 'edit_posts' => true, 'list_users' => true, 'nab_manage_students' => true, 'nab_review_steps' => true, 'nab_send_messages' => true )
		);
		remove_role( 'nab_finance' );
		add_role(
			'nab_finance',
			__( 'Finance', 'nab-core' ),
			$base + array( 'edit_shop_orders' => true, 'read_shop_order' => true, 'edit_others_shop_orders' => true, 'view_woocommerce_reports' => true, 'nab_manage_payments' => true, 'nab_view_reports' => true )
		);
		update_option( 'nab_roles_version', NAB_ROLES_VERSION );
	}
);
