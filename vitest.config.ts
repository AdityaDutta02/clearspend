import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
// @vitejs/plugin-react Plugin type conflicts with vitest PluginOption union — safe cast, no runtime effect
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
