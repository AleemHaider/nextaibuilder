<?php
/**
 * Learning rules carried over from the old platform:
 * - lessons unlock in order (a lesson can't be opened or completed before the
 *   previous one is done);
 * - free-preview lessons are readable by anyone at /courses/<course>/preview/<lesson>/;
 * - finishing every lesson completes the course and issues a course certificate
 *   (public link /verify/<token>/, LinkedIn share), with an email + notification;
 * - students see their certificates at /certificates/.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Lesson IDs of a course in curriculum order.
 *
 * @param int $course_id Course.
 * @return int[]
 */
function nab_course_lesson_ids( $course_id ) {
	$ids = array();
	foreach ( get_posts( array( 'post_type' => 'topics', 'post_parent' => $course_id, 'posts_per_page' => -1, 'orderby' => 'menu_order', 'order' => 'ASC', 'fields' => 'ids' ) ) as $topic_id ) {
		$ids = array_merge( $ids, get_posts( array( 'post_type' => 'lesson', 'post_parent' => $topic_id, 'post_status' => 'publish', 'posts_per_page' => -1, 'orderby' => 'menu_order', 'order' => 'ASC', 'fields' => 'ids' ) ) );
	}
	return array_map( 'intval', $ids );
}

/**
 * Course a lesson belongs to.
 *
 * @param int $lesson_id Lesson.
 * @return int
 */
function nab_lesson_course( $lesson_id ) {
	return (int) get_post_meta( $lesson_id, '_tutor_course_id_for_lesson', true );
}

/**
 * Whether a user completed a lesson.
 *
 * @param int $lesson_id Lesson.
 * @param int $user_id   User.
 * @return bool
 */
function nab_lesson_done( $lesson_id, $user_id ) {
	return (bool) get_user_meta( $user_id, '_tutor_completed_lesson_id_' . $lesson_id, true );
}

/**
 * The first lesson the user hasn't completed, or 0 when all are done.
 *
 * @param int $course_id Course.
 * @param int $user_id   User.
 * @return int
 */
function nab_next_open_lesson( $course_id, $user_id ) {
	foreach ( nab_course_lesson_ids( $course_id ) as $id ) {
		if ( ! nab_lesson_done( $id, $user_id ) ) {
			return $id;
		}
	}
	return 0;
}

/**
 * Whether the lesson is locked for this user (an earlier lesson is unfinished).
 *
 * @param int $lesson_id Lesson.
 * @param int $user_id   User.
 * @return bool
 */
function nab_lesson_locked( $lesson_id, $user_id ) {
	if ( user_can( $user_id, 'edit_posts' ) ) {
		return false;
	}
	foreach ( nab_course_lesson_ids( nab_lesson_course( $lesson_id ) ) as $id ) {
		if ( $id === (int) $lesson_id ) {
			return false;
		}
		if ( ! nab_lesson_done( $id, $user_id ) ) {
			return true;
		}
	}
	return false;
}

// Completing out of order is refused.
add_filter(
	'tutor_validate_lesson_complete',
	static fn( $ok, $user_id, $lesson_id ) => $ok && ! nab_lesson_locked( (int) $lesson_id, (int) $user_id ),
	10,
	3
);

// Opening a locked lesson sends the student to the lesson they should do next.
add_action(
	'template_redirect',
	static function () {
		if ( ! is_singular( 'lesson' ) || ! is_user_logged_in() ) {
			return;
		}
		$lesson_id = get_queried_object_id();
		if ( nab_lesson_locked( $lesson_id, get_current_user_id() ) ) {
			$next = nab_next_open_lesson( nab_lesson_course( $lesson_id ), get_current_user_id() );
			if ( $next && $next !== $lesson_id ) {
				wp_safe_redirect( add_query_arg( 'nab_locked', 1, get_permalink( $next ) ) );
				exit;
			}
		}
	},
	5
);

/* ---------------- Free-preview lessons ---------------- */

/**
 * Public preview URL for a preview lesson.
 *
 * @param int $lesson_id Lesson.
 * @return string
 */
function nab_preview_url( $lesson_id ) {
	return home_url( '/courses/' . get_post_field( 'post_name', nab_lesson_course( $lesson_id ) ) . '/preview/' . $lesson_id . '/' );
}

add_action(
	'init',
	static function () {
		add_rewrite_rule( '^courses/([^/]+)/preview/([0-9]+)/?$', 'index.php?nab_preview=$matches[2]', 'top' );
		add_rewrite_rule( '^certificates/?$', 'index.php?nab_certs=1', 'top' );
	}
);
add_filter(
	'query_vars',
	static function ( $vars ) {
		$vars[] = 'nab_preview';
		$vars[] = 'nab_certs';
		return $vars;
	}
);

add_action(
	'template_redirect',
	static function () {
		$lesson_id = (int) get_query_var( 'nab_preview' );
		if ( ! $lesson_id ) {
			return;
		}
		$lesson = get_post( $lesson_id );
		if ( ! $lesson || 'lesson' !== $lesson->post_type || 'publish' !== $lesson->post_status || ! ( get_post_meta( $lesson_id, '_is_preview', true ) || ( nab_demo_on() && nab_course_lesson_ids( nab_lesson_course( $lesson_id ) )[0] === $lesson_id ) ) ) {
			wp_safe_redirect( get_post_type_archive_link( 'courses' ) );
			exit;
		}
		$course_id = nab_lesson_course( $lesson_id );
		$video     = get_post_meta( $lesson_id, '_video', true );
		$embed     = '';
		if ( is_array( $video ) && ! empty( $video['source'] ) ) {
			$url   = (string) ( $video[ 'source_' . $video['source'] ] ?? '' );
			$embed = $url ? wp_oembed_get( $url ) : '';
		}
		$c    = nab_get_course( $course_id );
		$html = '<section class="nab-wrap" style="padding-block:3rem 5rem;max-width:860px">'
			. '<nav class="nab-crumbs"><a href="' . esc_url( $c['url'] ) . '">' . esc_html( $c['title'] ) . '</a> / ' . esc_html__( 'Free preview', 'nab-core' ) . '</nav>'
			. '<span class="nab-badge">' . esc_html__( 'Free preview', 'nab-core' ) . '</span>'
			. '<h1 style="font-size:var(--wp--preset--font-size--2-xl);font-weight:300;letter-spacing:-0.03em;margin:.75rem 0 1.5rem">' . esc_html( get_the_title( $lesson ) ) . '</h1>'
			. ( $embed ? '<div class="nab-preview__video">' . $embed . '</div>' : '' )
			. '<div class="nab-prose">' . apply_filters( 'the_content', $lesson->post_content ) . '</div>'
			. '<div class="nab-card" style="padding:1.75rem;margin-top:3rem;display:flex;flex-wrap:wrap;gap:1rem;align-items:center;justify-content:space-between"><div><b>' . esc_html__( 'Enjoyed this lesson?', 'nab-core' ) . '</b><p style="margin:.25rem 0 0;color:var(--muted)">' . esc_html( sprintf( /* translators: %d: lessons. */ __( 'Get all %d sessions, live Q&A and a shipped project.', 'nab-core' ), $c['lesson_count'] ) ) . '</p></div><a class="nab-btn" href="' . esc_url( $c['url'] ) . '">' . esc_html__( 'See the full course', 'nab-core' ) . '</a></div>'
			. '</section>';
		add_filter( 'pre_get_document_title', static fn() => get_the_title( $lesson ) . ' – ' . __( 'Free preview', 'nab-core' ) );
		nextaibuilder_render_shell( $html );
		exit;
	}
);

/* ---------------- Course completion + certificate ---------------- */

/**
 * Issue a course certificate once (idempotent).
 *
 * @param int $course_id Course.
 * @param int $user_id   User.
 * @return array|null The certificate.
 */
function nab_issue_course_certificate( $course_id, $user_id ) {
	$list = array_values( array_filter( (array) get_user_meta( $user_id, '_nab_course_certificates', true ), 'is_array' ) );
	foreach ( $list as $cert ) {
		if ( (int) ( $cert['course_id'] ?? 0 ) === (int) $course_id ) {
			return $cert;
		}
	}
	$number = (int) get_option( 'nab_certificate_seq', 1000 ) + 1;
	update_option( 'nab_certificate_seq', $number, false );
	$cert   = array(
		'token'     => strtolower( wp_generate_password( 20, false ) ),
		'number'    => 'NAB-' . $number,
		'issued'    => time(),
		'course'    => get_the_title( $course_id ),
		'course_id' => (int) $course_id,
	);
	$list[] = $cert;
	update_user_meta( $user_id, '_nab_course_certificates', $list );
	add_user_meta( $user_id, '_nab_certificate_token', $cert['token'] );
	$user = get_userdata( $user_id );
	if ( $user && function_exists( 'nab_send_email' ) ) {
		nab_send_email(
			$user->user_email,
			/* translators: %s: course. */
			sprintf( __( 'Your certificate: %s', 'nab-core' ), $cert['course'] ),
			'<p>' . esc_html__( 'Congratulations on finishing the course! Your certificate is ready to share.', 'nab-core' ) . '</p><p><a href="' . esc_url( home_url( '/verify/' . $cert['token'] . '/' ) ) . '">' . esc_html__( 'View your certificate', 'nab-core' ) . '</a></p>'
		);
	}
	if ( function_exists( 'nab_notify' ) ) {
		/* translators: %s: course. */
		nab_notify( $user_id, 'certificate', sprintf( __( 'Certificate issued for %s', 'nab-core' ), $cert['course'] ), '', home_url( '/certificates/' ) );
	}
	return $cert;
}

// When the last lesson is completed, complete the course and issue the certificate.
/**
 * After a lesson is completed: if it was the last one, issue the certificate.
 *
 * @param int $lesson_id Lesson.
 * @param int $user_id   User.
 */
function nab_on_lesson_completed( $lesson_id, $user_id = 0 ) {
	$user_id   = $user_id ? (int) $user_id : get_current_user_id();
	$course_id = nab_lesson_course( (int) $lesson_id );
	if ( $course_id && $user_id && ! nab_next_open_lesson( $course_id, $user_id ) ) {
		nab_issue_course_certificate( $course_id, $user_id );
	}
}
add_action( 'tutor_lesson_completed_after', 'nab_on_lesson_completed', 5, 2 );
add_action( 'tutor_course_complete_after', static fn( $course_id, $user_id ) => nab_issue_course_certificate( (int) $course_id, (int) $user_id ), 10, 2 );

/**
 * /certificates/: the student's certificates with share links.
 */
add_action(
	'template_redirect',
	static function () {
		if ( ! get_query_var( 'nab_certs' ) ) {
			return;
		}
		if ( ! is_user_logged_in() ) {
			wp_safe_redirect( nab_signin_url( home_url( '/certificates/' ) ) );
			exit;
		}
		$user  = wp_get_current_user();
		$certs = array_values( array_filter( (array) get_user_meta( $user->ID, '_nab_course_certificates', true ), 'is_array' ) );
		$setup = get_user_meta( $user->ID, '_nab_certificate', true );
		if ( is_array( $setup ) ) {
			$certs[] = $setup + array( 'course' => __( 'AI tool setup', 'nab-core' ) );
		}
		$html = '<section class="nab-wrap" style="padding-block:3rem 5rem"><h1 style="font-size:var(--wp--preset--font-size--2-xl);font-weight:300;letter-spacing:-0.03em;margin:0 0 2rem">' . esc_html__( 'Your certificates', 'nab-core' ) . '</h1>';
		if ( ! $certs ) {
			$html .= '<div class="nab-card" style="padding:2rem"><p style="margin:0 0 1rem">' . esc_html__( 'Finish every lesson in a course to earn its certificate. Your progress is on the dashboard.', 'nab-core' ) . '</p><a class="nab-btn" href="' . esc_url( home_url( '/dashboard/' ) ) . '">' . esc_html__( 'Go to dashboard', 'nab-core' ) . '</a></div>';
		} else {
			$html .= '<div class="nab-certs">';
			foreach ( $certs as $cert ) {
				$url      = home_url( '/verify/' . $cert['token'] . '/' );
				$linkedin = add_query_arg(
					array(
						'startTask'        => 'CERTIFICATION_NAME',
						'name'             => rawurlencode( $cert['course'] ),
						'organizationName' => 'nextaibuilder',
						'issueYear'        => wp_date( 'Y', $cert['issued'] ),
						'issueMonth'       => wp_date( 'n', $cert['issued'] ),
						'certUrl'          => rawurlencode( $url ),
						'certId'           => rawurlencode( $cert['number'] ),
					),
					'https://www.linkedin.com/profile/add'
				);
				$html .= '<article class="nab-cert-card"><p class="nab-kicker">' . esc_html__( 'Certificate of completion', 'nab-core' ) . '</p><h2>' . esc_html( $cert['course'] ) . '</h2><p class="nab-cert-card__meta">' . esc_html( $cert['number'] . ' · ' . wp_date( 'F j, Y', $cert['issued'] ) ) . '</p><div class="nab-cert-card__actions"><a class="nab-btn" href="' . esc_url( $url ) . '">' . esc_html__( 'View', 'nab-core' ) . '</a><a class="nab-btn nab-btn--outline" href="' . esc_url( $linkedin ) . '" target="_blank" rel="noopener">' . esc_html__( 'Add to LinkedIn', 'nab-core' ) . '</a></div></article>';
			}
			$html .= '</div>';
		}
		$html .= '</section>';
		add_filter( 'pre_get_document_title', static fn() => __( 'Your certificates', 'nab-core' ) . ' – nextaibuilder' );
		nextaibuilder_render_shell( $html );
		exit;
	}
);

// Certificates in the dashboard menu.
add_filter(
	'tutor_dashboard/nav_items',
	static function ( $items ) {
		$items['nab-certificates'] = array(
			'title' => __( 'Certificates', 'nab-core' ),
			'icon'  => 'certificate',
			'url'   => home_url( '/certificates/' ),
		);
		return $items;
	},
	25
);
