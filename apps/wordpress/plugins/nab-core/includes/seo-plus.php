<?php
/**
 * SEO + GEO fixes from the 2026-10-11 audit:
 *
 * - XML sitemap lists only indexable, canonical 200 pages (no cart, checkout,
 *   account, student-only, WooCommerce product, lesson, author or empty
 *   taxonomy URLs) and adds the /courses/ catalog.
 * - noindex for member-only, transactional and duplicate screens.
 * - Canonical tags for the home page and archives (core only does singulars).
 * - Distinct, keyword-led titles; longer course descriptions.
 * - Richer JSON-LD: WebSite, Organization, FAQPage, Course details,
 *   Person (instructor), Article author/publisher, BreadcrumbList.
 * - Security headers; old-site URL redirects.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Pages that are transactional or member-only and never belong in search.
 *
 * @return string[] Page slugs.
 */
function nab_private_page_slugs() {
	return array( 'cart', 'cart-2', 'checkout', 'checkout-2', 'my-account', 'dashboard', 'student-registration', 'instructor-registration', 'setup', 'sign-in', 'shop', 'refund_returns' );
}

/**
 * Whether the current request should be kept out of search results.
 *
 * @return bool
 */
function nab_should_noindex() {
	if ( is_search() || is_author() || is_404() ) {
		return true;
	}
	if ( is_singular( array( 'lesson', 'tutor_quiz', 'tutor_assignments', 'product' ) ) || is_tax( array( 'product_cat', 'product_tag' ) ) ) {
		return true;
	}
	if ( is_page( nab_private_page_slugs() ) ) {
		return true;
	}
	// Free-preview, certificate, notification and student screens are PHP routes.
	$path = (string) wp_parse_url( isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '', PHP_URL_PATH );
	return (bool) preg_match( '#/(preview/\d+|certificates|notifications|live-sessions|book-a-call|verify)/#', $path );
}

add_filter(
	'wp_robots',
	static function ( $robots ) {
		if ( nab_should_noindex() ) {
			$robots['noindex'] = true;
			$robots['follow']  = true;
			unset( $robots['max-image-preview'] );
		}
		return $robots;
	}
);

/* ---------------- Sitemap ---------------- */

add_filter(
	'wp_sitemaps_add_provider',
	static fn( $provider, $name ) => 'users' === $name ? false : $provider,
	10,
	2
);

add_filter(
	'wp_sitemaps_post_types',
	static function ( $types ) {
		foreach ( array( 'product', 'lesson', 'tutor_quiz', 'tutor_assignments', 'attachment', 'nab_session', 'nab_call' ) as $t ) {
			unset( $types[ $t ] );
		}
		return $types;
	}
);

add_filter(
	'wp_sitemaps_taxonomies',
	static function ( $taxonomies ) {
		return array_intersect_key( $taxonomies, array( 'category' => true ) );
	}
);

add_filter(
	'wp_sitemaps_posts_query_args',
	static function ( $args, $post_type ) {
		if ( 'page' === $post_type ) {
			$ids = array();
			foreach ( nab_private_page_slugs() as $slug ) {
				$p = get_page_by_path( $slug );
				if ( $p ) {
					$ids[] = $p->ID;
				}
			}
			$args['post__not_in'] = array_merge( (array) ( $args['post__not_in'] ?? array() ), $ids );
		}
		return $args;
	},
	10,
	2
);

// Category archives: only Guides and Resources (they have their own URLs).
add_filter(
	'wp_sitemaps_taxonomies_query_args',
	static function ( $args, $taxonomy ) {
		if ( 'category' === $taxonomy && function_exists( 'nab_root_categories' ) ) {
			$args['slug'] = nab_root_categories();
		}
		return $args;
	},
	10,
	2
);

// The course catalog is a post type archive, which core sitemaps skip.
add_filter(
	'wp_sitemaps_posts_entry',
	static function ( $entry, $post ) {
		if ( 'courses' === $post->post_type ) {
			$entry['lastmod'] = get_post_modified_time( 'c', true, $post );
		}
		return $entry;
	},
	10,
	2
);
add_action(
	'init',
	static function () {
		if ( ! class_exists( 'WP_Sitemaps_Provider' ) ) {
			return;
		}
		$provider = new class() extends WP_Sitemaps_Provider {
			/** Constructor. */
			public function __construct() {
				$this->name        = 'nab';
				$this->object_type = 'nab';
			}
			/**
			 * URLs.
			 *
			 * @param int    $page_num Page.
			 * @param string $subtype  Unused.
			 * @return array
			 */
			public function get_url_list( $page_num, $subtype = '' ) {
				return 1 === (int) $page_num ? array( array( 'loc' => get_post_type_archive_link( 'courses' ) ) ) : array();
			}
			/**
			 * Pages.
			 *
			 * @param string $subtype Unused.
			 * @return int
			 */
			public function get_max_num_pages( $subtype = '' ) {
				return 1;
			}
		};
		wp_register_sitemap_provider( 'nab', $provider );
	},
	20
);

// Old sitemap URL from the previous site.
add_action(
	'template_redirect',
	static function () {
		$path = (string) wp_parse_url( isset( $_SERVER['REQUEST_URI'] ) ? esc_url_raw( wp_unslash( $_SERVER['REQUEST_URI'] ) ) : '', PHP_URL_PATH );
		$map  = array(
			'/sitemap.xml'  => '/wp-sitemap.xml',
			'/login'        => '/sign-in/',
			'/signin'       => '/sign-in/',
			'/register'     => '/courses/',
			'/signup'       => '/courses/',
			'/cohorts'      => '/courses/?format=live',
			'/pricing'      => '/#pricing',
			'/curriculum'   => '/#curriculum',
		);
		// Old static guide URLs (/guides/slug.html) still resolve, so send them to the canonical slug.
		if ( preg_match( '#^/(guides|resources)/([a-z0-9-]+)\.html$#', $path, $m ) ) {
			wp_safe_redirect( home_url( '/' . $m[1] . '/' . $m[2] . '/' ), 301 );
			exit;
		}
		$key  = untrailingslashit( $path );
		if ( isset( $map[ $key ] ) && is_404() ) {
			wp_safe_redirect( home_url( $map[ $key ] ), 301 );
			exit;
		}
	},
	1
);

/* ---------------- Canonicals ---------------- */

add_action(
	'wp_head',
	static function () {
		if ( is_singular() || nab_should_noindex() ) {
			return; // Core prints singular canonicals.
		}
		$url = '';
		if ( is_front_page() ) {
			$url = home_url( '/' );
		} elseif ( is_post_type_archive( 'courses' ) ) {
			$url = get_post_type_archive_link( 'courses' ); // ?format= filters collapse into the catalog.
		} elseif ( is_category() ) {
			$url = get_term_link( get_queried_object() );
			$paged = (int) get_query_var( 'paged' );
			$url   = $paged > 1 ? trailingslashit( $url ) . 'page/' . $paged . '/' : $url;
		}
		if ( $url && ! is_wp_error( $url ) ) {
			printf( '<link rel="canonical" href="%s" />' . "\n", esc_url( $url ) );
		}
	},
	1
);

/* ---------------- Titles and descriptions ---------------- */

add_filter(
	'document_title_parts',
	static function ( $parts ) {
		if ( is_front_page() ) {
			return array( 'title' => __( 'Claude AI Course: Build & Ship AI Products', 'nab-core' ), 'site' => 'nextaibuilder' );
		}
		if ( is_post_type_archive( 'courses' ) ) {
			$parts['title'] = __( 'AI Product & Claude API Courses', 'nab-core' );
		}
		if ( is_category( 'guides' ) ) {
			$parts['title'] = __( 'Guides to Building AI Products with Claude', 'nab-core' );
		}
		if ( is_category( 'resources' ) ) {
			$parts['title'] = __( 'Free Claude API Checklists & Resources', 'nab-core' );
		}
		if ( is_singular( 'courses' ) && function_exists( 'nab_course_format' ) ) {
			$label          = 'recorded' === nab_course_format( get_the_ID() ) ? __( 'Self-Paced', 'nab-core' ) : __( 'Live Cohort', 'nab-core' );
			$parts['title'] = get_the_title() . ' (' . $label . ')';
			unset( $parts['site'] ); // Long course names would push the brand past the cut-off.
		}
		return $parts;
	},
	20
);

add_filter( 'document_title_separator', static fn() => '–' );

/**
 * Richer description for course pages and archives (overrides nab_meta_description
 * through its filter-less fallbacks by wrapping it).
 *
 * @param string $desc Description.
 * @return string
 */
function nab_seo_description( $desc ) {
	if ( is_singular( 'courses' ) && function_exists( 'nab_get_course' ) ) {
		$c     = nab_get_course( get_the_ID() );
		$live  = 'recorded' !== $c['format'];
		$bits  = array( rtrim( $c['tagline'] ? $c['tagline'] : get_the_title(), '.' ) . '.' );
		$bits[] = $live ? __( 'Live online cohort with weekly instructor sessions, recordings and AI-checked setup.', 'nab-core' ) : __( 'Self-paced video course with lifetime access and AI-checked setup.', 'nab-core' );
		if ( $c['price'] ) {
			/* translators: %s: price. */
			$bits[] = sprintf( __( '%s, or 3 monthly payments.', 'nab-core' ), nab_money( $c['price'] ) );
		}
		return wp_html_excerpt( implode( ' ', $bits ), 158, '…' );
	}
	if ( is_category( 'resources' ) ) {
		return __( 'Free checklists and references for building with the Claude API: prompt debugging, evals, agents and shipping AI features to production.', 'nab-core' );
	}
	if ( is_category( 'guides' ) ) {
		return __( 'Long-form, practical guides on building and shipping production AI products with the Claude API: architecture, evals, cost control and agents.', 'nab-core' );
	}
	if ( is_page( 'apply' ) ) {
		return __( 'Apply to the nextaibuilder Agentic AI Engineer program. Choose a 6-month or 1-year track; we review every application and reply within two working days.', 'nab-core' );
	}
	return $desc;
}

/* ---------------- Structured data ---------------- */

/**
 * FAQ shown on the home page (also used by the FAQ pattern).
 *
 * @return array<int, array{0:string,1:string}>
 */
function nab_faq_items() {
	return array(
		array( 'What is the difference between recorded and live cohorts?', 'Recorded courses are self-paced: watch the video lessons any time and rewatch as often as you like. Live cohorts run on a fixed schedule with real-time instructor sessions, Q&A and peer collaboration. Both follow the same curriculum.' ),
		array( 'Can I pay in installments?', 'Yes. Every course offers a 3-installment plan at no extra cost. The first payment is taken at checkout and the other two 30 and 60 days later.' ),
		array( 'Can I pay by bank transfer?', 'Yes. Choose bank transfer at checkout and upload your payment receipt. We confirm it and activate your enrollment, usually within one business day.' ),
		array( 'Do I get lifetime access to course materials?', 'Yes. Once enrolled you keep access to all course materials, including updates to the curriculum.' ),
		array( 'What if I miss a live session?', 'Every live session is recorded and posted to your student dashboard within 24 hours.' ),
		array( 'What tools do I need to get started?', 'A computer and an internet connection. The guided setup steps walk you through installing everything else, and our AI checks each step from a screenshot.' ),
		array( 'Is there a refund policy?', 'Yes. You get a full refund within 2 weeks of the cohort start date, no questions asked. See the refund policy page for details.' ),
	);
}

/**
 * The instructor as a schema.org Person.
 *
 * @return array
 */
function nab_instructor_schema() {
	$u      = function_exists( 'nab_instructor_user' ) ? nab_instructor_user() : null;
	$person = array(
		'@type'    => 'Person',
		'@id'      => home_url( '/about/#instructor' ),
		'name'     => $u ? $u->display_name : 'Aleem Haider',
		'jobTitle' => $u ? (string) get_user_meta( $u->ID, '_tutor_profile_job_title', true ) : 'Founder & Lead Instructor',
		'url'      => home_url( '/about/' ),
		'worksFor' => array( '@id' => home_url( '/#organization' ) ),
	);
	$same = array();
	foreach ( array( 'linkedin', 'twitter', 'github', 'website' ) as $k ) {
		$v = $u ? (string) get_user_meta( $u->ID, '_tutor_profile_' . $k, true ) : '';
		if ( $v && wp_http_validate_url( $v ) ) {
			$same[] = $v;
		}
	}
	if ( $same ) {
		$person['sameAs'] = $same;
	}
	return array_filter( $person );
}

/**
 * Breadcrumb list from [name => url] pairs.
 *
 * @param array $items Items.
 * @return array
 */
function nab_breadcrumbs( $items ) {
	$list = array();
	$i    = 0;
	foreach ( $items as $name => $url ) {
		$list[] = array( '@type' => 'ListItem', 'position' => ++$i, 'name' => $name, 'item' => $url );
	}
	return array( '@type' => 'BreadcrumbList', 'itemListElement' => $list );
}

add_action(
	'wp_head',
	static function () {
		if ( nab_should_noindex() ) {
			return;
		}
		$org   = home_url( '/#organization' );
		$graph = array();
		if ( is_front_page() ) {
			$graph[] = array(
				'@type'     => 'WebSite',
				'@id'       => home_url( '/#website' ),
				'url'       => home_url( '/' ),
				'name'      => 'nextaibuilder',
				'publisher' => array( '@id' => $org ),
				'inLanguage' => 'en',
			);
			$graph[] = array(
				'@type'      => 'FAQPage',
				'mainEntity' => array_map(
					static fn( $q ) => array( '@type' => 'Question', 'name' => $q[0], 'acceptedAnswer' => array( '@type' => 'Answer', 'text' => $q[1] ) ),
					nab_faq_items()
				),
			);
			$graph[] = nab_instructor_schema();
		}
		if ( is_page( 'about' ) ) {
			$graph[] = array( '@type' => 'AboutPage', 'url' => get_permalink(), 'name' => get_the_title(), 'about' => array( '@id' => $org ) );
			$graph[] = nab_instructor_schema();
		}
		if ( is_singular( 'courses' ) ) {
			$graph[] = nab_breadcrumbs( array( __( 'Home', 'nab-core' ) => home_url( '/' ), __( 'Courses', 'nab-core' ) => get_post_type_archive_link( 'courses' ), get_the_title() => get_permalink() ) );
		}
		if ( is_singular( 'post' ) ) {
			$cats = get_the_category();
			$sec  = $cats ? $cats[0] : null;
			$crumbs = array( __( 'Home', 'nab-core' ) => home_url( '/' ) );
			if ( $sec ) {
				$crumbs[ $sec->name ] = get_term_link( $sec );
			}
			$crumbs[ get_the_title() ] = get_permalink();
			$graph[] = nab_breadcrumbs( $crumbs );
		}
		if ( $graph ) {
			printf( '<script type="application/ld+json">%s</script>' . "\n", wp_json_encode( array( '@context' => 'https://schema.org', '@graph' => $graph ), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_HEX_TAG ) );
		}
	},
	4
);

/**
 * Enrich the JSON-LD that seo.php prints (Organization, Course, Article).
 *
 * @param array $graph Graph nodes.
 * @return array
 */
function nab_enrich_graph( $graph ) {
	foreach ( $graph as &$node ) {
		$type = $node['@type'] ?? '';
		if ( 'EducationalOrganization' === $type ) {
			$node['@id']   = home_url( '/#organization' );
			$node['logo']  = array( '@type' => 'ImageObject', 'url' => get_theme_file_uri( 'assets/images/icon-512.png' ), 'width' => 512, 'height' => 512 );
			$node['image'] = get_theme_file_uri( 'assets/images/og-image.png' );
			$node['email'] = (string) get_option( 'admin_email' );
			$node['founder'] = array( '@id' => home_url( '/about/#instructor' ) );
			$node['knowsAbout'] = array( 'Claude API', 'Claude Code', 'AI agents', 'Model Context Protocol', 'Prompt engineering', 'LLM evaluation', 'AI product development' );
		}
		if ( 'Course' === $type && function_exists( 'nab_get_course' ) ) {
			$c = nab_get_course( get_the_ID() );
			$node['provider'] = array( '@id' => home_url( '/#organization' ), '@type' => 'EducationalOrganization', 'name' => 'nextaibuilder', 'url' => home_url( '/' ) );
			$node['inLanguage'] = 'en';
			$node['image']      = $c['image'] ? $c['image'] : ( function_exists( 'nab_course_cover' ) && nab_course_cover( $c ) ? nab_course_cover( $c ) : get_theme_file_uri( 'assets/images/og-image.png' ) );
			$node['educationalLevel'] = 'Intermediate';
			$node['teaches']    = $c['outcomes'] ? array_values( $c['outcomes'] ) : null;
			$node['syllabusSections'] = array_map(
				static fn( $m ) => array( '@type' => 'Syllabus', 'name' => $m['title'], 'description' => implode( '; ', array_column( $m['lessons'], 'title' ) ) ),
				$c['modules']
			);
			$node['numberOfCredits'] = null;
			if ( isset( $node['offers'] ) ) {
				$node['offers']['availability'] = empty( $c['availability']['sold_out'] ) ? 'https://schema.org/InStock' : 'https://schema.org/SoldOut';
			}
			$live = 'recorded' !== $c['format'];
			$inst = array_merge(
				(array) ( $node['hasCourseInstance'] ?? array() ),
				array(
					'@type'          => 'CourseInstance',
					'courseMode'     => 'Online',
					'courseWorkload' => $c['hours'] ? 'PT' . $c['hours'] . 'H' : 'PT30H',
					'instructor'     => nab_instructor_schema(),
				)
			);
			if ( $live ) {
				$inst['courseSchedule'] = array( '@type' => 'Schedule', 'repeatFrequency' => 'P1W', 'repeatCount' => max( 1, count( $c['modules'] ) ) );
			}
			$node['hasCourseInstance'] = $inst;
			$node = array_filter( $node, static fn( $v ) => null !== $v );
		}
		if ( 'Article' === $type ) {
			$node['author']    = nab_instructor_schema();
			$node['publisher'] = array( '@id' => home_url( '/#organization' ), '@type' => 'Organization', 'name' => 'nextaibuilder', 'logo' => array( '@type' => 'ImageObject', 'url' => get_theme_file_uri( 'assets/images/icon-512.png' ) ) );
			$node['image']     = has_post_thumbnail() ? get_the_post_thumbnail_url( null, 'large' ) : get_theme_file_uri( 'assets/images/og-image.png' );
			$node['mainEntityOfPage'] = get_permalink();
			$node['inLanguage'] = 'en';
		}
	}
	return $graph;
}

/* ---------------- Security headers ---------------- */

add_action(
	'send_headers',
	static function () {
		if ( headers_sent() ) {
			return;
		}
		header_remove( 'X-Powered-By' );
		header( 'Strict-Transport-Security: max-age=31536000' );
		header( 'X-Content-Type-Options: nosniff' );
		header( 'Referrer-Policy: strict-origin-when-cross-origin' );
		header( 'X-Frame-Options: SAMEORIGIN' );
		header( 'Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()' );
	}
);

// XML-RPC isn't used (no Jetpack/app publishing) and is a brute-force target.
add_filter( 'xmlrpc_enabled', '__return_false' );

/* ---------------- Front-end weight ---------------- */

/**
 * Marketing pages render entirely with the theme; Tutor and WooCommerce
 * front-end assets (≈160 KB incl. React and jQuery UI) are only needed on
 * the cart, checkout, account, dashboard and lesson screens.
 *
 * @return bool
 */
function nab_is_marketing_page() {
	if ( is_admin() || is_user_logged_in() ) {
		return false; // Signed-in people get Tutor's header widgets and dashboards.
	}
	return is_front_page() || is_singular( array( 'post', 'courses' ) ) || is_post_type_archive( 'courses' ) || is_category() || is_page( array( 'about', 'apply', 'refund-policy' ) );
}

add_action(
	'wp_enqueue_scripts',
	static function () {
		if ( ! nab_is_marketing_page() ) {
			return;
		}
		foreach ( array( 'tutor-icon', 'tutor', 'tutor-plyr', 'tutor-frontend', 'tutor-cart-button', 'woocommerce-layout', 'woocommerce-smallscreen', 'woocommerce-general', 'woocommerce-blocktheme', 'wc-blocks-style' ) as $h ) {
			wp_dequeue_style( $h );
		}
		foreach ( array( 'tutor-script', 'tutor-frontend', 'tutor-plyr', 'tutor-social-share', 'wc-add-to-cart', 'woocommerce', 'wc-js-cookie', 'wc-jquery-blockui', 'jquery-ui-sortable', 'jquery-touch-punch' ) as $h ) {
			wp_dequeue_script( $h );
		}
	},
	100
);
