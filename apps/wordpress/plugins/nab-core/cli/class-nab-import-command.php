<?php
/**
 * `wp nab import <file>`: load an export from tools/export-mongo.mjs.
 *
 * Idempotent: every record is matched by its old MongoDB id (_nab_legacy_id),
 * so re-running updates instead of duplicating. No emails are sent.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Imports users, courses, enrollments, progress, setup steps and certificates.
 */
class NAB_Import_Command {

	/**
	 * Old user id => WP user id.
	 *
	 * @var array<string,int>
	 */
	private $users = array();

	/**
	 * Old cohort id => course id.
	 *
	 * @var array<string,int>
	 */
	private $courses = array();

	/**
	 * Old lesson id => lesson id.
	 *
	 * @var array<string,int>
	 */
	private $lessons = array();

	/**
	 * Old step id => nab_step id.
	 *
	 * @var array<string,int>
	 */
	private $steps = array();

	/**
	 * Dry run flag.
	 *
	 * @var bool
	 */
	private $dry = false;

	/**
	 * Counters for the summary.
	 *
	 * @var array<string,int>
	 */
	private $count = array();

	/**
	 * Import an export file.
	 *
	 * ## OPTIONS
	 *
	 * <file>
	 * : Path to the JSON export (inside the container).
	 *
	 * [--dry-run]
	 * : Report what would be imported without writing.
	 *
	 * ## EXAMPLES
	 *
	 *     wp nab import wp-content/plugins/nab-core/import-data/export.json --dry-run
	 *
	 * @param array $args       Positional args.
	 * @param array $assoc_args Flags.
	 */
	public function __invoke( $args, $assoc_args ) {
		$data = json_decode( (string) file_get_contents( $args[0] ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions -- local file.
		if ( ! is_array( $data ) || empty( $data['users'] ) ) {
			WP_CLI::error( 'Not a valid export file.' );
		}
		$this->dry = (bool) \WP_CLI\Utils\get_flag_value( $assoc_args, 'dry-run', false );
		WP_CLI::log( sprintf( 'Export from %s%s', $data['exportedAt'] ?? '?', $this->dry ? ' (dry run: nothing is written)' : '' ) );

		// Imports must not notify anyone or trigger payment logic.
		add_filter( 'pre_wp_mail', '__return_false' );
		wp_defer_term_counting( true );

		foreach ( $data['users'] as $u ) {
			$this->user( $u );
		}
		foreach ( $data['cohorts'] as $c ) {
			$this->course( $c );
		}
		foreach ( $data['enrollments'] as $e ) {
			$this->enrollment( $e );
		}
		foreach ( $data['lessonProgress'] as $p ) {
			$this->lesson_progress( $p );
		}
		foreach ( $data['setupSteps'] as $s ) {
			$this->step( $s );
		}
		$this->step_progress( $data['stepProgress'] );
		foreach ( $data['certificates'] as $cert ) {
			$this->certificate( $cert );
		}
		foreach ( $data['payments'] as $p ) {
			$this->payment( $p );
		}

		wp_defer_term_counting( false );
		WP_CLI\Utils\format_items(
			'table',
			array_map( static fn( $k, $v ) => array( 'what' => $k, 'count' => $v ), array_keys( $this->count ), $this->count ),
			array( 'what', 'count' )
		);
		WP_CLI::success( $this->dry ? 'Dry run complete.' : 'Import complete.' );
	}

	/**
	 * Count something.
	 *
	 * @param string $what Label.
	 */
	private function tally( $what ) {
		$this->count[ $what ] = ( $this->count[ $what ] ?? 0 ) + 1;
	}

	/**
	 * Find a post by legacy id.
	 *
	 * @param string $type   Post type.
	 * @param string $legacy Old id.
	 * @return int
	 */
	private function find( $type, $legacy ) {
		$ids = get_posts(
			array(
				'post_type'      => $type,
				'post_status'    => 'any',
				'posts_per_page' => 1,
				'fields'         => 'ids',
				'meta_key'       => '_nab_legacy_id', // phpcs:ignore WordPress.DB.SlowDBQuery -- one-off import.
				'meta_value'     => $legacy, // phpcs:ignore WordPress.DB.SlowDBQuery
			)
		);
		return $ids ? (int) $ids[0] : 0;
	}

	/**
	 * Upsert a user. Keeps their bcrypt password hash (WordPress verifies it
	 * natively and upgrades it on first login).
	 *
	 * @param array $u User.
	 */
	private function user( $u ) {
		if ( ! is_email( $u['email'] ) ) {
			$this->tally( 'users skipped (no valid email)' );
			return;
		}
		$roles = array(
			'SUPER_ADMIN' => 'administrator',
			'ADMIN'       => 'shop_manager',
			'SUB_ADMIN'   => 'shop_manager',
			'INSTRUCTOR'  => 'tutor_instructor',
		);
		$role     = $roles[ $u['role'] ] ?? 'customer';
		$existing = get_user_by( 'email', $u['email'] );
		$this->tally( $existing ? 'users updated' : 'users created' );
		if ( $this->dry ) {
			$this->users[ $u['id'] ] = $existing ? $existing->ID : -1;
			return;
		}
		if ( $existing ) {
			$user_id = $existing->ID;
			// Never downgrade someone who already has more access in WordPress.
			if ( ! user_can( $user_id, 'manage_options' ) ) {
				( new WP_User( $user_id ) )->add_role( $role );
			}
		} else {
			$login   = sanitize_user( strstr( $u['email'], '@', true ), true );
			$login   = username_exists( $login ) ? $login . '-' . substr( $u['id'], -6 ) : $login;
			$user_id = wp_insert_user(
				array(
					'user_login'      => $login,
					'user_email'      => $u['email'],
					'user_pass'       => wp_generate_password( 32 ),
					'first_name'      => $u['firstName'],
					'last_name'       => $u['lastName'],
					'display_name'    => trim( $u['firstName'] . ' ' . $u['lastName'] ) ? trim( $u['firstName'] . ' ' . $u['lastName'] ) : $login,
					'role'            => $role,
					'user_registered' => $u['createdAt'] ? gmdate( 'Y-m-d H:i:s', strtotime( $u['createdAt'] ) ) : current_time( 'mysql', true ),
				)
			);
			if ( is_wp_error( $user_id ) ) {
				WP_CLI::warning( $u['email'] . ': ' . $user_id->get_error_message() );
				return;
			}
			if ( $u['passwordHash'] && str_starts_with( $u['passwordHash'], '$2' ) ) {
				global $wpdb;
				$wpdb->update( $wpdb->users, array( 'user_pass' => $u['passwordHash'] ), array( 'ID' => $user_id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery -- store the existing hash as-is.
				clean_user_cache( $user_id );
				$this->tally( 'passwords carried over' );
			}
		}
		if ( 'tutor_instructor' === $role ) {
			update_user_meta( $user_id, '_is_tutor_instructor', time() );
			update_user_meta( $user_id, '_tutor_instructor_status', 'approved' );
		}
		update_user_meta( $user_id, '_nab_legacy_id', $u['id'] );
		if ( $u['oauthProvider'] && 'local' !== $u['oauthProvider'] ) {
			update_user_meta( $user_id, '_nab_oauth_provider', $u['oauthProvider'] );
			update_user_meta( $user_id, '_nab_oauth_id', (string) $u['oauthId'] );
		}
		if ( ! $u['isActive'] ) {
			update_user_meta( $user_id, '_nab_disabled', 1 );
		}
		$this->users[ $u['id'] ] = (int) $user_id;
	}

	/**
	 * Upsert a course (cohort) with modules, lessons and its product.
	 *
	 * @param array $c Cohort.
	 */
	private function course( $c ) {
		if ( empty( $c['slug'] ) ) {
			$this->tally( 'courses skipped (no slug)' );
			return;
		}
		$course_id = $this->find( 'courses', $c['id'] );
		if ( ! $course_id ) {
			$by_slug   = get_page_by_path( $c['slug'], OBJECT, 'courses' );
			$course_id = $by_slug ? $by_slug->ID : 0;
		}
		$this->tally( $course_id ? 'courses updated' : 'courses created' );
		if ( $this->dry ) {
			$this->courses[ $c['id'] ] = $course_id ? $course_id : -1;
			foreach ( $c['modules'] as $m ) {
				foreach ( $m['lessons'] as $l ) {
					$this->tally( 'lessons' );
					$this->lessons[ $l['id'] ] = -1;
				}
			}
			return;
		}
		$published = $c['isPublished'] && ! in_array( $c['status'], array( 'ARCHIVED', 'CANCELLED' ), true );
		$course_id = wp_insert_post(
			array(
				'ID'           => $course_id,
				'post_type'    => 'courses',
				'post_status'  => $published ? 'publish' : 'draft',
				'post_name'    => $c['slug'],
				'post_title'   => $c['name'],
				'post_excerpt' => $c['tagline'],
				'post_content' => $c['description'] ? '<!-- wp:paragraph --><p>' . esc_html( $c['description'] ) . '</p><!-- /wp:paragraph -->' : '',
			)
		);
		update_post_meta( $course_id, '_nab_legacy_id', $c['id'] );
		update_post_meta( $course_id, '_nab_format', in_array( $c['type'], array( 'live', 'recorded', 'combined' ), true ) ? $c['type'] : 'recorded' );
		update_post_meta( $course_id, '_nab_tagline', $c['tagline'] );
		if ( $c['startDate'] && 'recorded' !== $c['type'] ) {
			update_post_meta( $course_id, '_nab_start_date', gmdate( 'Y-m-d', strtotime( $c['startDate'] ) ) );
		}
		if ( $c['endDate'] && 'recorded' !== $c['type'] ) {
			update_post_meta( $course_id, '_nab_end_date', gmdate( 'Y-m-d', strtotime( $c['endDate'] ) ) );
		}
		if ( $c['maxSeats'] ) {
			update_post_meta( $course_id, '_nab_seats', (int) $c['maxSeats'] );
		}
		update_post_meta( $course_id, '_tutor_course_benefits', implode( "\n", $c['learningOutcomes'] ) );
		update_post_meta( $course_id, '_tutor_course_requirements', implode( "\n", $c['requirements'] ) );
		update_post_meta( $course_id, '_tutor_course_target_audience', implode( "\n", $c['targetAudience'] ) );

		// Price from the one-time plan; installment count from the installment plan.
		$one   = current( array_filter( $c['plans'], static fn( $p ) => 'ONE_TIME' === $p['type'] && $p['isActive'] ) );
		$multi = current( array_filter( $c['plans'], static fn( $p ) => 'INSTALLMENT' === $p['type'] && $p['isActive'] ) );
		if ( $one ) {
			$product_id = (int) get_post_meta( $course_id, '_tutor_course_product_id', true );
			$product    = $product_id ? wc_get_product( $product_id ) : null;
			$product    = $product ? $product : new WC_Product_Simple();
			$product->set_name( $c['name'] );
			$product->set_slug( $c['slug'] );
			$product->set_status( 'publish' );
			$product->set_catalog_visibility( 'hidden' );
			$product->set_virtual( true );
			$product->set_sold_individually( true );
			$product->set_regular_price( (string) ( $one['totalAmount'] / 100 ) );
			$product->save();
			update_post_meta( $product->get_id(), '_tutor_product', 'yes' );
			update_post_meta( $course_id, '_tutor_course_product_id', $product->get_id() );
			update_post_meta( $course_id, '_tutor_course_price_type', 'paid' );
		}
		// The old plan lists each installment; older records may hold a number instead.
		$parts = $multi ? ( is_array( $multi['installments'] ) ? count( $multi['installments'] ) : (int) $multi['installments'] ) : 0;
		update_post_meta( $course_id, '_nab_installment_count', $multi ? ( $parts > 1 ? $parts : 3 ) : 0 );

		foreach ( $c['modules'] as $m_order => $m ) {
			$topic_id = $this->find( 'topics', $m['id'] );
			$topic_id = wp_insert_post(
				array(
					'ID'           => $topic_id,
					'post_type'    => 'topics',
					'post_status'  => 'publish',
					'post_title'   => $m['title'],
					'post_content' => $m['description'],
					'post_parent'  => $course_id,
					'menu_order'   => $m_order,
				)
			);
			update_post_meta( $topic_id, '_nab_legacy_id', $m['id'] );
			foreach ( $m['lessons'] as $l_order => $l ) {
				$lesson_id = $this->find( 'lesson', $l['id'] );
				$lesson_id = wp_insert_post(
					array(
						'ID'           => $lesson_id,
						'post_type'    => 'lesson',
						'post_status'  => $l['isPublished'] ? 'publish' : 'draft',
						'post_title'   => $l['title'],
						'post_content' => wp_kses_post( $l['content'] ),
						'post_parent'  => $topic_id,
						'menu_order'   => $l_order,
					)
				);
				update_post_meta( $lesson_id, '_nab_legacy_id', $l['id'] );
				update_post_meta( $lesson_id, '_tutor_course_id_for_lesson', $course_id );
				update_post_meta( $lesson_id, '_nab_minutes', (int) $l['minutes'] );
				update_post_meta( $lesson_id, '_is_preview', $l['freePreview'] ? 1 : 0 );
				if ( $l['videoUrl'] ) {
					update_post_meta( $lesson_id, '_video', $this->tutor_video( $l ) );
				}
				$this->lessons[ $l['id'] ] = (int) $lesson_id;
				$this->tally( 'lessons' );
			}
		}
		$this->courses[ $c['id'] ] = (int) $course_id;
	}

	/**
	 * Tutor's lesson video meta.
	 *
	 * @param array $l Lesson.
	 * @return array
	 */
	private function tutor_video( $l ) {
		$url    = $l['videoUrl'];
		$source = str_contains( $url, 'youtu' ) ? 'youtube' : ( str_contains( $url, 'vimeo' ) ? 'vimeo' : 'external_url' );
		$mins   = (int) $l['minutes'];
		return array(
			'source'          => $source,
			'source_' . $source => $url,
			'runtime'         => array(
				'hours'   => intdiv( $mins, 60 ),
				'minutes' => $mins % 60,
				'seconds' => 0,
			),
		);
	}

	/**
	 * Tutor enrollment with the old status.
	 *
	 * @param array $e Enrollment.
	 */
	private function enrollment( $e ) {
		$user_id   = $this->users[ $e['userId'] ] ?? 0;
		$course_id = $this->courses[ $e['cohortId'] ] ?? 0;
		if ( ! $user_id || ! $course_id ) {
			$this->tally( 'enrollments skipped (unknown user/course)' );
			return;
		}
		$this->tally( 'enrollments' );
		if ( $this->dry || $user_id < 0 || $course_id < 0 ) {
			return;
		}
		$status = array(
			'ACTIVE'    => 'completed',
			'COMPLETED' => 'completed',
			'PENDING'   => 'pending',
		)[ $e['status'] ] ?? 'cancel';
		global $wpdb;
		$enroll_id = (int) $wpdb->get_var( $wpdb->prepare( "SELECT ID FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_parent = %d AND post_author = %d", $course_id, $user_id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
		if ( ! $enroll_id ) {
			$enroll_id = (int) tutor_utils()->do_enroll( $course_id, 0, $user_id );
		}
		if ( $enroll_id ) {
			tutor_utils()->course_enrol_status_change( $enroll_id, $status );
			update_post_meta( $enroll_id, '_nab_legacy_id', $e['id'] );
			update_post_meta( $enroll_id, '_nab_legacy_payment', $e['paymentMethod'] . '/' . $e['paymentStatus'] );
		}
	}

	/**
	 * Completed lessons (Tutor stores one user meta per completed lesson).
	 *
	 * @param array $p Progress row.
	 */
	private function lesson_progress( $p ) {
		$user_id   = $this->users[ $p['userId'] ] ?? 0;
		$lesson_id = $this->lessons[ $p['lessonId'] ] ?? 0;
		if ( ! $user_id || ! $lesson_id ) {
			$this->tally( 'lesson completions skipped' );
			return;
		}
		$this->tally( 'lesson completions' );
		if ( ! $this->dry && $user_id > 0 && $lesson_id > 0 ) {
			update_user_meta( $user_id, '_tutor_completed_lesson_id_' . $lesson_id, $p['completedAt'] ? strtotime( $p['completedAt'] ) : time() );
		}
	}

	/**
	 * Upsert a setup step (by legacy id, then by slug of the title).
	 *
	 * @param array $s Step.
	 */
	private function step( $s ) {
		$step_id = $this->find( 'nab_step', $s['id'] );
		if ( ! $step_id ) {
			$by_slug = get_page_by_path( sanitize_title( $s['title'] ), OBJECT, 'nab_step' );
			$step_id = $by_slug ? $by_slug->ID : 0;
		}
		$this->tally( 'setup steps' );
		if ( $this->dry ) {
			$this->steps[ $s['id'] ] = $step_id ? $step_id : -1;
			return;
		}
		$step_id = wp_insert_post(
			array(
				'ID'           => $step_id,
				'post_type'    => 'nab_step',
				'post_status'  => $s['isActive'] ? 'publish' : 'draft',
				'post_name'    => sanitize_title( $s['title'] ),
				'post_title'   => $s['title'],
				'post_content' => wp_kses_post( $s['description'] ),
				'menu_order'   => (int) $s['order'],
			)
		);
		update_post_meta( $step_id, '_nab_legacy_id', $s['id'] );
		update_post_meta( $step_id, '_nab_screenshot_criteria', $s['screenshotCriteria'] );
		update_post_meta( $step_id, '_nab_checklist', implode( "\n", $s['checklist'] ) );
		update_post_meta( $step_id, '_nab_why', $s['whyItMatters'] );
		update_post_meta( $step_id, '_nab_minutes', (int) $s['minutes'] );
		update_post_meta( $step_id, '_nab_video_url', (string) $s['videoUrl'] );
		$this->steps[ $s['id'] ] = (int) $step_id;
	}

	/**
	 * Done / failed steps per student. Locked/in-progress are derived, so skipped.
	 *
	 * @param array $rows Progress rows.
	 */
	private function step_progress( $rows ) {
		$map = array(
			'COMPLETE'      => 'complete',
			'OVERRIDE_PASS' => 'override_pass',
			'OVERRIDE_FAIL' => 'override_fail',
		);
		$per_user = array();
		foreach ( $rows as $r ) {
			$user_id = $this->users[ $r['userId'] ] ?? 0;
			$step_id = $this->steps[ $r['stepId'] ] ?? 0;
			if ( ! $user_id || ! $step_id || ! isset( $map[ $r['status'] ] ) ) {
				continue;
			}
			$per_user[ $user_id ][ $step_id ] = array(
				'status'       => $map[ $r['status'] ],
				'attempts'     => (int) $r['attempts'],
				'completed_at' => $r['completedAt'] ? strtotime( $r['completedAt'] ) : 0,
			);
			$this->tally( 'setup steps completed' );
		}
		if ( $this->dry ) {
			return;
		}
		foreach ( $per_user as $user_id => $steps ) {
			if ( $user_id > 0 ) {
				update_user_meta( $user_id, '_nab_steps', array_replace( (array) get_user_meta( $user_id, '_nab_steps', true ), $steps ) );
				nab_award_badges( $user_id );
			}
		}
	}

	/**
	 * Course certificate, keeping its public token so old links still verify.
	 *
	 * @param array $cert Certificate.
	 */
	private function certificate( $cert ) {
		$user_id   = $this->users[ $cert['userId'] ] ?? 0;
		$course_id = $this->courses[ $cert['cohortId'] ] ?? 0;
		if ( ! $user_id || ! $cert['token'] ) {
			$this->tally( 'certificates skipped' );
			return;
		}
		$this->tally( 'certificates' );
		if ( $this->dry || $user_id < 0 ) {
			return;
		}
		$list = (array) get_user_meta( $user_id, '_nab_course_certificates', true );
		$list = array_values( array_filter( $list, static fn( $c ) => is_array( $c ) && $c['token'] !== $cert['token'] ) );
		$list[] = array(
			'token'     => $cert['token'],
			'number'    => $cert['credentialId'] ? $cert['credentialId'] : 'NAB-' . strtoupper( substr( $cert['token'], 0, 8 ) ),
			'issued'    => $cert['issuedAt'] ? strtotime( $cert['issuedAt'] ) : time(),
			'course'    => $course_id > 0 ? get_the_title( $course_id ) : __( 'nextaibuilder course', 'nab-core' ),
			'course_id' => max( 0, $course_id ),
		);
		update_user_meta( $user_id, '_nab_course_certificates', $list );
		if ( ! in_array( $cert['token'], get_user_meta( $user_id, '_nab_certificate_token' ), true ) ) {
			add_user_meta( $user_id, '_nab_certificate_token', $cert['token'] );
		}
	}

	/**
	 * Historical payment, kept as a read-only ledger row (not a WooCommerce
	 * order, so nothing re-triggers enrollment or emails).
	 *
	 * @param array $p Payment.
	 */
	private function payment( $p ) {
		$this->tally( 'payments (ledger)' );
		if ( $this->dry ) {
			return;
		}
		$id = $this->find( 'nab_legacy_payment', $p['id'] );
		$id = wp_insert_post(
			array(
				'ID'          => $id,
				'post_type'   => 'nab_legacy_payment',
				'post_status' => 'private',
				'post_author' => max( 0, $this->users[ $p['userId'] ] ?? 0 ),
				'post_title'  => sprintf( '%s %s %s', $p['provider'], $p['status'], $p['reference'] ?? '' ),
				'post_date'   => $p['createdAt'] ? get_date_from_gmt( gmdate( 'Y-m-d H:i:s', strtotime( $p['createdAt'] ) ) ) : current_time( 'mysql' ),
			)
		);
		update_post_meta( $id, '_nab_legacy_id', $p['id'] );
		foreach ( array( 'provider', 'status', 'reference', 'currency' ) as $k ) {
			update_post_meta( $id, '_nab_' . $k, (string) $p[ $k ] );
		}
		update_post_meta( $id, '_nab_amount', $p['amount'] );
		update_post_meta( $id, '_nab_course_id', max( 0, $this->courses[ $p['cohortId'] ] ?? 0 ) );
	}
}

WP_CLI::add_command( 'nab import', 'NAB_Import_Command' );
