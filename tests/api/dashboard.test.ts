import { vi, describe, it, expect, beforeEach } from 'vitest'
import { GET } from '@/app/api/dashboard/route'
import * as db from '@/lib/db'

vi.mock('@/lib/db')

describe('GET /api/dashboard', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns 401 when no token', async () => {
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/dashboard')
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it('returns dashboard data', async () => {
    vi.mocked(db.dbList).mockResolvedValue([])
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/dashboard', {
      headers: { Authorization: 'Bearer token' },
    })
    const res = await GET(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.statements).toBeDefined()
    expect(data.analyses).toBeDefined()
  })
})
