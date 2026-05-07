import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DELETE } from '@/app/api/statements/[id]/route'
import { NextRequest } from 'next/server'

vi.mock('@/lib/db', () => ({
  dbList: vi.fn(),
  dbDelete: vi.fn(),
}))

import { dbList, dbDelete } from '@/lib/db'

describe('DELETE /api/statements/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no authorization header', async () => {
    const req = new NextRequest('http://localhost/api/statements/stmt-1', { method: 'DELETE' })
    const res = await DELETE(req, { params: { id: 'stmt-1' } })
    expect(res.status).toBe(401)
  })

  it('cascades delete of transactions and analyses then deletes statement', async () => {
    vi.mocked(dbList).mockImplementation(async (table) => {
      if (table === 'transactions') return [{ id: 'txn-1' }, { id: 'txn-2' }] as any
      if (table === 'analyses') return [{ id: 'analysis-1' }] as any
      return []
    })
    vi.mocked(dbDelete).mockResolvedValue(undefined)

    const req = new NextRequest('http://localhost/api/statements/stmt-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer test-token' },
    })
    const res = await DELETE(req, { params: { id: 'stmt-1' } })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual({ success: true })

    expect(dbList).toHaveBeenCalledWith('transactions', { statement_id: 'stmt-1' }, 'test-token')
    expect(dbList).toHaveBeenCalledWith('analyses', { statement_id: 'stmt-1' }, 'test-token')
    expect(dbDelete).toHaveBeenCalledWith('transactions', 'txn-1', 'test-token')
    expect(dbDelete).toHaveBeenCalledWith('transactions', 'txn-2', 'test-token')
    expect(dbDelete).toHaveBeenCalledWith('analyses', 'analysis-1', 'test-token')
    expect(dbDelete).toHaveBeenCalledWith('statements', 'stmt-1', 'test-token')

    // Verify cascade order: statement deleted last
    const deleteCalls = vi.mocked(dbDelete).mock.calls
    const stmtDeleteIndex = deleteCalls.findIndex((c) => c[0] === 'statements')
    expect(stmtDeleteIndex).toBe(deleteCalls.length - 1)
  })
})
