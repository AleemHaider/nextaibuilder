<?php
/**
 * In-app notifications: a bell in the header with an unread count, and a
 * /notifications/ page (mark read, mark all read, clear). Stored per user
 * (newest 50). Created by nab_notify() from step reviews, badges, certificates,
 * receipts, broadcasts and live sessions.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

const NAB_NOTIFY_KEEP = 50;

/**
 * Add a notification.
 *
 * @param int    $user_id User.
 * @param string $type    Type slug (step_approved, badge, certificate, …).
 * @param string $title   Short text.
 * @param string $body    Optional detail.
 * @param string $url     Optional link.
 */
function nab_notify( $user_id, $type, $title, $body = '', $url = '' ) {
	if ( ! $user_id ) {
		return;
	}
	$list = (array) get_user_meta( $user_id, '_nab_notifications', true );
	array_unshift(
		$list,
		array(
			'id'    => wp_generate_password( 10, false ),
			'type'  => $type,
			'title' => $title,
			'body'  => $body,
			'url'   => $url,
			'time'  => time(),
			'read'  => false,
		)
	);
	update_user_meta( $user_id, '_nab_notifications', array_slice( array_values( array_filter( $list, 'is_array' ) ), 0, NAB_NOTIFY_KEEP ) );
}

/**
 * Unread count.
 *
 * @param int $user_id User.
 * @return int
 */
function nab_unread_count( $user_id ) {
	return count( array_filter( (array) get_user_meta( $user_id, '_nab_notifications', true ), static fn( $n ) => is_array( $n ) && empty( $n['read'] ) ) );
}

// Bell next to the header button for signed-in visitors.
add_filter(
	'render_block',
	static function ( $html, $block ) {
		if ( ! is_user_logged_in() || 'core/buttons' !== $block['blockName'] || ! str_contains( (string) ( $block['attrs']['className'] ?? '' ), 'nab-header__cta' ) ) {
			return $html;
		}
		$n    = nab_unread_count( get_current_user_id() );
		/* translators: %d: unread count. */
		$bell = '<a class="nab-bell" href="' . esc_url( home_url( '/notifications/' ) ) . '" aria-label="' . esc_attr( $n ? sprintf( _n( 'Notifications, %d unread', 'Notifications, %d unread', $n, 'nab-core' ), $n ) : __( 'Notifications', 'nab-core' ) ) . '"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>' . ( $n ? '<span>' . ( $n > 9 ? '9+' : (int) $n ) . '</span>' : '' ) . '</a>';
		return $bell . $html;
	},
	20,
	2
);

add_action( 'init', static fn() => add_rewrite_rule( '^notifications/?$', 'index.php?nab_notifications=1', 'top' ) );
add_filter(
	'query_vars',
	static function ( $vars ) {
		$vars[] = 'nab_notifications';
		return $vars;
	}
);

// Mark read / clear.
add_action(
	'admin_post_nab_notifications',
	static function () {
		check_admin_referer( 'nab_notifications' );
		$user_id = get_current_user_id();
		$op      = isset( $_POST['op'] ) ? sanitize_key( wp_unslash( $_POST['op'] ) ) : '';
		$id      = isset( $_POST['id'] ) ? sanitize_text_field( wp_unslash( $_POST['id'] ) ) : '';
		$list    = array_values( array_filter( (array) get_user_meta( $user_id, '_nab_notifications', true ), 'is_array' ) );
		if ( 'clear' === $op ) {
			$list = array();
		} elseif ( 'delete' === $op ) {
			$list = array_values( array_filter( $list, static fn( $n ) => $n['id'] !== $id ) );
		} else {
			foreach ( $list as &$n ) {
				if ( 'read_all' === $op || $n['id'] === $id ) {
					$n['read'] = true;
				}
			}
			unset( $n );
		}
		update_user_meta( $user_id, '_nab_notifications', $list );
		$go = isset( $_POST['go'] ) ? esc_url_raw( wp_unslash( $_POST['go'] ) ) : '';
		wp_safe_redirect( $go ? $go : home_url( '/notifications/' ) );
		exit;
	}
);

add_action(
	'template_redirect',
	static function () {
		if ( ! get_query_var( 'nab_notifications' ) ) {
			return;
		}
		if ( ! is_user_logged_in() ) {
			wp_safe_redirect( nab_signin_url( home_url( '/notifications/' ) ) );
			exit;
		}
		$list  = array_values( array_filter( (array) get_user_meta( get_current_user_id(), '_nab_notifications', true ), 'is_array' ) );
		$nonce = wp_nonce_field( 'nab_notifications', '_wpnonce', true, false );
		$form  = static fn( $op, $label, $id = '', $go = '', $cls = 'nab-link-btn' ) => '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="display:inline"' . ( 'clear' === $op ? ' data-confirm="' . esc_attr__( 'Remove all notifications? This can’t be undone.', 'nab-core' ) . '"' : '' ) . '><input type="hidden" name="action" value="nab_notifications" /><input type="hidden" name="op" value="' . esc_attr( $op ) . '" /><input type="hidden" name="id" value="' . esc_attr( $id ) . '" /><input type="hidden" name="go" value="' . esc_attr( $go ) . '" />' . $nonce . '<button class="' . esc_attr( $cls ) . '">' . esc_html( $label ) . '</button></form>';
		$html  = '<section class="nab-wrap" style="padding-block:3rem 5rem;max-width:820px"><div style="display:flex;justify-content:space-between;align-items:baseline;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem"><h1 style="font-size:var(--wp--preset--font-size--2-xl);font-weight:300;letter-spacing:-0.03em;margin:0">' . esc_html__( 'Notifications', 'nab-core' ) . '</h1>';
		if ( $list ) {
			$html .= '<span>' . $form( 'read_all', __( 'Mark all as read', 'nab-core' ) ) . ' · ' . $form( 'clear', __( 'Clear all', 'nab-core' ) ) . '</span>';
		}
		$html .= '</div>';
		if ( ! $list ) {
			$html .= '<div class="nab-card" style="padding:2rem"><p style="margin:0">' . esc_html__( 'You’re all caught up. Updates about your steps, badges, payments and live sessions appear here.', 'nab-core' ) . '</p></div>';
		} else {
			$html .= '<ul class="nab-notes">';
			foreach ( $list as $n ) {
				$title = esc_html( $n['title'] );
				$html .= '<li class="' . ( empty( $n['read'] ) ? 'is-unread' : '' ) . '"><div><p class="nab-notes__title">' . ( $n['url'] ? $form( 'read', $n['title'], $n['id'], $n['url'], 'nab-link-btn nab-notes__link' ) : $title ) . '</p>' . ( $n['body'] ? '<p class="nab-notes__body">' . esc_html( $n['body'] ) . '</p>' : '' ) . '<time>' . esc_html( human_time_diff( $n['time'] ) . ' ' . __( 'ago', 'nab-core' ) ) . '</time></div>' . $form( 'delete', __( 'Remove', 'nab-core' ), $n['id'] ) . '</li>';
			}
			$html .= '</ul>';
		}
		$html .= function_exists( 'nab_render_prefs_form' ) ? nab_render_prefs_form() : '';
		$html .= function_exists( 'nab_render_delete_account' ) ? nab_render_delete_account() : '';
		$html .= '</section>';
		add_filter( 'pre_get_document_title', static fn() => __( 'Notifications', 'nab-core' ) . ' – nextaibuilder' );
		nextaibuilder_render_shell( $html );
		exit;
	}
);

/* Hook notifications into existing events. */

add_action(
	'tutor/course/enrol_status_change/after',
	static function ( $enroll_id, $status ) {
		$e = get_post( $enroll_id );
		if ( $e && 'completed' === $status ) {
			/* translators: %s: course. */
			nab_notify( (int) $e->post_author, 'enrolled', sprintf( __( 'You’re enrolled in %s', 'nab-core' ), get_the_title( $e->post_parent ) ), __( 'Start with the setup steps, then your first lesson.', 'nab-core' ), home_url( '/setup/' ) );
		} elseif ( $e && 'cancel' === $status ) {
			/* translators: %s: course. */
			nab_notify( (int) $e->post_author, 'suspended', sprintf( __( 'Access to %s is paused', 'nab-core' ), get_the_title( $e->post_parent ) ), __( 'An installment is unpaid. Pay it to restore access.', 'nab-core' ), function_exists( 'wc_get_account_endpoint_url' ) ? wc_get_account_endpoint_url( 'orders' ) : '' );
		}
	},
	30,
	2
);
