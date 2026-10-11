<?php
/**
 * Lean checkout for online courses: name, email and country only. Card
 * details (incl. ZIP) are collected by Stripe's own card field.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Address fields a course purchase doesn't need.
 *
 * @return string[]
 */
function nab_hidden_checkout_fields() {
	return array( 'company', 'address_1', 'address_2', 'city', 'state', 'postcode' );
}

/**
 * Hide and un-require those fields (works for both block and classic checkout).
 *
 * @param array $fields Locale field settings.
 * @return array
 */
function nab_hide_address_fields_default( $fields ) {
	foreach ( nab_hidden_checkout_fields() as $key ) {
		$fields[ $key ]['required'] = false;
		$fields[ $key ]['hidden']   = true;
	}
	return $fields;
}
add_filter( 'woocommerce_get_country_locale_default', 'nab_hide_address_fields_default' );

/**
 * Same per country, since country locales override the default.
 *
 * @param array $locales Per-country settings.
 * @return array
 */
function nab_hide_address_fields_locales( $locales ) {
	foreach ( $locales as $country => $fields ) {
		$locales[ $country ] = nab_hide_address_fields_default( (array) $fields );
	}
	return $locales;
}
add_filter( 'woocommerce_get_country_locale', 'nab_hide_address_fields_locales' );

/**
 * Classic checkout fallback.
 *
 * @param array $fields Billing fields.
 * @return array
 */
function nab_classic_billing_fields( $fields ) {
	foreach ( nab_hidden_checkout_fields() as $key ) {
		unset( $fields[ 'billing_' . $key ] );
	}
	unset( $fields['billing_phone'] );
	return $fields;
}
add_filter( 'woocommerce_billing_fields', 'nab_classic_billing_fields' );

/**
 * Don't sell a course to someone already enrolled in it.
 *
 * @param bool $passed     Validation result.
 * @param int  $product_id Product being added.
 * @return bool
 */
function nab_block_repeat_purchase( $passed, $product_id ) {
	$course_id = function_exists( 'nab_course_id_for_product' ) ? nab_course_id_for_product( $product_id ) : 0;
	if ( $passed && $course_id && nab_course_has_ended( $course_id ) ) {
		if ( isset( $_GET['add-to-cart'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification -- read-only redirect.
			wp_safe_redirect( get_permalink( $course_id ) );
			exit;
		}
		wc_add_notice( __( 'This cohort has ended and is closed for enrollment.', 'nab-core' ), 'error' );
		return false;
	}
	if ( $passed && $course_id && nab_user_enrolled( $course_id ) ) {
		// Add-to-cart links (GET): go back to the course page, which shows "You are enrolled".
		if ( isset( $_GET['add-to-cart'] ) ) { // phpcs:ignore WordPress.Security.NonceVerification -- read-only redirect.
			wp_safe_redirect( get_permalink( $course_id ) );
			exit;
		}
		wc_add_notice(
			sprintf(
				/* translators: %s: link to the student's courses. */
				__( 'You’re already enrolled in this course. %s', 'nab-core' ),
				'<a href="' . esc_url( tutor_utils()->get_tutor_dashboard_page_permalink( 'enrolled-courses' ) ) . '">' . esc_html__( 'Go to my courses', 'nab-core' ) . '</a>'
			),
			'notice'
		);
		return false;
	}
	return $passed;
}
add_filter( 'woocommerce_add_to_cart_validation', 'nab_block_repeat_purchase', 1, 2 );

/**
 * There's no cart step for single-course purchases: an empty cart sends people
 * to the catalog, a full one straight to checkout.
 */
function nab_skip_cart_page() {
	if ( function_exists( 'is_cart' ) && is_cart() && WC()->cart ) {
		wp_safe_redirect( WC()->cart->is_empty() ? get_post_type_archive_link( 'courses' ) : wc_get_checkout_url() );
		exit;
	}
}
add_action( 'template_redirect', 'nab_skip_cart_page' );
