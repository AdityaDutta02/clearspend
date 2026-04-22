import { callModel } from '@/lib/terminal-ai'
import { extractJsonArray } from './utils'

interface TxWithUpi {
  id: string
  upi_ref: string | null
  merchant: string
  description: string
}

interface TxWithUpiMerchant extends TxWithUpi {
  upi_merchant: string | null
}

const SYSTEM_PROMPT = `You are an expert at identifying Indian UPI merchants.
Given UPI transaction IDs and descriptions, resolve the real merchant name.
Examples:
- "swiggy@sbi" -> "Swiggy"
- "zomatoltd@hdfc" -> "Zomato"
- "ola.cabs@hdfc" -> "Ola Cabs"
- "netflix.com@ybl" -> "Netflix"
- "bigbasket@axis" -> "BigBasket"
Return JSON array: [{ "id": "...", "upi_merchant": "..." }]
Return ONLY the JSON array, no prose.`

export async function resolveUpiMerchants(
  transactions: TxWithUpi[],
  token: string,
): Promise<TxWithUpiMerchant[]> {
  const upiTxs = transactions.filter((tx) => tx.upi_ref !== null)

  if (upiTxs.length === 0) {
    return transactions.map((tx) => ({ ...tx, upi_merchant: null }))
  }

  const input = upiTxs.map(({ id, upi_ref, description }) => ({ id, upi_ref, description }))

  const content = await callModel(
    'qwen/qwen3-235b-a22b-2507',
    [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: JSON.stringify(input) },
    ],
    token,
  )

  const parsed = JSON.parse(extractJsonArray(content)) as Array<{
    id: string
    upi_merchant: string
  }>
  const lookup = new Map(parsed.map((p) => [p.id, p.upi_merchant]))

  return transactions.map((tx) => ({
    ...tx,
    upi_merchant: tx.upi_ref ? (lookup.get(tx.id) ?? null) : null,
  }))
}
