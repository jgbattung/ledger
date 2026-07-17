import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Dedicated Vitest config so the app's vite-plugin-pwa (service-worker
// generation) never runs during tests. Mirrors the app's `@/` path alias.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
    include: ['src/**/*.test.{ts,tsx}'],
    // The LibraryPage suite drives userEvent interactions against the full
    // ~440-row catalog, which re-renders on every keystroke. In isolation each
    // test runs in ~1.5-2.5s, but under the default 5000ms timeout they flake
    // when Vitest's parallel workers contend for CPU (the whole suite, and CI,
    // run in parallel). Give real-but-slow jsdom tests headroom so a green
    // suite stays green regardless of machine load.
    testTimeout: 15000,
  },
})
