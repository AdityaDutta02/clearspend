import { extractJsonArray } from '@/lib/ai/utils'
import type { RawTransaction } from '@/types'

const GATEWAY_URL = process.env.TERMINAL_AI_GATEWAY_URL!

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

export async function extractTransactionsFromText(
  rawText: string,
  embedToken: string,
): Promise<RawTransaction[]> {
  const prompt = `Extract all bank transactions from the following statement text.
Return ONLY a JSON array of objects with these fields:
- date: string in YYYY-MM-DD format
- amount: number (positive, no currency symbol)
- type: "debit" or "credit"
- description: string (merchant or description, remove personal info like account numbers)
- upi_ref: string or null

Statement text:
${rawText}

Return ONLY the JSON array, no explanation.`

  const res = await fetch(`${GATEWAY_URL}/ai/chat`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${embedToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'deepseek/deepseek-v3.2',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Unknown AI error' })) as { error: string }
    throw new Error(err.error ?? `AI extract error ${res.status}`)
  }

  const json = await res.json() as { choices?: Array<{ message: { content: string } }> }
  const content = json.choices?.[0]?.message?.content ?? ''
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
