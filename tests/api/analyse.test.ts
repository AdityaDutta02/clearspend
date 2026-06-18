import { vi, describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/analyse/route'
import * as db from '@/lib/db'
import * as categorise from '@/lib/ai/categorise'
import * as upiResolve from '@/lib/ai/upi-resolve'
import * as insights from '@/lib/ai/insights'
import * as isStatement from '@/lib/is-statement'
import * as classify from '@/lib/ai/classify-statement'

vi.mock('@/lib/db')
vi.mock('@/lib/ai/categorise')
vi.mock('@/lib/ai/upi-resolve')
vi.mock('@/lib/ai/insights')
vi.mock('@/lib/is-statement')
vi.mock('@/lib/ai/classify-statement')

const mockStatement = {
  id: 'stmt-1', month: '2024-01', bank: 'hdfc', account_type: 'debit',
  transaction_count: 1, total_debit: 500, total_credit: 0, currency: 'INR', uploaded_at: 'now',
}

const mockAnalysis = {
  id: 'anal-1', statement_id: 'stmt-1', month: '2024-01',
  category_breakdown: {}, top_merchants: [], upi_summary: { total_spent: 0, merchant_breakdown: [] },
  monthly_total: 500, insights: [], generated_at: 'now',
}

describe('POST /api/analyse', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(isStatement.scoreStatementText).mockReturnValue({ confidence: 'high', score: 80, signals: ['bank'] })
  })

  it('returns 401 when no token', async () => {
    const req = new Request('http://localhost/api/analyse', { method: 'POST', body: '{}' })
    const { NextRequest } = await import('next/server')
    const res = await POST(new NextRequest(req))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/analyse', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 'bad', bank: 'hdfc', account_type: 'debit', transactions: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns statement and analysis on success', async () => {
    vi.mocked(db.dbInsert).mockResolvedValueOnce(mockStatement as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce(mockAnalysis as never)
    vi.mocked(db.dbList).mockResolvedValue([])
    vi.mocked(categorise.categoriseTransactions).mockResolvedValue([
      { id: 'stmt-1_0', date: '2024-01-01', amount: 500, type: 'debit', description: 'ATM', upi_ref: null, merchant: 'ATM', category: 'others' },
    ])
    vi.mocked(upiResolve.resolveUpiMerchants).mockResolvedValue([
      { id: 'stmt-1_0', upi_ref: null, merchant: 'ATM', description: 'ATM', upi_merchant: null },
    ])
    vi.mocked(insights.generateInsights).mockResolvedValue(['Spend on track'])

    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/analyse', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month: '2024-01', bank: 'hdfc', account_type: 'debit',
        transactions: [{ date: '2024-01-01', amount: 500, type: 'debit', description: 'ATM withdrawal', upi_ref: null }],
      }),
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.statement).toBeDefined()
    expect(data.analysis).toBeDefined()
  })

  it('rejects low-confidence junk with 422 NOT_A_STATEMENT and never calls AI', async () => {
    vi.mocked(isStatement.scoreStatementText).mockReturnValue({ confidence: 'low', score: 5, signals: [] })
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/analyse', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_type: 'debit', transactions: [], raw_text: 'Lorem ipsum résumé',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe('NOT_A_STATEMENT')
    expect(classify.classifyStatement).not.toHaveBeenCalled()
  })

  it('gray-zone calls the AI classifier and rejects when is_statement=false', async () => {
    vi.mocked(isStatement.scoreStatementText).mockReturnValue({ confidence: 'medium', score: 30, signals: ['amount'] })
    vi.mocked(classify.classifyStatement).mockResolvedValue({ is_statement: false, confidence: 0.1, bank_guess: null })
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/analyse', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        account_type: 'debit',
        transactions: [{ date: '2024-01-01', amount: 100, type: 'debit', description: 'Invoice', upi_ref: null }],
        raw_text: 'Invoice 2024 Total 1,234.00',
      }),
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
    expect((await res.json()).error).toBe('NOT_A_STATEMENT')
  })
})
