import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    root: __dirname,
    include: ['server/**/*.test.ts', 'cli/**/*.test.ts'],
    testTimeout: 10_000,
  },
})
