// FIR-75: PWA Lighthouse targets
// - Performance: 90+ (code splitting, lazy routes)
// - PWA: 90+ (manifest, SW, HTTPS required in prod)
// - To audit: npx lighthouse https://nextaibuilder.com --view
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png', 'og-image.png'],
      manifest: {
        name: 'nextaibuilder — AI product cohorts that ship',
        short_name: 'nextaibuilder',
        description:
          'Live and recorded cohorts that teach you to ship production AI products with the Anthropic Claude API.',
        theme_color: '#0d1a3a',
        background_color: '#f8f9fb',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /^\/api\/v1\/storefront\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-storefront',
              expiration: { maxEntries: 20, maxAgeSeconds: 3600 },
            },
          },
        ],
      },
    }),
  ],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
  resolve: {
    alias: { '@': '/src' },
    // Prefer TS sources over .js compiled outputs. Without this, Vite's
    // default order (.mjs, .js, .mts, .ts, .jsx, .tsx, .json) picks up
    // stale .js siblings when they exist. Wave 10 deletes the siblings,
    // but this flip makes the resolution deterministic going forward.
    extensions: ['.tsx', '.ts', '.jsx', '.mjs', '.mts', '.js', '.json'],
  },
})
