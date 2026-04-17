import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Node environment — no DOM needed for API tests
    environment: 'node',

    // Each test file gets its own module registry so mocks don't bleed across files
    isolate: true,

    // Coverage via v8 (fastest, no instrumentation overhead)
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/__tests__/**', 'src/index.ts'],
    },

    // Print full diff on assertion failures
    reporters: ['verbose'],
  },
})
