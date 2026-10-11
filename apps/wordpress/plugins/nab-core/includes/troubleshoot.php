<?php
/**
 * AI troubleshooter on setup steps: students describe what's going wrong (and
 * can attach a screenshot); Claude answers with the step's instructions as
 * context. History is kept per student and step (last 20 messages).
 * Limit: NAB_TROUBLESHOOT_PER_HOUR questions per student per hour.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

const NAB_TROUBLESHOOT_PER_HOUR = 10;

add_action(
	'rest_api_init',
	static function () {
		register_rest_route(
			'nab/v1',
			'/troubleshoot',
			array(
				'methods'             => 'POST',
				'permission_callback' => static fn() => is_user_logged_in() && nab_user_can_do_steps( get_current_user_id() ),
				'callback'            => 'nab_troubleshoot',
				'args'                => array(
					'step_id' => array( 'type' => 'integer', 'required' => true ),
					'message' => array( 'type' => 'string', 'required' => true ),
					'image'   => array( 'type' => 'string', 'required' => false ),
				),
			)
		);
	}
);

/**
 * Conversation history key.
 *
 * @param int $step_id Step.
 * @return string
 */
function nab_ts_key( $step_id ) {
	return '_nab_ts_' . (int) $step_id;
}

/**
 * Handle a question.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response
 */
function nab_troubleshoot( WP_REST_Request $request ) {
	$user_id = get_current_user_id();
	$step    = get_post( (int) $request['step_id'] );
	$message = trim( sanitize_textarea_field( (string) $request['message'] ) );
	if ( ! $step || 'nab_step' !== $step->post_type || '' === $message || mb_strlen( $message ) > 2000 ) {
		return new WP_REST_Response( array( 'error' => __( 'Describe what’s going wrong (up to 2,000 characters).', 'nab-core' ) ), 400 );
	}

	$hits = array_filter( (array) get_user_meta( $user_id, '_nab_ts_hits', true ), static fn( $t ) => $t > time() - HOUR_IN_SECONDS );
	if ( count( $hits ) >= NAB_TROUBLESHOOT_PER_HOUR ) {
		return new WP_REST_Response( array( 'error' => __( 'You’ve asked 10 questions in the last hour. Try again a little later, or post in the cohort channel.', 'nab-core' ) ), 429 );
	}
	if ( ! nab_anthropic_api_key() ) {
		return new WP_REST_Response( array( 'error' => __( 'The AI helper isn’t switched on yet. Ask in the cohort channel and the team will help.', 'nab-core' ) ), 503 );
	}

	// Optional screenshot as a data URL (png/jpeg/webp/gif, up to 5 MB).
	$image = null;
	$data  = (string) $request['image'];
	if ( $data && preg_match( '#^data:(image/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$#', $data, $m ) && strlen( $m[2] ) * 3 / 4 <= 5 * MB_IN_BYTES ) {
		$image = array( $m[1], $m[2] );
	}

	$history  = array_slice( (array) get_user_meta( $user_id, nab_ts_key( $step->ID ), true ), -10 );
	$messages = array();
	foreach ( $history as $turn ) {
		if ( is_array( $turn ) ) {
			$messages[] = array( 'role' => $turn['role'], 'content' => $turn['text'] );
		}
	}
	$content = array();
	if ( $image ) {
		$content[] = array( 'type' => 'image', 'source' => array( 'type' => 'base64', 'mediaType' => $image[0], 'data' => $image[1] ) );
	}
	$content[]  = array( 'type' => 'text', 'text' => $message );
	$messages[] = array( 'role' => 'user', 'content' => $content );

	$system = "You help students of nextaibuilder, a course on building AI products, get unstuck on a setup step. Be concise and practical: say what's likely wrong and give the exact next commands or clicks. Use short paragraphs or numbered steps; put commands in backticks. If the screenshot shows something unrelated to the step, say so. Don't invent features of tools you aren't sure about.\n\n"
		. 'Step: ' . $step->post_title . "\nInstructions: " . wp_strip_all_tags( $step->post_content ) . "\nWhat a successful result looks like: " . get_post_meta( $step->ID, '_nab_screenshot_criteria', true );

	try {
		require_once NAB_CORE_DIR . 'vendor/autoload.php';
		$client = new \Anthropic\Client( apiKey: nab_anthropic_api_key() );
		$reply  = $client->beta->messages->create(
			model: NAB_VISION_MODEL,
			maxTokens: 4000,
			system: $system,
			messages: $messages,
			outputConfig: array( 'effort' => 'low' ),
			fallbacks: 'default',
			betas: array( 'server-side-fallback-2026-07-01' ),
		);
	} catch ( Throwable $e ) {
		return new WP_REST_Response( array( 'error' => __( 'The AI helper couldn’t answer just now. Please try again in a minute.', 'nab-core' ) ), 502 );
	}
	$answer = '';
	foreach ( $reply->content as $block ) {
		if ( 'text' === $block->type ) {
			$answer .= $block->text;
		}
	}
	if ( 'refusal' === $reply->stopReason || '' === trim( $answer ) ) {
		$answer = __( 'I can’t help with that one. Please ask in the cohort channel and the team will take a look.', 'nab-core' );
	}

	$hits[] = time();
	update_user_meta( $user_id, '_nab_ts_hits', array_values( $hits ) );
	$history   = (array) get_user_meta( $user_id, nab_ts_key( $step->ID ), true );
	$history[] = array( 'role' => 'user', 'text' => $message . ( $image ? ' [screenshot attached]' : '' ) );
	$history[] = array( 'role' => 'assistant', 'text' => $answer );
	update_user_meta( $user_id, nab_ts_key( $step->ID ), array_slice( $history, -20 ) );

	return new WP_REST_Response( array( 'answer' => $answer ), 200 );
}

/**
 * Helper panel markup for one step (rendered inside the step card).
 *
 * @param int $step_id Step.
 * @return string HTML.
 */
function nab_render_troubleshooter( $step_id ) {
	$history = array_filter( (array) get_user_meta( get_current_user_id(), nab_ts_key( $step_id ), true ), 'is_array' );
	$html    = '<details class="nab-ts"' . ( $history ? ' open' : '' ) . '><summary>' . esc_html__( 'Stuck? Ask the AI helper', 'nab-core' ) . '</summary><div class="nab-ts__log" aria-live="polite">';
	foreach ( $history as $turn ) {
		$html .= '<div class="nab-ts__msg nab-ts__msg--' . esc_attr( $turn['role'] ) . '">' . wp_kses_post( wpautop( esc_html( $turn['text'] ) ) ) . '</div>';
	}
	$html .= '</div><form class="nab-ts__form" data-step="' . (int) $step_id . '"><label class="screen-reader-text" for="nab-ts-' . (int) $step_id . '">' . esc_html__( 'Your question', 'nab-core' ) . '</label><textarea id="nab-ts-' . (int) $step_id . '" rows="2" maxlength="2000" placeholder="' . esc_attr__( 'e.g. brew --version says “command not found”', 'nab-core' ) . '" required></textarea><div class="nab-ts__row"><label class="nab-ts__file">' . esc_html__( 'Attach screenshot', 'nab-core' ) . '<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" /></label><button class="nab-btn" type="submit">' . esc_html__( 'Ask', 'nab-core' ) . '</button></div></form></details>';
	return $html;
}

add_action(
	'wp_enqueue_scripts',
	static function () {
		if ( ! is_page( 'setup' ) ) {
			return;
		}
		wp_register_script( 'nab-ts', '', array(), NAB_CORE_VERSION, true );
		wp_enqueue_script( 'nab-ts' );
		wp_add_inline_script(
			'nab-ts',
			'window.nabTs=' . wp_json_encode( array( 'url' => rest_url( 'nab/v1/troubleshoot' ), 'nonce' => wp_create_nonce( 'wp_rest' ), 'thinking' => __( 'Thinking…', 'nab-core' ) ) ) . ';'
			. <<<'JS'
document.addEventListener('submit', async function (e) {
  var f = e.target.closest('.nab-ts__form'); if (!f) return; e.preventDefault();
  var ta = f.querySelector('textarea'), file = f.querySelector('input[type=file]'), log = f.parentElement.querySelector('.nab-ts__log'), btn = f.querySelector('button');
  var text = ta.value.trim(); if (!text) return;
  var esc = function (s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML.replace(/\n/g, '<br>'); };
  var image = '';
  if (file.files[0]) { image = await new Promise(function (r) { var fr = new FileReader(); fr.onload = function () { r(fr.result); }; fr.readAsDataURL(file.files[0]); }); }
  log.insertAdjacentHTML('beforeend', '<div class="nab-ts__msg nab-ts__msg--user">' + esc(text) + (image ? ' 📎' : '') + '</div><div class="nab-ts__msg nab-ts__msg--assistant is-thinking">' + nabTs.thinking + '</div>');
  ta.value = ''; file.value = ''; btn.disabled = true;
  try {
    var res = await fetch(nabTs.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nabTs.nonce }, body: JSON.stringify({ step_id: +f.dataset.step, message: text, image: image }) });
    var data = await res.json();
    log.querySelector('.is-thinking').outerHTML = '<div class="nab-ts__msg nab-ts__msg--assistant' + (data.error ? ' is-error' : '') + '">' + esc(data.answer || data.error || 'Error') + '</div>';
  } catch (err) { log.querySelector('.is-thinking').textContent = 'Network error. Please try again.'; }
  btn.disabled = false; log.scrollTop = log.scrollHeight;
});
JS
		);
	}
);
