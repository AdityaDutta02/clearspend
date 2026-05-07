import { NextRequest, NextResponse } from 'next/server'
import { dbList, dbDelete } from '@/lib/db'
import type { Transaction, Analysis } from '@/types'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const statementId = params.id

  try {
    const [transactions, analyses] = await Promise.all([
      dbList<Transaction>('transactions', { statement_id: statementId }, token),
      dbList<Analysis>('analyses', { statement_id: statementId }, token),
    ])

    for (const t of transactions) await dbDelete('transactions', t.id, token)
    for (const a of analyses) await dbDelete('analyses', a.id, token)
    await dbDelete('statements', statementId, token)

    return NextResponse.json({ success: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
