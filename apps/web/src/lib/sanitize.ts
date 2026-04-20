// Sprint 1 Story 6 — DOMPurify-backed HTML sanitizer.
//
// We render user/admin-authored HTML in two places via `dangerouslySetInnerHTML`:
//   1. CohortDetailPage — the public cohort description (authored by admins).
//   2. student/LessonPage — TEXT lesson bodies (authored by lesson creators).
//
// If either author account is compromised, or an author embeds malicious
// markup, we would otherwise serve XSS to every viewer. All HTML that feeds
// `dangerouslySetInnerHTML` MUST pass through one of the exported helpers
// below. The API response shape is untouched — sanitization happens at render
// time so we keep the original HTML in the database for editing workflows.
import DOMPurify, { type Config } from 'dompurify'

// Strict allow-list. Start tight; we'll extend only if a legitimate tag gets
// stripped during smoke testing. Scripts, iframes, event handlers, and
// `javascript:` URLs are all dropped by DOMPurify defaults plus this config.
//
// NAB-P0-4 — extended for TipTap-authored lesson bodies:
//   * `pre` + `code` + `class` — fenced code blocks with a
//     `language-<lang>` hint so highlight.js can style them client-side.
//   * `img` + `data-key` — inline lesson images (the `data-key` lets a
//     future cleanup job reconcile uploads against rendered references).
//   * Everything else the toolbar can emit was already on the list.
//
// Inline `style` attributes are NOT in ALLOWED_ATTR — DOMPurify drops any
// attr not on the list, so Google-Docs-style `style="color:#…"` spans are
// stripped. This intentionally runs AFTER editor-side paste normalisation
// so the only authoritative check is at render time.
const DEFAULT_CONFIG: Config = {
  ALLOWED_TAGS: [
    'a', 'abbr', 'b', 'blockquote', 'br', 'code', 'em',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'hr', 'i', 'img', 'li', 'ol', 'p', 'pre', 'span',
    'strong', 'sub', 'sup',
    'table', 'tbody', 'td', 'th', 'thead', 'tr', 'ul',
  ],
  ALLOWED_ATTR: [
    'href', 'title', 'target', 'rel', 'src', 'alt', 'class',
    // NAB-P0-4 — image-upload bookkeeping + code-block language hint.
    'data-key', 'data-language',
  ],
  // Allow target/rel so the post-sanitize hook below can set them safely.
  ADD_ATTR: ['target', 'rel'],
}

// DOMPurify hooks are registered globally on the module singleton. Keep the
// registration in exactly one place (here) so we don't double-attach and
// mutate <a> tags twice per sanitize call.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if ((node as Element).tagName === 'A') {
    const el = node as Element
    el.setAttribute('target', '_blank')
    el.setAttribute('rel', 'noopener noreferrer')
  }
})

/**
 * Sanitize admin-authored HTML (e.g. cohort descriptions).
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, DEFAULT_CONFIG)
}

/**
 * Sanitize lesson-body HTML. Uses the same strict config as `sanitizeHtml` —
 * TEXT lessons today don't need extra tags. If a lesson author legitimately
 * needs something else (e.g. Loom iframes), extend the allow-list here rather
 * than loosening the shared default.
 */
export function sanitizeLessonHtml(dirty: string): string {
  if (!dirty) return ''
  return DOMPurify.sanitize(dirty, DEFAULT_CONFIG)
}
