<?php
/**
 * Users → Students: the old admin "Students" screen.
 * - table with courses, lesson progress, setup steps, last activity and health
 *   (blocked: 14+ days quiet with setup steps left; at risk: 7–14 days quiet);
 * - per-student actions: nudge email, reset progress, enroll in a course,
 *   move to another course; CSV export;
 * - Users → Invite students: emails (paste or CSV, up to 100), optional course,
 *   each gets a 7-day sign-in link.
 * Every action is written to the activity log.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Write an entry to the activity log (Simple History when active).
 *
 * @param string $message Message with {placeholders}.
 * @param array  $context Values.
 */
function nab_log( $message, $context = array() ) {
	do_action( 'simple_history_log', $message, $context, 'info' );
}

/**
 * Everything the Students screen shows about one student.
 *
 * @param WP_User $u User.
 * @return array
 */
function nab_student_row( $u ) {
	global $wpdb;
	$enrolls = $wpdb->get_results( $wpdb->prepare( "SELECT ID, post_parent, post_status, post_date_gmt FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_author = %d", $u->ID ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	$courses = array();
	$last    = strtotime( $u->user_registered . ' UTC' );
	foreach ( $enrolls as $e ) {
		$ids  = nab_course_lesson_ids( (int) $e->post_parent );
		$done = count( array_filter( $ids, static fn( $l ) => nab_lesson_done( $l, $u->ID ) ) );
		$last = max( $last, nab_last_activity( $u->ID, (int) $e->post_parent, strtotime( $e->post_date_gmt . ' UTC' ) ) );
		$courses[] = array(
			'enroll' => (int) $e->ID,
			'id'     => (int) $e->post_parent,
			'title'  => get_the_title( (int) $e->post_parent ),
			'status' => $e->post_status,
			'pct'    => $ids ? (int) round( 100 * $done / count( $ids ) ) : 0,
		);
	}
	$progress   = nab_step_progress( $u->ID );
	$steps_done = count( array_filter( $progress, static fn( $p ) => nab_step_status_is_done( $p['status'] ) ) );
	$last       = max( $last, (int) get_user_meta( $u->ID, '_nab_steps_last', true ), (int) get_user_meta( $u->ID, 'nab_last_login', true ) );
	$quiet      = (int) floor( ( time() - $last ) / DAY_IN_SECONDS );
	$steps_left = $steps_done < count( $progress );
	$health     = ( $quiet >= 14 && $steps_left ) ? 'blocked' : ( $quiet >= 7 ? 'at_risk' : 'on_track' );
	return array(
		'user'       => $u,
		'courses'    => $courses,
		'steps_done' => $steps_done,
		'steps_all'  => count( $progress ),
		'last'       => $last,
		'quiet'      => $quiet,
		'health'     => $courses ? $health : 'not_enrolled',
	);
}

add_action( 'wp_login', static fn( $login, $user ) => update_user_meta( $user->ID, 'nab_last_login', time() ), 10, 2 );

/**
 * Students to list (anyone with an enrollment, plus customers).
 *
 * @param string $search Search text.
 * @return WP_User[]
 */
function nab_students( $search = '' ) {
	$args = array(
		'role__in' => array( 'customer', 'subscriber', 'tutor_student' ),
		'number'   => 500,
		'orderby'  => 'registered',
		'order'    => 'DESC',
	);
	if ( $search ) {
		$args['search']         = '*' . $search . '*';
		$args['search_columns'] = array( 'user_email', 'display_name', 'user_login' );
	}
	return get_users( $args );
}

add_action(
	'admin_menu',
	static function () {
		add_users_page( __( 'Students', 'nab-core' ), __( 'Students', 'nab-core' ), 'nab_manage_students', 'nab-students', 'nab_render_students_page' );
		add_users_page( __( 'Invite students', 'nab-core' ), __( 'Invite students', 'nab-core' ), 'nab_manage_students', 'nab-invite', 'nab_render_invite_page' );
	}
);

/**
 * Students screen.
 */
function nab_render_students_page() {
	// phpcs:disable WordPress.Security.NonceVerification -- read-only filters.
	$search = sanitize_text_field( wp_unslash( $_GET['s'] ?? '' ) );
	$filter = sanitize_key( $_GET['health'] ?? '' );
	// phpcs:enable
	$rows = array_map( 'nab_student_row', nab_students( $search ) );
	if ( $filter ) {
		$rows = array_values( array_filter( $rows, static fn( $r ) => $r['health'] === $filter ) );
	}
	$labels  = array( 'on_track' => __( 'On track', 'nab-core' ), 'at_risk' => __( 'At risk', 'nab-core' ), 'blocked' => __( 'Blocked', 'nab-core' ), 'not_enrolled' => __( 'Not enrolled', 'nab-core' ) );
	$courses = nab_query_course_ids();
	$msg     = sanitize_key( $_GET['done'] ?? '' ); // phpcs:ignore WordPress.Security.NonceVerification

	echo '<div class="wrap"><h1 class="wp-heading-inline">' . esc_html__( 'Students', 'nab-core' ) . '</h1> <a class="page-title-action" href="' . esc_url( admin_url( 'users.php?page=nab-invite' ) ) . '">' . esc_html__( 'Invite students', 'nab-core' ) . '</a> <a class="page-title-action" href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=nab_students_csv' ), 'nab_students_csv' ) ) . '">' . esc_html__( 'Export CSV', 'nab-core' ) . '</a>';
	if ( $msg ) {
		echo '<div class="notice notice-success"><p>' . esc_html( ucfirst( str_replace( '_', ' ', $msg ) ) ) . '.</p></div>';
	}
	echo '<form style="margin:1rem 0"><input type="hidden" name="page" value="nab-students" /><input type="search" name="s" value="' . esc_attr( $search ) . '" placeholder="' . esc_attr__( 'Name or email', 'nab-core' ) . '" /> <select name="health"><option value="">' . esc_html__( 'All health states', 'nab-core' ) . '</option>';
	foreach ( $labels as $k => $l ) {
		echo '<option value="' . esc_attr( $k ) . '"' . selected( $filter, $k, false ) . '>' . esc_html( $l ) . '</option>';
	}
	echo '</select> <button class="button">' . esc_html__( 'Filter', 'nab-core' ) . '</button></form>';
	echo '<table class="widefat striped"><thead><tr><th>' . esc_html__( 'Student', 'nab-core' ) . '</th><th>' . esc_html__( 'Courses and progress', 'nab-core' ) . '</th><th>' . esc_html__( 'Setup steps', 'nab-core' ) . '</th><th>' . esc_html__( 'Last active', 'nab-core' ) . '</th><th>' . esc_html__( 'Health', 'nab-core' ) . '</th><th>' . esc_html__( 'Actions', 'nab-core' ) . '</th></tr></thead><tbody>';
	if ( ! $rows ) {
		echo '<tr><td colspan="6">' . esc_html__( 'No students match.', 'nab-core' ) . '</td></tr>';
	}
	$colors = array( 'on_track' => '#1f7a45', 'at_risk' => '#b4501e', 'blocked' => '#b0222e', 'not_enrolled' => '#5f6b80' );
	foreach ( $rows as $r ) {
		$u = $r['user'];
		echo '<tr><td><a href="' . esc_url( get_edit_user_link( $u->ID ) ) . '"><strong>' . esc_html( $u->display_name ) . '</strong></a><br><small>' . esc_html( $u->user_email ) . '</small></td><td>';
		foreach ( $r['courses'] as $c ) {
			echo esc_html( $c['title'] ) . ' <small>(' . esc_html( $c['status'] ) . ', ' . (int) $c['pct'] . '%)</small><br>';
		}
		echo '</td><td>' . (int) $r['steps_done'] . ' / ' . (int) $r['steps_all'] . '</td><td>' . esc_html( human_time_diff( $r['last'] ) ) . ' ' . esc_html__( 'ago', 'nab-core' ) . '</td><td><strong style="color:' . esc_attr( $colors[ $r['health'] ] ) . '">' . esc_html( $labels[ $r['health'] ] ) . '</strong></td><td>';
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center"><input type="hidden" name="action" value="nab_student_action" /><input type="hidden" name="user" value="' . (int) $u->ID . '" />';
		wp_nonce_field( 'nab_student_' . $u->ID );
		echo '<select name="op"><option value="nudge">' . esc_html__( 'Send nudge email', 'nab-core' ) . '</option><option value="enroll">' . esc_html__( 'Enroll in…', 'nab-core' ) . '</option><option value="transfer">' . esc_html__( 'Move to…', 'nab-core' ) . '</option><option value="reset">' . esc_html__( 'Reset progress', 'nab-core' ) . '</option></select><select name="course"><option value="0">—</option>';
		foreach ( $courses as $cid ) {
			echo '<option value="' . (int) $cid . '">' . esc_html( wp_trim_words( get_the_title( $cid ), 6 ) . ' (' . nab_course_formats()[ nab_course_format( $cid ) ] . ')' ) . '</option>';
		}
		echo '</select><button class="button" onclick="return this.form.op.value!==\'reset\'||confirm(\'' . esc_js( __( 'Reset this student’s lesson and setup progress?', 'nab-core' ) ) . '\')">' . esc_html__( 'Go', 'nab-core' ) . '</button></form></td></tr>';
	}
	echo '</tbody></table><p class="description">' . esc_html__( 'Health: Blocked = quiet 14+ days with setup steps left; At risk = quiet 7+ days. “Move to” moves the student’s first active enrollment to the chosen course. “Reset progress” clears lesson completions, setup steps and badges (certificates and payments are kept).', 'nab-core' ) . '</p></div>';
}

add_action(
	'admin_post_nab_student_action',
	static function () {
		$uid = absint( $_POST['user'] ?? 0 );
		check_admin_referer( 'nab_student_' . $uid );
		if ( ! current_user_can( 'nab_manage_students' ) ) {
			wp_die( '', 403 );
		}
		$op     = sanitize_key( $_POST['op'] ?? '' );
		$course = absint( $_POST['course'] ?? 0 );
		$u      = get_userdata( $uid );
		$done   = 'nothing_changed';
		if ( $u && 'nudge' === $op ) {
			nab_send_email(
				$u->user_email,
				__( 'Checking in on your progress', 'nab-core' ),
				'<p>' . esc_html( sprintf( /* translators: %s: name. */ __( 'Hi %s, just checking in. If anything is blocking you, reply to this email or book a call and we’ll help you get moving.', 'nab-core' ), $u->first_name ? $u->first_name : $u->display_name ) ) . '</p><p><a href="' . esc_url( home_url( '/dashboard/' ) ) . '">' . esc_html__( 'Open your dashboard', 'nab-core' ) . '</a> · <a href="' . esc_url( home_url( '/book-a-call/' ) ) . '">' . esc_html__( 'Book a call', 'nab-core' ) . '</a></p>'
			);
			nab_log( 'Sent a nudge to {student}', array( 'student' => $u->user_email ) );
			$done = 'nudge_sent';
		} elseif ( $u && 'enroll' === $op && $course ) {
			global $wpdb;
			$eid = (int) $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$wpdb->posts} WHERE post_type='tutor_enrolled' AND post_parent=%d AND post_author=%d", $course, $uid ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			$eid = $eid ? $eid : (int) tutor_utils()->do_enroll( $course, 0, $uid );
			tutor_utils()->course_enrol_status_change( $eid, 'completed' );
			update_post_meta( $eid, '_nab_legacy_payment', 'MANUAL_ADMIN' );
			nab_log( 'Manually enrolled {student} in {course}', array( 'student' => $u->user_email, 'course' => get_the_title( $course ) ) );
			$done = 'student_enrolled';
		} elseif ( $u && 'transfer' === $op && $course ) {
			global $wpdb;
			$eid = (int) $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$wpdb->posts} WHERE post_type='tutor_enrolled' AND post_status='completed' AND post_author=%d ORDER BY ID LIMIT 1", $uid ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			if ( $eid ) {
				$from = (int) get_post_field( 'post_parent', $eid );
				$wpdb->update( $wpdb->posts, array( 'post_parent' => $course ), array( 'ID' => $eid ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
				clean_post_cache( $eid );
				nab_log( 'Moved {student} from {from} to {to}', array( 'student' => $u->user_email, 'from' => get_the_title( $from ), 'to' => get_the_title( $course ) ) );
				$done = 'student_moved';
			}
		} elseif ( $u && 'reset' === $op ) {
			global $wpdb;
			$wpdb->query( $wpdb->prepare( "DELETE FROM {$wpdb->usermeta} WHERE user_id = %d AND meta_key LIKE %s", $uid, $wpdb->esc_like( '_tutor_completed_lesson_id_' ) . '%' ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
			delete_user_meta( $uid, '_nab_steps' );
			delete_user_meta( $uid, '_nab_badges' );
			clean_user_cache( $uid );
			nab_log( 'Reset progress for {student}', array( 'student' => $u->user_email ) );
			$done = 'progress_reset';
		}
		wp_safe_redirect( add_query_arg( 'done', $done, admin_url( 'users.php?page=nab-students' ) ) );
		exit;
	}
);

add_action(
	'admin_post_nab_students_csv',
	static function () {
		check_admin_referer( 'nab_students_csv' );
		if ( ! current_user_can( 'nab_manage_students' ) ) {
			wp_die( '', 403 );
		}
		nocache_headers();
		header( 'Content-Type: text/csv; charset=utf-8' );
		header( 'Content-Disposition: attachment; filename="students-' . gmdate( 'Y-m-d' ) . '.csv"' );
		$out = fopen( 'php://output', 'w' ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		fputcsv( $out, array( 'Name', 'Email', 'Courses', 'Progress %', 'Setup steps done', 'Setup steps total', 'Last active (UTC)', 'Health', 'Registered (UTC)' ) );
		foreach ( nab_students() as $u ) {
			$r = nab_student_row( $u );
			fputcsv( $out, array( $u->display_name, $u->user_email, implode( '; ', array_column( $r['courses'], 'title' ) ), implode( '; ', array_column( $r['courses'], 'pct' ) ), $r['steps_done'], $r['steps_all'], gmdate( 'Y-m-d H:i', $r['last'] ), $r['health'], $u->user_registered ) );
		}
		fclose( $out ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		exit;
	}
);

/* ---------------- Invites ---------------- */

/**
 * Invite screen.
 */
function nab_render_invite_page() {
	$res = get_transient( 'nab_invite_result_' . get_current_user_id() );
	delete_transient( 'nab_invite_result_' . get_current_user_id() );
	echo '<div class="wrap"><h1>' . esc_html__( 'Invite students', 'nab-core' ) . '</h1>';
	if ( $res ) {
		echo '<div class="notice notice-success"><p>' . esc_html( $res ) . '</p></div>';
	}
	echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '" enctype="multipart/form-data"><input type="hidden" name="action" value="nab_invite" />';
	wp_nonce_field( 'nab_invite' );
	echo '<table class="form-table"><tr><th>' . esc_html__( 'Emails', 'nab-core' ) . '</th><td><textarea name="emails" rows="6" class="large-text" placeholder="ana@example.com, Tom Becker &lt;tom@example.com&gt;"></textarea><p class="description">' . esc_html__( 'One per line or comma-separated. Or upload a CSV with columns: email, first name, last name. Up to 100 at a time.', 'nab-core' ) . '</p><input type="file" name="csv" accept=".csv,text/csv" /></td></tr>';
	echo '<tr><th>' . esc_html__( 'Enroll in', 'nab-core' ) . '</th><td><select name="course"><option value="0">' . esc_html__( 'Don’t enroll (account only)', 'nab-core' ) . '</option>';
	foreach ( nab_query_course_ids() as $cid ) {
		echo '<option value="' . (int) $cid . '">' . esc_html( get_the_title( $cid ) . ' (' . nab_course_formats()[ nab_course_format( $cid ) ] . ')' ) . '</option>';
	}
	echo '</select></td></tr></table>';
	submit_button( __( 'Send invites', 'nab-core' ) );
	echo '</form></div>';
}

add_action(
	'admin_post_nab_invite',
	static function () {
		check_admin_referer( 'nab_invite' );
		if ( ! current_user_can( 'nab_manage_students' ) ) {
			wp_die( '', 403 );
		}
		$people = array();
		foreach ( preg_split( '/[\n,;]+/', (string) wp_unslash( $_POST['emails'] ?? '' ) ) as $line ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- each part sanitized below.
			if ( preg_match( '/([^<]*)<([^>]+)>/', $line, $m ) ) {
				$name     = array_pad( explode( ' ', trim( $m[1] ), 2 ), 2, '' );
				$people[] = array( sanitize_email( $m[2] ), sanitize_text_field( $name[0] ), sanitize_text_field( $name[1] ) );
			} elseif ( trim( $line ) ) {
				$people[] = array( sanitize_email( trim( $line ) ), '', '' );
			}
		}
		if ( ! empty( $_FILES['csv']['tmp_name'] ) && is_uploaded_file( $_FILES['csv']['tmp_name'] ) ) { // phpcs:ignore WordPress.Security.ValidatedSanitizedInput
			$fh = fopen( $_FILES['csv']['tmp_name'], 'r' ); // phpcs:ignore WordPress.WP.AlternativeFunctions, WordPress.Security.ValidatedSanitizedInput
			while ( $fh && ( $row = fgetcsv( $fh ) ) !== false ) { // phpcs:ignore Generic.CodeAnalysis.AssignmentInCondition
				if ( is_email( trim( $row[0] ?? '' ) ) ) {
					$people[] = array( sanitize_email( $row[0] ), sanitize_text_field( $row[1] ?? '' ), sanitize_text_field( $row[2] ?? '' ) );
				}
			}
		}
		$people = array_slice( array_filter( $people, static fn( $p ) => is_email( $p[0] ) ), 0, 100 );
		$course = absint( $_POST['course'] ?? 0 );
		$sent   = 0;
		foreach ( $people as [ $email, $first, $last ] ) {
			$user = get_user_by( 'email', $email );
			if ( ! $user ) {
				$login = sanitize_user( strstr( $email, '@', true ), true );
				$login = username_exists( $login ) ? $login . '-' . wp_generate_password( 4, false ) : $login;
				$uid   = wp_insert_user( array( 'user_login' => $login, 'user_email' => $email, 'user_pass' => wp_generate_password( 32 ), 'first_name' => $first, 'last_name' => $last, 'display_name' => trim( "$first $last" ) ? trim( "$first $last" ) : $login, 'role' => 'customer' ) );
				if ( is_wp_error( $uid ) ) {
					continue;
				}
				$user = get_userdata( $uid );
			}
			if ( $course ) {
				$eid = (int) tutor_utils()->do_enroll( $course, 0, $user->ID );
				if ( $eid ) {
					tutor_utils()->course_enrol_status_change( $eid, 'completed' );
					update_post_meta( $eid, '_nab_legacy_payment', 'MANUAL_ADMIN' );
				}
			}
			// 7-day sign-in link (same mechanism as the email sign-in link).
			$token = wp_generate_password( 40, false );
			update_user_meta( $user->ID, '_nab_magic', array( 'hash' => wp_hash_password( $token ), 'expires' => time() + 7 * DAY_IN_SECONDS, 'redirect' => home_url( '/setup/' ) ) );
			update_user_meta( $user->ID, '_nab_invited', time() );
			nab_send_email(
				$email,
				__( 'You’re invited to nextaibuilder', 'nab-core' ),
				'<p>' . esc_html( $course ? sprintf( /* translators: %s: course. */ __( 'You’ve been given a place in %s.', 'nab-core' ), get_the_title( $course ) ) : __( 'An account has been created for you.', 'nab-core' ) ) . '</p><p><a href="' . esc_url( add_query_arg( 'nab_magic', $user->ID . '.' . $token, home_url( '/sign-in/' ) ) ) . '">' . esc_html__( 'Accept your invite and sign in', 'nab-core' ) . '</a></p><p style="color:#5f6b80;font-size:13px">' . esc_html__( 'This link works once and expires in 7 days. After that, sign in with Google or request a new email link.', 'nab-core' ) . '</p>'
			);
			nab_log( 'Invited {student}', array( 'student' => $email ) );
			++$sent;
		}
		/* translators: %d: count. */
		set_transient( 'nab_invite_result_' . get_current_user_id(), sprintf( _n( '%d invite sent.', '%d invites sent.', $sent, 'nab-core' ), $sent ), MINUTE_IN_SECONDS );
		wp_safe_redirect( admin_url( 'users.php?page=nab-invite' ) );
		exit;
	}
);
