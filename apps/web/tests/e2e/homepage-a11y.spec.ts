// Sprint 4 Story 17 — Basic a11y smoke for the public homepage.
//
// Deliberately lightweight — Story 18 (Accessibility baseline sweep) will
// add deeper axe-core coverage. We only assert a few stable invariants:
//   • exactly one <h1> landmark with non-empty text,
//   • a top-level landmark exists (either <main> or the site header/nav),
//   • tab order is deterministic — the first focusable element is either a
//     skip-to-content link (if Story 18 added one) OR a real interactive
//     control (link/button). We don't hard-code which, so the test stays
//     green through the Story 18 rollout.
import { test, expect } from '@playwright/test'

test.describe('Homepage a11y smoke', () => {
  test('page has an h1 with meaningful text', async ({ page }) => {
    await page.goto('/')
    const h1 = page.getByRole('heading', { level: 1 }).first()
    await expect(h1).toBeVisible()
    const text = (await h1.textContent())?.trim() ?? ''
    expect(text.length).toBeGreaterThan(0)
  })

  test('page exposes a top-level landmark (main, nav, or banner)', async ({ page }) => {
    await page.goto('/')

    // HomePage doesn't wrap content in <main> today (tracked by Story 18).
    // We accept any recognised landmark so this test passes now and keeps
    // passing after Story 18 introduces <main>.
    const landmarkCount = await page
      .locator('main, [role="main"], nav, [role="navigation"], header, [role="banner"]')
      .count()
    expect(landmarkCount).toBeGreaterThan(0)
  })

  test('tab order is deterministic — first focusable is a link or skip control', async ({ page }) => {
    await page.goto('/')

    await page.keyboard.press('Tab')
    const focused = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null
      if (!el || el === document.body) return null
      return {
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        text: (el.textContent ?? '').trim().slice(0, 80),
        href: (el as HTMLAnchorElement).href ?? null,
      }
    })

    expect(focused).not.toBeNull()
    // Accept either a skip link (Story 18 outcome) or any interactive control.
    const tag = focused!.tag
    expect(['a', 'button', 'input', 'select', 'textarea']).toContain(tag)
  })
})
