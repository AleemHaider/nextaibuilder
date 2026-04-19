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
