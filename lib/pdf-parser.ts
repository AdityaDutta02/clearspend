'use client'

import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { ParsedStatement, RawTransaction } from '@/types'
import { stripPii } from '@/lib/pii-stripper'
import { detectBankAndMonth } from '@/lib/bank-detect'

async function getPdfJs() {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc =
    `//unpkg.com/pdfjs-dist@${String(pdfjs.version)}/build/pdf.worker.min.mjs`
  return pdfjs
}

export class PdfPasswordError extends Error {
  constructor() {
    super('PDF is password-protected')
    this.name = 'PdfPasswordError'
  }
}

export interface PdfParseOptions {
  password?: string
}

export async function parsePdf(
  file: File,
  options: PdfParseOptions = {},
): Promise<ParsedStatement> {
  const pdfjs = await getPdfJs()
  const arrayBuffer = await file.arrayBuffer()

  let doc: PDFDocumentProxy
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      password: options.password,
    }).promise
  } catch (err) {
    // pdfjs PasswordException is a plain object, not an Error subclass — check name directly
    if (
      err !== null &&
      typeof err === 'object' &&
      (err as { name?: string }).name === 'PasswordException'
    ) {
      throw new PdfPasswordError()
    }
    throw err
  }

  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }

  const fullText = pages.join('\n')
  const headerText = pages[0] ?? ''
  const { bank, month, account_type } = detectBankAndMonth(headerText)
  const transactions = extractTransactions(fullText)

  return {
    bank,
    month,
    account_type,
    transactions,
    raw_header: stripPii(headerText.slice(0, 500)),
    raw_text: stripPii(fullText.slice(0, 15000)),
  }
}

function extractTransactions(text: string): RawTransaction[] {
  const transactions: RawTransaction[] = []
  const linePattern =
    /(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Dr|Cr|DR|CR)?/g

  for (const match of text.matchAll(linePattern)) {
    const [, rawDate, rawDesc, rawAmount, drCr] = match
    const date = normaliseDate(rawDate)
    const amount = parseFloat(rawAmount.replace(/,/g, ''))
    const type = drCr?.toUpperCase() === 'CR' ? 'credit' : 'debit'
    const description = stripPii(rawDesc.trim())
    const upiRef = extractUpiRef(description)
    transactions.push({ date, amount, type, description, upi_ref: upiRef })
  }

  return transactions
}

function normaliseDate(raw: string): string {
  const parts = raw.split(/[\/\-]/)
  if (parts.length !== 3) return raw
  const [dd, mm, yyyy] = parts
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

function extractUpiRef(description: string): string | null {
  const match = description.match(/UPI[\/\-\s]*([A-Z0-9]+)/i)
  return match ? match[1] : null
}
