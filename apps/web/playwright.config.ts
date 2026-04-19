// Sprint 4 Story 17 — Playwright E2E config for NAB web.
//
// Notes:
//  • fullyParallel is `false` and a single worker is used so the admin-login
//    smoke test can reliably read the latest DEV OTP from /tmp/nab-api.log
//    without racing another test that also triggers OTP generation.
//  • webServer entries use `reuseExistingServer: true` with no-op echo
//    commands, which means the Playwright runner never starts the stack
//    itself — run `npm run dev` in apps/web and the API server separately
//    before invoking `npm run test:e2e`.
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'echo "Assuming frontend already running at :5173"',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 5_000,
    },
    {
      command: 'echo "Assuming API already running at :4000"',
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
      timeout: 5_000,
    },
  ],
})
