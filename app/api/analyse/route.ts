import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { dbInsert, dbList } from '@/lib/db'
import { categoriseTransactions } from '@/lib/ai/categorise'
import { resolveUpiMerchants } from '@/lib/ai/upi-resolve'
import { generateInsights } from '@/lib/ai/insights'
import type { Statement, Transaction, Analysis, CategorySlug } from '@/types'

const RawTransactionSchema = z.object({
  date: z.string(),
  amount: z.number(),
  type: z.enum(['debit', 'credit']),
  description: z.string(),
  upi_ref: z.string().nullable(),
})

const AnalyseRequestSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  bank: z.enum(['hdfc', 'sbi', 'icici', 'axis', 'kotak', 'yes', 'pnb', 'bob', 'canara', 'indusind']),
  account_type: z.enum(['credit', 'debit']),
  transactions: z.array(RawTransactionSchema).min(1).max(1000),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body: unknown = await req.json()
  const parsed = AnalyseRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { month, bank, account_type, transactions: rawTxs } = parsed.data

  // Declare statementId before dbInsert so it is available in downstream steps
  // regardless of what id the DB layer returns (caller id overrides auto-generated id
  // because dbInsert does { id: crypto.randomUUID(), ...row } and our id is in row)
  const statementId = crypto.randomUUID()
  const statement = await dbInsert<Statement>('statements', {
    id: statementId,
    month, bank, account_type,
    transaction_count: rawTxs.length,
    total_debit: rawTxs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0),
    total_credit: rawTxs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0),
    currency: 'INR',
    uploaded_at: new Date().toISOString(),
  }, token)

  // AI Step 1: categorise
  const withIds = rawTxs.map((tx, i) => ({ ...tx, id: `${statementId}_${i}` }))
  const categorised = await categoriseTransactions(withIds, token)

  // AI Step 2: resolve UPI merchants
  const withUpi = await resolveUpiMerchants(
    categorised.map((tx) => ({
      id: tx.id, upi_ref: tx.upi_ref, merchant: tx.merchant, description: tx.description,
    })),
    token,
  )
  const upiMerchantMap = new Map(withUpi.map((tx) => [tx.id, tx.upi_merchant]))

  const finalTxs: Transaction[] = categorised.map((tx) => ({
    id: tx.id,
    statement_id: statementId,
    date: tx.date,
    amount: tx.amount,
    type: tx.type,
    merchant: tx.merchant,
    category: tx.category,
    upi_ref: tx.upi_ref,
    upi_merchant: upiMerchantMap.get(tx.id) ?? null,
    raw_description: tx.description,
  }))

  for (const tx of finalTxs) {
    await dbInsert<Transaction>('transactions', tx as unknown as Record<string, unknown>, token)
  }

  // Aggregate spend by category (debits only)
  const debits = finalTxs.filter((tx) => tx.type === 'debit')
  const categoryBreakdown = debits.reduce<Record<string, number>>((acc, tx) => {
    acc[tx.category] = (acc[tx.category] ?? 0) + tx.amount
    return acc
  }, {})

  const merchantMap = new Map<string, { total: number; count: number }>()
  for (const tx of debits) {
    const prev = merchantMap.get(tx.merchant) ?? { total: 0, count: 0 }
    merchantMap.set(tx.merchant, { total: prev.total + tx.amount, count: prev.count + 1 })
  }
  const topMerchants = [...merchantMap.entries()]
    .map(([name, { total, count }]) => ({ name, total, count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // Aggregate UPI merchant totals
  const upiTxs = debits.filter((tx) => tx.upi_merchant)
  const upiMerchantTotalsMap = new Map<string, { total: number; count: number }>()
  for (const tx of upiTxs) {
    // upi_merchant is guaranteed non-null by the filter above
    const name = tx.upi_merchant!
    const prev = upiMerchantTotalsMap.get(name) ?? { total: 0, count: 0 }
    upiMerchantTotalsMap.set(name, { total: prev.total + tx.amount, count: prev.count + 1 })
  }

  const monthlyTotal = debits.reduce((s, tx) => s + tx.amount, 0)

  const priorAnalyses = await dbList<Analysis>('analyses', {}, token)
  const priorMonthTotal = priorAnalyses.length > 0
    ? priorAnalyses.sort((a, b) => b.month.localeCompare(a.month))[0]?.monthly_total ?? null
    : null

  // AI Step 3: insights
  const insights = await generateInsights(
    categoryBreakdown as Record<CategorySlug, number>,
    topMerchants,
    monthlyTotal,
    priorMonthTotal,
    token,
  )

  const analysisId = crypto.randomUUID()
  const analysis = await dbInsert<Analysis>('analyses', {
    id: analysisId,
    statement_id: statementId,
    month,
    category_breakdown: categoryBreakdown as Record<CategorySlug, number>,
    top_merchants: topMerchants,
    upi_summary: {
      total_spent: upiTxs.reduce((s, tx) => s + tx.amount, 0),
      merchant_breakdown: [...upiMerchantTotalsMap.entries()]
        .map(([name, { total, count }]) => ({ name, total, count }))
        .sort((a, b) => b.total - a.total),
    },
    monthly_total: monthlyTotal,
    insights,
    generated_at: new Date().toISOString(),
  }, token)

  return NextResponse.json({ statement, analysis })
}
