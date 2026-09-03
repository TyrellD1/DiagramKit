import path from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.join(__dirname, 'src'),
    },
  },
  test: {
    root: __dirname,
    include: ['server/**/*.test.ts', 'cli/**/*.test.ts', 'src/**/*.test.ts', 'migrations/**/*.test.ts'],
    testTimeout: 10_000,
  },
})
