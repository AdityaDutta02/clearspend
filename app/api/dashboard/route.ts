import { NextRequest, NextResponse } from 'next/server'
import { dbList, dbDelete } from '@/lib/db'
import type { Statement, Analysis, Transaction, DashboardData } from '@/types'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [statements, analyses] = await Promise.all([
    dbList<Statement>('statements', {}, token),
    dbList<Analysis>('analyses', {}, token),
  ])

  // Auto-delete orphan statements (statement with no matching analysis — e.g. from a failed pipeline run)
  const analysedIds = new Set(analyses.map((a) => a.statement_id))
  const orphans = statements.filter((s) => !analysedIds.has(s.id))

  if (orphans.length > 0) {
    const transactions = await dbList<Transaction>('transactions', {}, token)
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
  const data: DashboardData = { statements: cleanStatements, analyses }
  return NextResponse.json(data)
}
