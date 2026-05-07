import { NextRequest, NextResponse } from 'next/server'
import { dbList, dbDelete } from '@/lib/db'
import type { Transaction, Analysis } from '@/types'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const statementId = params.id

  // Cascade: fetch then delete transactions, analysis, statement
  const [transactions, analyses] = await Promise.all([
    dbList<Transaction>('transactions', { statement_id: statementId }, token),
    dbList<Analysis>('analyses', { statement_id: statementId }, token),
  ])

  await Promise.all([
    ...transactions.map((t) => dbDelete('transactions', t.id, token)),
    ...analyses.map((a) => dbDelete('analyses', a.id, token)),
  ])
  await dbDelete('statements', statementId, token)

  return NextResponse.json({ success: true })
}
