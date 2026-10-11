<?php
/**
 * `wp nab seed`: load nextaibuilder's real courses, prices, pages and
 * articles into a fresh site. Safe to re-run; it updates in place.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Seeds site content from cli/seed-data.json.
 */
class NAB_Seed_Command {

	/**
	 * Configure WooCommerce + Tutor and import courses, pages and articles.
	 *
	 * ## EXAMPLES
	 *
	 *     wp nab seed
	 *
	 * @param array $args       Positional args.
	 * @param array $assoc_args Flags.
	 */
	public function seed( $args, $assoc_args ) {
		$data = json_decode( (string) file_get_contents( NAB_CORE_DIR . 'cli/seed-data.json' ), true ); // phpcs:ignore WordPress.WP.AlternativeFunctions -- local file.
		if ( ! $data ) {
			WP_CLI::error( 'Could not read cli/seed-data.json' );
		}

		$this->configure_plugins();
		$instructor = $this->instructor();
		foreach ( $data['courses'] as $course ) {
			$id = $this->course( $course, $instructor );
			WP_CLI::log( sprintf( 'Course #%d %s (%s)', $id, $course['title'], $course['format'] ) );
		}
		$this->pages();
		foreach ( $data['steps'] ?? array() as $step ) {
			$id = $this->step( $step );
			WP_CLI::log( sprintf( 'Setup step #%d %s', $id, $step['title'] ) );
		}
		foreach ( $data['articles'] as $article ) {
			$id = $this->article( $article );
			WP_CLI::log( sprintf( 'Article #%d %s', $id, $article['title'] ) );
		}
		flush_rewrite_rules();
		WP_CLI::success( 'Seed complete.' );
	}

	/**
	 * WooCommerce in USD with no setup wizard; Tutor sells through WooCommerce.
	 */
	private function configure_plugins() {
		update_option( 'woocommerce_currency', 'USD' );
		update_option( 'woocommerce_default_country', 'US' );
		update_option( 'woocommerce_coming_soon', 'no' );
		update_option( 'woocommerce_onboarding_profile', array( 'skipped' => true ) );
		update_option( 'woocommerce_enable_guest_checkout', 'no' );
		update_option( 'woocommerce_enable_signup_and_login_from_checkout', 'yes' );
		update_option( 'woocommerce_manage_stock', 'no' );
		update_option( 'woocommerce_calc_taxes', 'no' );
		update_option( 'woocommerce_ship_to_countries', 'disabled' );

		// Bank transfer with receipt upload (nab-core/includes/manual-payment.php).
		// Account details are added in WooCommerce → Settings → Payments.
		$bacs                 = (array) get_option( 'woocommerce_bacs_settings', array() );
		$bacs['enabled']      = 'yes';
		$bacs['title']        = 'Bank transfer';
		$bacs['description']  = 'Transfer the amount to our bank account, then upload your receipt on the next page. We confirm within one business day.';
		$bacs['instructions'] = 'Use your order number as the payment reference. After transferring, upload your receipt below so we can activate your enrollment.';
		update_option( 'woocommerce_bacs_settings', $bacs );
		// Card payments first; bank transfer last.
		update_option(
			'woocommerce_gateway_order',
			array(
				'stripe'     => 0,
				'nab_paddle' => 1,
				'bacs'       => 2,
			)
		);

		$tutor                             = (array) get_option( 'tutor_option', array() );
		$tutor['monetize_by']              = 'wc';
		$tutor['enable_guest_course_cart'] = 'off';
		// Card-paid course orders go straight to "completed" so Tutor activates the
		// enrollment (it ignores "processing"). Bank transfers still wait for approval.
		$tutor['tutor_woocommerce_order_auto_complete'] = 'on';
		update_option( 'tutor_option', $tutor );

		// Single-instructor school: no public instructor sign-up page.
		$instructor_page = (int) tutor_utils()->get_option( 'instructor_register_page' );
		if ( $instructor_page ) {
			wp_update_post( array( 'ID' => $instructor_page, 'post_status' => 'draft' ) );
		}

		update_option( 'permalink_structure', '/%category%/%postname%/' );
		update_option( 'posts_per_page', 12 );
	}

	/**
	 * The instructor who authors the courses.
	 *
	 * @return int User ID.
	 */
	private function instructor() {
		// Reuse the account that already owns the instructor email (on a fresh host
		// that's usually the site admin) instead of failing on a duplicate email.
		$user = get_user_by( 'login', 'aleem' );
		$user = $user ? $user : get_user_by( 'email', 'aleem@nextaibuilder.com' );
		if ( $user && $user->display_name === $user->user_login ) {
			wp_update_user( array( 'ID' => $user->ID, 'display_name' => 'Aleem Haider', 'first_name' => 'Aleem', 'last_name' => 'Haider' ) );
		}
		$id   = $user ? $user->ID : wp_insert_user(
			array(
				'user_login'   => 'aleem',
				'user_pass'    => wp_generate_password( 32 ),
				'user_email'   => 'aleem@nextaibuilder.com',
				'display_name' => 'Aleem Haider',
				'first_name'   => 'Aleem',
				'last_name'    => 'Haider',
				'role'         => 'editor',
			)
		);
		if ( is_wp_error( $id ) ) {
			WP_CLI::error( $id->get_error_message() );
		}
		( new WP_User( $id ) )->add_role( 'tutor_instructor' );
		update_user_meta( $id, '_is_tutor_instructor', time() );
		update_user_meta( $id, '_tutor_instructor_status', 'approved' );
		update_user_meta( $id, '_tutor_profile_job_title', 'Founder & Lead Instructor' );
		update_user_meta( $id, '_tutor_profile_bio', 'Builder, educator, and AI product enthusiast. Helping founders ship real AI products.' );
		return (int) $id;
	}

	/**
	 * Upsert one course with its modules, lessons and WooCommerce product.
	 *
	 * @param array $c          Course data.
	 * @param int   $instructor Author ID.
	 * @return int Course ID.
	 */
	private function course( $c, $instructor ) {
		$existing = get_page_by_path( $c['slug'], OBJECT, 'courses' );
		$id       = wp_insert_post(
			array(
				'ID'           => $existing ? $existing->ID : 0,
				'post_type'    => 'courses',
				'post_status'  => 'publish',
				'post_name'    => $c['slug'],
				'post_title'   => $c['title'],
				'post_excerpt' => $c['tagline'],
				'post_content' => '<!-- wp:paragraph --><p>' . esc_html( $c['description'] ) . '</p><!-- /wp:paragraph -->',
				'post_author'  => $instructor,
				'menu_order'   => $c['menu_order'],
			),
			true
		);
		if ( is_wp_error( $id ) ) {
			WP_CLI::error( $id->get_error_message() );
		}

		update_post_meta( $id, '_nab_format', $c['format'] );
		update_post_meta( $id, '_nab_tagline', $c['tagline'] );
		update_post_meta( $id, '_nab_installment_count', (int) $c['installments'] );
		update_post_meta( $id, '_nab_refund_policy', $c['refund_policy'] );
		update_post_meta( $id, '_tutor_course_material_includes', implode( "\n", $c['includes'] ) );
		update_post_meta( $id, '_tutor_course_level', 'intermediate' );
		update_post_meta( $id, '_tutor_course_price_type', 'paid' );
		update_post_meta( $id, '_tutor_is_public_course', 'no' );

		// Rebuild the curriculum from scratch so re-runs stay in sync.
		foreach ( get_posts( array( 'post_type' => 'topics', 'post_parent' => $id, 'posts_per_page' => -1, 'fields' => 'ids', 'post_status' => 'any' ) ) as $topic_id ) {
			foreach ( get_posts( array( 'post_type' => 'lesson', 'post_parent' => $topic_id, 'posts_per_page' => -1, 'fields' => 'ids', 'post_status' => 'any' ) ) as $lesson_id ) {
				wp_delete_post( $lesson_id, true );
			}
			wp_delete_post( $topic_id, true );
		}
		foreach ( $c['modules'] as $m_order => $module ) {
			$topic_id = wp_insert_post(
				array(
					'post_type'   => 'topics',
					'post_status' => 'publish',
					'post_title'  => $module['title'],
					'post_parent' => $id,
					'post_author' => $instructor,
					'menu_order'  => $m_order,
				)
			);
			foreach ( $module['lessons'] as $l_order => $lesson ) {
				$lesson_id = wp_insert_post(
					array(
						'post_type'   => 'lesson',
						'post_status' => 'publish',
						'post_title'  => $lesson['title'],
						'post_parent' => $topic_id,
						'post_author' => $instructor,
						'menu_order'  => $l_order,
					)
				);
				update_post_meta( $lesson_id, '_nab_minutes', (int) $lesson['minutes'] );
				update_post_meta( $lesson_id, '_tutor_course_id_for_lesson', $id );
			}
		}

		$product_id = (int) get_post_meta( $id, '_tutor_course_product_id', true );
		$product    = $product_id ? wc_get_product( $product_id ) : null;
		if ( ! $product ) {
			$product = new WC_Product_Simple();
		}
		$product->set_name( $c['title'] . ( 'live' === $c['format'] ? ' (Live cohort)' : ' (Recorded)' ) );
		$product->set_slug( $c['slug'] );
		$product->set_status( 'publish' );
		$product->set_catalog_visibility( 'hidden' );
		$product->set_virtual( true );
		$product->set_sold_individually( true );
		$product->set_regular_price( (string) $c['price'] );
		$product->save();
		update_post_meta( $product->get_id(), '_tutor_product', 'yes' );
		update_post_meta( $id, '_tutor_course_product_id', $product->get_id() );

		return (int) $id;
	}

	/**
	 * Static pages: About and Refund policy.
	 */
	private function pages() {
		$about = <<<'HTML'
<!-- wp:group {"tagName":"section","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"backgroundColor":"surface","layout":{"type":"constrained","contentSize":"1180px"}} -->
<section class="wp-block-group has-surface-background-color has-background" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)">
<!-- wp:heading {"level":1,"className":"nab-section__title","fontSize":"2xl"} --><h1 class="wp-block-heading nab-section__title has-2-xl-font-size">We help builders ship real AI products.</h1><!-- /wp:heading -->
<!-- wp:paragraph {"className":"nab-section__lede"} --><p class="nab-section__lede">nextaibuilder is a cohort-based learning platform where founders, developers, and product people learn to build and ship AI products with live sessions, real projects, and a community that actually shows up.</p><!-- /wp:paragraph -->
</section>
<!-- /wp:group -->
<!-- wp:group {"tagName":"section","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"layout":{"type":"constrained","contentSize":"1180px"}} -->
<section class="wp-block-group" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)">
<!-- wp:heading {"className":"nab-section__title"} --><h2 class="wp-block-heading nab-section__title">What we stand for</h2><!-- /wp:heading -->
<!-- wp:columns {"className":"nab-audience__grid"} -->
<div class="wp-block-columns nab-audience__grid">
<!-- wp:column --><div class="wp-block-column"><!-- wp:heading {"level":3} --><h3 class="wp-block-heading">Build, don't just learn</h3><!-- /wp:heading --><!-- wp:paragraph {"textColor":"muted"} --><p class="has-muted-color has-text-color">Every cohort ends with a deployed, production-grade project, not a certificate you forget about.</p><!-- /wp:paragraph --></div><!-- /wp:column -->
<!-- wp:column --><div class="wp-block-column"><!-- wp:heading {"level":3} --><h3 class="wp-block-heading">Community first</h3><!-- /wp:heading --><!-- wp:paragraph {"textColor":"muted"} --><p class="has-muted-color has-text-color">You learn faster alongside people who share your goals. We keep cohorts intentionally small.</p><!-- /wp:paragraph --></div><!-- /wp:column -->
</div>
<!-- /wp:columns -->
<!-- wp:columns {"className":"nab-audience__grid"} -->
<div class="wp-block-columns nab-audience__grid">
<!-- wp:column --><div class="wp-block-column"><!-- wp:heading {"level":3} --><h3 class="wp-block-heading">AI-native curriculum</h3><!-- /wp:heading --><!-- wp:paragraph {"textColor":"muted"} --><p class="has-muted-color has-text-color">We update every cohort as the tools evolve. No stale content, just what's relevant right now.</p><!-- /wp:paragraph --></div><!-- /wp:column -->
<!-- wp:column --><div class="wp-block-column"><!-- wp:heading {"level":3} --><h3 class="wp-block-heading">Transparent pricing</h3><!-- /wp:heading --><!-- wp:paragraph {"textColor":"muted"} --><p class="has-muted-color has-text-color">Installment plans, bank transfer, and no hidden fees. Education should be accessible.</p><!-- /wp:paragraph --></div><!-- /wp:column -->
</div>
<!-- /wp:columns -->
</section>
<!-- /wp:group -->
<!-- wp:group {"tagName":"section","style":{"spacing":{"padding":{"top":"var:preset|spacing|60","bottom":"var:preset|spacing|60"}}},"backgroundColor":"surface","layout":{"type":"constrained","contentSize":"1180px"}} -->
<section class="wp-block-group has-surface-background-color has-background" style="padding-top:var(--wp--preset--spacing--60);padding-bottom:var(--wp--preset--spacing--60)">
<!-- wp:heading {"className":"nab-section__title"} --><h2 class="wp-block-heading nab-section__title">Who teaches</h2><!-- /wp:heading -->
<!-- wp:heading {"level":2,"fontSize":"lg"} --><h2 class="wp-block-heading has-lg-font-size">Aleem Haider</h2><!-- /wp:heading -->
<!-- wp:paragraph {"textColor":"muted","fontSize":"sm"} --><p class="has-muted-color has-text-color has-sm-font-size">Founder &amp; Lead Instructor</p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>Builder, educator, and AI product enthusiast. Helping founders ship real AI products.</p><!-- /wp:paragraph -->
</section>
<!-- /wp:group -->
<!-- wp:pattern {"slug":"nextaibuilder/cta"} /-->
HTML;

		$refund = <<<'HTML'
<!-- wp:paragraph --><p><strong>Live cohorts:</strong> full refund within 2 weeks of the cohort start date, no questions asked.</p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p><strong>Recorded courses:</strong> full refund within 2 weeks of purchase, no questions asked.</p><!-- /wp:paragraph -->
<!-- wp:paragraph --><p>If you paid in installments, any remaining installments are cancelled when the refund is issued. To request a refund, reply to your enrollment confirmation email.</p><!-- /wp:paragraph -->
HTML;

		$this->page( 'setup', 'Setup steps', '<!-- wp:paragraph {"textColor":"muted"} --><p class="has-muted-color has-text-color">Get your AI development environment ready. Each step unlocks the next; upload a screenshot when you finish one and our AI checks it for you.</p><!-- /wp:paragraph --><!-- wp:nab/setup-steps /-->' );
		$this->page( 'sign-in', 'Sign in', '<!-- wp:nab/sign-in /-->' );
		$this->page( 'about', 'About', $about, 'page-wide' );
		$this->page( 'refund-policy', 'Refund policy', $refund );
	}

	/**
	 * Upsert a page.
	 *
	 * @param string $slug     Slug.
	 * @param string $title    Title.
	 * @param string $content  Block markup.
	 * @param string $template Optional page template.
	 */
	private function page( $slug, $title, $content, $template = '' ) {
		$existing = get_page_by_path( $slug );
		$id       = wp_insert_post(
			array(
				'ID'           => $existing ? $existing->ID : 0,
				'post_type'    => 'page',
				'post_status'  => 'publish',
				'post_name'    => $slug,
				'post_title'   => $title,
				'post_content' => $content,
			)
		);
		if ( $template ) {
			update_post_meta( $id, '_wp_page_template', $template );
		}
		WP_CLI::log( sprintf( 'Page #%d %s', $id, $title ) );
	}

	/**
	 * Upsert a setup step (matched by slug).
	 *
	 * @param array $step Step data.
	 * @return int Post ID.
	 */
	private function step( $step ) {
		$slug     = sanitize_title( $step['title'] );
		$existing = get_page_by_path( $slug, OBJECT, 'nab_step' );
		$id       = wp_insert_post(
			array(
				'ID'           => $existing ? $existing->ID : 0,
				'post_type'    => 'nab_step',
				'post_status'  => 'publish',
				'post_name'    => $slug,
				'post_title'   => $step['title'],
				'post_content' => $step['content'],
				'menu_order'   => (int) $step['order'],
			)
		);
		update_post_meta( $id, '_nab_screenshot_criteria', $step['criteria'] );
		update_post_meta( $id, '_nab_checklist', implode( "\n", $step['checklist'] ) );
		update_post_meta( $id, '_nab_why', $step['why'] );
		update_post_meta( $id, '_nab_minutes', (int) $step['minutes'] );
		return (int) $id;
	}

	/**
	 * Upsert a guide/resource article.
	 *
	 * @param array $a Article data.
	 * @return int Post ID.
	 */
	private function article( $a ) {
		$term = term_exists( $a['category'], 'category' );
		if ( ! $term ) {
			$term = wp_insert_term( $a['category'], 'category', array( 'slug' => sanitize_title( $a['category'] ) ) );
		}
		$descriptions = array(
			'Guides'    => 'Long-form guides on building and shipping production AI products with the Claude API.',
			'Resources' => 'Checklists and references you can use on your own AI projects.',
		);
		if ( isset( $descriptions[ $a['category'] ] ) ) {
			wp_update_term( (int) $term['term_id'], 'category', array( 'description' => $descriptions[ $a['category'] ] ) );
		}
		$existing = get_page_by_path( $a['slug'], OBJECT, 'post' );
		$id       = wp_insert_post(
			array(
				'ID'            => $existing ? $existing->ID : 0,
				'post_type'     => 'post',
				'post_status'   => 'publish',
				'post_name'     => $a['slug'],
				'post_title'    => $a['title'],
				'post_excerpt'  => $a['excerpt'],
				'post_content'  => $a['content'],
				'post_category' => array( (int) $term['term_id'] ),
			)
		);
		update_post_meta( $id, '_nab_legacy_path', $a['legacy_path'] );
		return (int) $id;
	}

	/**
	 * Charge installment N of a plan right now instead of waiting for the schedule.
	 *
	 * ## OPTIONS
	 *
	 * <order_id>
	 * : The first-installment order ID.
	 *
	 * <number>
	 * : Installment number to charge (2 or more).
	 *
	 * ## EXAMPLES
	 *
	 *     wp nab charge-installment 123 2
	 *
	 * @subcommand charge-installment
	 * @param array $args Positional args.
	 */
	public function charge_installment( $args ) {
		[ $order_id, $n ] = array_map( 'absint', $args );
		$order            = nab_charge_installment( $order_id, $n );
		if ( ! $order ) {
			WP_CLI::error( 'Nothing charged: not an active installment plan, or no such installment.' );
		}
		WP_CLI::log( sprintf( 'Installment order #%d is %s (%s).', $order->get_id(), $order->get_status(), wc_price( $order->get_total() ) ) );
	}

	/**
	 * Show an installment plan's state.
	 *
	 * ## OPTIONS
	 *
	 * <order_id>
	 * : The first-installment order ID.
	 *
	 * @subcommand plan-status
	 * @param array $args Positional args.
	 */
	public function plan_status( $args ) {
		$order = wc_get_order( absint( $args[0] ) );
		$item  = $order ? nab_order_plan_item( $order ) : null;
		if ( ! $item ) {
			WP_CLI::error( 'Not an installment plan order.' );
		}
		$count = (int) $item->get_meta( '_nab_installments' );
		$rows  = array(
			array(
				'n'      => 1,
				'order'  => $order->get_id(),
				'status' => $order->get_status(),
				'total'  => $order->get_total(),
			),
		);
		for ( $n = 2; $n <= $count; $n++ ) {
			$child  = wc_get_order( (int) $order->get_meta( '_nab_installment_' . $n . '_order' ) );
			$next   = as_next_scheduled_action( 'nab_charge_installment', array( $order->get_id(), $n ), 'nab-installments' );
			$rows[] = array(
				'n'      => $n,
				'order'  => $child ? $child->get_id() : '-',
				'status' => $child ? $child->get_status() : ( $next ? 'scheduled ' . gmdate( 'Y-m-d', $next ) : 'not scheduled' ),
				'total'  => $child ? $child->get_total() : '-',
			);
		}
		WP_CLI::log( 'Plan status: ' . $order->get_meta( '_nab_plan_status' ) );
		WP_CLI\Utils\format_items( 'table', $rows, array( 'n', 'order', 'status', 'total' ) );
	}
}

WP_CLI::add_command( 'nab', 'NAB_Seed_Command' );
