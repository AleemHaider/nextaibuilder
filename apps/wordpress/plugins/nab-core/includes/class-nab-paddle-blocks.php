<?php
/**
 * Block checkout integration for the Paddle gateway.
 *
 * @package nab-core
 */

defined( 'ABSPATH' ) || exit;

use Automattic\WooCommerce\Blocks\Payments\Integrations\AbstractPaymentMethodType;

/**
 * Registers the Paddle option in the checkout block.
 */
final class NAB_Paddle_Blocks extends AbstractPaymentMethodType {

	/**
	 * Payment method name (matches the gateway ID).
	 *
	 * @var string
	 */
	protected $name = 'nab_paddle';

	/**
	 * Load settings.
	 */
	public function initialize() {
		$this->settings = get_option( 'woocommerce_nab_paddle_settings', array() );
	}

	/**
	 * Active when the gateway is available for the current cart.
	 *
	 * @return bool
	 */
	public function is_active() {
		$gateway = nab_paddle_gateway();
		return $gateway && $gateway->is_available();
	}

	/**
	 * Front-end script handles.
	 *
	 * @return string[]
	 */
	public function get_payment_method_script_handles() {
		wp_register_script(
			'nab-paddle-blocks',
			plugins_url( 'assets/paddle-blocks.js', NAB_CORE_DIR . 'nab-core.php' ),
			array( 'wc-blocks-registry', 'wc-settings', 'wp-element', 'wp-html-entities' ),
			NAB_CORE_VERSION,
			true
		);
		return array( 'nab-paddle-blocks' );
	}

	/**
	 * Data passed to the script.
	 *
	 * @return array
	 */
	public function get_payment_method_data() {
		return array(
			'title'       => $this->get_setting( 'title' ),
			'description' => $this->get_setting( 'description' ),
			'supports'    => array( 'products' ),
		);
	}
}
