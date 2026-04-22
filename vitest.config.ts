import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyPlugin = any

export default defineConfig({
  plugins: [react() as AnyPlugin],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
  },
  resolve: {
    alias: { '@': resolve(__dirname, '.') },
  },
})
