import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

// Match the tsconfig path alias "@/* -> ./*" so tests can import like the app does.
const root = fileURLToPath(new URL('.', import.meta.url)).replace(/\/$/, '')

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    // macOS writes `._*` AppleDouble sidecars on external/exFAT volumes; they
    // match the include glob but aren't valid TS. Keep them out of the run.
    exclude: ['**/._*'],
  },
  resolve: {
    alias: { '@': root },
  },
})
