import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { dbInsert, dbList, dbDelete } from '@/lib/db'
import { categoriseTransactions } from '@/lib/ai/categorise'
import { resolveUpiMerchants } from '@/lib/ai/upi-resolve'
import { generateInsights } from '@/lib/ai/insights'
import { extractTransactionsWithAI } from '@/lib/ai/extract-transactions'
import type { Statement, Transaction, Analysis, CategorySlug } from '@/types'

const RawTransactionSchema = z.object({
  date: z.string(),
  amount: z.number(),
  type: z.enum(['debit', 'credit']),
  description: z.string(),
  upi_ref: z.string().nullable(),
})

const AnalyseRequestSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).nullable(),
  bank: z.enum(['hdfc', 'sbi', 'icici', 'axis', 'kotak', 'yes', 'pnb', 'bob', 'canara', 'indusind']).nullable(),
  account_type: z.enum(['credit', 'debit']),
  transactions: z.array(RawTransactionSchema).max(1000),
  raw_text: z.string().max(20000).optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = AnalyseRequestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_REQUEST', details: parsed.error.flatten() }, { status: 400 })
  }

  let { month, bank, account_type, transactions: rawTxs, raw_text } = parsed.data

  // AI fallback: if regex extracted 0 transactions, let the model parse the raw text
  if (rawTxs.length === 0 && raw_text) {
    try {
      rawTxs = await extractTransactionsWithAI(raw_text, token)
    } catch {
      // AI extraction failed — fall through to NO_TRANSACTIONS error
    }
  }

  if (rawTxs.length === 0) {
    return NextResponse.json({ error: 'NO_TRANSACTIONS' }, { status: 422 })
  }

  if (!bank || !month) {
    return NextResponse.json({ error: 'BANK_NOT_DETECTED' }, { status: 422 })
  }

  // Sanitize all transactions before DB operations
  rawTxs = rawTxs
    .filter((tx) => /^\d{4}-\d{2}-\d{2}$/.test(tx.date) && tx.amount > 0)
    .map((tx) => ({
      ...tx,
      amount: Math.round(tx.amount * 100) / 100,
      description: tx.description.slice(0, 200),
      upi_ref: tx.upi_ref != null ? String(tx.upi_ref) : null,
    }))

  if (rawTxs.length === 0) {
    return NextResponse.json({ error: 'NO_TRANSACTIONS' }, { status: 422 })
  }

  const statementId = crypto.randomUUID()
  const insertedTxIds: string[] = []

  try {
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

    // Transaction has typed narrow fields (CategorySlug, 'debit'|'credit') not assignable to Record<string, unknown> directly
    for (const tx of finalTxs) {
      await dbInsert<Transaction>('transactions', tx as unknown as Record<string, unknown>, token)
      insertedTxIds.push(tx.id)
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

    const priorAnalyses = (await dbList<Analysis>('analyses', {}, token))
      .filter((a) => a.month < month)
      .sort((a, b) => b.month.localeCompare(a.month))
    const priorMonthTotal = priorAnalyses[0]?.monthly_total ?? null

    // AI Step 3: insights
    const insights = await generateInsights(
      categoryBreakdown as Partial<Record<CategorySlug, number>>,
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
      category_breakdown: categoryBreakdown as Partial<Record<CategorySlug, number>>,
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
  } catch (err) {
    // Rollback: delete statement and any partially inserted transactions
    await Promise.all([
      ...insertedTxIds.map((id) => dbDelete('transactions', id, token).catch(() => undefined)),
      dbDelete('statements', statementId, token).catch(() => undefined),
    ])

    const message = err instanceof Error ? err.message : String(err)
    if (message.includes('INSUFFICIENT_CREDITS') || message.includes('insufficient')) {
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }
    return NextResponse.json({ error: 'ANALYSIS_FAILED', details: message }, { status: 500 })
  }
}
