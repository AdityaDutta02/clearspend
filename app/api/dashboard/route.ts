import { NextRequest, NextResponse } from 'next/server'
import { dbList } from '@/lib/db'
import type { Statement, Analysis, DashboardData } from '@/types'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [statements, analyses] = await Promise.all([
    dbList<Statement>('statements', {}, token),
    dbList<Analysis>('analyses', {}, token),
  ])

  const data: DashboardData = { statements, analyses }
  return NextResponse.json(data)
}
