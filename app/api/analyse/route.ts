import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { dbInsert, dbDelete, dbList } from '@/lib/db'
import { categoriseTransactions } from '@/lib/ai/categorise'
import { resolveUpiMerchants } from '@/lib/ai/upi-resolve'
import { generateInsights } from '@/lib/ai/insights'
import { extractTransactionsFromText } from '@/lib/ai/extract-transactions'
import { detectBankAndMonth } from '@/lib/bank-detect'
import type { Statement, Transaction, Analysis, CategorySlug } from '@/types'

const RawTransactionSchema = z.object({
  date: z.string(),
  amount: z.number(),
  type: z.enum(['debit', 'credit']),
  description: z.string(),
  upi_ref: z.string().nullable(),
})

const AnalyseRequestSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).nullable().optional(),
  bank: z.enum(['hdfc', 'sbi', 'icici', 'axis', 'kotak', 'yes', 'pnb', 'bob', 'canara', 'indusind']).nullable().optional(),
  account_type: z.enum(['credit', 'debit']),
  transactions: z.array(RawTransactionSchema).max(1000),
  raw_text: z.string().optional(),
  card_name: z.string().nullable().optional(),
  last_four: z.string().nullable().optional(),
})

export async function POST(req: NextRequest): Promise<NextResponse> {
  const reqId = Math.random().toString(36).slice(2, 8)
  console.log(`[analyse:${reqId}] START`)

  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) {
    console.error(`[analyse:${reqId}] FAIL no token`)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: unknown = await req.json()
  const parsed = AnalyseRequestSchema.safeParse(body)
  if (!parsed.success) {
    console.error(`[analyse:${reqId}] FAIL schema:`, JSON.stringify(parsed.error.flatten()))
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  let { month, bank, account_type, transactions: rawTxs } = parsed.data
  const rawText = parsed.data.raw_text
  const cardName = parsed.data.card_name ?? null
  const lastFour = parsed.data.last_four ?? null
  console.log(`[analyse:${reqId}] parsed — txs=${rawTxs.length} hasRawText=${!!rawText} month=${month} bank=${bank} acct=${account_type}`)

  // AI fallback: extract transactions from raw text if regex got none
  if (rawTxs.length === 0 && rawText) {
    console.log(`[analyse:${reqId}] AI fallback extraction start`)
    try {
      rawTxs = await extractTransactionsFromText(rawText, token)
      console.log(`[analyse:${reqId}] AI fallback extracted ${rawTxs.length} txs`)
    } catch (e) {
      console.error(`[analyse:${reqId}] AI fallback failed:`, e instanceof Error ? e.message : String(e))
    }
  }

  if (rawTxs.length === 0) {
    console.error(`[analyse:${reqId}] FAIL no transactions`)
    return NextResponse.json({ error: 'No transactions found in this statement' }, { status: 422 })
  }

  const sanitisedTxs = rawTxs
    .filter((tx) => /^\d{4}-\d{2}-\d{2}$/.test(tx.date))
    .map((tx) => ({
      ...tx,
      amount: Math.round(tx.amount * 100) / 100,
      upi_ref: tx.upi_ref ?? null,
      description: (tx.description ?? '').slice(0, 300),
    }))

  console.log(`[analyse:${reqId}] sanitised ${sanitisedTxs.length}/${rawTxs.length} txs (filtered ${rawTxs.length - sanitisedTxs.length} bad dates)`)

  if (sanitisedTxs.length === 0) {
    const sampleDates = rawTxs.slice(0, 3).map((tx) => tx.date)
    console.error(`[analyse:${reqId}] FAIL all dates invalid — sample:`, sampleDates)
    return NextResponse.json({ error: 'No valid transactions after sanitisation' }, { status: 422 })
  }

  if (!month) {
    const firstDate = sanitisedTxs[0].date
    month = firstDate.slice(0, 7)
  }
  if (!bank && rawText) {
    bank = detectBankAndMonth(rawText, '').bank
  }
  if (!bank) {
    // No bank detected from PDF text or filename — log for debugging
    console.warn(`[analyse:${reqId}] bank not detected, defaulting to hdfc`)
    bank = 'hdfc'
  }

  const statementId = crypto.randomUUID()
  const insertedTxIds: string[] = []

  try {
    console.log(`[analyse:${reqId}] DB insert statement ${statementId}`)
    await dbInsert<Statement>('statements', {
      id: statementId,
      month, bank, account_type,
      transaction_count: sanitisedTxs.length,
      total_debit: sanitisedTxs.filter((t) => t.type === 'debit').reduce((s, t) => s + t.amount, 0),
      total_credit: sanitisedTxs.filter((t) => t.type === 'credit').reduce((s, t) => s + t.amount, 0),
      currency: 'INR',
      uploaded_at: new Date().toISOString(),
    }, token)
    console.log(`[analyse:${reqId}] DB statement OK`)

    // AI Step 1: categorise
    console.log(`[analyse:${reqId}] AI step 1 categorise start (${sanitisedTxs.length} txs)`)
    const withIds = sanitisedTxs.map((tx, i) => ({ ...tx, id: `${statementId}_${i}` }))
    const categorised = await categoriseTransactions(withIds, token)
    console.log(`[analyse:${reqId}] AI step 1 categorise OK`)

    // AI Step 2: resolve UPI merchants
    console.log(`[analyse:${reqId}] AI step 2 upi-resolve start`)
    const withUpi = await resolveUpiMerchants(
      categorised.map((tx) => ({
        id: tx.id, upi_ref: tx.upi_ref, merchant: tx.merchant, description: tx.description,
      })),
      token,
    )
    console.log(`[analyse:${reqId}] AI step 2 upi-resolve OK`)
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

    console.log(`[analyse:${reqId}] DB insert ${finalTxs.length} transactions`)
    for (const tx of finalTxs) {
      await dbInsert<Transaction>('transactions', tx as unknown as Record<string, unknown>, token)
      insertedTxIds.push(tx.id)
    }
    console.log(`[analyse:${reqId}] DB transactions OK`)

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

    const upiTxs = debits.filter((tx) => tx.upi_ref !== null)
    const upiMerchantTotalsMap = new Map<string, { total: number; count: number }>()
    for (const tx of upiTxs) {
      const name = tx.upi_merchant ?? tx.upi_ref!
      const prev = upiMerchantTotalsMap.get(name) ?? { total: 0, count: 0 }
      upiMerchantTotalsMap.set(name, { total: prev.total + tx.amount, count: prev.count + 1 })
    }

    const monthlyTotal = debits.reduce((s, tx) => s + tx.amount, 0)

    console.log(`[analyse:${reqId}] DB list prior analyses`)
    const priorAnalyses = (await dbList<Analysis>('analyses', {}, token))
      .filter((a) => a.month < month!)
      .sort((a, b) => b.month.localeCompare(a.month))
    const priorMonthTotal = priorAnalyses[0]?.monthly_total ?? null
    console.log(`[analyse:${reqId}] prior analyses: ${priorAnalyses.length} found`)

    // AI Step 3: insights
    console.log(`[analyse:${reqId}] AI step 3 insights start`)
    const insights = await generateInsights(
      categoryBreakdown as Partial<Record<CategorySlug, number>>,
      topMerchants,
      monthlyTotal,
      priorMonthTotal,
      token,
    )
    console.log(`[analyse:${reqId}] AI step 3 insights OK — ${insights.length} insights`)

    const analysisId = crypto.randomUUID()
    console.log(`[analyse:${reqId}] DB insert analysis ${analysisId}`)
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
        card_name: cardName,
        last_four: lastFour,
      },
      monthly_total: monthlyTotal,
      insights,
      generated_at: new Date().toISOString(),
    }, token)
    console.log(`[analyse:${reqId}] DB analysis OK — DONE`)

    return NextResponse.json({ success: true, analysis })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? err.stack : undefined
    console.error(`[analyse:${reqId}] CAUGHT ERROR: ${message}`)
    if (stack) console.error(`[analyse:${reqId}] STACK: ${stack}`)

    // Rollback: delete any inserted transactions and the statement
    await Promise.all([
      ...insertedTxIds.map((id) => dbDelete('transactions', id, token).catch(() => undefined)),
      dbDelete('statements', statementId, token).catch(() => undefined),
    ])
    console.log(`[analyse:${reqId}] rollback complete (deleted ${insertedTxIds.length} txs + statement)`)

    if (message.includes('INSUFFICIENT_CREDITS')) {
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }
    return NextResponse.json({ error: 'ANALYSIS_FAILED', details: message }, { status: 500 })
  }
}
