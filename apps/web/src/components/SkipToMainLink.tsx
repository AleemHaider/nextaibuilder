// Sprint 4 Story 18 — Accessibility baseline.
//
// Visually hidden skip-to-content link that appears on focus and jumps the
// user straight to the page's <main id="main-content"> landmark, bypassing
// the shared TopNav. Rendered at the very top of the rendered tree in
// TopNav so it's first in tab order.
export function SkipToMainLink() {
  return (
    <a
      href="#main-content"
      className={
        'sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 ' +
        'focus:bg-[var(--color-wise-primary)] focus:text-[var(--color-wise-primary-text)] ' +
        'focus:px-4 focus:py-2 focus:rounded-full focus:shadow-[var(--shadow-card)] ' +
        'focus:outline-2 focus:outline-offset-2 focus:outline-[var(--color-wise-primary-text)] ' +
        'text-[14px] font-semibold no-underline'
      }
    >
      Skip to main content
    </a>
  )
}
