import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Match the tsconfig path alias "@/* -> ./*" so tests can import like the app does.
const root = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '')

export default defineConfig({
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': root },
  },
})
