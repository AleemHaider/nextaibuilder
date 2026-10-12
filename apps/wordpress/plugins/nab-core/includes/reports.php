<?php
/**
 * Dashboard → Reports: course completion and progress, setup-step pass rates,
 * submissions per day (last 30 days), and how often the AI's screenshot verdict
 * matched the admin's decision. Revenue lives in WooCommerce → Analytics.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'admin_menu',
	static function () {
		add_submenu_page( 'index.php', __( 'Reports', 'nab-core' ), __( 'Reports', 'nab-core' ), 'nab_view_reports', 'nab-reports', 'nab_render_reports' );
	}
);

/**
 * Reports page.
 */
function nab_render_reports() {
	global $wpdb;
	echo '<div class="wrap"><h1>' . esc_html__( 'Reports', 'nab-core' ) . '</h1><p><a href="' . esc_url( admin_url( 'admin.php?page=wc-admin&path=/analytics/revenue' ) ) . '">' . esc_html__( 'Revenue and orders are in WooCommerce → Analytics', 'nab-core' ) . '</a> · <a href="' . esc_url( wp_nonce_url( admin_url( 'admin-post.php?action=nab_students_csv' ), 'nab_students_csv' ) ) . '">' . esc_html__( 'Export student progress (CSV)', 'nab-core' ) . '</a></p>';

	// Courses.
	echo '<h2>' . esc_html__( 'Courses', 'nab-core' ) . '</h2><table class="widefat striped" style="max-width:900px"><thead><tr><th>' . esc_html__( 'Course', 'nab-core' ) . '</th><th>' . esc_html__( 'Active students', 'nab-core' ) . '</th><th>' . esc_html__( 'Average progress', 'nab-core' ) . '</th><th>' . esc_html__( 'Completed', 'nab-core' ) . '</th></tr></thead><tbody>';
	foreach ( nab_query_course_ids() as $cid ) {
		$students = nab_broadcast_audience( $cid );
		$lessons  = nab_course_lesson_ids( $cid );
		$pcts     = array();
		foreach ( $students as $uid ) {
			$pcts[] = $lessons ? 100 * count( array_filter( $lessons, static fn( $l ) => nab_lesson_done( $l, $uid ) ) ) / count( $lessons ) : 0;
		}
		$complete = count( array_filter( $pcts, static fn( $p ) => $p >= 100 ) );
		echo '<tr><td>' . esc_html( get_the_title( $cid ) ) . ' <small>(' . esc_html( nab_course_formats()[ nab_course_format( $cid ) ] ) . ')</small></td><td>' . count( $students ) . '</td><td>' . ( $pcts ? (int) round( array_sum( $pcts ) / count( $pcts ) ) : 0 ) . '%</td><td>' . (int) $complete . ( $students ? ' (' . (int) round( 100 * $complete / count( $students ) ) . '%)' : '' ) . '</td></tr>';
	}
	echo '</tbody></table>';

	// Step pass rates.
	$rows = $wpdb->get_results( "SELECT p.post_parent AS step, m.meta_value AS status, COUNT(*) AS n FROM {$wpdb->posts} p JOIN {$wpdb->postmeta} m ON m.post_id = p.ID AND m.meta_key = '_nab_status' WHERE p.post_type = 'nab_submission' GROUP BY p.post_parent, m.meta_value" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	$by   = array();
	foreach ( $rows as $r ) {
		$by[ (int) $r->step ][ $r->status ] = (int) $r->n;
	}
	echo '<h2>' . esc_html__( 'Setup steps', 'nab-core' ) . '</h2><table class="widefat striped" style="max-width:900px"><thead><tr><th>' . esc_html__( 'Step', 'nab-core' ) . '</th><th>' . esc_html__( 'Approved', 'nab-core' ) . '</th><th>' . esc_html__( 'Rejected', 'nab-core' ) . '</th><th>' . esc_html__( 'Waiting for review', 'nab-core' ) . '</th><th>' . esc_html__( 'Pass rate', 'nab-core' ) . '</th></tr></thead><tbody>';
	foreach ( nab_get_steps() as $s ) {
		$a = $by[ $s->ID ]['approved'] ?? 0;
		$r = $by[ $s->ID ]['rejected'] ?? 0;
		$h = $by[ $s->ID ]['human_review'] ?? 0;
		echo '<tr><td>' . esc_html( get_the_title( $s ) ) . '</td><td>' . (int) $a . '</td><td>' . (int) $r . '</td><td>' . (int) $h . '</td><td>' . ( $a + $r ? (int) round( 100 * $a / ( $a + $r ) ) . '%' : '—' ) . '</td></tr>';
	}
	echo '</tbody></table>';

	// Submissions per day.
	$days = $wpdb->get_results( $wpdb->prepare( "SELECT DATE(post_date) AS d, COUNT(*) AS n FROM {$wpdb->posts} WHERE post_type = 'nab_submission' AND post_date >= %s GROUP BY DATE(post_date)", gmdate( 'Y-m-d', strtotime( '-29 days' ) ) ), OBJECT_K ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	$max  = max( 1, ...array_map( static fn( $d ) => (int) $d->n, array_values( $days ) ?: array( (object) array( 'n' => 1 ) ) ) );
	echo '<h2>' . esc_html__( 'Screenshot submissions, last 30 days', 'nab-core' ) . '</h2><div style="display:flex;align-items:flex-end;gap:3px;height:140px;max-width:900px;padding:8px;background:#fff;border:1px solid #dcdcde">';
	for ( $i = 29; $i >= 0; $i-- ) {
		$d = gmdate( 'Y-m-d', strtotime( "-$i days" ) );
		$n = isset( $days[ $d ] ) ? (int) $days[ $d ]->n : 0;
		echo '<div title="' . esc_attr( "$d: $n" ) . '" style="flex:1;background:#2a6fa8;border-radius:3px 3px 0 0;height:' . esc_attr( max( 2, (int) round( 120 * $n / $max ) ) ) . 'px"></div>';
	}
	echo '</div>';

	// AI vs admin.
	$pairs = $wpdb->get_results( "SELECT s.meta_value AS final, ml.meta_value AS ml FROM {$wpdb->postmeta} s JOIN {$wpdb->postmeta} ml ON ml.post_id = s.post_id AND ml.meta_key = '_nab_ml_passed' JOIN {$wpdb->postmeta} rb ON rb.post_id = s.post_id AND rb.meta_key = '_nab_reviewed_by' WHERE s.meta_key = '_nab_status' AND s.meta_value IN ('approved','rejected')" ); // phpcs:ignore WordPress.DB.DirectDatabaseQuery
	$agree = count( array_filter( $pairs, static fn( $p ) => ( 'approved' === $p->final ) === (bool) $p->ml ) );
	echo '<h2>' . esc_html__( 'AI screenshot checks vs admin decisions', 'nab-core' ) . '</h2><p>' . ( $pairs ? esc_html( sprintf( /* translators: 1: percent, 2: count. */ __( 'The AI’s verdict matched the admin’s decision %1$d%% of the time, over %2$d screenshots that went to manual review.', 'nab-core' ), (int) round( 100 * $agree / count( $pairs ) ), count( $pairs ) ) ) : esc_html__( 'No manually reviewed screenshots with an AI verdict yet.', 'nab-core' ) ) . '</p></div>';
}
