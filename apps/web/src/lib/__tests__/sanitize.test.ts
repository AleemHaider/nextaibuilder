// Sprint 1 Story 6 — tests for the DOMPurify-backed sanitizer.
//
// Each test asserts on a specific XSS vector or a legitimate-content
// preservation case. If any of these regress, the render sites in
// CohortDetailPage/LessonPage will start serving XSS to viewers.
import { describe, it, expect } from 'vitest'
import { sanitizeHtml, sanitizeLessonHtml } from '../sanitize'

describe('sanitizeHtml', () => {
  it('passes a plain paragraph through unchanged', () => {
    expect(sanitizeHtml('<p>Hello world</p>')).toBe('<p>Hello world</p>')
  })

  it('strips <script> tags entirely', () => {
    const dirty = '<p>Hi</p><script>alert("xss")</script>'
    const clean = sanitizeHtml(dirty)
    expect(clean).not.toContain('<script')
    expect(clean).not.toContain('alert')
    expect(clean).toContain('<p>Hi</p>')
  })

  it('strips onerror attribute from <img>', () => {
    const dirty = '<img src="x" onerror="alert(1)" alt="pic">'
    const clean = sanitizeHtml(dirty)
    expect(clean).not.toContain('onerror')
    expect(clean).not.toContain('alert')
    // The <img> itself stays (it's in the allow-list), just the attr drops.
    expect(clean).toContain('<img')
    expect(clean).toContain('alt="pic"')
  })

  it('strips javascript: href on anchor', () => {
    const dirty = '<a href="javascript:alert(1)">click</a>'
    const clean = sanitizeHtml(dirty)
    expect(clean).not.toContain('javascript:')
    expect(clean).not.toContain('alert')
  })

  it('adds target="_blank" rel="noopener noreferrer" to anchors post-sanitize', () => {
    const clean = sanitizeHtml('<a href="https://example.com">example</a>')
    expect(clean).toContain('target="_blank"')
    expect(clean).toContain('rel="noopener noreferrer"')
  })

  it('preserves allowed formatting tags (<b>, <em>, <a href>, <ul><li>)', () => {
    const dirty =
      '<p><b>Bold</b> and <em>italic</em> with <a href="https://a.test">link</a></p>' +
      '<ul><li>one</li><li>two</li></ul>'
    const clean = sanitizeHtml(dirty)
    expect(clean).toContain('<b>Bold</b>')
    expect(clean).toContain('<em>italic</em>')
    expect(clean).toContain('href="https://a.test"')
    expect(clean).toContain('<ul>')
    expect(clean).toContain('<li>one</li>')
    expect(clean).toContain('<li>two</li>')
  })

  it('strips <iframe> (not in ALLOWED_TAGS)', () => {
    const dirty = '<p>before</p><iframe src="https://evil.test"></iframe><p>after</p>'
    const clean = sanitizeHtml(dirty)
    expect(clean).not.toContain('<iframe')
    expect(clean).not.toContain('evil.test')
    expect(clean).toContain('<p>before</p>')
    expect(clean).toContain('<p>after</p>')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeHtml('')).toBe('')
  })
})

describe('sanitizeLessonHtml', () => {
  it('also strips <script> tags', () => {
    expect(sanitizeLessonHtml('<script>alert(1)</script>hi')).not.toContain('<script')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeLessonHtml('')).toBe('')
  })
})
