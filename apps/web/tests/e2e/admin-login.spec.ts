// Sprint 4 Story 17 — Admin login OTP smoke.
//
// Flow:
//   1. /admin/login        → fill seeded email+password, submit
//   2. /admin/verify-otp   → read latest DEV OTP from /tmp/nab-api.log
//                            (Wave 5 — API logs "[auth-admin] DEV OTP" with
//                             {"code":"NNNNNN"}), paste into 6-digit boxes
//   3. /admin/dashboard    → verify admin shell chrome (Cohorts / Students).
//
// Reading the OTP from the log is intentional — it matches the dev-OTP
// pattern described in the story. The regex picks the LAST matching line so
// if a previous test (or the dev server itself) generated earlier OTPs, we
// still grab the freshest one.
import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'

const ADMIN_EMAIL = 'admin@nextaibuilder.com'
const ADMIN_PASSWORD = 'Admin123'
const API_LOG_PATH = '/tmp/nab-api.log'

function readLatestOtpFromLog(): string {
  const contents = readFileSync(API_LOG_PATH, 'utf8')
  // Lines look like:
  //   ...,"email":"admin@nextaibuilder.com","code":"464678","msg":"[auth-admin] DEV OTP..."
  const matches = [...contents.matchAll(/"code":"(\d{6})"/g)]
  if (matches.length === 0) {
    throw new Error(
      `No DEV OTP code found in ${API_LOG_PATH}. Did the API server emit an admin OTP?`,
    )
  }
  return matches[matches.length - 1][1]
}

test.describe('Admin OTP login flow', () => {
  test('admin logs in with email+password, enters OTP, lands on dashboard', async ({ page }) => {
    // Snapshot OTP count BEFORE submitting — we'll poll for a newer entry
    // so we don't accidentally use a stale code from a prior run.
    const preCount = (readFileSync(API_LOG_PATH, 'utf8').match(/"code":"\d{6}"/g) ?? []).length

    await page.goto('/admin/login')

    await page.locator('#admin-email').fill(ADMIN_EMAIL)
    await page.locator('#admin-password').fill(ADMIN_PASSWORD)
    await page.getByRole('button', { name: /sign in/i }).click()

    // Expect redirect to the OTP page.
    await expect(page).toHaveURL(/\/admin\/verify-otp/, { timeout: 10_000 })

    // Wait until the API log contains a NEW OTP entry (count > preCount).
    // Small poll loop — usually arrives within a few hundred ms.
    let otp = ''
    for (let i = 0; i < 25; i++) {
      const current = readFileSync(API_LOG_PATH, 'utf8')
      const all = [...current.matchAll(/"code":"(\d{6})"/g)]
      if (all.length > preCount) {
        otp = all[all.length - 1][1]
        break
      }
      await page.waitForTimeout(200)
    }
    if (!otp) {
      // Fallback — use the most recent OTP even if count didn't change. This
      // keeps the test resilient if the API logs OTP before the browser
      // navigates to /admin/verify-otp.
      otp = readLatestOtpFromLog()
    }

    // The OTP UI is six individual <input maxLength={1}> boxes with ids
    // `otp-0` ... `otp-5`. Fill each digit in turn.
    for (let i = 0; i < 6; i++) {
      await page.locator(`#otp-${i}`).fill(otp[i])
    }

    // Submit — the verify button should enable once all 6 digits are filled.
    await page.getByRole('button', { name: /verify|continue|submit/i }).first().click()

    // Expect to land on the admin dashboard.
    await expect(page).toHaveURL(/\/admin\/dashboard/, { timeout: 15_000 })

    // Admin shell chrome — sidebar exposes Cohorts / Students nav entries.
    // Either should be visible; use .first() to tolerate desktop vs. mobile
    // duplicates.
    await expect(
      page.getByRole('link', { name: /Students|Cohorts|Dashboard/i }).first(),
    ).toBeVisible()
  })
})
