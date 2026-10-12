<?php
/**
 * Automations carried over from the old platform's background jobs:
 * - daily 09:00 UTC run (Action Scheduler):
 *   · re-engagement nudges 3 and 7 days after a student's last lesson activity
 *     ("Still with us? You're X% through…");
 *   · setup reminders for unfinished setup steps (3–6 days quiet: nudge; 7+: last call);
 *   · installment reminders 3 days before each automatic charge;
 *   · one review-backlog alert when 10+ screenshots wait for a human;
 * - email preferences per student (honoured by nudges, reminders and broadcasts);
 * - an email log (Tools → Email log) of everything the site sends.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

const NAB_BACKLOG_ALERT = 10;

/* ---------------- Preferences ---------------- */

/**
 * Email preference labels.
 *
 * @return array<string,string>
 */
function nab_pref_labels() {
	return array(
		'setup_reminders'  => __( 'Reminders about unfinished setup steps', 'nab-core' ),
		'progress_updates' => __( 'Progress check-ins and course announcements', 'nab-core' ),
		'deadline_alerts'  => __( 'Live session and deadline reminders', 'nab-core' ),
		'tips'             => __( 'Tips and encouragement', 'nab-core' ),
	);
}

/**
 * Whether a student wants a kind of email (default yes).
 *
 * @param int    $user_id User.
 * @param string $key     Preference.
 * @return bool
 */
function nab_wants( $user_id, $key ) {
	$prefs = (array) get_user_meta( $user_id, '_nab_prefs', true );
	return ! array_key_exists( $key, $prefs ) || ! empty( $prefs[ $key ] );
}

add_action(
	'admin_post_nab_prefs',
	static function () {
		check_admin_referer( 'nab_prefs' );
		$prefs = array();
		foreach ( array_keys( nab_pref_labels() ) as $k ) {
			$prefs[ $k ] = ! empty( $_POST[ $k ] );
		}
		update_user_meta( get_current_user_id(), '_nab_prefs', $prefs );
		wp_safe_redirect( add_query_arg( 'saved', 1, home_url( '/notifications/#email-preferences' ) ) );
		exit;
	}
);

/**
 * Preferences form (shown on /notifications/).
 *
 * @return string HTML.
 */
function nab_render_prefs_form() {
	$uid  = get_current_user_id();
	$html = '<section id="email-preferences" class="nab-card" style="padding:1.75rem;margin-top:3rem"><h2 style="font-size:1.375rem;font-weight:400;margin:0 0 .25rem">' . esc_html__( 'Email preferences', 'nab-core' ) . '</h2><p style="margin:0 0 1rem;color:var(--muted);font-size:.9375rem">' . esc_html__( 'Payment, receipt and account emails are always sent.', 'nab-core' ) . '</p><form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="nab_prefs" />' . wp_nonce_field( 'nab_prefs', '_wpnonce', true, false );
	foreach ( nab_pref_labels() as $k => $label ) {
		$html .= '<label class="nab-check"><input type="checkbox" name="' . esc_attr( $k ) . '" value="1"' . checked( nab_wants( $uid, $k ), true, false ) . ' /> ' . esc_html( $label ) . '</label>';
	}
	return $html . '<button class="nab-btn" style="margin-top:1rem">' . esc_html__( 'Save preferences', 'nab-core' ) . '</button></form></section>';
}

/* ---------------- Daily run ---------------- */

add_action(
	'init',
	static function () {
		if ( function_exists( 'as_has_scheduled_action' ) && ! as_has_scheduled_action( 'nab_daily' ) ) {
			$next = strtotime( 'tomorrow 09:00 UTC' );
			as_schedule_recurring_action( $next, DAY_IN_SECONDS, 'nab_daily', array(), 'nab' );
		}
	}
);

/**
 * Last lesson activity for a user in a course (completion times), else enrollment date.
 *
 * @param int $user_id   User.
 * @param int $course_id Course.
 * @param int $enrolled  Enrollment timestamp.
 * @return int
 */
function nab_last_activity( $user_id, $course_id, $enrolled ) {
	$last = $enrolled;
	foreach ( nab_course_lesson_ids( $course_id ) as $l ) {
		$t    = (int) get_user_meta( $user_id, '_tutor_completed_lesson_id_' . $l, true );
		$last = max( $last, $t );
	}
	return $last;
}

/**
 * The daily job.
 */
function nab_daily() {
	global $wpdb;
	$now = time();

	// 1) Re-engagement nudges (3 and 7 days quiet), once each per quiet spell.
	$rows = $wpdb->get_results( "SELECT ID, post_author, post_parent, post_date_gmt FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_status = 'completed'" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	foreach ( $rows as $e ) {
		$lessons = nab_course_lesson_ids( (int) $e->post_parent );
		if ( ! $lessons ) {
			continue;
		}
		$done = count( array_filter( $lessons, static fn( $l ) => nab_lesson_done( $l, (int) $e->post_author ) ) );
		if ( $done >= count( $lessons ) ) {
			continue;
		}
		$last  = nab_last_activity( (int) $e->post_author, (int) $e->post_parent, strtotime( $e->post_date_gmt . ' UTC' ) );
		$days  = (int) floor( ( $now - $last ) / DAY_IN_SECONDS );
		$sent  = (int) get_post_meta( $e->ID, '_nab_nudged_for', true ); // Activity timestamp the nudges were for.
		$level = (int) get_post_meta( $e->ID, '_nab_nudge_level', true );
		if ( $sent !== $last ) {
			$level = 0; // New activity since the last nudge: start over.
		}
		$want = $days >= 7 ? 2 : ( $days >= 3 ? 1 : 0 );
		if ( $want > $level && nab_wants( (int) $e->post_author, 'progress_updates' ) ) {
			$u   = get_userdata( (int) $e->post_author );
			$pct = (int) round( 100 * $done / count( $lessons ) );
			$url = get_permalink( nab_next_open_lesson( (int) $e->post_parent, (int) $e->post_author ) );
			if ( $u ) {
				nab_send_email(
					$u->user_email,
					/* translators: %d: percent. */
					sprintf( __( 'Still with us? You’re %d%% through', 'nab-core' ), $pct ),
					'<p>' . esc_html( sprintf( /* translators: 1: name, 2: course. */ __( 'Hi %1$s, you haven’t opened %2$s for a few days. Your next lesson is ready when you are.', 'nab-core' ), $u->first_name ? $u->first_name : $u->display_name, get_the_title( (int) $e->post_parent ) ) ) . '</p><p><a href="' . esc_url( $url ) . '">' . esc_html__( 'Continue where you left off', 'nab-core' ) . '</a></p>'
				);
			}
			update_post_meta( $e->ID, '_nab_nudge_level', $want );
			update_post_meta( $e->ID, '_nab_nudged_for', $last );
		}
	}

	// 2) Setup reminders: students with unfinished steps, quiet for 3+ days.
	$steps_total = count( nab_get_steps() );
	if ( $steps_total ) {
		foreach ( array_unique( wp_list_pluck( $rows, 'post_author' ) ) as $uid ) {
			$uid      = (int) $uid;
			$progress = nab_step_progress( $uid );
			$done     = count( array_filter( $progress, static fn( $p ) => nab_step_status_is_done( $p['status'] ) ) );
			if ( $done >= $steps_total || ! nab_wants( $uid, 'setup_reminders' ) ) {
				continue;
			}
			$last = max( array_merge( array( (int) get_user_meta( $uid, '_nab_steps_last', true ) ), array_column( $progress, 'completed_at' ) ) );
			$last = $last ? $last : strtotime( get_userdata( $uid )->user_registered . ' UTC' );
			$days = (int) floor( ( $now - $last ) / DAY_IN_SECONDS );
			$lvl  = (int) get_user_meta( $uid, '_nab_setup_nudge', true );
			$want = $days >= 7 ? 2 : ( $days >= 3 ? 1 : 0 );
			if ( $want > $lvl ) {
				$u = get_userdata( $uid );
				nab_send_email(
					$u->user_email,
					2 === $want ? __( 'Your setup is waiting for you', 'nab-core' ) : __( 'A quick nudge on your setup steps', 'nab-core' ),
					'<p>' . esc_html( sprintf( /* translators: 1: done, 2: total. */ __( 'You’ve finished %1$d of %2$d setup steps. Each one takes about 10 minutes, and the AI helper is there if you get stuck.', 'nab-core' ), $done, $steps_total ) ) . '</p><p><a href="' . esc_url( home_url( '/setup/' ) ) . '">' . esc_html__( 'Continue setup', 'nab-core' ) . '</a></p>'
				);
				if ( 2 === $want ) {
					nab_notify( $uid, 'deadline', __( 'Your setup steps are waiting', 'nab-core' ), '', home_url( '/setup/' ) );
				}
				update_user_meta( $uid, '_nab_setup_nudge', $want );
			}
		}
	}

	// 3) Installment reminders, 3 days before each automatic charge.
	foreach ( as_get_scheduled_actions( array( 'hook' => 'nab_charge_installment', 'status' => 'pending', 'per_page' => 500 ), OBJECT ) as $action ) {
		$args = $action->get_args();
		$when = $action->get_schedule() ? $action->get_schedule()->get_date() : null;
		$ts   = $when ? $when->getTimestamp() : 0;
		if ( ! $ts || $ts - $now > 3 * DAY_IN_SECONDS || $ts < $now ) {
			continue;
		}
		$parent = wc_get_order( (int) $args[0] );
		$n      = (int) $args[1];
		if ( ! $parent || $parent->get_meta( '_nab_reminded_' . $n ) ) {
			continue;
		}
		$item  = nab_order_plan_item( $parent );
		$count = $item ? (int) $item->get_meta( '_nab_installments' ) : 3;
		$amt   = $item ? nab_installment_amounts( (float) $item->get_meta( '_nab_full_price' ), $count )[ $n - 1 ] ?? 0 : 0;
		nab_send_email(
			$parent->get_billing_email(),
			/* translators: 1: n, 2: count. */
			sprintf( __( 'Installment %1$d of %2$d is due soon', 'nab-core' ), $n, $count ),
			'<p>' . esc_html( sprintf( /* translators: 1: amount, 2: date. */ __( 'We’ll charge %1$s to your saved card on %2$s. Nothing to do if your card is up to date.', 'nab-core' ), nab_money( $amt ), wp_date( 'F j', $ts ) ) ) . '</p><p><a href="' . esc_url( $parent->get_view_order_url() ) . '">' . esc_html__( 'View your plan', 'nab-core' ) . '</a></p>'
		);
		$parent->update_meta_data( '_nab_reminded_' . $n, $now );
		$parent->save();
	}

	// 4) Review backlog alert.
	if ( function_exists( 'nab_submissions_needing_review' ) ) {
		$backlog = count( nab_submissions_needing_review() );
		if ( $backlog >= NAB_BACKLOG_ALERT ) {
			nab_send_email(
				get_option( 'admin_email' ),
				/* translators: %d: count. */
				sprintf( __( '%d setup screenshots are waiting for review', 'nab-core' ), $backlog ),
				'<p><a href="' . esc_url( admin_url( 'edit.php?post_type=nab_step&page=nab-step-reviews' ) ) . '">' . esc_html__( 'Open the review queue', 'nab-core' ) . '</a></p>'
			);
		}
	}
}
add_action( 'nab_daily', 'nab_daily' );

// Setup activity timestamp (submissions count as activity).
add_action( 'save_post_nab_submission', static fn( $id, $post ) => update_user_meta( (int) $post->post_author, '_nab_steps_last', time() ), 10, 2 );

/* ---------------- Email log ---------------- */

add_action(
	'init',
	static function () {
		register_post_type( 'nab_email_log', array( 'label' => __( 'Email log', 'nab-core' ), 'public' => false, 'show_ui' => false ) );
	}
);

add_filter(
	'wp_mail',
	static function ( $atts ) {
		$to = is_array( $atts['to'] ) ? implode( ', ', $atts['to'] ) : (string) $atts['to'];
		$id = wp_insert_post( array( 'post_type' => 'nab_email_log', 'post_status' => 'private', 'post_title' => wp_strip_all_tags( (string) $atts['subject'] ), 'post_excerpt' => $to ) );
		update_post_meta( $id, '_nab_status', 'sent' );
		$GLOBALS['nab_last_mail_log'] = $id;
		return $atts;
	},
	1
);
add_action(
	'wp_mail_failed',
	static function ( $error ) {
		if ( ! empty( $GLOBALS['nab_last_mail_log'] ) ) {
			update_post_meta( (int) $GLOBALS['nab_last_mail_log'], '_nab_status', 'failed' );
			update_post_meta( (int) $GLOBALS['nab_last_mail_log'], '_nab_error', $error->get_error_message() );
		}
	}
);
// Keep 90 days.
add_action(
	'nab_daily',
	static function () {
		foreach ( get_posts( array( 'post_type' => 'nab_email_log', 'post_status' => 'private', 'posts_per_page' => 500, 'fields' => 'ids', 'date_query' => array( array( 'before' => '90 days ago' ) ) ) ) as $id ) {
			wp_delete_post( $id, true );
		}
	},
	20
);

add_action(
	'admin_menu',
	static function () {
		add_management_page(
			__( 'Email log', 'nab-core' ),
			__( 'Email log', 'nab-core' ),
			'manage_options',
			'nab-email-log',
			static function () {
				$q    = sanitize_text_field( wp_unslash( $_GET['s'] ?? '' ) ); // phpcs:ignore WordPress.Security.NonceVerification
				$logs = get_posts( array( 'post_type' => 'nab_email_log', 'post_status' => 'private', 'posts_per_page' => 200, 's' => $q ) );
				echo '<div class="wrap"><h1>' . esc_html__( 'Email log', 'nab-core' ) . '</h1><form><input type="hidden" name="page" value="nab-email-log" /><p class="search-box"><input type="search" name="s" value="' . esc_attr( $q ) . '" /><button class="button">' . esc_html__( 'Search subject', 'nab-core' ) . '</button></p></form><table class="widefat striped"><thead><tr><th>' . esc_html__( 'When', 'nab-core' ) . '</th><th>' . esc_html__( 'To', 'nab-core' ) . '</th><th>' . esc_html__( 'Subject', 'nab-core' ) . '</th><th>' . esc_html__( 'Status', 'nab-core' ) . '</th></tr></thead><tbody>';
				foreach ( $logs as $l ) {
					$st = (string) get_post_meta( $l->ID, '_nab_status', true );
					echo '<tr><td>' . esc_html( get_the_date( 'M j, Y g:i a', $l ) ) . '</td><td>' . esc_html( $l->post_excerpt ) . '</td><td>' . esc_html( $l->post_title ) . '</td><td>' . esc_html( $st ) . ( 'failed' === $st ? '<br><small>' . esc_html( get_post_meta( $l->ID, '_nab_error', true ) ) . '</small>' : '' ) . '</td></tr>';
				}
				echo $logs ? '' : '<tr><td colspan="4">' . esc_html__( 'No emails yet.', 'nab-core' ) . '</td></tr>';
				echo '</tbody></table></div>';
			}
		);
	}
);
