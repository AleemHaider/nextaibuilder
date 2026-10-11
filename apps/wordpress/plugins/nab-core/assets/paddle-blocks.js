/**
 * Paddle option in the WooCommerce checkout block. Payment happens in Paddle's
 * overlay on the next page, so this only shows the label and description.
 */
( function ( wc, wp ) {
	const settings = wc.wcSettings.getSetting( 'nab_paddle_data', {} );
	const decode = wp.htmlEntities.decodeEntities;
	const label = decode( settings.title || 'Card, PayPal, Apple Pay or Google Pay' );
	const Content = function () {
		return wp.element.createElement( 'p', null, decode( settings.description || '' ) );
	};

	wc.wcBlocksRegistry.registerPaymentMethod( {
		name: 'nab_paddle',
		label: wp.element.createElement( 'span', null, label ),
		ariaLabel: label,
		content: wp.element.createElement( Content ),
		edit: wp.element.createElement( Content ),
		canMakePayment: function () {
			return true;
		},
		supports: { features: settings.supports || [ 'products' ] },
	} );
} )( window.wc, window.wp );
