<?php
/**
 * Paddle as a WooCommerce payment method (one-time payments only; the
 * installment plan stays on Stripe, same as the previous platform).
 *
 * Flow: checkout → create a Paddle transaction (non-catalog price, custom_data
 * carries the WooCommerce order) → order-pay page opens Paddle's overlay →
 * payment confirmed by the signed webhook (/wp-json/nab/v1/paddle-webhook) and,
 * as a fallback, by fetching the transaction when the student returns.
 *
 * Settings: WooCommerce → Settings → Payments → Paddle.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'plugins_loaded',
	static function () {
		if ( ! class_exists( 'WC_Payment_Gateway' ) ) {
			return;
		}

		/**
		 * Paddle gateway.
		 */
		class NAB_Gateway_Paddle extends WC_Payment_Gateway {

			/**
			 * Set up the gateway.
			 */
			public function __construct() {
				$this->id                 = 'nab_paddle';
				$this->method_title       = 'Paddle';
				$this->method_description = __( 'Card, PayPal, Apple Pay and Google Pay through Paddle (merchant of record). One-time payments only.', 'nab-core' );
				$this->has_fields         = false;
				$this->supports           = array( 'products' );
				$this->init_form_fields();
				$this->init_settings();
				$this->title       = $this->get_option( 'title' );
				$this->description = $this->get_option( 'description' );
				add_action( 'woocommerce_update_options_payment_gateways_' . $this->id, array( $this, 'process_admin_options' ) );
				add_action( 'woocommerce_receipt_' . $this->id, array( $this, 'receipt_page' ) );
			}

			/**
			 * Admin settings fields.
			 */
			public function init_form_fields() {
				$this->form_fields = array(
					'enabled'        => array(
						'title'   => __( 'Enable', 'nab-core' ),
						'type'    => 'checkbox',
						'label'   => __( 'Offer Paddle at checkout', 'nab-core' ),
						'default' => 'no',
					),
					'title'          => array(
						'title'   => __( 'Title', 'nab-core' ),
						'type'    => 'text',
						'default' => __( 'Card, PayPal, Apple Pay or Google Pay', 'nab-core' ),
					),
					'description'    => array(
						'title'   => __( 'Description', 'nab-core' ),
						'type'    => 'textarea',
						'default' => __( 'Pay securely through Paddle. A payment window opens after you place your order.', 'nab-core' ),
					),
					'environment'    => array(
						'title'   => __( 'Environment', 'nab-core' ),
						'type'    => 'select',
						'options' => array(
							'sandbox'    => 'Sandbox (test)',
							'production' => 'Live',
						),
						'default' => 'sandbox',
					),
					'api_key'        => array(
						'title' => __( 'API key', 'nab-core' ),
						'type'  => 'password',
					),
					'client_token'   => array(
						'title'       => __( 'Client-side token', 'nab-core' ),
						'type'        => 'text',
						'description' => __( 'Starts with test_ (sandbox) or live_.', 'nab-core' ),
					),
					'webhook_secret' => array(
						'title'       => __( 'Webhook secret key', 'nab-core' ),
						'type'        => 'password',
						/* translators: %s: webhook URL. */
						'description' => sprintf( __( 'Notification destination URL: %s (events: transaction.completed, transaction.payment_failed).', 'nab-core' ), rest_url( 'nab/v1/paddle-webhook' ) ),
					),
				);
			}

			/**
			 * Hide when unconfigured or when the cart is an installment plan.
			 *
			 * @return bool
			 */
			public function is_available() {
				if ( 'yes' !== $this->enabled || ! $this->get_option( 'api_key' ) || ! $this->get_option( 'client_token' ) ) {
					return false;
				}
				if ( WC()->cart ) {
					foreach ( WC()->cart->get_cart() as $item ) {
						if ( 'installments' === ( $item['nab_plan'] ?? '' ) ) {
							return false;
						}
					}
				}
				return parent::is_available();
			}

			/**
			 * Create the Paddle transaction and send the student to the pay page.
			 *
			 * @param int $order_id Order ID.
			 * @return array
			 */
			public function process_payment( $order_id ) {
				$order = wc_get_order( $order_id );
				$items = array();
				foreach ( $order->get_items() as $item ) {
					$items[] = array(
						'quantity' => 1,
						'price'    => array(
							'description' => sprintf( 'WooCommerce order %d', $order_id ),
							'name'        => $item->get_name(),
							'unit_price'  => array(
								'amount'        => (string) (int) round( (float) $item->get_total() * 100 ),
								'currency_code' => $order->get_currency(),
							),
							'tax_mode'    => 'account_setting',
							'product'     => array(
								'name'         => $item->get_name(),
								'tax_category' => 'standard',
							),
						),
					);
				}
				$response = nab_paddle_request(
					'POST',
					'/transactions',
					array(
						'collection_mode' => 'automatic',
						'currency_code'   => $order->get_currency(),
						'items'           => $items,
						'custom_data'     => array(
							'wc_order_id'  => (string) $order_id,
							'wc_order_key' => $order->get_order_key(),
							'source'       => 'nextaibuilder-wordpress',
						),
					)
				);
				if ( is_wp_error( $response ) ) {
					wc_add_notice( __( 'We couldn’t start the payment. Please try again or choose another method.', 'nab-core' ), 'error' );
					$order->add_order_note( 'Paddle transaction failed: ' . $response->get_error_message() );
					return array( 'result' => 'failure' );
				}
				$order->update_meta_data( '_nab_paddle_txn', $response['id'] );
				$order->save();
				$order->update_status( 'pending', sprintf( 'Paddle transaction %s created.', $response['id'] ) );
				return array(
					'result'   => 'success',
					'redirect' => $order->get_checkout_payment_url( true ),
				);
			}

			/**
			 * Order-pay page: open Paddle's overlay for the transaction.
			 *
			 * @param int $order_id Order ID.
			 */
			public function receipt_page( $order_id ) {
				$order = wc_get_order( $order_id );
				$txn   = (string) $order->get_meta( '_nab_paddle_txn' );
				if ( ! $txn ) {
					return;
				}
				wp_enqueue_script( 'paddle-js', 'https://cdn.paddle.com/paddle/v2/paddle.js', array(), null, true ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters -- Paddle serves a single evergreen v2 URL.
				$config = array(
					'env'        => $this->get_option( 'environment' ),
					'token'      => $this->get_option( 'client_token' ),
					'txn'        => $txn,
					'email'      => $order->get_billing_email(),
					'successUrl' => $this->get_return_url( $order ),
				);
				wp_add_inline_script(
					'paddle-js',
					'(function(c){if(c.env==="sandbox"){Paddle.Environment.set("sandbox");}Paddle.Initialize({token:c.token,eventCallback:function(e){if(e.name==="checkout.completed"){window.location.href=c.successUrl;}}});' .
					'function open(){Paddle.Checkout.open({transactionId:c.txn,customer:{email:c.email},settings:{displayMode:"overlay",theme:"light",allowLogout:false,successUrl:c.successUrl}});}' .
					'document.getElementById("nab-paddle-open").addEventListener("click",open);open();})(' . wp_json_encode( $config ) . ');'
				);
				echo '<div class="nab-card" style="padding:1.75rem"><p>' . esc_html__( 'Complete your payment in the secure Paddle window. If it didn’t open, use the button below.', 'nab-core' ) . '</p><button type="button" class="nab-btn" id="nab-paddle-open">' . esc_html__( 'Open payment window', 'nab-core' ) . '</button></div>';
			}
		}

		add_filter(
			'woocommerce_payment_gateways',
			static function ( $gateways ) {
				$gateways[] = 'NAB_Gateway_Paddle';
				return $gateways;
			}
		);
	}
);

/**
 * The Paddle gateway instance, if registered.
 *
 * @return NAB_Gateway_Paddle|null
 */
function nab_paddle_gateway() {
	$gateways = function_exists( 'WC' ) ? WC()->payment_gateways()->payment_gateways() : array();
	return $gateways['nab_paddle'] ?? null;
}

/**
 * Call the Paddle API.
 *
 * @param string     $method HTTP method.
 * @param string     $path   e.g. /transactions.
 * @param array|null $body   JSON body.
 * @return array|WP_Error The response "data" object.
 */
function nab_paddle_request( $method, $path, $body = null ) {
	$gateway = nab_paddle_gateway();
	if ( ! $gateway ) {
		return new WP_Error( 'nab_paddle', 'Paddle gateway not loaded' );
	}
	$base     = 'production' === $gateway->get_option( 'environment' ) ? 'https://api.paddle.com' : 'https://sandbox-api.paddle.com';
	$response = wp_remote_request(
		$base . $path,
		array(
			'method'  => $method,
			'timeout' => 20,
			'headers' => array(
				'Authorization' => 'Bearer ' . $gateway->get_option( 'api_key' ),
				'Content-Type'  => 'application/json',
			),
			'body'    => null === $body ? null : wp_json_encode( $body ),
		)
	);
	if ( is_wp_error( $response ) ) {
		return $response;
	}
	$data = json_decode( wp_remote_retrieve_body( $response ), true );
	$code = wp_remote_retrieve_response_code( $response );
	if ( $code >= 300 || empty( $data['data'] ) ) {
		$detail = $data['error']['detail'] ?? ( $data['error']['code'] ?? 'HTTP ' . $code );
		return new WP_Error( 'nab_paddle', $detail );
	}
	return $data['data'];
}

/**
 * Mark the order paid if its Paddle transaction is completed. Idempotent.
 *
 * @param WC_Order $order Order.
 * @param array    $txn   Transaction data (fetched if omitted).
 * @return bool Whether the order is now paid.
 */
function nab_paddle_sync_order( $order, $txn = null ) {
	if ( $order->is_paid() ) {
		return true;
	}
	$txn_id = (string) $order->get_meta( '_nab_paddle_txn' );
	if ( ! $txn_id ) {
		return false;
	}
	if ( null === $txn ) {
		$txn = nab_paddle_request( 'GET', '/transactions/' . rawurlencode( $txn_id ) );
		if ( is_wp_error( $txn ) ) {
			return false;
		}
	}
	if ( ( $txn['id'] ?? '' ) !== $txn_id || ! in_array( $txn['status'] ?? '', array( 'completed', 'paid' ), true ) ) {
		return false;
	}
	// Amount check (minor units). subtotal + tax covers both tax-inclusive and
	// tax-exclusive Paddle pricing.
	$paid     = (int) ( $txn['details']['totals']['subtotal'] ?? 0 ) + (int) ( $txn['details']['totals']['tax'] ?? 0 );
	$expected = (int) round( (float) $order->get_total() * 100 );
	if ( $paid < $expected ) {
		$order->add_order_note( sprintf( 'Paddle transaction %s subtotal %d is below the order total %d; not marking paid.', $txn_id, $paid, $expected ) );
		return false;
	}
	$order->payment_complete( $txn_id );
	$order->add_order_note( sprintf( 'Paid via Paddle (%s).', $txn_id ) );
	return true;
}

// Returning from the overlay: confirm straight away instead of waiting for the webhook.
add_action(
	'woocommerce_thankyou_nab_paddle',
	static function ( $order_id ) {
		$order = wc_get_order( $order_id );
		if ( $order && ! nab_paddle_sync_order( $order ) ) {
			echo '<p class="nab-notice">' . esc_html__( 'We’re confirming your payment with Paddle. This page will update; you’ll also get an email once your enrollment is active.', 'nab-core' ) . '</p><script>setTimeout(function(){location.reload();},5000);</script>';
		}
	},
	5
);

/**
 * Verify a Paddle-Signature header ("ts=...;h1=...").
 *
 * @param string $header Signature header.
 * @param string $body   Raw body.
 * @param string $secret Webhook secret.
 * @return bool
 */
function nab_paddle_verify_signature( $header, $body, $secret ) {
	$parts = array();
	foreach ( explode( ';', $header ) as $pair ) {
		[ $k, $v ] = array_pad( explode( '=', trim( $pair ), 2 ), 2, '' );
		$parts[ $k ][] = $v;
	}
	$ts = (int) ( $parts['ts'][0] ?? 0 );
	if ( ! $ts || abs( time() - $ts ) > 300 || empty( $parts['h1'] ) || ! $secret ) {
		return false;
	}
	$expected = hash_hmac( 'sha256', $ts . ':' . $body, $secret );
	foreach ( $parts['h1'] as $h1 ) {
		if ( hash_equals( $expected, $h1 ) ) {
			return true;
		}
	}
	return false;
}

add_action(
	'rest_api_init',
	static function () {
		register_rest_route(
			'nab/v1',
			'/paddle-webhook',
			array(
				'methods'             => 'POST',
				'permission_callback' => '__return_true', // Authenticated by signature below.
				'callback'            => 'nab_paddle_webhook',
			)
		);
	}
);

/**
 * Handle a Paddle webhook.
 *
 * @param WP_REST_Request $request Request.
 * @return WP_REST_Response
 */
function nab_paddle_webhook( WP_REST_Request $request ) {
	$gateway = nab_paddle_gateway();
	$body    = $request->get_body();
	if ( ! $gateway || ! nab_paddle_verify_signature( (string) $request->get_header( 'paddle-signature' ), $body, (string) $gateway->get_option( 'webhook_secret' ) ) ) {
		return new WP_REST_Response( array( 'error' => 'invalid signature' ), 400 );
	}
	$event = json_decode( $body, true );
	$txn   = $event['data'] ?? array();
	$order = wc_get_order( (int) ( $txn['custom_data']['wc_order_id'] ?? 0 ) );
	if ( ! $order || ! hash_equals( $order->get_order_key(), (string) ( $txn['custom_data']['wc_order_key'] ?? '' ) ) ) {
		return new WP_REST_Response( array( 'ok' => true, 'skipped' => 'unknown order' ), 200 );
	}
	switch ( $event['event_type'] ?? '' ) {
		case 'transaction.completed':
			nab_paddle_sync_order( $order, $txn );
			break;
		case 'transaction.payment_failed':
			$order->add_order_note( sprintf( 'Paddle payment attempt failed (%s).', $txn['id'] ?? '' ) );
			break;
	}
	return new WP_REST_Response( array( 'ok' => true ), 200 );
}

/**
 * Show Paddle in the block-based checkout.
 */
add_action(
	'woocommerce_blocks_payment_method_type_registration',
	static function ( $registry ) {
		if ( ! class_exists( '\Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType' ) ) {
			return;
		}
		require_once NAB_CORE_DIR . 'includes/class-nab-paddle-blocks.php';
		$registry->register( new NAB_Paddle_Blocks() );
	}
);
