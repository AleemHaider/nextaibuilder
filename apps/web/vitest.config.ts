/// <reference types="vitest" />
// Wave 5 Story Z — Vitest config for the NAB web app. Kept as its own file
// (rather than extending vite.config.ts) so test runs don't boot the PWA /
// Tailwind plugins, which are irrelevant for unit tests and add noise.
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
    // Prefer TS sources over compiled .js siblings during test runs so tests
    // always exercise the current source. Without this, Vite's default order
    // (`.js` before `.tsx`) picks up stale build artefacts in `src/`.
    extensions: ['.tsx', '.ts', '.jsx', '.mjs', '.js', '.mts', '.json'],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [resolve(__dirname, 'src/test/setup.ts')],
    css: true,
    // Story 17 added Playwright E2E specs under tests/e2e/; vitest picks them
    // up otherwise and fails (Playwright APIs are not in scope here).
    exclude: ['node_modules/**', 'dist/**', 'tests/e2e/**'],
  },
})
