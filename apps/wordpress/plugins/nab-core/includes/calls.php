<?php
/**
 * Book a call with an instructor (the old "agents" feature):
 * - staff opt in on their profile (takes calls, available, scheduling link);
 * - students see /book-a-call/ with ratings and reviews, book one call at a time
 *   (the scheduling link is saved with the booking), then go to the scheduler;
 * - staff mark calls completed under Users → My calls, which asks the student
 *   for a 1–5 star review.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	static function () {
		register_post_type(
			'nab_call',
			array(
				'label'    => __( 'Calls', 'nab-core' ),
				'public'   => false,
				'show_ui'  => false,
				'supports' => array( 'title', 'author' ),
			)
		);
		add_rewrite_rule( '^book-a-call/?$', 'index.php?nab_calls=1', 'top' );
	}
);
add_filter(
	'query_vars',
	static function ( $vars ) {
		$vars[] = 'nab_calls';
		return $vars;
	}
);

/* ---------- Staff profile settings ---------- */

$nab_call_fields = static function ( $user ) {
	if ( ! user_can( $user, 'edit_posts' ) || ! current_user_can( 'edit_user', $user->ID ) ) {
		return;
	}
	wp_nonce_field( 'nab_call_profile', 'nab_call_profile_nonce' );
	echo '<h2>' . esc_html__( 'Student calls', 'nab-core' ) . '</h2><table class="form-table"><tr><th>' . esc_html__( 'Takes student calls', 'nab-core' ) . '</th><td><label><input type="checkbox" name="nab_takes_calls" value="1"' . checked( get_user_meta( $user->ID, '_nab_takes_calls', true ), '1', false ) . ' /> ' . esc_html__( 'Show me on the Book a call page', 'nab-core' ) . '</label><br><label><input type="checkbox" name="nab_available" value="1"' . checked( get_user_meta( $user->ID, '_nab_available', true ), '1', false ) . ' /> ' . esc_html__( 'Currently accepting bookings', 'nab-core' ) . '</label></td></tr>';
	echo '<tr><th><label for="nab_scheduling_url">' . esc_html__( 'Scheduling link', 'nab-core' ) . '</label></th><td><input class="regular-text" type="url" id="nab_scheduling_url" name="nab_scheduling_url" value="' . esc_attr( get_user_meta( $user->ID, '_nab_scheduling_url', true ) ) . '" placeholder="https://cal.com/…" /></td></tr>';
	echo '<tr><th><label for="nab_call_blurb">' . esc_html__( 'What you can help with', 'nab-core' ) . '</label></th><td><textarea class="large-text" rows="2" id="nab_call_blurb" name="nab_call_blurb">' . esc_textarea( get_user_meta( $user->ID, '_nab_call_blurb', true ) ) . '</textarea></td></tr></table>';
};
add_action( 'show_user_profile', $nab_call_fields );
add_action( 'edit_user_profile', $nab_call_fields );

$nab_call_save = static function ( $user_id ) {
	if ( ! isset( $_POST['nab_call_profile_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['nab_call_profile_nonce'] ), 'nab_call_profile' ) || ! current_user_can( 'edit_user', $user_id ) ) {
		return;
	}
	update_user_meta( $user_id, '_nab_takes_calls', empty( $_POST['nab_takes_calls'] ) ? '' : '1' );
	update_user_meta( $user_id, '_nab_available', empty( $_POST['nab_available'] ) ? '' : '1' );
	update_user_meta( $user_id, '_nab_scheduling_url', esc_url_raw( wp_unslash( $_POST['nab_scheduling_url'] ?? '' ) ) );
	update_user_meta( $user_id, '_nab_call_blurb', sanitize_textarea_field( wp_unslash( $_POST['nab_call_blurb'] ?? '' ) ) );
};
add_action( 'personal_options_update', $nab_call_save );
add_action( 'edit_user_profile_update', $nab_call_save );

/* ---------- Data helpers ---------- */

/**
 * Calls matching a meta filter.
 *
 * @param array $meta  key => value.
 * @param int   $limit Max.
 * @return WP_Post[]
 */
function nab_calls( $meta, $limit = 100 ) {
	$query = array();
	foreach ( $meta as $k => $v ) {
		$query[] = array( 'key' => $k, 'value' => $v );
	}
	return get_posts( array( 'post_type' => 'nab_call', 'post_status' => 'private', 'posts_per_page' => $limit, 'meta_query' => $query ) ); // phpcs:ignore WordPress.DB.SlowDBQuery -- small set.
}

/**
 * Average rating + reviews for an instructor.
 *
 * @param int $staff_id Staff user.
 * @return array{avg:float,count:int,reviews:array}
 */
function nab_staff_rating( $staff_id ) {
	$reviews = array();
	foreach ( nab_calls( array( '_nab_staff' => $staff_id, '_nab_status' => 'completed' ), 200 ) as $call ) {
		$r = (int) get_post_meta( $call->ID, '_nab_rating', true );
		if ( $r ) {
			$reviews[] = array( 'rating' => $r, 'comment' => (string) get_post_meta( $call->ID, '_nab_review', true ), 'name' => get_the_author_meta( 'first_name', $call->post_author ), 'time' => strtotime( $call->post_date_gmt ) );
		}
	}
	usort( $reviews, static fn( $a, $b ) => $b['time'] <=> $a['time'] );
	return array(
		'avg'     => $reviews ? array_sum( array_column( $reviews, 'rating' ) ) / count( $reviews ) : 0.0,
		'count'   => count( $reviews ),
		'reviews' => array_slice( $reviews, 0, 20 ),
	);
}

/* ---------- Student actions ---------- */

add_action(
	'admin_post_nab_call',
	static function () {
		check_admin_referer( 'nab_call' );
		$user_id = get_current_user_id();
		$op      = sanitize_key( wp_unslash( $_POST['op'] ?? '' ) );
		$back    = home_url( '/book-a-call/' );
		if ( 'book' === $op && nab_user_can_do_steps( $user_id ) ) {
			$staff = absint( $_POST['staff'] ?? 0 );
			$url   = (string) get_user_meta( $staff, '_nab_scheduling_url', true );
			if ( nab_calls( array( '_nab_student' => $user_id, '_nab_status' => 'active' ), 1 ) || ! $url || ! get_user_meta( $staff, '_nab_available', true ) ) {
				wp_safe_redirect( add_query_arg( 'nab_call', 'blocked', $back ) );
				exit;
			}
			$id = wp_insert_post( array( 'post_type' => 'nab_call', 'post_status' => 'private', 'post_author' => $user_id, 'post_title' => sprintf( '%s ↔ %s', wp_get_current_user()->display_name, get_the_author_meta( 'display_name', $staff ) ) ) );
			update_post_meta( $id, '_nab_student', $user_id );
			update_post_meta( $id, '_nab_staff', $staff );
			update_post_meta( $id, '_nab_status', 'active' );
			update_post_meta( $id, '_nab_url', $url ); // Snapshot at booking time.
			wp_redirect( $url ); // phpcs:ignore WordPress.Security.SafeRedirect -- staff-configured scheduler.
			exit;
		}
		if ( 'review' === $op ) {
			$call = get_post( absint( $_POST['call'] ?? 0 ) );
			$rate = max( 1, min( 5, absint( $_POST['rating'] ?? 0 ) ) );
			if ( $call && 'nab_call' === $call->post_type && (int) $call->post_author === $user_id && 'completed' === get_post_meta( $call->ID, '_nab_status', true ) && ! get_post_meta( $call->ID, '_nab_rating', true ) ) {
				update_post_meta( $call->ID, '_nab_rating', $rate );
				update_post_meta( $call->ID, '_nab_review', sanitize_textarea_field( wp_unslash( $_POST['comment'] ?? '' ) ) );
			}
			wp_safe_redirect( add_query_arg( 'nab_call', 'reviewed', $back ) );
			exit;
		}
		if ( 'cancel' === $op ) {
			foreach ( nab_calls( array( '_nab_student' => $user_id, '_nab_status' => 'active' ), 5 ) as $call ) {
				update_post_meta( $call->ID, '_nab_status', 'cancelled' );
			}
		}
		wp_safe_redirect( $back );
		exit;
	}
);

/* ---------- Student page ---------- */

add_action(
	'template_redirect',
	static function () {
		if ( ! get_query_var( 'nab_calls' ) ) {
			return;
		}
		if ( ! is_user_logged_in() ) {
			wp_safe_redirect( nab_signin_url( home_url( '/book-a-call/' ) ) );
			exit;
		}
		$uid   = get_current_user_id();
		$nonce = wp_nonce_field( 'nab_call', '_wpnonce', true, false );
		$post  = static fn( $fields, $inner ) => '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="nab_call" />' . $fields . $nonce . $inner . '</form>';
		$html  = '<section class="nab-wrap" style="padding-block:3rem 5rem;max-width:980px"><h1 style="font-size:var(--wp--preset--font-size--2-xl);font-weight:300;letter-spacing:-0.03em;margin:0 0 .5rem">' . esc_html__( 'Book a call', 'nab-core' ) . '</h1><p class="nab-lede" style="margin-bottom:2rem!important">' . esc_html__( 'Get one-to-one help from an instructor: unblock a setup step, review your project or plan your next build.', 'nab-core' ) . '</p>';

		if ( isset( $_GET['nab_call'] ) && 'blocked' === $_GET['nab_call'] ) { // phpcs:ignore WordPress.Security.NonceVerification
			$html .= '<p class="nab-notice nab-notice--error">' . esc_html__( 'You already have an active booking, or that instructor isn’t taking bookings right now.', 'nab-core' ) . '</p>';
		}
		$active = nab_calls( array( '_nab_student' => $uid, '_nab_status' => 'active' ), 1 );
		if ( $active ) {
			$a     = $active[0];
			$html .= '<div class="nab-card" style="padding:1.5rem;margin-bottom:2rem;display:flex;flex-wrap:wrap;gap:1rem;justify-content:space-between;align-items:center"><div><b>' . esc_html( sprintf( /* translators: %s: name. */ __( 'Your call with %s is booked', 'nab-core' ), get_the_author_meta( 'display_name', (int) get_post_meta( $a->ID, '_nab_staff', true ) ) ) ) . '</b><p style="margin:.25rem 0 0;color:var(--muted)">' . esc_html__( 'Pick or change your time in the scheduler.', 'nab-core' ) . '</p></div><div style="display:flex;gap:.6rem"><a class="nab-btn" href="' . esc_url( get_post_meta( $a->ID, '_nab_url', true ) ) . '" target="_blank" rel="noopener">' . esc_html__( 'Open scheduler', 'nab-core' ) . '</a>' . $post( '<input type="hidden" name="op" value="cancel" />', '<button class="nab-btn nab-btn--outline">' . esc_html__( 'Cancel booking', 'nab-core' ) . '</button>' ) . '</div></div>';
		}
		foreach ( nab_calls( array( '_nab_student' => $uid, '_nab_status' => 'completed' ), 20 ) as $done ) {
			if ( get_post_meta( $done->ID, '_nab_rating', true ) ) {
				continue;
			}
			$stars = '';
			for ( $i = 5; $i >= 1; $i-- ) {
				$stars .= '<input type="radio" id="r' . $done->ID . '-' . $i . '" name="rating" value="' . $i . '" required /><label for="r' . $done->ID . '-' . $i . '" title="' . $i . '">★</label>';
			}
			$html .= '<div class="nab-card" style="padding:1.5rem;margin-bottom:2rem">' . $post( '<input type="hidden" name="op" value="review" /><input type="hidden" name="call" value="' . (int) $done->ID . '" />', '<p style="margin:0 0 .5rem"><b>' . esc_html( sprintf( /* translators: %s: name. */ __( 'How was your call with %s?', 'nab-core' ), get_the_author_meta( 'display_name', (int) get_post_meta( $done->ID, '_nab_staff', true ) ) ) ) . '</b></p><div class="nab-stars-input">' . $stars . '</div><textarea name="comment" rows="2" maxlength="1000" placeholder="' . esc_attr__( 'What helped? (optional)', 'nab-core' ) . '" style="width:100%;margin:.75rem 0;padding:.6rem;border:1px solid #a8c3de;border-radius:6px;font:inherit"></textarea><button class="nab-btn">' . esc_html__( 'Send review', 'nab-core' ) . '</button>' ) . '</div>';
		}

		$staff = get_users( array( 'meta_key' => '_nab_takes_calls', 'meta_value' => '1' ) ); // phpcs:ignore WordPress.DB.SlowDBQuery
		if ( ! $staff && nab_demo_on() && nab_instructor_user() ) {
			$staff = array( nab_instructor_user() ); // DEMO: show the lead instructor as bookable.
		}
		if ( ! $staff ) {
			$html .= '<div class="nab-card" style="padding:2rem"><p style="margin:0">' . esc_html__( 'No instructors are taking calls right now. Check back soon or ask in the cohort channel.', 'nab-core' ) . '</p></div>';
		}
		$html .= '<div class="nab-agents">';
		foreach ( $staff as $s ) {
			$r     = nab_staff_rating( $s->ID );
			$open  = ( get_user_meta( $s->ID, '_nab_available', true ) && get_user_meta( $s->ID, '_nab_scheduling_url', true ) ) || nab_demo_on();
			$avatar = nab_demo_on() ? '<img src="' . esc_url( nab_demo()['instructor']['photo'] ) . '" alt="" width="56" height="56" style="object-fit:cover" />' : '<span class="nab-rv__avatar nab-rv__avatar--initials" style="width:56px;height:56px" aria-hidden="true">' . esc_html( mb_substr( $s->display_name, 0, 1 ) ) . '</span>';
			$html  .= '<article class="nab-agent"><header>' . $avatar . '<div><h2>' . esc_html( $s->display_name ) . '</h2><p>' . esc_html( (string) get_user_meta( $s->ID, '_tutor_profile_job_title', true ) ) . '</p></div></header>';
			$blurb = (string) get_user_meta( $s->ID, '_nab_call_blurb', true );
			$blurb = $blurb ? $blurb : ( nab_demo_on() ? __( '30-minute calls on setup problems, project reviews and planning your next build.', 'nab-core' ) : '' );
			$html .= '<p class="nab-agent__blurb">' . esc_html( $blurb ) . '</p>';
			$html .= '<p class="nab-agent__rating">' . ( $r['count'] ? '<span aria-hidden="true">★</span> ' . esc_html( sprintf( /* translators: 1: avg, 2: count. */ __( '%1$s from %2$d reviews', 'nab-core' ), number_format_i18n( $r['avg'], 1 ), $r['count'] ) ) : esc_html__( 'No reviews yet', 'nab-core' ) ) . '</p>';
			$html .= ( $open && ! $active ) ? $post( '<input type="hidden" name="op" value="book" /><input type="hidden" name="staff" value="' . (int) $s->ID . '" />', '<button class="nab-btn nab-btn--block">' . esc_html__( 'Book a call', 'nab-core' ) . '</button>' ) : '<p class="nab-agent__off">' . esc_html( $active ? __( 'You have an active booking', 'nab-core' ) : __( 'Not taking bookings right now', 'nab-core' ) ) . '</p>';
			foreach ( array_slice( $r['reviews'], 0, 3 ) as $rv ) {
				$html .= $rv['comment'] ? '<blockquote class="nab-agent__review">“' . esc_html( $rv['comment'] ) . '” <cite>— ' . esc_html( $rv['name'] ) . ', ' . str_repeat( '★', (int) $rv['rating'] ) . '</cite></blockquote>' : '';
			}
			$html .= '</article>';
		}
		$html .= '</div></section>';
		add_filter( 'pre_get_document_title', static fn() => __( 'Book a call', 'nab-core' ) . ' – nextaibuilder' );
		nextaibuilder_render_shell( $html );
		exit;
	}
);

/* ---------- Staff: My calls ---------- */

add_action(
	'admin_menu',
	static function () {
		add_users_page( __( 'My calls', 'nab-core' ), __( 'My calls', 'nab-core' ), 'edit_posts', 'nab-my-calls', 'nab_render_my_calls' );
	}
);

/**
 * Staff call list with "mark completed".
 */
function nab_render_my_calls() {
	$tab   = sanitize_key( $_GET['tab'] ?? 'active' ); // phpcs:ignore WordPress.Security.NonceVerification
	$meta  = array( '_nab_staff' => get_current_user_id() ) + ( 'all' === $tab ? array() : array( '_nab_status' => 'completed' === $tab ? 'completed' : 'active' ) );
	$calls = nab_calls( $meta, 200 );
	echo '<div class="wrap"><h1>' . esc_html__( 'My calls', 'nab-core' ) . '</h1><ul class="subsubsub">';
	foreach ( array( 'active' => __( 'Active', 'nab-core' ), 'completed' => __( 'Completed', 'nab-core' ), 'all' => __( 'All', 'nab-core' ) ) as $k => $label ) {
		echo '<li><a href="' . esc_url( admin_url( 'users.php?page=nab-my-calls&tab=' . $k ) ) . '"' . ( $tab === $k ? ' class="current"' : '' ) . '>' . esc_html( $label ) . '</a> |</li> ';
	}
	echo '</ul><table class="widefat striped"><thead><tr><th>' . esc_html__( 'Student', 'nab-core' ) . '</th><th>' . esc_html__( 'Booked', 'nab-core' ) . '</th><th>' . esc_html__( 'Status', 'nab-core' ) . '</th><th>' . esc_html__( 'Review', 'nab-core' ) . '</th><th></th></tr></thead><tbody>';
	if ( ! $calls ) {
		echo '<tr><td colspan="5">' . esc_html__( 'No calls here.', 'nab-core' ) . '</td></tr>';
	}
	foreach ( $calls as $c ) {
		$status = (string) get_post_meta( $c->ID, '_nab_status', true );
		$rating = (int) get_post_meta( $c->ID, '_nab_rating', true );
		echo '<tr><td>' . esc_html( get_the_author_meta( 'display_name', $c->post_author ) ) . '<br><small>' . esc_html( get_the_author_meta( 'user_email', $c->post_author ) ) . '</small></td><td>' . esc_html( get_the_date( 'M j, Y g:i a', $c ) ) . '</td><td>' . esc_html( $status ) . '</td><td>' . ( $rating ? esc_html( str_repeat( '★', $rating ) . ' ' . get_post_meta( $c->ID, '_nab_review', true ) ) : '—' ) . '</td><td>';
		if ( 'active' === $status ) {
			echo '<form method="post" action="' . esc_url( admin_url( 'admin-post.php' ) ) . '"><input type="hidden" name="action" value="nab_call_complete" /><input type="hidden" name="call" value="' . (int) $c->ID . '" />';
			wp_nonce_field( 'nab_call_complete_' . $c->ID );
			echo '<button class="button button-primary">' . esc_html__( 'Mark completed', 'nab-core' ) . '</button></form>';
		}
		echo '</td></tr>';
	}
	echo '</tbody></table></div>';
}

add_action(
	'admin_post_nab_call_complete',
	static function () {
		$id = absint( $_POST['call'] ?? 0 );
		check_admin_referer( 'nab_call_complete_' . $id );
		if ( (int) get_post_meta( $id, '_nab_staff', true ) === get_current_user_id() || current_user_can( 'manage_options' ) ) {
			update_post_meta( $id, '_nab_status', 'completed' );
			$student = (int) get_post_field( 'post_author', $id );
			$name    = wp_get_current_user()->display_name;
			if ( function_exists( 'nab_notify' ) ) {
				/* translators: %s: instructor. */
				nab_notify( $student, 'call_completed', sprintf( __( 'How was your call with %s?', 'nab-core' ), $name ), __( 'Leave a quick rating to help other students.', 'nab-core' ), home_url( '/book-a-call/' ) );
			}
			$u = get_userdata( $student );
			if ( $u && function_exists( 'nab_send_email' ) ) {
				/* translators: %s: instructor. */
				nab_send_email( $u->user_email, sprintf( __( 'How was your call with %s?', 'nab-core' ), $name ), '<p>' . esc_html__( 'Thanks for joining the call. Leave a quick rating so we can keep improving.', 'nab-core' ) . '</p><p><a href="' . esc_url( home_url( '/book-a-call/' ) ) . '">' . esc_html__( 'Rate your call', 'nab-core' ) . '</a></p>' );
			}
		}
		wp_safe_redirect( admin_url( 'users.php?page=nab-my-calls' ) );
		exit;
	}
);

add_filter(
	'tutor_dashboard/nav_items',
	static function ( $items ) {
		$items['nab-calls'] = array(
			'title' => __( 'Book a call', 'nab-core' ),
			'icon'  => 'profile',
			'url'   => home_url( '/book-a-call/' ),
		);
		return $items;
	},
	23
);
