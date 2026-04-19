// Sprint 4 Story 17 — Storefront smoke: public browse flow.
//
// Covers: landing page hero + featured cohort cards → cohort detail page →
// Footer cross-link to public certificate verification.
import { test, expect } from '@playwright/test'

test.describe('Storefront public browse flow', () => {
  test('homepage shows hero and featured cohort cards', async ({ page }) => {
    await page.goto('/')

    // Hero h1 is split across lines ("Build AI Products. Ship Real Projects.").
    // Match on the leading text so whitespace/line-break differences don't
    // break the assertion.
    const hero = page.getByRole('heading', { level: 1 })
    await expect(hero).toBeVisible()
    await expect(hero).toContainText(/Build AI/i)

    // Seeded featured cohort — "Claude API Mastery" appears in the Featured
    // Cohorts grid (and in the decorative hero card). Use .first() to disambiguate.
    await expect(page.getByText('Claude API Mastery').first()).toBeVisible()
  })

  test('clicking a cohort card lands on the cohort detail page', async ({ page }) => {
    await page.goto('/')

    // Cohort cards each expose an "Enroll Now" link that points at
    // `/courses/:slug`. The Claude API Mastery card is the first in
    // the Featured Cohorts grid (seeded order: claude-api-mastery,
    // ai-product-bootcamp, full-stack-ai-dev). Use the href-based locator
    // so the test is robust to sibling "Enroll Now" buttons elsewhere.
    const cohortLink = page
      .getByRole('link', { name: /Enroll Now/i })
      .and(page.locator('[href="/courses/claude-api-mastery"]'))
    await cohortLink.first().click()

    await expect(page).toHaveURL(/\/courses\/claude-api-mastery$/)

    // Detail page chrome — title heading + enroll CTA.
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: /Enroll Now/i }).first()).toBeVisible()
  })

  test('Footer "Verify Certificate" link points at /verify-certificate', async ({ page }) => {
    await page.goto('/')

    // Assert the Footer exposes a "Verify Certificate" link with the
    // canonical href. We assert on the link attribute rather than the
    // post-click URL so the test stays honest to the spec even if the
    // dev server is caching a stale compiled Footer build (see caveat in
    // the story writeup — repo has a set of stale .js twins alongside .tsx).
    const verifyLink = page
      .locator('footer')
      .getByRole('link', { name: /Verify Certificate/i })
      .first()
    await verifyLink.scrollIntoViewIfNeeded()
    await expect(verifyLink).toHaveAttribute('href', '/verify-certificate')

    // Clicking should also land on the verify page.
    await verifyLink.click()
    await expect(page).toHaveURL(/\/verify-certificate$/)
  })
})
