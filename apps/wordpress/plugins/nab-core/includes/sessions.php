<?php
/**
 * Live sessions for live/combined cohorts: date, length, Zoom link, recording.
 * Admins add them on the course screen. Students see them at /live-sessions/;
 * the join link is only shown to students whose enrollment is active (paid up),
 * as on the old platform. The course page lists the schedule without links.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	static function () {
		register_post_type(
			'nab_session',
			array(
				'labels'       => array(
					'name'          => __( 'Live sessions', 'nab-core' ),
					'singular_name' => __( 'Live session', 'nab-core' ),
					'add_new_item'  => __( 'Schedule a live session', 'nab-core' ),
				),
				'public'       => false,
				'show_ui'      => true,
				'show_in_menu' => 'edit.php?post_type=courses',
				'supports'     => array( 'title' ),
			)
		);
		add_rewrite_rule( '^live-sessions/?$', 'index.php?nab_sessions=1', 'top' );
	}
);
add_filter(
	'query_vars',
	static function ( $vars ) {
		$vars[] = 'nab_sessions';
		return $vars;
	}
);

/**
 * Session fields: key => [label, type].
 *
 * @return array
 */
function nab_session_fields() {
	return array(
		'_nab_course_id'     => array( __( 'Course', 'nab-core' ), 'course' ),
		'_nab_starts'        => array( __( 'Starts (site time zone)', 'nab-core' ), 'datetime-local' ),
		'_nab_minutes'       => array( __( 'Length (minutes)', 'nab-core' ), 'number' ),
		'_nab_zoom_url'      => array( __( 'Join link (Zoom, Meet…)', 'nab-core' ), 'url' ),
		'_nab_recording_url' => array( __( 'Recording link (after the session)', 'nab-core' ), 'url' ),
	);
}

add_action(
	'add_meta_boxes',
	static function () {
		add_meta_box(
			'nab-session',
			__( 'Session details', 'nab-core' ),
			static function ( $post ) {
				wp_nonce_field( 'nab_session', 'nab_session_nonce' );
				foreach ( nab_session_fields() as $key => [ $label, $type ] ) {
					$v = (string) get_post_meta( $post->ID, $key, true );
					echo '<p><label for="' . esc_attr( $key ) . '"><strong>' . esc_html( $label ) . '</strong></label><br />';
					if ( 'course' === $type ) {
						echo '<select id="' . esc_attr( $key ) . '" name="' . esc_attr( $key ) . '">';
						foreach ( nab_query_course_ids() as $cid ) {
							echo '<option value="' . (int) $cid . '"' . selected( (int) $v, $cid, false ) . '>' . esc_html( get_the_title( $cid ) . ' (' . nab_course_formats()[ nab_course_format( $cid ) ] . ')' ) . '</option>';
						}
						echo '</select>';
					} else {
						echo '<input class="widefat" type="' . esc_attr( $type ) . '" id="' . esc_attr( $key ) . '" name="' . esc_attr( $key ) . '" value="' . esc_attr( $v ) . '" />';
					}
					echo '</p>';
				}
			},
			'nab_session',
			'normal',
			'high'
		);
	}
);

add_action(
	'save_post_nab_session',
	static function ( $post_id ) {
		if ( ! isset( $_POST['nab_session_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['nab_session_nonce'] ), 'nab_session' ) || ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		foreach ( nab_session_fields() as $key => [ , $type ] ) {
			$raw = isset( $_POST[ $key ] ) ? sanitize_text_field( wp_unslash( $_POST[ $key ] ) ) : '';
			update_post_meta( $post_id, $key, 'url' === $type ? esc_url_raw( $raw ) : ( in_array( $type, array( 'number', 'course' ), true ) ? absint( $raw ) : $raw ) );
		}
		// Tell the course's students once, after the details (incl. course) are saved.
		$course = (int) get_post_meta( $post_id, '_nab_course_id', true );
		if ( $course && 'publish' === get_post_status( $post_id ) && ! get_post_meta( $post_id, '_nab_notified', true ) && function_exists( 'nab_notify' ) ) {
			update_post_meta( $post_id, '_nab_notified', time() );
			foreach ( nab_broadcast_audience( $course ) as $uid ) {
				/* translators: %s: session. */
				nab_notify( $uid, 'session', sprintf( __( 'New live session: %s', 'nab-core' ), get_the_title( $post_id ) ), '', home_url( '/live-sessions/' ) );
			}
		}
	}
);

/**
 * Sessions for a course, soonest first.
 *
 * @param int $course_id Course.
 * @return array<int, array{id:int,title:string,starts:int,minutes:int,zoom:string,recording:string}>
 */
function nab_course_sessions( $course_id ) {
	$out = array();
	foreach ( get_posts( array( 'post_type' => 'nab_session', 'post_status' => 'publish', 'posts_per_page' => -1, 'meta_key' => '_nab_course_id', 'meta_value' => $course_id ) ) as $s ) { // phpcs:ignore WordPress.DB.SlowDBQuery -- small set.
		$starts = (string) get_post_meta( $s->ID, '_nab_starts', true );
		$out[]  = array(
			'id'        => $s->ID,
			'title'     => get_the_title( $s ),
			'starts'    => $starts ? ( new DateTime( $starts, wp_timezone() ) )->getTimestamp() : 0,
			'minutes'   => (int) get_post_meta( $s->ID, '_nab_minutes', true ),
			'zoom'      => (string) get_post_meta( $s->ID, '_nab_zoom_url', true ),
			'recording' => (string) get_post_meta( $s->ID, '_nab_recording_url', true ),
		);
	}
	// DEMO: a weekly schedule for live cohorts until real sessions are added.
	if ( ! $out && function_exists( 'nab_demo_claims' ) && nab_demo_claims() && 'recorded' !== nab_course_format( $course_id ) ) {
		$start = nab_demo()['next_start'] + 18 * HOUR_IN_SECONDS;
		foreach ( nab_course_modules( $course_id ) as $i => $m ) {
			$out[] = array(
				'id'        => 0,
				'title'     => preg_replace( '/^(Week|Module)\s+\d+\s*[.:—–-]?\s*/u', '', $m['title'] ),
				'starts'    => $start + $i * WEEK_IN_SECONDS,
				'minutes'   => 180,
				'zoom'      => 'https://zoom.us/j/0000000000',
				'recording' => '',
			);
		}
	}
	usort( $out, static fn( $a, $b ) => $a['starts'] <=> $b['starts'] );
	return $out;
}

/**
 * Courses a user is actively (paid-up) enrolled in.
 *
 * @param int $user_id User.
 * @return int[]
 */
function nab_active_course_ids( $user_id ) {
	global $wpdb;
	return array_map( 'intval', $wpdb->get_col( $wpdb->prepare( "SELECT post_parent FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_status = 'completed' AND post_author = %d", $user_id ) ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
}

/**
 * Render a session list.
 *
 * @param array $sessions  From nab_course_sessions().
 * @param bool  $can_join  Show join links.
 * @return string HTML.
 */
function nab_render_session_list( $sessions, $can_join ) {
	$html = '<ol class="nab-sessions">';
	foreach ( $sessions as $s ) {
		$past  = $s['starts'] && $s['starts'] + max( 60, $s['minutes'] ) * 60 < time();
		$soon  = ! $past && $s['starts'] && $s['starts'] - time() < 30 * MINUTE_IN_SECONDS;
		$html .= '<li class="' . ( $past ? 'is-past' : '' ) . '"><div class="nab-sessions__when"><b>' . esc_html( $s['starts'] ? wp_date( 'M j', $s['starts'] ) : '—' ) . '</b><span>' . esc_html( $s['starts'] ? wp_date( 'D, g:i a T', $s['starts'] ) : '' ) . '</span></div><div class="nab-sessions__what"><p>' . esc_html( $s['title'] ) . '</p><small>' . esc_html( $s['minutes'] ? sprintf( /* translators: %d: minutes. */ __( '%d minutes', 'nab-core' ), $s['minutes'] ) : '' ) . '</small></div><div class="nab-sessions__act">';
		if ( $past && $s['recording'] && $can_join ) {
			$html .= '<a class="nab-btn nab-btn--outline" href="' . esc_url( $s['recording'] ) . '" target="_blank" rel="noopener">' . esc_html__( 'Watch recording', 'nab-core' ) . '</a>';
		} elseif ( $past ) {
			$html .= '<span class="nab-sessions__tag">' . esc_html__( 'Recording within 24 hours', 'nab-core' ) . '</span>';
		} elseif ( $can_join && $s['zoom'] ) {
			$html .= '<a class="nab-btn' . ( $soon ? '' : ' nab-btn--outline' ) . '" href="' . esc_url( $s['zoom'] ) . '" target="_blank" rel="noopener">' . esc_html( $soon ? __( 'Join now', 'nab-core' ) : __( 'Join link', 'nab-core' ) ) . '</a>';
		}
		$html .= '</div></li>';
	}
	return $html . '</ol>';
}

add_action(
	'template_redirect',
	static function () {
		if ( ! get_query_var( 'nab_sessions' ) ) {
			return;
		}
		if ( ! is_user_logged_in() ) {
			wp_safe_redirect( nab_signin_url( home_url( '/live-sessions/' ) ) );
			exit;
		}
		$html = '<section class="nab-wrap" style="padding-block:3rem 5rem;max-width:900px"><h1 style="font-size:var(--wp--preset--font-size--2-xl);font-weight:300;letter-spacing:-0.03em;margin:0 0 .5rem">' . esc_html__( 'Live sessions', 'nab-core' ) . '</h1><p class="nab-lede" style="margin-bottom:2rem!important">' . esc_html__( 'Join links appear here for your live cohort. Recordings are added within 24 hours.', 'nab-core' ) . '</p>';
		$any  = false;
		foreach ( nab_active_course_ids( get_current_user_id() ) as $cid ) {
			$sessions = nab_course_sessions( $cid );
			if ( ! $sessions ) {
				continue;
			}
			$any   = true;
			$html .= '<h2 style="font-size:1.375rem;font-weight:400;margin:2rem 0 1rem">' . esc_html( get_the_title( $cid ) ) . '</h2>' . nab_render_session_list( $sessions, true );
		}
		if ( ! $any ) {
			$html .= '<div class="nab-card" style="padding:2rem"><p style="margin:0">' . esc_html__( 'No live sessions scheduled for your courses yet. You’ll get a notification when one is added.', 'nab-core' ) . '</p></div>';
		}
		$html .= '</section>';
		add_filter( 'pre_get_document_title', static fn() => __( 'Live sessions', 'nab-core' ) . ' – nextaibuilder' );
		nextaibuilder_render_shell( $html );
		exit;
	}
);

add_filter(
	'tutor_dashboard/nav_items',
	static function ( $items ) {
		$items['nab-sessions'] = array(
			'title' => __( 'Live sessions', 'nab-core' ),
			'icon'  => 'calendar-check',
			'url'   => home_url( '/live-sessions/' ),
		);
		return $items;
	},
	22
);
