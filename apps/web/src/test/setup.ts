// Wave 5 Story Z — Vitest / RTL setup. Wires jest-dom matchers and ensures
// each test gets a fresh DOM by unmounting any trees left behind.
import { expect, afterEach } from 'vitest'
// Side-effect import augments vitest's `expect` typing with jest-dom matchers.
import '@testing-library/jest-dom/vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/react'

expect.extend(matchers)

afterEach(() => {
  cleanup()
})

// NAB-P0-4 — jsdom lacks the layout APIs ProseMirror (TipTap's DOM view)
// reaches into when dispatching transactions. Stub the handful of methods
// with no-op defaults so editor-driving tests don't crash on input events.
// These shims do NOT affect non-editor tests; they just define functions
// that jsdom ships as undefined.
if (typeof globalThis.document !== 'undefined') {
  if (typeof (document as unknown as { elementFromPoint?: unknown }).elementFromPoint !== 'function') {
    ;(document as unknown as { elementFromPoint: () => null }).elementFromPoint = () => null
  }
  if (typeof (document as unknown as { caretRangeFromPoint?: unknown }).caretRangeFromPoint !== 'function') {
    ;(document as unknown as { caretRangeFromPoint: () => null }).caretRangeFromPoint = () => null
  }
  // Ensure every element has a workable getClientRects + getBoundingClientRect.
  const emptyRect = {
    top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0, x: 0, y: 0,
    toJSON: () => ({}),
  } as DOMRect
  if (
    typeof (Element.prototype as unknown as { getClientRects?: unknown }).getClientRects !== 'function'
  ) {
    ;(Element.prototype as unknown as { getClientRects: () => DOMRectList }).getClientRects =
      () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} } as unknown as DOMRectList)
  }
  if (
    typeof (Element.prototype as unknown as { getBoundingClientRect?: unknown }).getBoundingClientRect !== 'function'
  ) {
    ;(Element.prototype as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => emptyRect
  }
  // Range.getClientRects — ProseMirror calls this while resolving coordinates.
  if (
    typeof globalThis.Range !== 'undefined' &&
    typeof (Range.prototype as unknown as { getClientRects?: unknown }).getClientRects !== 'function'
  ) {
    ;(Range.prototype as unknown as { getClientRects: () => DOMRectList }).getClientRects =
      () => ({ length: 0, item: () => null, [Symbol.iterator]: function* () {} } as unknown as DOMRectList)
  }
  if (
    typeof globalThis.Range !== 'undefined' &&
    typeof (Range.prototype as unknown as { getBoundingClientRect?: unknown }).getBoundingClientRect !== 'function'
  ) {
    ;(Range.prototype as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () => emptyRect
  }
}
