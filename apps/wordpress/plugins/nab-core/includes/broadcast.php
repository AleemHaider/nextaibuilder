<?php
/**
 * Users → Email students: send one message to everyone actively enrolled in a
 * course (or in any course). Sent in background batches via Action Scheduler.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

const NAB_BROADCAST_BATCH = 40;

/**
 * Active student IDs, optionally for one course.
 *
 * @param int $course_id 0 for every course.
 * @return int[]
 */
function nab_broadcast_audience( $course_id = 0 ) {
	global $wpdb;
	$sql = "SELECT DISTINCT p.post_author FROM {$wpdb->posts} p INNER JOIN {$wpdb->users} u ON u.ID = p.post_author
		WHERE p.post_type = 'tutor_enrolled' AND p.post_status = 'completed'";
	if ( $course_id ) {
		$sql .= $wpdb->prepare( ' AND p.post_parent = %d', $course_id );
	}
	return array_map( 'intval', $wpdb->get_col( $sql ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery, WordPress.DB.PreparedSQL.NotPrepared -- static SQL + prepared fragment.
}

add_action(
	'admin_menu',
	static function () {
		add_users_page( __( 'Email students', 'nab-core' ), __( 'Email students', 'nab-core' ), 'nab_send_messages', 'nab-broadcast', 'nab_render_broadcast_page' );
	}
);

/**
 * The compose form + recent sends.
 */
function nab_render_broadcast_page() {
	$courses = get_posts(
		array(
			'post_type'      => 'courses',
			'post_status'    => array( 'publish', 'draft' ),
			'posts_per_page' => -1,
		)
	);
	echo '<div class="wrap"><h1>' . esc_html__( 'Email students', 'nab-core' ) . '</h1>';
	if ( isset( $_GET['nab_sent'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification -- display flag.
		$n = absint( $_GET['nab_sent'] ); // phpcs:ignore WordPress.Security.NonceVerification
		echo '<div class="notice notice-success"><p>' . esc_html( -1 === (int) $_GET['nab_sent'] ? __( 'Test email sent to you.', 'nab-core' ) : sprintf( /* translators: %d: recipients. */ _n( 'Queued for %d student. Emails go out in the background over the next few minutes.', 'Queued for %d students. Emails go out in the background over the next few minutes.', $n, 'nab-core' ), $n ) ) . '</p></div>'; // phpcs:ignore WordPress.Security.NonceVerification
	}
	?>
	<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
		<input type="hidden" name="action" value="nab_broadcast" />
		<?php wp_nonce_field( 'nab_broadcast' ); ?>
		<table class="form-table">
			<tr><th><label for="nab-b-course"><?php esc_html_e( 'Send to', 'nab-core' ); ?></label></th><td>
				<select id="nab-b-course" name="course">
					<option value="0"><?php echo esc_html( sprintf( /* translators: %d: count. */ __( 'All enrolled students (%d)', 'nab-core' ), count( nab_broadcast_audience() ) ) ); ?></option>
					<?php foreach ( $courses as $c ) : ?>
						<option value="<?php echo (int) $c->ID; ?>"><?php echo esc_html( sprintf( '%s · %s (%d)', get_the_title( $c ), nab_course_formats()[ nab_course_format( $c->ID ) ], count( nab_broadcast_audience( $c->ID ) ) ) ); ?></option>
					<?php endforeach; ?>
				</select>
			</td></tr>
			<tr><th><label for="nab-b-subject"><?php esc_html_e( 'Subject', 'nab-core' ); ?></label></th><td><input id="nab-b-subject" class="large-text" name="subject" required maxlength="150" /></td></tr>
			<tr><th><?php esc_html_e( 'Message', 'nab-core' ); ?></th><td>
				<?php wp_editor( '', 'nab_b_body', array( 'textarea_name' => 'body', 'media_buttons' => false, 'textarea_rows' => 12 ) ); ?>
				<p class="description"><?php esc_html_e( 'Use {first_name} to personalise.', 'nab-core' ); ?></p>
			</td></tr>
		</table>
		<p>
			<button class="button" name="mode" value="test"><?php esc_html_e( 'Send me a test', 'nab-core' ); ?></button>
			<button class="button button-primary" name="mode" value="send" onclick="return confirm('<?php echo esc_js( __( 'Send this email to the selected students now?', 'nab-core' ) ); ?>')"><?php esc_html_e( 'Send to students', 'nab-core' ); ?></button>
		</p>
	</form>
	<?php
	$log = array_reverse( (array) get_option( 'nab_broadcast_log', array() ) );
	if ( $log ) {
		echo '<h2>' . esc_html__( 'Recent emails', 'nab-core' ) . '</h2><table class="widefat striped"><thead><tr><th>' . esc_html__( 'Date', 'nab-core' ) . '</th><th>' . esc_html__( 'Subject', 'nab-core' ) . '</th><th>' . esc_html__( 'Audience', 'nab-core' ) . '</th><th>' . esc_html__( 'Recipients', 'nab-core' ) . '</th></tr></thead><tbody>';
		foreach ( array_slice( $log, 0, 20 ) as $row ) {
			printf( '<tr><td>%s</td><td>%s</td><td>%s</td><td>%d</td></tr>', esc_html( wp_date( 'M j, Y g:i a', $row['at'] ) ), esc_html( $row['subject'] ), esc_html( $row['audience'] ), (int) $row['count'] );
		}
		echo '</tbody></table>';
	}
	echo '</div>';
}

add_action(
	'admin_post_nab_broadcast',
	static function () {
		check_admin_referer( 'nab_broadcast' );
		if ( ! current_user_can( 'nab_send_messages' ) ) {
			wp_die( '', 403 );
		}
		$course  = isset( $_POST['course'] ) ? absint( $_POST['course'] ) : 0;
		$subject = isset( $_POST['subject'] ) ? sanitize_text_field( wp_unslash( $_POST['subject'] ) ) : '';
		$body    = isset( $_POST['body'] ) ? wp_kses_post( wp_unslash( $_POST['body'] ) ) : '';
		$back    = admin_url( 'users.php?page=nab-broadcast' );
		if ( ! $subject || ! trim( wp_strip_all_tags( $body ) ) ) {
			wp_safe_redirect( $back );
			exit;
		}
		if ( 'test' === ( $_POST['mode'] ?? '' ) ) {
			nab_send_broadcast_one( get_current_user_id(), $subject, $body );
			wp_safe_redirect( add_query_arg( 'nab_sent', -1, $back ) );
			exit;
		}
		$ids = nab_broadcast_audience( $course );
		foreach ( array_chunk( $ids, NAB_BROADCAST_BATCH ) as $i => $chunk ) {
			// Body stored once in an option; actions only carry its key.
			$key = 'nab_bc_' . wp_generate_password( 10, false );
			update_option( $key, array( 'subject' => $subject, 'body' => $body ), false );
			as_schedule_single_action( time() + $i * 60, 'nab_send_broadcast_batch', array( $key, $chunk ), 'nab-broadcast' );
		}
		$log   = (array) get_option( 'nab_broadcast_log', array() );
		$log[] = array(
			'at'       => time(),
			'subject'  => $subject,
			'audience' => $course ? get_the_title( $course ) : __( 'All enrolled students', 'nab-core' ),
			'count'    => count( $ids ),
		);
		update_option( 'nab_broadcast_log', array_slice( $log, -50 ), false );
		wp_safe_redirect( add_query_arg( 'nab_sent', count( $ids ), $back ) );
		exit;
	}
);

/**
 * Send one personalised email.
 *
 * @param int    $user_id User.
 * @param string $subject Subject.
 * @param string $body    HTML body.
 */
function nab_send_broadcast_one( $user_id, $subject, $body ) {
	$user = get_userdata( $user_id );
	if ( ! $user || ( function_exists( 'nab_wants' ) && ! nab_wants( $user_id, 'progress_updates' ) && get_current_user_id() !== $user_id ) ) {
		return; // Respect students who turned off announcements (tests to yourself always send).
	}
	$first = $user->first_name ? $user->first_name : $user->display_name;
	nab_send_email( $user->user_email, str_replace( '{first_name}', $first, $subject ), wpautop( str_replace( '{first_name}', esc_html( $first ), $body ) ) );
	if ( function_exists( 'nab_notify' ) ) {
		nab_notify( $user_id, 'broadcast', str_replace( '{first_name}', $first, $subject ), wp_trim_words( wp_strip_all_tags( $body ), 30 ) );
	}
}

add_action(
	'nab_send_broadcast_batch',
	static function ( $key, $user_ids ) {
		$msg = get_option( $key );
		if ( ! is_array( $msg ) ) {
			return;
		}
		foreach ( (array) $user_ids as $user_id ) {
			nab_send_broadcast_one( (int) $user_id, $msg['subject'], $msg['body'] );
		}
		delete_option( $key );
	},
	10,
	2
);
