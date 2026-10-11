/**
 * Editor previews for nab/* dynamic blocks. No build step: plain wp globals.
 */
( function ( wp ) {
	const el = wp.element.createElement;
	const SSR = wp.serverSideRender;
	const useBlockProps = wp.blockEditor.useBlockProps;

	[ 'courses', 'course-filters', 'hero-courses', 'pricing', 'setup-steps', 'sign-in', 'ship-log', 'format-compare', 'hero-visual', 'projects', 'timeline', 'instructor', 'pricing-cards', 'reviews' ].forEach( function ( name ) {
		const type = wp.blocks.getBlockType( 'nab/' + name );
		if ( ! type ) {
			return;
		}
		wp.blocks.unregisterBlockType( 'nab/' + name );
		wp.blocks.registerBlockType( 'nab/' + name, Object.assign( {}, type, {
			edit: function ( props ) {
				return el( 'div', useBlockProps(), el( SSR, { block: 'nab/' + name, attributes: props.attributes } ) );
			},
			save: function () {
				return null;
			},
		} ) );
	} );
} )( window.wp );
