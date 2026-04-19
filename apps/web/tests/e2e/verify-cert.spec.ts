// Sprint 4 Story 17 — Certificate verify smoke: public verify page.
//
// Covers the two entry points to CertificateVerifyPage:
//   1. /verify-certificate   → idle state (SearchForm) → submit fake token
//   2. /verify-certificate/:token → direct deep link
// Both surface the "Certificate not found" EmptyState with the ShieldX icon
// when the backend returns no matching credential.
import { test, expect } from '@playwright/test'

test.describe('Public certificate verification', () => {
  test('search form renders on the verify landing page', async ({ page }) => {
    await page.goto('/verify-certificate')

    // The input is #credential-id-input with placeholder "e.g. NAB-2024-000042".
    const input = page.locator('#credential-id-input')
    await expect(input).toBeVisible()
    await expect(page.getByRole('button', { name: /verify/i }).first()).toBeVisible()
  })

  test('submitting a fake token shows the "Certificate not found" state', async ({ page }) => {
    await page.goto('/verify-certificate')

    await page.locator('#credential-id-input').fill('FAKE-123')
    await page.getByRole('button', { name: /verify/i }).first().click()

    // EmptyState renders the ShieldX icon + "Certificate not found" title.
    await expect(page.getByText('Certificate not found')).toBeVisible({ timeout: 10_000 })
  })

  test('direct deep-link to a fake token shows the same not-found state', async ({ page }) => {
    await page.goto('/verify-certificate/FAKE-123')

    await expect(page.getByText('Certificate not found')).toBeVisible({ timeout: 10_000 })
  })
})
