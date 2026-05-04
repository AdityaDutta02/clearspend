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
  // Use up to 5000 chars of full text for bank detection so names buried past page 1 are found
  const { bank, month, account_type, card_name, last_four } = detectBankAndMonth(fullText.slice(0, 5000), file.name)
  const transactions = extractTransactions(fullText)

  return {
    bank,
    month,
    account_type,
    card_name,
    last_four,
    transactions,
    raw_header: stripPii(headerText.slice(0, 500)),
    raw_text: stripPii(fullText.slice(0, 15000)),
  }
}

const MONTH_ABBR: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

// Matches: DD/MM/YYYY, DD-MM-YYYY, DD-MMM-YY, DD-MMM-YYYY, DD MMM 'YY (Axis Bank apostrophe format)
// ['‘’] handles ASCII apostrophe, Unicode left/right single quotes from PDF extraction
const DATE_PAT = String.raw`(\d{1,2}[\/\-]\d{2}[\/\-]\d{2,4}|\d{1,2}[\-\s][A-Za-z]{3}[\-\s]['‘’]?\d{2,4})`

function extractTransactions(text: string): RawTransaction[] {
  const transactions: RawTransaction[] = []
  // Handles:
  //   DD-MMM-'YY  description  ₹ 1,234.56  Debit/Credit    (Axis Bank)
  //   DD/MM/YYYY  description  1,234.56 Dr/Cr              (HDFC/ICICI etc.)
  const linePattern = new RegExp(
    `${DATE_PAT}\\s+(.+?)\\s+₹?\\s*([\\d,]+\\.\\d{2})\\s*(Debit|Credit|Dr|Cr|DR|CR)?`,
    'g',
  )

  for (const match of text.matchAll(linePattern)) {
    const [, rawDate, rawDesc, rawAmount, typeMarker] = match
    const date = normaliseDate(rawDate.trim())
    if (!date) continue
    const amount = parseFloat(rawAmount.replace(/,/g, ''))
    const type =
      typeMarker?.toLowerCase() === 'credit' || typeMarker?.toUpperCase() === 'CR'
        ? 'credit'
        : 'debit'
    const description = stripPii(rawDesc.trim())
    const upiRef = extractUpiRef(description)
    transactions.push({ date, amount, type, description, upi_ref: upiRef })
  }

  return transactions
}

function normaliseDate(raw: string): string {
  // DD/MM/YYYY or DD-MM-YYYY (or 2-digit year)
  const numeric = raw.match(/^(\d{1,2})[\/\-](\d{2})[\/\-](\d{2,4})$/)
  if (numeric) {
    const [, dd, mm, yyyy] = numeric
    const year = yyyy.length === 2 ? (parseInt(yyyy) >= 50 ? `19${yyyy}` : `20${yyyy}`) : yyyy
    return `${year}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
  }
  // DD-MMM-YY/YYYY, DD MMM YYYY, DD MMM 'YY (Axis Bank apostrophe prefix)
  const named = raw.match(/^(\d{1,2})[\-\s]([A-Za-z]{3})[\-\s][''']?(\d{2,4})$/)
  if (named) {
    const mm = MONTH_ABBR[named[2].toLowerCase()]
    if (!mm) return ''
    const year = named[3].length === 2 ? (parseInt(named[3]) >= 50 ? `19${named[3]}` : `20${named[3]}`) : named[3]
    return `${year}-${mm}-${named[1].padStart(2, '0')}`
  }
  return ''
}

function extractUpiRef(description: string): string | null {
  const vpa = description.match(/([a-zA-Z0-9._\-]+@[a-zA-Z]{2,})/i)
  if (vpa) return vpa[1]
  const code = description.match(/UPI[\/\-\s]+([A-Z0-9]{6,})/i)
  return code ? code[1] : null
}
