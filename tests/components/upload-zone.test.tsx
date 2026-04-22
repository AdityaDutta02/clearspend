import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { UploadZone } from '@/components/upload/upload-zone'
import type { ParsedStatement } from '@/types'

vi.mock('@/lib/pdf-parser', () => ({
  parsePdf: vi.fn(),
  PdfPasswordError: class PdfPasswordError extends Error {
    constructor() {
      super('PDF is password-protected')
      this.name = 'PdfPasswordError'
    }
  },
}))

async function importPdfParser(): Promise<typeof import('@/lib/pdf-parser')> {
  return import('@/lib/pdf-parser')
}

function createPdfFile(name = 'statement.pdf'): File {
  return new File(['%PDF-1.4 content'], name, { type: 'application/pdf' })
}

const MOCK_PARSED_STATEMENT: ParsedStatement = {
  bank: 'hdfc',
  month: '2024-03',
  account_type: 'debit',
  transactions: [
    {
      date: '2024-03-01',
      amount: 500,
      type: 'debit',
      description: 'Coffee Shop',
      upi_ref: null,
    },
  ],
  raw_header: 'HDFC Bank Account Statement March 2024',
}

describe('UploadZone', () => {
  let onParsed: ReturnType<typeof vi.fn>
  let onError: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onParsed = vi.fn()
    onError = vi.fn()
    vi.clearAllMocks()
  })

  it('renders drop zone with correct aria-label', () => {
    render(<UploadZone onParsed={onParsed} onError={onError} />)
    const zone = screen.getByRole('button', { name: 'Upload PDF statement' })
    expect(zone).toBeInTheDocument()
  })

  it('shows error message when non-PDF file is dropped', async () => {
    render(<UploadZone onParsed={onParsed} onError={onError} />)

    const zone = screen.getByTestId('upload-zone')
    const nonPdfFile = new File(['hello world'], 'document.txt', { type: 'text/plain' })

    fireEvent.drop(zone, {
      dataTransfer: { files: [nonPdfFile] },
    })

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        'Only PDF files are supported. Please select a PDF bank statement.',
      )
    })
    expect(onParsed).not.toHaveBeenCalled()
  })

  it('shows loading state while parsePdf is in-flight', async () => {
    const { parsePdf } = await importPdfParser()
    let resolvePromise!: (value: ParsedStatement) => void
    const hangingPromise = new Promise<ParsedStatement>((resolve) => {
      resolvePromise = resolve
    })
    vi.mocked(parsePdf).mockReturnValue(hangingPromise)

    render(<UploadZone onParsed={onParsed} onError={onError} />)

    const input = screen.getByTestId('upload-input')
    const pdfFile = createPdfFile()

    Object.defineProperty(input, 'files', {
      value: [pdfFile],
      configurable: true,
    })
    fireEvent.change(input)

    await waitFor(() => {
      expect(screen.getByTestId('loading-text')).toBeInTheDocument()
    })

    // Resolve so the component can clean up
    resolvePromise(MOCK_PARSED_STATEMENT)
  })

  it('calls onParsed with correct shape after successful parse', async () => {
    const { parsePdf } = await importPdfParser()
    vi.mocked(parsePdf).mockResolvedValue(MOCK_PARSED_STATEMENT)

    render(<UploadZone onParsed={onParsed} onError={onError} />)

    const input = screen.getByTestId('upload-input')
    const pdfFile = createPdfFile('march-statement.pdf')

    Object.defineProperty(input, 'files', {
      value: [pdfFile],
      configurable: true,
    })
    fireEvent.change(input)

    await waitFor(() => {
      expect(onParsed).toHaveBeenCalledTimes(1)
    })

    expect(onParsed).toHaveBeenCalledWith(
      expect.objectContaining({
        file: pdfFile,
        text: MOCK_PARSED_STATEMENT.raw_header,
        transactions: MOCK_PARSED_STATEMENT.transactions,
        detection: {
          bank: MOCK_PARSED_STATEMENT.bank,
          month: MOCK_PARSED_STATEMENT.month,
          account_type: MOCK_PARSED_STATEMENT.account_type,
        },
      }),
    )
  })

  it('calls onError with password-protection message on PdfPasswordError', async () => {
    const { parsePdf, PdfPasswordError } = await importPdfParser()
    vi.mocked(parsePdf).mockRejectedValue(new PdfPasswordError())

    render(<UploadZone onParsed={onParsed} onError={onError} />)

    const input = screen.getByTestId('upload-input')
    const pdfFile = createPdfFile('protected.pdf')

    Object.defineProperty(input, 'files', {
      value: [pdfFile],
      configurable: true,
    })
    fireEvent.change(input)

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(
        'This PDF is password protected. Please remove the password and try again.',
      )
    })
    expect(onParsed).not.toHaveBeenCalled()
  })
})
