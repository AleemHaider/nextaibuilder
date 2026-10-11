<?php
/**
 * Setup steps: guided tool setup where students prove each step with a
 * screenshot. Claude checks the screenshot (see vision.php); unsure or
 * unavailable → an admin reviews it.
 *
 * Data:
 * - nab_step        CPT (public instructions; order = menu_order).
 *                   Meta: _nab_screenshot_criteria, _nab_checklist (lines),
 *                   _nab_minutes, _nab_video_url, _nab_why.
 * - nab_submission  CPT (private; author = student, parent = step).
 *                   Meta: _nab_file, _nab_mime, _nab_status
 *                   (pending|ml_processing|human_review|approved|rejected),
 *                   _nab_ml_score, _nab_ml_feedback, _nab_ml_reasoning,
 *                   _nab_review_note, _nab_reviewed_by.
 * - user meta _nab_steps: [ step_id => [status, attempts, completed_at] ].
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

const NAB_STEP_MAX_BYTES = 10 * MB_IN_BYTES;

/**
 * Register step + submission post types.
 */
function nab_register_step_types() {
	register_post_type(
		'nab_step',
		array(
			'labels'       => array(
				'name'          => __( 'Setup steps', 'nab-core' ),
				'singular_name' => __( 'Setup step', 'nab-core' ),
				'add_new_item'  => __( 'Add setup step', 'nab-core' ),
				'edit_item'     => __( 'Edit setup step', 'nab-core' ),
			),
			'public'       => false,
			'show_ui'      => true,
			'show_in_rest' => true,
			'menu_icon'    => 'dashicons-yes-alt',
			'supports'     => array( 'title', 'editor', 'page-attributes' ),
			'hierarchical' => false,
		)
	);
	register_post_type(
		'nab_submission',
		array(
			'label'        => __( 'Step submissions', 'nab-core' ),
			'public'       => false,
			'show_ui'      => false,
			'supports'     => array( 'title', 'author' ),
		)
	);
}
add_action( 'init', 'nab_register_step_types' );

/**
 * Step fields: key => [label, type].
 *
 * @return array<string, array{0:string,1:string}>
 */
function nab_step_fields() {
	return array(
		'_nab_screenshot_criteria' => array( __( 'Screenshot acceptance criteria (what the AI checks for)', 'nab-core' ), 'textarea' ),
		'_nab_checklist'           => array( __( 'Checklist (one item per line)', 'nab-core' ), 'textarea' ),
		'_nab_why'                 => array( __( 'Why it matters', 'nab-core' ), 'textarea' ),
		'_nab_minutes'             => array( __( 'Estimated minutes', 'nab-core' ), 'number' ),
		'_nab_video_url'           => array( __( 'Video URL (optional)', 'nab-core' ), 'url' ),
	);
}

add_action(
	'add_meta_boxes',
	static function () {
		add_meta_box(
			'nab-step-details',
			__( 'Step details', 'nab-core' ),
			static function ( $post ) {
				wp_nonce_field( 'nab_step_meta', 'nab_step_meta_nonce' );
				foreach ( nab_step_fields() as $key => [ $label, $type ] ) {
					$value = (string) get_post_meta( $post->ID, $key, true );
					echo '<p><label for="' . esc_attr( $key ) . '"><strong>' . esc_html( $label ) . '</strong></label><br />';
					if ( 'textarea' === $type ) {
						echo '<textarea class="widefat" rows="4" id="' . esc_attr( $key ) . '" name="' . esc_attr( $key ) . '">' . esc_textarea( $value ) . '</textarea>';
					} else {
						echo '<input class="widefat" type="' . esc_attr( $type ) . '" id="' . esc_attr( $key ) . '" name="' . esc_attr( $key ) . '" value="' . esc_attr( $value ) . '" />';
					}
					echo '</p>';
				}
				echo '<p class="description">' . esc_html__( 'Step order: use the "Order" field in Page Attributes (lower runs first).', 'nab-core' ) . '</p>';
			},
			'nab_step',
			'normal',
			'high'
		);
	}
);

add_action(
	'save_post_nab_step',
	static function ( $post_id ) {
		if ( ! isset( $_POST['nab_step_meta_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['nab_step_meta_nonce'] ), 'nab_step_meta' ) || ! current_user_can( 'edit_post', $post_id ) ) {
			return;
		}
		foreach ( nab_step_fields() as $key => [ , $type ] ) {
			if ( ! isset( $_POST[ $key ] ) ) {
				continue;
			}
			$raw = wp_unslash( $_POST[ $key ] ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- sanitized per type.
			$val = 'number' === $type ? absint( $raw ) : ( 'url' === $type ? esc_url_raw( $raw ) : sanitize_textarea_field( $raw ) );
			update_post_meta( $post_id, $key, $val );
		}
	}
);

/**
 * Published steps in order.
 *
 * @return WP_Post[]
 */
function nab_get_steps() {
	return get_posts(
		array(
			'post_type'      => 'nab_step',
			'post_status'    => 'publish',
			'posts_per_page' => -1,
			'orderby'        => array(
				'menu_order' => 'ASC',
				'ID'         => 'ASC',
			),
		)
	);
}

/**
 * Whether a user may do setup steps: any active course enrollment, or staff.
 *
 * @param int $user_id User.
 * @return bool
 */
function nab_user_can_do_steps( $user_id ) {
	if ( user_can( $user_id, 'edit_posts' ) ) {
		return true;
	}
	global $wpdb;
	return (bool) $wpdb->get_var( // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- tiny indexed lookup, status changes bypass cache.
		$wpdb->prepare( "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_author = %d AND post_status = 'completed' LIMIT 1", $user_id )
	);
}

/**
 * A student's progress with sequential unlocking applied.
 *
 * @param int $user_id User.
 * @return array<int, array{status:string, attempts:int, completed_at:int}> Keyed by step ID, in step order.
 */
function nab_step_progress( $user_id ) {
	$stored   = (array) get_user_meta( $user_id, '_nab_steps', true );
	$progress = array();
	$open     = true; // First incomplete step is unlocked; later ones stay locked.
	foreach ( nab_get_steps() as $step ) {
		$row    = $stored[ $step->ID ] ?? array();
		$status = $row['status'] ?? '';
		if ( nab_step_status_is_done( $status ) ) {
			$progress[ $step->ID ] = array(
				'status'       => $status,
				'attempts'     => (int) ( $row['attempts'] ?? 0 ),
				'completed_at' => (int) ( $row['completed_at'] ?? 0 ),
			);
			continue;
		}
		$progress[ $step->ID ] = array(
			'status'       => $open ? ( $status ? $status : 'in_progress' ) : 'locked',
			'attempts'     => (int) ( $row['attempts'] ?? 0 ),
			'completed_at' => 0,
		);
		$open = false;
	}
	return $progress;
}

/**
 * Statuses that count as done.
 *
 * @param string $status Status.
 * @return bool
 */
function nab_step_status_is_done( $status ) {
	return in_array( $status, array( 'complete', 'override_pass' ), true );
}

/**
 * Persist a step status for a user and run completion side effects.
 *
 * @param int    $user_id User.
 * @param int    $step_id Step.
 * @param string $status  in_progress|pending_review|complete|override_pass|override_fail.
 */
function nab_set_step_status( $user_id, $step_id, $status ) {
	$stored = (array) get_user_meta( $user_id, '_nab_steps', true );
	$row    = $stored[ $step_id ] ?? array( 'attempts' => 0 );
	if ( 'pending_review' === $status ) {
		$row['attempts'] = (int) ( $row['attempts'] ?? 0 ) + 1;
	}
	$row['status'] = $status;
	if ( nab_step_status_is_done( $status ) ) {
		$row['completed_at'] = time();
	}
	$stored[ $step_id ] = $row;
	update_user_meta( $user_id, '_nab_steps', $stored );
	if ( nab_step_status_is_done( $status ) ) {
		nab_award_badges( $user_id );
		nab_maybe_issue_certificate( $user_id );
	}
}

/**
 * Private uploads dir for step screenshots.
 *
 * @return string
 */
function nab_step_uploads_dir() {
	$dir = trailingslashit( wp_upload_dir()['basedir'] ) . 'nab-steps/';
	if ( ! is_dir( $dir ) ) {
		wp_mkdir_p( $dir );
		file_put_contents( $dir . '.htaccess', "Require all denied\nDeny from all\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		file_put_contents( $dir . 'index.php', "<?php\n// Silence.\n" ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	}
	return $dir;
}

/**
 * Latest submission for a user + step.
 *
 * @param int $user_id User.
 * @param int $step_id Step.
 * @return WP_Post|null
 */
function nab_latest_submission( $user_id, $step_id ) {
	$posts = get_posts(
		array(
			'post_type'      => 'nab_submission',
			'post_status'    => 'private',
			'author'         => $user_id,
			'post_parent'    => $step_id,
			'posts_per_page' => 1,
			'orderby'        => 'ID',
			'order'          => 'DESC',
		)
	);
	return $posts ? $posts[0] : null;
}

/**
 * Handle a screenshot upload for a step.
 */
function nab_handle_step_upload() {
	$step_id = isset( $_POST['step_id'] ) ? absint( $_POST['step_id'] ) : 0;
	check_admin_referer( 'nab_step_upload_' . $step_id );
	$user_id = get_current_user_id();
	$back    = wp_get_referer() ? wp_get_referer() : home_url( '/setup/' );
	$back    = remove_query_arg( 'nab_step_msg', $back );
	$step    = get_post( $step_id );
	if ( ! $user_id || ! $step || 'nab_step' !== $step->post_type || ! nab_user_can_do_steps( $user_id ) ) {
		wp_die( esc_html__( 'You can’t submit this step.', 'nab-core' ), 403 );
	}
	$progress = nab_step_progress( $user_id );
	if ( ! in_array( $progress[ $step_id ]['status'] ?? 'locked', array( 'in_progress', 'override_fail', 'rejected' ), true ) ) {
		wp_safe_redirect( add_query_arg( 'nab_step_msg', 'locked', $back ) . '#step-' . $step_id );
		exit;
	}

	// At most 10 screenshots per step per day.
	$today = get_posts( array( 'post_type' => 'nab_submission', 'post_status' => 'private', 'author' => $user_id, 'post_parent' => $step_id, 'posts_per_page' => 10, 'fields' => 'ids', 'date_query' => array( array( 'after' => '24 hours ago' ) ) ) );
	if ( count( $today ) >= 10 ) {
		wp_safe_redirect( add_query_arg( 'nab_step_msg', 'limit', $back ) . '#step-' . $step_id );
		exit;
	}

	$file = $_FILES['screenshot'] ?? null; // phpcs:ignore WordPress.Security.ValidatedSanitizedInput -- validated below.
	if ( ! $file || UPLOAD_ERR_OK !== (int) $file['error'] || ! is_uploaded_file( $file['tmp_name'] ) ) {
		wp_safe_redirect( add_query_arg( 'nab_step_msg', 'error', $back ) . '#step-' . $step_id );
		exit;
	}
	if ( (int) $file['size'] > NAB_STEP_MAX_BYTES ) {
		wp_safe_redirect( add_query_arg( 'nab_step_msg', 'size', $back ) . '#step-' . $step_id );
		exit;
	}
	$types = array(
		'jpg'  => 'image/jpeg',
		'jpeg' => 'image/jpeg',
		'png'  => 'image/png',
		'webp' => 'image/webp',
		'gif'  => 'image/gif',
	);
	$check = wp_check_filetype_and_ext( $file['tmp_name'], sanitize_file_name( $file['name'] ), $types );
	if ( empty( $check['ext'] ) || empty( $check['type'] ) ) {
		wp_safe_redirect( add_query_arg( 'nab_step_msg', 'type', $back ) . '#step-' . $step_id );
		exit;
	}
	$name = sprintf( 'u%d-s%d-%s.%s', $user_id, $step_id, wp_generate_password( 16, false ), $check['ext'] );
	if ( ! move_uploaded_file( $file['tmp_name'], nab_step_uploads_dir() . $name ) ) {
		wp_safe_redirect( add_query_arg( 'nab_step_msg', 'error', $back ) . '#step-' . $step_id );
		exit;
	}

	$submission_id = wp_insert_post(
		array(
			'post_type'   => 'nab_submission',
			'post_status' => 'private',
			'post_author' => $user_id,
			'post_parent' => $step_id,
			/* translators: 1: step, 2: user. */
			'post_title'  => sprintf( '%1$s — %2$s', get_the_title( $step ), wp_get_current_user()->display_name ),
		)
	);
	update_post_meta( $submission_id, '_nab_file', $name );
	update_post_meta( $submission_id, '_nab_mime', $check['type'] );
	update_post_meta( $submission_id, '_nab_status', 'pending' );
	nab_set_step_status( $user_id, $step_id, 'pending_review' );
	as_enqueue_async_action( 'nab_validate_submission', array( $submission_id ), 'nab-steps' );

	wp_safe_redirect( add_query_arg( 'nab_step_msg', 'uploaded', $back ) . '#step-' . $step_id );
	exit;
}
add_action( 'admin_post_nab_step_upload', 'nab_handle_step_upload' );

/**
 * Apply a final decision to a submission (AI or human).
 *
 * @param int    $submission_id Submission.
 * @param string $decision      approved|rejected|human_review.
 * @param string $feedback      Student-facing text.
 * @param string $actor         'ai' or 'admin'.
 */
function nab_decide_submission( $submission_id, $decision, $feedback, $actor = 'ai' ) {
	$submission = get_post( $submission_id );
	if ( ! $submission ) {
		return;
	}
	$user_id = (int) $submission->post_author;
	$step_id = (int) $submission->post_parent;
	update_post_meta( $submission_id, '_nab_status', $decision );
	if ( $feedback ) {
		update_post_meta( $submission_id, 'admin' === $actor ? '_nab_review_note' : '_nab_ml_feedback', $feedback );
	}
	if ( 'admin' === $actor ) {
		update_post_meta( $submission_id, '_nab_reviewed_by', get_current_user_id() );
	}

	if ( 'approved' === $decision ) {
		nab_set_step_status( $user_id, $step_id, 'admin' === $actor ? 'override_pass' : 'complete' );
		if ( function_exists( 'nab_notify' ) ) {
			/* translators: %s: step. */
			nab_notify( $user_id, 'step_approved', sprintf( __( 'Step approved: %s', 'nab-core' ), get_the_title( $step_id ) ), '', home_url( '/setup/' ) );
		}
		/* translators: %s: step title. */
		nab_step_email( $user_id, sprintf( __( 'Step approved: %s', 'nab-core' ), get_the_title( $step_id ) ), __( 'Nice work, your screenshot checks out and the next step is unlocked.', 'nab-core' ) );
	} elseif ( 'rejected' === $decision ) {
		nab_set_step_status( $user_id, $step_id, 'admin' === $actor ? 'override_fail' : 'rejected' );
		if ( function_exists( 'nab_notify' ) ) {
			/* translators: %s: step. */
			nab_notify( $user_id, 'step_rejected', sprintf( __( 'Step needs another try: %s', 'nab-core' ), get_the_title( $step_id ) ), $feedback, home_url( '/setup/#step-' . $step_id ) );
		}
		/* translators: %s: step title. */
		nab_step_email( $user_id, sprintf( __( 'Step needs another try: %s', 'nab-core' ), get_the_title( $step_id ) ), $feedback );
	}
	// human_review: the step stays "pending_review" until an admin decides.
	// Alert admins once a day when the review backlog reaches 10 (not on every screenshot).
	if ( 'human_review' === $decision && function_exists( 'nab_send_email' ) && count( nab_submissions_needing_review() ) >= 10 && ! get_transient( 'nab_backlog_alerted' ) ) {
		set_transient( 'nab_backlog_alerted', 1, DAY_IN_SECONDS );
		nab_send_email(
			get_option( 'admin_email' ),
			/* translators: %d: count. */ sprintf( __( '%d setup screenshots are waiting for review', 'nab-core' ), count( nab_submissions_needing_review() ) ),
			sprintf( '<p><a href="%s">%s</a></p>', esc_url( admin_url( 'edit.php?post_type=nab_step&page=nab-step-reviews' ) ), esc_html__( 'Open the review queue', 'nab-core' ) )
		);
	}
}

/**
 * Email a student about a step.
 *
 * @param int    $user_id User.
 * @param string $subject Subject.
 * @param string $text    Plain text body.
 */
function nab_step_email( $user_id, $subject, $text ) {
	$user = get_userdata( $user_id );
	if ( $user && function_exists( 'nab_send_email' ) ) {
		nab_send_email(
			$user->user_email,
			$subject,
			wpautop( esc_html( $text ) ) . sprintf( '<p><a href="%s">%s</a></p>', esc_url( home_url( '/setup/' ) ), esc_html__( 'Go to your setup steps', 'nab-core' ) )
		);
	}
}

/* ------------------------------------------------------------------------
 * Student page: [nab/setup-steps] block, used on /setup/.
 * --------------------------------------------------------------------- */

/**
 * Status labels for students.
 *
 * @return array<string, string>
 */
function nab_step_status_labels() {
	return array(
		'locked'         => __( 'Locked', 'nab-core' ),
		'in_progress'    => __( 'To do', 'nab-core' ),
		'pending_review' => __( 'Checking…', 'nab-core' ),
		'complete'       => __( 'Done', 'nab-core' ),
		'override_pass'  => __( 'Done', 'nab-core' ),
		'rejected'       => __( 'Try again', 'nab-core' ),
		'override_fail'  => __( 'Try again', 'nab-core' ),
	);
}

/**
 * Render the setup steps for the current student.
 *
 * @return string HTML.
 */
function nab_render_setup_steps() {
	if ( ! is_user_logged_in() ) {
		return '<div class="nab-card" style="padding:2rem"><p>' . esc_html__( 'Sign in to see your setup steps.', 'nab-core' ) . '</p><a class="nab-btn" href="' . esc_url( wp_login_url( home_url( '/setup/' ) ) ) . '">' . esc_html__( 'Sign in', 'nab-core' ) . '</a></div>';
	}
	$user_id = get_current_user_id();
	if ( ! nab_user_can_do_steps( $user_id ) ) {
		return '<div class="nab-card" style="padding:2rem"><p>' . esc_html__( 'Setup steps unlock once you’re enrolled in a course.', 'nab-core' ) . '</p><a class="nab-btn" href="' . esc_url( get_post_type_archive_link( 'courses' ) ) . '">' . esc_html__( 'Browse courses', 'nab-core' ) . '</a></div>';
	}
	$steps    = nab_get_steps();
	$progress = nab_step_progress( $user_id );
	$done     = count( array_filter( $progress, static fn( $p ) => nab_step_status_is_done( $p['status'] ) ) );
	$labels   = nab_step_status_labels();
	$checking = false;

	ob_start();
	$msg = isset( $_GET['nab_step_msg'] ) ? sanitize_key( wp_unslash( $_GET['nab_step_msg'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification -- display-only flag.
	$msgs = array(
		'uploaded' => array( 'success', __( 'Screenshot received. Our AI is checking it now; this usually takes under a minute.', 'nab-core' ) ),
		'type'     => array( 'error', __( 'Upload a PNG, JPG, WebP or GIF screenshot.', 'nab-core' ) ),
		'size'     => array( 'error', __( 'That image is larger than 10 MB.', 'nab-core' ) ),
		'locked'   => array( 'error', __( 'That step isn’t open yet. Finish the steps before it first.', 'nab-core' ) ),
		'limit'    => array( 'error', __( 'You’ve uploaded 10 screenshots for this step today. Ask the AI helper or try again tomorrow.', 'nab-core' ) ),
		'error'    => array( 'error', __( 'The upload failed. Please try again.', 'nab-core' ) ),
	);
	if ( isset( $msgs[ $msg ] ) ) {
		printf( '<p class="nab-notice nab-notice--%s">%s</p>', esc_attr( $msgs[ $msg ][0] ), esc_html( $msgs[ $msg ][1] ) );
	}
	?>
	<div class="nab-steps">
		<div class="nab-steps__progress" role="progressbar" aria-label="<?php esc_attr_e( 'Setup progress', 'nab-core' ); ?>" aria-valuemin="0" aria-valuemax="<?php echo count( $steps ); ?>" aria-valuenow="<?php echo (int) $done; ?>">
			<p><strong><?php echo esc_html( sprintf( /* translators: 1: done, 2: total. */ __( '%1$d of %2$d steps complete', 'nab-core' ), $done, count( $steps ) ) ); ?></strong></p>
			<span class="nab-steps__bar"><span style="width:<?php echo $steps ? (int) round( 100 * $done / count( $steps ) ) : 0; ?>%"></span></span>
		</div>
		<?php echo nab_render_user_badges( $user_id ); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside. ?>
		<?php echo $steps && count( $steps ) === $done ? nab_render_setup_complete( $user_id ) : ''; // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside. ?>
		<?php foreach ( $steps as $i => $step ) : ?>
			<?php
			$p          = $progress[ $step->ID ];
			$status     = $p['status'];
			$submission = nab_latest_submission( $user_id, $step->ID );
			$sub_status = $submission ? get_post_meta( $submission->ID, '_nab_status', true ) : '';
			$checking   = $checking || in_array( $sub_status, array( 'pending', 'ml_processing' ), true );
			$open       = in_array( $status, array( 'in_progress', 'rejected', 'override_fail', 'pending_review' ), true );
			$checklist  = array_filter( array_map( 'trim', explode( "\n", (string) get_post_meta( $step->ID, '_nab_checklist', true ) ) ) );
			$why        = (string) get_post_meta( $step->ID, '_nab_why', true );
			$video      = (string) get_post_meta( $step->ID, '_nab_video_url', true );
			$minutes    = (int) get_post_meta( $step->ID, '_nab_minutes', true );
			?>
			<details id="step-<?php echo (int) $step->ID; ?>" class="nab-card nab-step nab-step--<?php echo esc_attr( $status ); ?>"<?php echo $open ? ' open' : ''; ?>>
				<summary>
					<span class="nab-step__num"><?php echo (int) $i + 1; ?></span>
					<span class="nab-step__title"><?php echo esc_html( get_the_title( $step ) ); ?><?php echo $minutes ? ' <small>~' . (int) $minutes . ' min</small>' : ''; ?></span>
					<span class="nab-step__status"><?php echo esc_html( $labels[ $status ] ?? $status ); ?></span>
				</summary>
				<?php if ( 'locked' === $status ) : ?>
					<p class="nab-course-card__meta"><?php esc_html_e( 'Finish the previous step to unlock this one.', 'nab-core' ); ?></p>
				<?php else : ?>
					<?php if ( $why ) : ?>
						<p class="nab-step__why"><strong><?php esc_html_e( 'Why it matters:', 'nab-core' ); ?></strong> <?php echo esc_html( $why ); ?></p>
					<?php endif; ?>
					<?php if ( $video ) : ?>
						<div class="nab-step__video"><?php echo wp_oembed_get( $video ) ? wp_oembed_get( $video ) : '<a href="' . esc_url( $video ) . '">' . esc_html__( 'Watch the walkthrough', 'nab-core' ) . '</a>'; // phpcs:ignore WordPress.Security.EscapeOutput -- core oEmbed HTML. ?></div>
					<?php endif; ?>
					<div class="nab-prose nab-step__body"><?php echo apply_filters( 'the_content', $step->post_content ); // phpcs:ignore WordPress.Security.EscapeOutput -- post content. ?></div>
					<?php if ( $checklist ) : ?>
						<ul class="nab-buy-box__list" style="border:0;padding:0">
							<?php foreach ( $checklist as $item ) : ?>
								<li><?php echo esc_html( $item ); ?></li>
							<?php endforeach; ?>
						</ul>
					<?php endif; ?>

					<?php if ( $submission && in_array( $sub_status, array( 'rejected', 'approved' ), true ) ) : ?>
						<?php $fb = (string) ( get_post_meta( $submission->ID, '_nab_review_note', true ) ? get_post_meta( $submission->ID, '_nab_review_note', true ) : get_post_meta( $submission->ID, '_nab_ml_feedback', true ) ); ?>
						<?php if ( $fb ) : ?>
							<p class="nab-notice nab-notice--<?php echo 'approved' === $sub_status ? 'success' : 'error'; ?>"><?php echo esc_html( $fb ); ?></p>
						<?php endif; ?>
					<?php endif; ?>

					<?php if ( 'pending_review' === $status ) : ?>
						<p class="nab-notice"><?php echo 'human_review' === $sub_status ? esc_html__( 'Your screenshot is with our team for a quick manual check. We’ll email you when it’s reviewed.', 'nab-core' ) : esc_html__( 'Checking your screenshot…', 'nab-core' ); ?></p>
					<?php elseif ( ! nab_step_status_is_done( $status ) ) : ?>
						<form class="nab-receipt__form" method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data">
							<input type="hidden" name="action" value="nab_step_upload" />
							<input type="hidden" name="step_id" value="<?php echo (int) $step->ID; ?>" />
							<?php wp_nonce_field( 'nab_step_upload_' . $step->ID ); ?>
							<label for="nab-shot-<?php echo (int) $step->ID; ?>"><strong><?php esc_html_e( 'Upload a screenshot that proves this step is done', 'nab-core' ); ?></strong></label>
							<?php $criteria = (string) get_post_meta( $step->ID, '_nab_screenshot_criteria', true ); ?>
							<?php if ( $criteria ) : ?>
								<span class="nab-course-card__meta"><?php echo esc_html( $criteria ); ?></span>
							<?php endif; ?>
							<input id="nab-shot-<?php echo (int) $step->ID; ?>" type="file" name="screenshot" accept="image/png,image/jpeg,image/webp,image/gif" required />
							<button class="nab-btn" type="submit"><?php esc_html_e( 'Submit screenshot', 'nab-core' ); ?></button>
						</form>
					<?php endif; ?>
					<?php if ( ! nab_step_status_is_done( $status ) && function_exists( 'nab_render_troubleshooter' ) ) : ?>
						<?php echo nab_render_troubleshooter( $step->ID ); // phpcs:ignore WordPress.Security.EscapeOutput -- escaped inside. ?>
					<?php endif; ?>
				<?php endif; ?>
			</details>
		<?php endforeach; ?>
	</div>
	<?php if ( $checking ) : ?>
		<script>setTimeout(function(){ location.reload(); }, 6000);</script>
	<?php endif; ?>
	<?php
	return (string) ob_get_clean();
}

add_action(
	'init',
	static function () {
		register_block_type(
			'nab/setup-steps',
			array(
				'api_version'     => 3,
				'title'           => __( 'Setup steps (student)', 'nab-core' ),
				'category'        => 'widgets',
				'render_callback' => 'nab_render_setup_steps',
				'editor_script'   => 'nab-blocks-editor',
			)
		);
	},
	20
);

/* ------------------------------------------------------------------------
 * Admin: review queue + screenshot preview.
 * --------------------------------------------------------------------- */

add_action(
	'admin_menu',
	static function () {
		$count = count( nab_submissions_needing_review() );
		add_submenu_page(
			'edit.php?post_type=nab_step',
			__( 'Review queue', 'nab-core' ),
			__( 'Review queue', 'nab-core' ) . ( $count ? ' <span class="awaiting-mod">' . (int) $count . '</span>' : '' ),
			'nab_review_steps',
			'nab-step-reviews',
			'nab_render_step_review_page'
		);
	}
);

/**
 * Submissions waiting for a human.
 *
 * @return WP_Post[]
 */
function nab_submissions_needing_review() {
	return get_posts(
		array(
			'post_type'      => 'nab_submission',
			'post_status'    => 'private',
			'posts_per_page' => 100,
			'orderby'        => 'ID',
			'order'          => 'ASC',
			'meta_key'       => '_nab_status', // phpcs:ignore WordPress.DB.SlowDBQuery -- admin screen.
			'meta_value'     => 'human_review', // phpcs:ignore WordPress.DB.SlowDBQuery
		)
	);
}

/**
 * Review queue page.
 */
function nab_render_step_review_page() {
	echo '<div class="wrap"><h1>' . esc_html__( 'Setup step review queue', 'nab-core' ) . '</h1>';
	if ( ! nab_anthropic_api_key() ) {
		echo '<div class="notice notice-warning"><p>' . esc_html__( 'No Anthropic API key is configured, so every screenshot comes here for manual review. Define NAB_ANTHROPIC_API_KEY in wp-config.php (or set ANTHROPIC_API_KEY) to turn on AI checks.', 'nab-core' ) . '</p></div>';
	}
	$items = nab_submissions_needing_review();
	if ( ! $items ) {
		echo '<p>' . esc_html__( 'Nothing waiting for review.', 'nab-core' ) . '</p></div>';
		return;
	}
	foreach ( $items as $s ) {
		$img = wp_nonce_url( admin_url( 'admin-post.php?action=nab_step_shot&submission=' . $s->ID ), 'nab_step_shot_' . $s->ID );
		echo '<div class="card" style="max-width:none;margin-bottom:1rem"><h2 style="margin-top:0">' . esc_html( get_the_title( $s->post_parent ) ) . ' — ' . esc_html( get_the_author_meta( 'display_name', $s->post_author ) ) . ' <small>(' . esc_html( get_the_author_meta( 'user_email', $s->post_author ) ) . ')</small></h2>';
		echo '<p><strong>' . esc_html__( 'Criteria:', 'nab-core' ) . '</strong> ' . esc_html( get_post_meta( $s->post_parent, '_nab_screenshot_criteria', true ) ) . '</p>';
		echo '<p><a href="' . esc_url( $img ) . '" target="_blank" rel="noopener"><img src="' . esc_url( $img ) . '" alt="" style="max-width:640px;max-height:420px;border:1px solid #ccd0d4" /></a></p>';
		$score = get_post_meta( $s->ID, '_nab_ml_score', true );
		if ( '' !== $score ) {
			echo '<p><strong>' . esc_html__( 'AI confidence:', 'nab-core' ) . '</strong> ' . esc_html( $score ) . '/100<br><strong>' . esc_html__( 'AI notes:', 'nab-core' ) . '</strong> ' . esc_html( get_post_meta( $s->ID, '_nab_ml_reasoning', true ) ) . '</p>';
		}
		echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="nab_step_review" /><input type="hidden" name="submission" value="' . (int) $s->ID . '" />';
		wp_nonce_field( 'nab_step_review_' . $s->ID );
		echo '<p><label>' . esc_html__( 'Note to the student (required when rejecting)', 'nab-core' ) . '<br><textarea name="note" rows="2" style="width:100%;max-width:640px"></textarea></label></p>';
		echo '<p><button class="button button-primary" name="decision" value="approved">' . esc_html__( 'Approve', 'nab-core' ) . '</button> <button class="button" name="decision" value="rejected">' . esc_html__( 'Reject', 'nab-core' ) . '</button></p></form></div>';
	}
	echo '</div>';
}

add_action(
	'admin_post_nab_step_review',
	static function () {
		$id = isset( $_POST['submission'] ) ? absint( $_POST['submission'] ) : 0;
		check_admin_referer( 'nab_step_review_' . $id );
		if ( ! current_user_can( 'nab_review_steps' ) ) {
			wp_die( '', 403 );
		}
		$decision = isset( $_POST['decision'] ) ? sanitize_key( wp_unslash( $_POST['decision'] ) ) : '';
		$note     = isset( $_POST['note'] ) ? sanitize_textarea_field( wp_unslash( $_POST['note'] ) ) : '';
		if ( in_array( $decision, array( 'approved', 'rejected' ), true ) && 'human_review' === get_post_meta( $id, '_nab_status', true ) ) {
			if ( 'rejected' === $decision && ! $note ) {
				$note = __( 'The screenshot didn’t show the required result. Check the criteria and try again.', 'nab-core' );
			}
			nab_decide_submission( $id, $decision, $note, 'admin' );
		}
		wp_safe_redirect( admin_url( 'edit.php?post_type=nab_step&page=nab-step-reviews' ) );
		exit;
	}
);

add_action(
	'admin_post_nab_step_shot',
	static function () {
		$id = isset( $_GET['submission'] ) ? absint( $_GET['submission'] ) : 0;
		check_admin_referer( 'nab_step_shot_' . $id );
		if ( ! current_user_can( 'nab_review_steps' ) ) {
			wp_die( '', 403 );
		}
		$file = nab_step_uploads_dir() . basename( (string) get_post_meta( $id, '_nab_file', true ) );
		if ( ! is_file( $file ) ) {
			wp_die( '', 404 );
		}
		nocache_headers();
		header( 'Content-Type: ' . get_post_meta( $id, '_nab_mime', true ) );
		header( 'X-Content-Type-Options: nosniff' );
		readfile( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions
		exit;
	}
);

/* ------------------------------------------------------------------------
 * Badges + certificate.
 * --------------------------------------------------------------------- */

/**
 * "You're set up" card with the next thing to do: the first open lesson in
 * the student's course, then the next live session.
 *
 * @param int $user_id User.
 * @return string HTML.
 */
function nab_render_setup_complete( $user_id ) {
	$next = '';
	$up   = '';
	foreach ( nab_active_course_ids( $user_id ) as $cid ) {
		$lesson = nab_next_open_lesson( $cid, $user_id );
		if ( $lesson ) {
			$next = '<a class="nab-btn" href="' . esc_url( get_permalink( $lesson ) ) . '" aria-describedby="nab-next-lesson">' . esc_html__( 'Start the next lesson', 'nab-core' ) . '</a>';
			$up   = '<p id="nab-next-lesson" class="nab-setup-done__next">' . esc_html( sprintf( /* translators: %s: lesson. */ __( 'Next up: %s', 'nab-core' ), get_the_title( $lesson ) ) ) . '</p>';
			break;
		}
	}
	$next = $next ? $next : '<a class="nab-btn" href="' . esc_url( home_url( '/dashboard/enrolled-courses/' ) ) . '">' . esc_html__( 'Go to my courses', 'nab-core' ) . '</a>';
	return '<div class="nab-card nab-setup-done"><h2>' . esc_html__( 'You’re all set up', 'nab-core' ) . '</h2><p>' . esc_html__( 'Your tools are installed and checked. Everything from here happens in the course.', 'nab-core' ) . '</p>' . $up . '<p class="nab-setup-done__actions">' . $next . ' <a class="nab-btn nab-btn--outline" href="' . esc_url( home_url( '/live-sessions/' ) ) . '">' . esc_html__( 'See live sessions', 'nab-core' ) . '</a></p></div>';
}

/**
 * Badge definitions: slug => [name, description, steps needed (0 = all)].
 * Filterable so new badges don't need code changes elsewhere.
 *
 * @return array<string, array{0:string,1:string,2:int}>
 */
function nab_badge_definitions() {
	return apply_filters(
		'nab_badges',
		array(
			'first-step'     => array( __( 'First Step', 'nab-core' ), __( 'Completed your first setup step', 'nab-core' ), 1 ),
			'halfway'        => array( __( 'Halfway There', 'nab-core' ), __( 'Completed half of the setup steps', 'nab-core' ), -50 ),
			'setup-complete' => array( __( 'Setup Complete', 'nab-core' ), __( 'Completed every setup step', 'nab-core' ), 0 ),
		)
	);
}

/**
 * Steps needed for a badge. Negative numbers are percentages; 0 means all.
 *
 * @param int $rule  Rule.
 * @param int $total Total steps.
 * @return int
 */
function nab_badge_threshold( $rule, $total ) {
	if ( 0 === $rule ) {
		return $total;
	}
	return $rule < 0 ? (int) ceil( $total * abs( $rule ) / 100 ) : $rule;
}

/**
 * Award any badges the user now qualifies for.
 *
 * @param int $user_id User.
 * @return string[] Newly awarded slugs.
 */
function nab_award_badges( $user_id ) {
	$total  = count( nab_get_steps() );
	$done   = count( array_filter( nab_step_progress( $user_id ), static fn( $p ) => nab_step_status_is_done( $p['status'] ) ) );
	$earned = (array) get_user_meta( $user_id, '_nab_badges', true );
	$new    = array();
	foreach ( nab_badge_definitions() as $slug => [ $name, , $rule ] ) {
		if ( isset( $earned[ $slug ] ) || ! $total ) {
			continue;
		}
		if ( $done >= nab_badge_threshold( (int) $rule, $total ) ) {
			$earned[ $slug ] = time();
			$new[]           = $slug;
			if ( function_exists( 'nab_notify' ) ) {
				/* translators: %s: badge. */
				nab_notify( $user_id, 'badge', sprintf( __( 'Badge earned: %s', 'nab-core' ), $name ), '', home_url( '/setup/' ) );
			}
		}
	}
	if ( $new ) {
		update_user_meta( $user_id, '_nab_badges', $earned );
	}
	return $new;
}

/**
 * Earned badges strip.
 *
 * @param int $user_id User.
 * @return string HTML.
 */
function nab_render_user_badges( $user_id ) {
	$earned = (array) get_user_meta( $user_id, '_nab_badges', true );
	$html   = '<ul class="nab-badges" aria-label="' . esc_attr__( 'Badges', 'nab-core' ) . '">';
	foreach ( nab_badge_definitions() as $slug => [ $name, $desc ] ) {
		$has   = isset( $earned[ $slug ] );
		$html .= sprintf( '<li class="nab-badges__item%s" title="%s"><span aria-hidden="true">%s</span>%s<span class="screen-reader-text">%s</span></li>', $has ? ' is-earned' : '', esc_attr( $desc ), $has ? '★' : '☆', esc_html( $name ), $has ? esc_html__( '(earned)', 'nab-core' ) : esc_html__( '(not yet earned)', 'nab-core' ) );
	}
	$cert = get_user_meta( $user_id, '_nab_certificate', true );
	if ( $cert ) {
		$html .= '<li class="nab-badges__item is-earned"><a href="' . esc_url( home_url( '/verify/' . $cert['token'] . '/' ) ) . '">' . esc_html__( 'View certificate', 'nab-core' ) . '</a></li>';
	}
	return $html . '</ul>';
}

/**
 * Issue a certificate once every step is done.
 *
 * @param int $user_id User.
 */
function nab_maybe_issue_certificate( $user_id ) {
	if ( get_user_meta( $user_id, '_nab_certificate', true ) ) {
		return;
	}
	$progress = nab_step_progress( $user_id );
	if ( ! $progress || count( array_filter( $progress, static fn( $p ) => nab_step_status_is_done( $p['status'] ) ) ) < count( $progress ) ) {
		return;
	}
	$number = (int) get_option( 'nab_certificate_seq', 1000 ) + 1;
	update_option( 'nab_certificate_seq', $number, false );
	$token = strtolower( wp_generate_password( 20, false ) );
	update_user_meta(
		$user_id,
		'_nab_certificate',
		array(
			'number' => 'NAB-' . $number,
			'token'  => $token,
			'issued' => time(),
		)
	);
	add_user_meta( $user_id, '_nab_certificate_token', $token ); // Lookup index; a user can hold several certificates.
}

/**
 * Public certificate verification at /verify/<token>/.
 */
add_action(
	'init',
	static function () {
		// /verify-certificate/<token> is the old site's URL; keep it working.
		add_rewrite_rule( '^(?:verify|verify-certificate)/([A-Za-z0-9-]{8,64})/?$', 'index.php?nab_verify=$matches[1]', 'top' );
	}
);
add_filter(
	'query_vars',
	static function ( $vars ) {
		$vars[] = 'nab_verify';
		return $vars;
	}
);
add_action(
	'template_redirect',
	static function () {
		$token = get_query_var( 'nab_verify' );
		if ( ! $token ) {
			return;
		}
		$users = get_users(
			array(
				'meta_key'   => '_nab_certificate_token', // phpcs:ignore WordPress.DB.SlowDBQuery -- rare public lookup.
				'meta_value' => (string) $token, // phpcs:ignore WordPress.DB.SlowDBQuery
				'number'     => 1,
			)
		);
		$match = null;
		if ( $users ) {
			$setup = get_user_meta( $users[0]->ID, '_nab_certificate', true );
			if ( is_array( $setup ) && hash_equals( (string) $setup['token'], (string) $token ) ) {
				$match = array( $users[0], $setup + array( 'what' => __( 'completed every nextaibuilder AI tool setup step: a working, verified Claude-powered development environment.', 'nab-core' ) ) );
			}
			foreach ( (array) get_user_meta( $users[0]->ID, '_nab_course_certificates', true ) as $cert ) {
				if ( is_array( $cert ) && hash_equals( (string) $cert['token'], (string) $token ) ) {
					/* translators: %s: course title. */
					$match = array( $users[0], $cert + array( 'what' => sprintf( __( 'successfully completed the course “%s”.', 'nab-core' ), $cert['course'] ) ) );
				}
			}
		}
		status_header( $match ? 200 : 404 );
		$html = $match
			? sprintf(
				'<section class="nab-course-wrap" style="padding:4rem 0"><div class="nab-card nab-cert"><p class="nab-eyebrow">%s</p><h1>%s</h1><p>%s</p><p class="nab-course-card__meta">%s · %s</p><button class="nab-btn nab-btn--outline" onclick="window.print()">%s</button></div></section>',
				esc_html__( 'Certificate of completion', 'nab-core' ),
				esc_html( $match[0]->display_name ),
				esc_html( $match[1]['what'] ),
				/* translators: %s: certificate number. */
				esc_html( sprintf( __( 'Certificate %s', 'nab-core' ), $match[1]['number'] ) ),
				/* translators: %s: date. */
				esc_html( sprintf( __( 'Issued %s', 'nab-core' ), wp_date( 'F j, Y', $match[1]['issued'] ) ) ),
				esc_html__( 'Print or save as PDF', 'nab-core' )
			)
			: '<section class="nab-course-wrap" style="padding:4rem 0"><div class="nab-card nab-cert"><h1>' . esc_html__( 'Certificate not found', 'nab-core' ) . '</h1><p>' . esc_html__( 'This verification link isn’t valid.', 'nab-core' ) . '</p></div></section>';
		add_filter( 'pre_get_document_title', static fn() => $match ? __( 'Certificate verification', 'nab-core' ) . ' – nextaibuilder' : __( 'Certificate not found', 'nab-core' ) );
		add_action( 'wp_head', static fn() => print( '<meta name="robots" content="noindex" />' . "\n" ), 1 );
		if ( function_exists( 'nextaibuilder_render_shell' ) ) {
			nextaibuilder_render_shell( $html );
		} else {
			wp_die( wp_kses_post( $html ), '', array( 'response' => $match ? 200 : 404 ) );
		}
		exit;
	}
);

/**
 * "Setup steps" link in the Tutor student dashboard menu.
 *
 * @param array $items Nav items.
 * @return array
 */
function nab_tutor_dashboard_setup_link( $items ) {
	$items['nab-setup'] = array(
		'title' => __( 'Setup steps', 'nab-core' ),
		'icon'  => 'badge-check',
		'url'   => home_url( '/setup/' ),
	);
	return $items;
}
add_filter( 'tutor_dashboard/nav_items', 'nab_tutor_dashboard_setup_link' );
