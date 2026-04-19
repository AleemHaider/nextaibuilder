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
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [resolve(__dirname, 'src/test/setup.ts')],
    css: true,
  },
})
