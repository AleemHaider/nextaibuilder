<?php
/**
 * Extra course fields Tutor LMS doesn't have: format, tagline, cohort dates,
 * installment plan. Edited in a sidebar box on the course screen.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

/**
 * Field definitions: meta key => [label, type, description].
 *
 * @return array<string, array{0:string,1:string,2:string}>
 */
function nab_course_fields() {
	return array(
		'_nab_format'            => array( __( 'Format', 'nab-core' ), 'format', '' ),
		'_nab_tagline'           => array( __( 'Tagline', 'nab-core' ), 'text', __( 'One line shown on course cards.', 'nab-core' ) ),
		'_nab_start_date'        => array( __( 'Cohort start date', 'nab-core' ), 'date', __( 'Live and combined cohorts only.', 'nab-core' ) ),
		'_nab_end_date'          => array( __( 'Cohort end date', 'nab-core' ), 'date', __( 'After this date the cohort is closed for enrollment.', 'nab-core' ) ),
		'_nab_schedule'          => array( __( 'Schedule', 'nab-core' ), 'text', __( 'e.g. "Tuesdays and Thursdays, 6–9pm ET".', 'nab-core' ) ),
		'_nab_seats'             => array( __( 'Seats per cohort', 'nab-core' ), 'number', __( 'Leave empty for unlimited.', 'nab-core' ) ),
		'_nab_regular_price'     => array( __( 'Regular price (founding offer)', 'nab-core' ), 'number', __( 'Set with Founding seats: the course sells at its normal price for the first N students, then at this price.', 'nab-core' ) ),
		'_nab_founding_seats'    => array( __( 'Founding seats', 'nab-core' ), 'number', '' ),
		'_nab_installment_count' => array( __( 'Installments', 'nab-core' ), 'number', __( 'Number of monthly payments. 0 disables the plan.', 'nab-core' ) ),
		'_nab_refund_policy'     => array( __( 'Refund policy line', 'nab-core' ), 'text', '' ),
	);
}

/**
 * Course formats and their display labels.
 *
 * @return array<string, string>
 */
function nab_course_formats() {
	return array(
		'recorded' => __( 'Recorded', 'nab-core' ),
		'live'     => __( 'Live cohort', 'nab-core' ),
		'combined' => __( 'Combined', 'nab-core' ),
	);
}

/**
 * Register the fields so they're available over REST and sanitized.
 */
function nab_register_course_meta() {
	foreach ( nab_course_fields() as $key => $field ) {
		$is_number = 'number' === $field[1];
		register_post_meta(
			'courses',
			$key,
			array(
				'type'              => $is_number ? 'integer' : 'string',
				'single'            => true,
				'show_in_rest'      => true,
				'sanitize_callback' => $is_number ? 'absint' : 'sanitize_text_field',
				'auth_callback'     => static fn() => current_user_can( 'edit_posts' ),
			)
		);
	}
}
add_action( 'init', 'nab_register_course_meta' );

/**
 * Sidebar box on the course edit screen.
 */
function nab_add_course_meta_box() {
	add_meta_box( 'nab-course-details', __( 'nextaibuilder details', 'nab-core' ), 'nab_render_course_meta_box', 'courses', 'side', 'high' );
}
add_action( 'add_meta_boxes', 'nab_add_course_meta_box' );

/**
 * Render the course details box.
 *
 * @param WP_Post $post Course.
 */
function nab_render_course_meta_box( $post ) {
	wp_nonce_field( 'nab_course_meta', 'nab_course_meta_nonce' );
	foreach ( nab_course_fields() as $key => $field ) {
		[ $label, $type, $help ] = $field;
		$value = get_post_meta( $post->ID, $key, true );
		$id    = 'nab' . $key;
		echo '<p><label for="' . esc_attr( $id ) . '"><strong>' . esc_html( $label ) . '</strong></label><br />';
		if ( 'format' === $type ) {
			echo '<select id="' . esc_attr( $id ) . '" name="' . esc_attr( $key ) . '" class="widefat">';
			foreach ( nab_course_formats() as $slug => $name ) {
				echo '<option value="' . esc_attr( $slug ) . '"' . selected( $value ? $value : 'recorded', $slug, false ) . '>' . esc_html( $name ) . '</option>';
			}
			echo '</select>';
		} else {
			$input_type = 'number' === $type ? 'number' : ( 'date' === $type ? 'date' : 'text' );
			echo '<input type="' . esc_attr( $input_type ) . '" id="' . esc_attr( $id ) . '" name="' . esc_attr( $key ) . '" value="' . esc_attr( $value ) . '" class="widefat" min="0" />';
		}
		if ( $help ) {
			echo '<span class="description">' . esc_html( $help ) . '</span>';
		}
		echo '</p>';
	}
}

/**
 * Save the course details box.
 *
 * @param int $post_id Course ID.
 */
function nab_save_course_meta( $post_id ) {
	if ( ! isset( $_POST['nab_course_meta_nonce'] ) || ! wp_verify_nonce( sanitize_key( $_POST['nab_course_meta_nonce'] ), 'nab_course_meta' ) ) {
		return;
	}
	if ( ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) || ! current_user_can( 'edit_post', $post_id ) ) {
		return;
	}
	foreach ( nab_course_fields() as $key => $field ) {
		if ( ! isset( $_POST[ $key ] ) ) {
			continue;
		}
		$raw = wp_unslash( $_POST[ $key ] ); // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- sanitized per type below.
		if ( 'number' === $field[1] ) {
			'' === $raw ? delete_post_meta( $post_id, $key ) : update_post_meta( $post_id, $key, absint( $raw ) );
		} elseif ( 'format' === $field[1] ) {
			$format = sanitize_key( $raw );
			update_post_meta( $post_id, $key, array_key_exists( $format, nab_course_formats() ) ? $format : 'recorded' );
		} else {
			update_post_meta( $post_id, $key, sanitize_text_field( $raw ) );
		}
	}
}
add_action( 'save_post_courses', 'nab_save_course_meta' );
