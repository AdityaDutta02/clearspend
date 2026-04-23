import { callModel } from '@/lib/terminal-ai'
import { extractJsonArray } from '@/lib/ai/utils'
import type { RawTransaction } from '@/types'

interface AiRawTx {
  date: string
  amount: number
  type: string
  description: string
  upi_ref?: string | null
}

function normaliseToIsoDate(raw: string): string {
  if (!raw) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy4 = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy4) return `${dmy4[3]}-${dmy4[2].padStart(2, '0')}-${dmy4[1].padStart(2, '0')}`

  // DD/MM/YY or DD-MM-YY
  const dmy2 = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/)
  if (dmy2) {
    const year = parseInt(dmy2[3], 10) >= 50 ? `19${dmy2[3]}` : `20${dmy2[3]}`
    return `${year}-${dmy2[2].padStart(2, '0')}-${dmy2[1].padStart(2, '0')}`
  }

  // DD Mon YYYY (e.g. "12 Apr 2025" or "12-Apr-2025")
  const months: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }
  const dmy3 = raw.match(/^(\d{1,2})[\s\-]([A-Za-z]{3})[\s\-](\d{4})$/)
  if (dmy3) {
    const mm = months[dmy3[2].toLowerCase()]
    if (mm) return `${dmy3[3]}-${mm}-${dmy3[1].padStart(2, '0')}`
  }

  return ''
}

const SYSTEM_PROMPT = `You are a bank statement parser for Indian banks.
Extract all transactions from the statement text.
Return ONLY a JSON array of objects with these fields:
- date: string in YYYY-MM-DD format
- amount: number (positive, no currency symbol)
- type: "debit" or "credit"
- description: string (merchant/description, max 200 chars)
- upi_ref: string or null

Return ONLY the JSON array, no explanation.`

export async function extractTransactionsFromText(
  rawText: string,
  embedToken: string,
): Promise<RawTransaction[]> {
  const content = await callModel(
    'deepseek/deepseek-v3.2',
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: rawText.slice(0, 12000) },
    ],
    embedToken,
  )

  const parsed = JSON.parse(extractJsonArray(content)) as AiRawTx[]

  return parsed
    .map((tx) => ({
      date: normaliseToIsoDate(tx.date),
      amount: Math.round(tx.amount * 100) / 100,
      type: (tx.type === 'credit' ? 'credit' : 'debit') as 'debit' | 'credit',
      description: (tx.description ?? '').slice(0, 300),
      upi_ref: tx.upi_ref ?? null,
    }))
    .filter((tx) => /^\d{4}-\d{2}-\d{2}$/.test(tx.date) && tx.amount > 0)
}
