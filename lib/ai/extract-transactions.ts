import { callModel } from '@/lib/terminal-ai'
import { extractJsonArray } from './utils'
import type { RawTransaction } from '@/types'

const MONTH_ABBR: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

function normaliseToIsoDate(raw: string): string {
  if (!raw) return ''
  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy4 = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy4) return `${dmy4[3]}-${dmy4[2].padStart(2, '0')}-${dmy4[1].padStart(2, '0')}`
  // DD/MM/YY or DD-MM-YY
  const dmy2 = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/)
  if (dmy2) {
    const yyyy = parseInt(dmy2[3], 10) > 50 ? `19${dmy2[3]}` : `20${dmy2[3]}`
    return `${yyyy}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`
  }
  // DD Mon YYYY or DD-Mon-YYYY
  const dname = raw.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,9})[\s\-](\d{4})$/)
  if (dname) {
    const mm = MONTH_ABBR[dname[2].toLowerCase().slice(0, 3)]
    if (mm) return `${dname[3]}-${mm}-${dname[1].padStart(2, '0')}`
  }
  return raw
}

const SYSTEM_PROMPT = `You are a financial transaction extractor for Indian bank statements.
Given raw text extracted from a bank statement PDF, extract all transactions.
Return a JSON array where each object has:
- date: "YYYY-MM-DD" format (convert DD/MM/YY, DD/MM/YYYY, "01 Jan 2024", etc.)
- amount: number, always positive
- type: "debit" or "credit" (infer from context: salary/refund/interest = credit; most others = debit)
- description: clean the description, max 80 chars
- upi_ref: UPI reference ID string if present in the transaction, else null

Rules:
- Skip header rows, totals, opening/closing balance lines
- Skip lines without a clear date + amount
- If debit/credit column is ambiguous, use description keywords to infer
- Return ONLY a valid JSON array, no prose`

export async function extractTransactionsWithAI(
  rawText: string,
  token: string,
): Promise<RawTransaction[]> {
  const content = await callModel(
    'deepseek/deepseek-v3.2',
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: rawText },
    ],
    token,
  )

  try {
    const parsed = JSON.parse(extractJsonArray(content)) as Array<{
      date: string
      amount: number
      type: string
      description: string
      upi_ref: string | null
    }>

    return parsed
      .filter((tx) => tx.date && typeof tx.amount === 'number' && tx.amount > 0 && tx.description?.trim())
      .map((tx) => ({
        date: normaliseToIsoDate(tx.date),
        amount: Math.round(tx.amount * 100) / 100,
        type: (tx.type === 'credit' ? 'credit' : 'debit') as 'debit' | 'credit',
        description: String(tx.description).slice(0, 80),
        upi_ref: tx.upi_ref != null ? String(tx.upi_ref) : null,
      }))
      .filter((tx) => /^\d{4}-\d{2}-\d{2}$/.test(tx.date))
  } catch {
    return []
  }
}
