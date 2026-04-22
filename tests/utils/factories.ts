import type { Analysis } from '@/types'

export function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: 'a1',
    statement_id: 's1',
    month: '2025-01',
    category_breakdown: {},
    top_merchants: [],
    upi_summary: {
      total_spent: 0,
      merchant_breakdown: [],
    },
    monthly_total: 0,
    insights: [],
    generated_at: '2025-01-31T00:00:00Z',
    ...overrides,
  }
}
