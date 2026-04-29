import { NextRequest, NextResponse } from 'next/server'
import { dbDropTable } from '@/lib/db'

// One-shot migration: drop all tables so they get recreated with the current schema on next insert.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const results: Record<string, string> = {}

  for (const table of ['statements_v2', 'analyses', 'transactions']) {
    try {
      await dbDropTable(table, token)
      results[table] = 'dropped'
    } catch (e) {
      results[table] = `error: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  return NextResponse.json({ results })
}
