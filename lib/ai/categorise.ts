import { callModel } from '@/lib/terminal-ai'
import type { CategorySlug } from '@/types'
import { extractJsonArray } from './utils'

interface RawTx {
  id: string
  date: string
  amount: number
  type: 'debit' | 'credit'
  description: string
  upi_ref: string | null
}

interface CategorisedTx extends RawTx {
  merchant: string
  category: CategorySlug
}

const SYSTEM_PROMPT = `You are a financial transaction categoriser for Indian bank statements.
Given a list of transactions, return a JSON array where each object has:
- id: same as input
- merchant: clean merchant name (e.g. "Swiggy" not "SWIGGY ORDER #12345")
- category: one of: food, transport, shopping, emi_loans, upi, utilities, entertainment, health, travel, others

Rules:
- UPI transactions with unclear merchant -> category "upi"
- EMI/loan repayments -> "emi_loans"
- Electricity/water/broadband -> "utilities"
Return ONLY valid JSON array, no prose.`

export async function categoriseTransactions(
  transactions: RawTx[],
  token: string,
): Promise<CategorisedTx[]> {
  const input = transactions.map(({ id, description, amount, type }) => ({
    id, description, amount, type,
  }))

  try {
    const content = await callModel(
      'deepseek/deepseek-v3.2',
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(input) },
      ],
      token,
    )

    const parsed = JSON.parse(extractJsonArray(content)) as Array<{
      id: string
      merchant: string
      category: string
    }>

    const lookup = new Map(parsed.map((p) => [p.id, p]))

    return transactions.map((tx) => {
      const categorised = lookup.get(tx.id)
      return {
        ...tx,
        merchant: categorised?.merchant ?? tx.description.slice(0, 40),
        category: (categorised?.category as CategorySlug) ?? 'others',
      }
    })
  } catch (err) {
    console.error('[categorise] AI failed, using fallback defaults:', err instanceof Error ? err.message : String(err))
    return transactions.map((tx) => ({
      ...tx,
      merchant: tx.description.slice(0, 40),
      category: 'others' as CategorySlug,
    }))
  }
}
