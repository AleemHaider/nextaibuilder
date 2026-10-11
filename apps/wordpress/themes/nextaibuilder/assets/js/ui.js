/**
 * Small site-wide UI helpers (no dependencies):
 * - Forms show a busy state once submitted, so slow uploads aren't sent twice.
 * - Forms with data-confirm ask before running a destructive action.
 */
( function () {
	document.addEventListener( 'submit', function ( e ) {
		var form = e.target;
		if ( ! ( form instanceof HTMLFormElement ) || e.defaultPrevented ) {
			return;
		}
		if ( form.dataset.confirm && ! window.confirm( form.dataset.confirm ) ) {
			e.preventDefault();
			return;
		}
		if ( form.method.toLowerCase() !== 'post' || form.hasAttribute( 'data-no-busy' ) ) {
			return;
		}
		var btn = e.submitter || form.querySelector( 'button[type="submit"], button:not([type])' );
		form.setAttribute( 'aria-busy', 'true' );
		if ( btn && btn.classList.contains( 'nab-btn' ) ) {
			// Disable after the submit is dispatched so the button's name/value still posts.
			setTimeout( function () {
				btn.disabled = true;
				btn.dataset.label = btn.textContent;
				btn.textContent = btn.textContent.trim() + '…';
			}, 0 );
		}
	} );
	// Re-enable if the page is restored from the back/forward cache.
	window.addEventListener( 'pageshow', function ( e ) {
		if ( ! e.persisted ) {
			return;
		}
		document.querySelectorAll( 'form[aria-busy="true"]' ).forEach( function ( f ) {
			f.removeAttribute( 'aria-busy' );
			f.querySelectorAll( 'button[data-label]' ).forEach( function ( b ) {
				b.disabled = false;
				b.textContent = b.dataset.label;
			} );
		} );
	} );
} )();
