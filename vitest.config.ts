import { defineConfig } from 'vitest/config'

// e2e/ 是 Playwright 的地盤，vitest 不要掃
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts']
  }
})
