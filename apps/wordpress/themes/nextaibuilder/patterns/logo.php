<?php
/**
 * Title: Logo
 * Slug: nextaibuilder/logo
 * Categories: nextaibuilder
 * Inserter: no
 *
 * @package nextaibuilder
 */

?>
<!-- wp:html -->
<a class="nab-logo" href="<?php echo esc_url( home_url( '/' ) ); ?>" aria-label="<?php esc_attr_e( 'Next aibuilder home', 'nextaibuilder' ); ?>">
	<svg class="nab-logo__mark" width="28" height="28" viewBox="0 0 56 56" fill="none" aria-hidden="true">
		<defs>
			<linearGradient id="nabDeep" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1a2744"/><stop offset="100%" stop-color="#4a90c4"/></linearGradient>
			<linearGradient id="nabSky" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7bb8e0"/><stop offset="100%" stop-color="#4a9ad4"/></linearGradient>
			<linearGradient id="nabPale" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#a8d4f0"/><stop offset="100%" stop-color="#d4e8f7"/></linearGradient>
			<linearGradient id="nabOrange" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#ff8c5a"/><stop offset="50%" stop-color="#ff6347"/><stop offset="100%" stop-color="#d73027"/></linearGradient>
		</defs>
		<rect x="24" y="0" width="8" height="10" fill="url(#nabDeep)"/><rect x="24" y="46" width="8" height="10" fill="url(#nabDeep)"/>
		<rect x="0" y="24" width="10" height="8" fill="url(#nabDeep)"/><rect x="46" y="24" width="10" height="8" fill="url(#nabDeep)"/>
		<rect x="8" y="8" width="7" height="7" fill="url(#nabSky)"/><rect x="41" y="8" width="7" height="7" fill="url(#nabSky)"/>
		<rect x="8" y="41" width="7" height="7" fill="url(#nabSky)"/><rect x="41" y="41" width="7" height="7" fill="url(#nabSky)"/>
		<rect x="16" y="10" width="8" height="8" fill="url(#nabSky)"/><rect x="32" y="10" width="8" height="8" fill="url(#nabSky)"/>
		<rect x="10" y="16" width="8" height="8" fill="url(#nabSky)"/><rect x="38" y="16" width="8" height="8" fill="url(#nabSky)"/>
		<rect x="16" y="38" width="8" height="8" fill="url(#nabSky)"/><rect x="32" y="38" width="8" height="8" fill="url(#nabSky)"/>
		<rect x="10" y="32" width="8" height="8" fill="url(#nabSky)"/><rect x="38" y="32" width="8" height="8" fill="url(#nabSky)"/>
		<rect x="18" y="18" width="20" height="20" fill="url(#nabPale)"/><rect x="20" y="20" width="16" height="16" fill="url(#nabSky)"/>
		<rect x="22" y="22" width="12" height="12" fill="url(#nabDeep)"/><rect x="24" y="24" width="8" height="8" fill="url(#nabOrange)"/>
	</svg>
	<span class="nab-logo__text">
		<span class="nab-logo__pill"><span class="nab-logo__dot"></span>Next</span>
		<span class="nab-logo__word">aibuilder</span>
	</span>
</a>
<!-- /wp:html -->
