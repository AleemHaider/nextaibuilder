<?php
/**
 * AI screenshot check for setup steps, via the Anthropic PHP SDK
 * (vendor/, installed with Composer).
 *
 * Decision rule (same as the previous platform):
 * - confidence >= NAB_ML_CONFIDENCE_THRESHOLD and passed  → approved
 * - confidence >= threshold and not passed                → rejected with feedback
 * - lower confidence, refusal, API error or no API key    → human review
 *
 * API key: define NAB_ANTHROPIC_API_KEY in wp-config.php, or set the
 * ANTHROPIC_API_KEY environment variable.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

const NAB_ML_CONFIDENCE_THRESHOLD = 80;
const NAB_VISION_MODEL            = 'claude-opus-5-5';

/**
 * Configured Anthropic API key, or ''.
 *
 * @return string
 */
function nab_anthropic_api_key() {
	if ( defined( 'NAB_ANTHROPIC_API_KEY' ) && NAB_ANTHROPIC_API_KEY ) {
		return (string) NAB_ANTHROPIC_API_KEY;
	}
	return (string) getenv( 'ANTHROPIC_API_KEY' );
}

/**
 * Ask Claude whether a screenshot proves a step is done.
 *
 * @param string  $image_bytes Raw image.
 * @param string  $mime        image/png etc.
 * @param WP_Post $step        Step.
 * @return array{passed:bool, confidence:int, feedback:string, reasoning:string}
 * @throws RuntimeException On refusal or unusable output.
 */
function nab_claude_check_screenshot( $image_bytes, $mime, $step ) {
	require_once NAB_CORE_DIR . 'vendor/autoload.php';
	$client = new \Anthropic\Client( apiKey: nab_anthropic_api_key() );

	$checklist = implode( ' | ', array_filter( array_map( 'trim', explode( "\n", (string) get_post_meta( $step->ID, '_nab_checklist', true ) ) ) ) );
	$system    = "You check screenshots that students upload to prove they completed a setup step in a developer training program.\n\n"
		. "Step: {$step->post_title}\n"
		. 'What they had to do: ' . wp_strip_all_tags( $step->post_content ) . "\n"
		. ( $checklist ? "Checklist: {$checklist}\n" : '' )
		. 'Screenshot acceptance criteria: ' . get_post_meta( $step->ID, '_nab_screenshot_criteria', true ) . "\n\n"
		. "Decide whether the screenshot genuinely shows the step is complete. Describe concretely what you see. There is no partial credit: if it is blurry, cropped, or doesn't show the relevant terminal or UI, it does not pass.\n"
		. "confidence is 0-100. Below 80 means you are unsure and a human will review it, so don't force a decision.\n"
		. "feedback is shown to the student (max 120 words): say what you saw and, if it didn't pass, exactly what to fix. reasoning is internal notes for staff.";

	$message = $client->beta->messages->create(
		model: NAB_VISION_MODEL,
		maxTokens: 8000,
		system: $system,
		messages: array(
			array(
				'role'    => 'user',
				'content' => array(
					array(
						'type'   => 'image',
						'source' => array(
							'type'      => 'base64',
							'mediaType' => $mime,
							'data'      => base64_encode( $image_bytes ), // phpcs:ignore WordPress.PHP.DiscouragedPHPFunctions -- API payload.
						),
					),
					array(
						'type' => 'text',
						'text' => 'Check this screenshot against the step.',
					),
				),
			),
		),
		outputConfig: array(
			'effort' => 'medium',
			'format' => array(
				'type'   => 'json_schema',
				'schema' => array(
					'type'                 => 'object',
					'properties'           => array(
						'passed'     => array( 'type' => 'boolean' ),
						'confidence' => array( 'type' => 'integer' ),
						'feedback'   => array( 'type' => 'string' ),
						'reasoning'  => array( 'type' => 'string' ),
					),
					'required'             => array( 'passed', 'confidence', 'feedback', 'reasoning' ),
					'additionalProperties' => false,
				),
			),
		),
		// If the model declines for policy reasons, let the API retry on its
		// recommended fallback model instead of failing.
		fallbacks: 'default',
		betas: array( 'server-side-fallback-2026-07-01' ),
	);

	if ( 'refusal' === $message->stopReason ) {
		throw new RuntimeException( 'Model declined to assess the screenshot.' );
	}
	foreach ( $message->content as $block ) {
		if ( 'text' === $block->type ) {
			$data = json_decode( $block->text, true );
			if ( is_array( $data ) && isset( $data['passed'], $data['confidence'] ) ) {
				return array(
					'passed'     => (bool) $data['passed'],
					'confidence' => max( 0, min( 100, (int) $data['confidence'] ) ),
					'feedback'   => (string) ( $data['feedback'] ?? '' ),
					'reasoning'  => (string) ( $data['reasoning'] ?? '' ),
				);
			}
		}
	}
	throw new RuntimeException( 'No usable JSON in the model response (stop reason: ' . $message->stopReason . ').' );
}

/**
 * Action Scheduler job: validate one submission.
 *
 * @param int $submission_id Submission.
 */
function nab_validate_submission( $submission_id ) {
	$status = get_post_meta( $submission_id, '_nab_status', true );
	if ( ! in_array( $status, array( 'pending', 'ml_processing' ), true ) ) {
		return; // Already decided.
	}
	$submission = get_post( $submission_id );
	$step       = $submission ? get_post( $submission->post_parent ) : null;
	if ( ! $step ) {
		return;
	}
	if ( ! nab_anthropic_api_key() ) {
		nab_decide_submission( $submission_id, 'human_review', '' );
		return;
	}
	update_post_meta( $submission_id, '_nab_status', 'ml_processing' );

	$file = nab_step_uploads_dir() . basename( (string) get_post_meta( $submission_id, '_nab_file', true ) );
	try {
		$result = nab_claude_check_screenshot( (string) file_get_contents( $file ), (string) get_post_meta( $submission_id, '_nab_mime', true ), $step ); // phpcs:ignore WordPress.WP.AlternativeFunctions
	} catch ( Throwable $e ) {
		update_post_meta( $submission_id, '_nab_ml_reasoning', 'AI check failed: ' . $e->getMessage() );
		nab_decide_submission( $submission_id, 'human_review', '' );
		return;
	}

	update_post_meta( $submission_id, '_nab_ml_score', $result['confidence'] );
	update_post_meta( $submission_id, '_nab_ml_passed', $result['passed'] ? 1 : 0 );
	update_post_meta( $submission_id, '_nab_ml_reasoning', $result['reasoning'] );
	update_post_meta( $submission_id, '_nab_ml_feedback', $result['feedback'] );

	if ( $result['confidence'] < NAB_ML_CONFIDENCE_THRESHOLD ) {
		nab_decide_submission( $submission_id, 'human_review', '' );
	} else {
		nab_decide_submission( $submission_id, $result['passed'] ? 'approved' : 'rejected', $result['feedback'] );
	}
}
add_action( 'nab_validate_submission', 'nab_validate_submission' );
