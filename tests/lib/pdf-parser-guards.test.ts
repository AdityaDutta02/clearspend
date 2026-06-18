import { describe, it, expect } from 'vitest'
import { MAX_PDF_BYTES, MAX_PDF_PAGES, PdfTooLargeError } from '@/lib/pdf-parser'

describe('pdf-parser guards', () => {
  it('exports a 10MB byte cap and a 50 page cap', () => {
    expect(MAX_PDF_BYTES).toBe(10 * 1024 * 1024)
    expect(MAX_PDF_PAGES).toBe(50)
  })

  it('PdfTooLargeError carries the right name', () => {
    const err = new PdfTooLargeError('too big')
    expect(err.name).toBe('PdfTooLargeError')
    expect(err).toBeInstanceOf(Error)
  })
})
