import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildFinancialContext } from '@/lib/ai/build-context'
import type { Statement, Analysis } from '@/types'

vi.mock('@/lib/db', () => ({ dbList: vi.fn() }))

import { dbList } from '@/lib/db'

const mockDbList = vi.mocked(dbList)

const mockStatement: Statement = {
  id: 'stmt-1',
  bank: 'hdfc',
  month: '2025-01',
  account_type: 'credit',
  transaction_count: 10,
  total_debit: 10000,
  total_credit: 0,
  currency: 'INR',
  uploaded_at: '2025-01-31T00:00:00Z',
}

const mockAnalysis: Analysis = {
  id: 'a1',
  statement_id: 'stmt-1',
  month: '2025-01',
  monthly_total: 10000,
  category_breakdown: { food: 4000, transport: 6000 },
  top_merchants: [{ name: 'Zomato', total: 2000, count: 5 }],
  insights: ['You spend a lot on food'],
  upi_summary: {
    total_spent: 3000,
    merchant_breakdown: [],
  },
  generated_at: '2025-01-31T00:00:00Z',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buildFinancialContext', () => {
  it('returns no-data message when analyses is empty', async () => {
    mockDbList.mockImplementation(async (table: string) => {
      if (table === 'statements') return [mockStatement] as never
      return [] as never
    })

    const result = await buildFinancialContext('test-token')
    expect(result).toBe('No financial data available yet.')
  })

  it('returns correctly formatted context with mock data', async () => {
    mockDbList.mockImplementation(async (table: string) => {
      if (table === 'statements') return [mockStatement] as never
      return [mockAnalysis] as never
    })

    const result = await buildFinancialContext('test-token')

    expect(result).toContain('FINANCIAL DATA SUMMARY')
    expect(result).toContain('2025-01: ₹10,000 (HDFC)')
    expect(result).toContain('transport: ₹6,000 (60%)')
    expect(result).toContain('Zomato ₹2,000 (5 txns)')
    expect(result).toContain('You spend a lot on food')
  })

  it('shows date range as oldest to newest for multiple months', async () => {
    const analysisJan: Analysis = { ...mockAnalysis, id: 'a1', month: '2025-01' }
    const analysisMar: Analysis = {
      ...mockAnalysis,
      id: 'a2',
      statement_id: 'stmt-2',
      month: '2025-03',
    }
    const statementMar: Statement = { ...mockStatement, id: 'stmt-2', month: '2025-03' }

    mockDbList.mockImplementation(async (table: string) => {
      if (table === 'statements') return [mockStatement, statementMar] as never
      return [analysisJan, analysisMar] as never
    })

    const result = await buildFinancialContext('test-token')
    expect(result).toContain('2025-01 to 2025-03')
  })

  it('deduplicates insights across analyses', async () => {
    const analysis1: Analysis = {
      ...mockAnalysis,
      id: 'a1',
      insights: ['You spend a lot on food', 'Consider reducing transport costs'],
    }
    const analysis2: Analysis = {
      ...mockAnalysis,
      id: 'a2',
      statement_id: 'stmt-2',
      month: '2025-02',
      insights: ['You spend a lot on food', 'High UPI usage detected'],
    }
    const statement2: Statement = { ...mockStatement, id: 'stmt-2', month: '2025-02' }

    mockDbList.mockImplementation(async (table: string) => {
      if (table === 'statements') return [mockStatement, statement2] as never
      return [analysis1, analysis2] as never
    })

    const result = await buildFinancialContext('test-token')

    const insightSection = result.split('AI insights from your data:')[1]
    const insightOccurrences = (insightSection.match(/You spend a lot on food/g) ?? []).length
    expect(insightOccurrences).toBe(1)
    expect(result).toContain('Consider reducing transport costs')
    expect(result).toContain('High UPI usage detected')
  })
})
