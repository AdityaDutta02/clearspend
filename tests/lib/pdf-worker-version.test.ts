import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { createRequire } from 'node:module'

describe('vendored pdf.js worker', () => {
  it('exists and matches installed pdfjs-dist version', () => {
    const workerPath = resolve(__dirname, '../../public/pdf.worker.min.mjs')
    expect(existsSync(workerPath)).toBe(true)
    const require = createRequire(__filename)
    const installed = require('pdfjs-dist/package.json').version as string
    const contents = readFileSync(workerPath, 'utf8')
    expect(contents).toContain(installed)
  })
})
