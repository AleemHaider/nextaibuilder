<?php
/**
 * Promotions and availability, as on the old platform:
 * - Seats: a cohort with "Seats per cohort" shows seats left (≤ 10) and sells
 *   out when active + pending enrollments reach the limit.
 * - Founding price: with a "Regular price" and "Founding seats", the course sells
 *   at its normal (lower) price for the first N enrollments, showing the regular
 *   price struck through; afterwards it sells at the regular price.
 * - Flash offer: X% off for N hours per visitor (Settings → nextaibuilder),
 *   with a countdown bar; applied at checkout as a discount line.
 * - Coupons: WooCommerce coupons (a 100% coupon = free enrollment).
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Active + pending enrollments in a course.
 *
 * @param int $course_id Course.
 * @return int
 */
function nab_enrolled_count( $course_id ) {
	global $wpdb;
	return (int) $wpdb->get_var( $wpdb->prepare( "SELECT COUNT(*) FROM {$wpdb->posts} WHERE post_type = 'tutor_enrolled' AND post_parent = %d AND post_status IN ('completed','pending','on-hold','processing')", $course_id ) ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
}

/**
 * Seat and founding-price facts for a course.
 *
 * @param int $course_id Course.
 * @return array{seats_left:?int, sold_out:bool, regular:float, founding_left:int}
 */
function nab_course_availability( $course_id ) {
	$taken    = nab_enrolled_count( $course_id );
	$seats    = (int) get_post_meta( $course_id, '_nab_seats', true );
	$regular  = (float) get_post_meta( $course_id, '_nab_regular_price', true );
	$founding = (int) get_post_meta( $course_id, '_nab_founding_seats', true );
	return array(
		'seats_left'    => $seats ? max( 0, $seats - $taken ) : null,
		'sold_out'      => $seats && $taken >= $seats,
		'regular'       => $regular,
		'founding_left' => ( $regular && $founding ) ? max( 0, $founding - $taken ) : 0,
	);
}

// After founding seats are gone, sell at the regular price.
$nab_price_filter = static function ( $price, $product ) {
	static $map = null;
	if ( null === $map ) {
		$map = array();
		foreach ( get_posts( array( 'post_type' => 'courses', 'posts_per_page' => -1, 'fields' => 'ids', 'meta_key' => '_nab_regular_price', 'meta_compare' => 'EXISTS' ) ) as $cid ) { // phpcs:ignore WordPress.DB.SlowDBQuery
			$map[ (int) get_post_meta( $cid, '_tutor_course_product_id', true ) ] = $cid;
		}
	}
	// The cart sets installment amounts with set_price(); leave those alone.
	if ( array_key_exists( 'price', $product->get_changes() ) ) {
		return $price;
	}
	$cid = $map[ $product->get_id() ] ?? 0;
	if ( $cid ) {
		$a = nab_course_availability( $cid );
		if ( $a['regular'] && ! $a['founding_left'] ) {
			return (string) $a['regular'];
		}
	}
	return $price;
};
add_filter( 'woocommerce_product_get_price', $nab_price_filter, 5, 2 );
add_filter( 'woocommerce_product_get_regular_price', $nab_price_filter, 5, 2 );

// Sold-out cohorts can't be bought.
add_filter(
	'woocommerce_add_to_cart_validation',
	static function ( $passed, $product_id ) {
		$cid = nab_course_id_for_product( $product_id );
		if ( $passed && $cid && nab_course_availability( $cid )['sold_out'] ) {
			wc_add_notice( __( 'This cohort is sold out. Join the waitlist by emailing us, or pick another course.', 'nab-core' ), 'error' );
			return false;
		}
		return $passed;
	},
	2,
	2
);

/* ---------------- Flash offer ---------------- */

/**
 * Flash offer settings.
 *
 * @return array{percent:int,hours:int}
 */
function nab_flash_settings() {
	return array(
		'percent' => (int) get_option( 'nab_flash_percent', 0 ),
		'hours'   => max( 1, (int) get_option( 'nab_flash_hours', 2 ) ),
	);
}

/**
 * Seconds left in this visitor's flash window (0 = none).
 *
 * @return int
 */
function nab_flash_seconds_left() {
	$s = nab_flash_settings();
	if ( $s['percent'] <= 0 ) {
		return 0;
	}
	$raw = isset( $_COOKIE['nab_promo'] ) ? sanitize_text_field( wp_unslash( $_COOKIE['nab_promo'] ) ) : '';
	[ $start, $sig ] = array_pad( explode( '.', $raw, 2 ), 2, '' );
	if ( ! $start || ! hash_equals( wp_hash( 'nab_promo' . $start ), $sig ) ) {
		return 0;
	}
	return max( 0, (int) $start + $s['hours'] * HOUR_IN_SECONDS - time() );
}

// Start the window on a visitor's first page view.
add_action(
	'template_redirect',
	static function () {
		if ( nab_flash_settings()['percent'] <= 0 || is_admin() || isset( $_COOKIE['nab_promo'] ) || headers_sent() ) {
			return;
		}
		$start = (string) time();
		$value = $start . '.' . wp_hash( 'nab_promo' . $start );
		setcookie( 'nab_promo', $value, array( 'expires' => time() + 30 * DAY_IN_SECONDS, 'path' => COOKIEPATH, 'secure' => is_ssl(), 'httponly' => true, 'samesite' => 'Lax' ) );
		$_COOKIE['nab_promo'] = $value;
	},
	0
);

// Countdown bar.
add_action(
	'wp_body_open',
	static function () {
		$left = nab_flash_seconds_left();
		if ( ! $left ) {
			return;
		}
		$pct = nab_flash_settings()['percent'];
		/* translators: %d: percent. */
		echo '<div class="nab-flash" role="status"><b>' . esc_html( sprintf( __( '%d%% off any course', 'nab-core' ), $pct ) ) . '</b> <span>' . esc_html__( 'Offer ends in', 'nab-core' ) . ' <time data-left="' . (int) $left . '">' . esc_html( gmdate( 'H:i:s', $left ) ) . '</time></span> <a href="' . esc_url( get_post_type_archive_link( 'courses' ) ) . '">' . esc_html__( 'See courses', 'nab-core' ) . '</a></div>';
		echo '<script>(function(){var t=document.querySelector(".nab-flash time"),s=+t.dataset.left,e=Date.now()+s*1e3;setInterval(function(){var l=Math.max(0,Math.round((e-Date.now())/1e3));t.textContent=[l/3600|0,(l%3600)/60|0,l%60].map(function(n){return String(n).padStart(2,"0")}).join(":");if(!l)t.closest(".nab-flash").remove();},1000);})();</script>';
	},
	5
);

// Discount line at checkout while the window is open.
add_action(
	'woocommerce_cart_calculate_fees',
	static function ( $cart ) {
		$left = nab_flash_seconds_left();
		if ( ! $left ) {
			return;
		}
		$pct = nab_flash_settings()['percent'];
		$sub = (float) $cart->get_subtotal();
		if ( $sub > 0 ) {
			/* translators: %d: percent. */
			$cart->add_fee( sprintf( __( 'Flash offer (%d%% off)', 'nab-core' ), $pct ), -round( $sub * $pct / 100, 2 ), false );
		}
	}
);

/* ---------------- Settings ---------------- */

add_action(
	'admin_init',
	static function () {
		register_setting( 'nab_sign_in', 'nab_flash_percent', array( 'type' => 'integer', 'sanitize_callback' => static fn( $v ) => max( 0, min( 90, absint( $v ) ) ) ) );
		register_setting( 'nab_sign_in', 'nab_flash_hours', array( 'type' => 'integer', 'sanitize_callback' => static fn( $v ) => max( 1, min( 72, absint( $v ) ) ) ) );
		add_settings_section( 'nab_promos', __( 'Flash offer', 'nab-core' ), static fn() => print( '<p>' . esc_html__( 'Give each new visitor a time-limited discount with a countdown bar. 0% turns it off.', 'nab-core' ) . '</p>' ), 'nab-sign-in' );
		add_settings_field( 'nab_flash_percent', __( 'Discount (%)', 'nab-core' ), static fn() => printf( '<input type="number" min="0" max="90" name="nab_flash_percent" value="%d" />', (int) get_option( 'nab_flash_percent', 0 ) ), 'nab-sign-in', 'nab_promos' );
		add_settings_field( 'nab_flash_hours', __( 'Window (hours)', 'nab-core' ), static fn() => printf( '<input type="number" min="1" max="72" name="nab_flash_hours" value="%d" />', (int) get_option( 'nab_flash_hours', 2 ) ), 'nab-sign-in', 'nab_promos' );
	}
);
