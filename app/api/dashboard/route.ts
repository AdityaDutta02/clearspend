import { NextRequest, NextResponse } from 'next/server'
import { dbList, dbDelete } from '@/lib/db'
import type { Statement, Analysis, Transaction, DashboardData } from '@/types'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [statements, analyses, transactions] = await Promise.all([
    dbList<Statement>('statements', {}, token).catch(() => [] as Statement[]),
    dbList<Analysis>('analyses', {}, token).catch(() => [] as Analysis[]),
    dbList<Transaction>('transactions', {}, token).catch(() => [] as Transaction[]),
  ])

  // Auto-delete orphan statements (no matching analysis — e.g. failed pipeline run)
  const analysedIds = new Set(analyses.map((a) => a.statement_id))
  const orphans = statements.filter((s) => !analysedIds.has(s.id))

  if (orphans.length > 0) {
    await Promise.all(
      orphans.flatMap((s) => {
        const txIds = transactions.filter((t) => t.statement_id === s.id).map((t) => t.id)
        return [
          ...txIds.map((id) => dbDelete('transactions', id, token).catch(() => undefined)),
          dbDelete('statements', s.id, token).catch(() => undefined),
        ]
      }),
    )
  }

  const cleanStatements = statements.filter((s) => analysedIds.has(s.id))
  const cleanTxIds = new Set(cleanStatements.map((s) => s.id))
  const cleanTransactions = transactions.filter((t) => cleanTxIds.has(t.statement_id))

  const data: DashboardData = { statements: cleanStatements, analyses, transactions: cleanTransactions }
  return NextResponse.json(data)
}
