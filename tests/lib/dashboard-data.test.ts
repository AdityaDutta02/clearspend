import { describe, it, expect } from 'vitest'
import {
  getAvailableMonths,
  getAvailableBanks,
  filterAnalyses,
  computeKpis,
  getSpendTrendData,
} from '@/lib/dashboard-data'
import type { FilterState } from '@/lib/dashboard-data'
import type { DashboardData, Statement, Analysis } from '@/types'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeStatement = (overrides: Partial<Statement>): Statement => ({
  id: 'stmt-1',
  month: '2025-01',
  bank: 'hdfc',
  account_type: 'debit',
  transaction_count: 10,
  total_debit: 5000,
  total_credit: 1000,
  currency: 'INR',
  uploaded_at: '2025-01-15T10:00:00Z',
  ...overrides,
})

const makeAnalysis = (overrides: Partial<Analysis>): Analysis => ({
  id: 'ana-1',
  statement_id: 'stmt-1',
  month: '2025-01',
  category_breakdown: { food: 2000, transport: 1000 },
  top_merchants: [{ name: 'Zomato', total: 1500, count: 5 }],
  upi_summary: { total_spent: 1000, merchant_breakdown: [] },
  monthly_total: 5000,
  insights: [],
  generated_at: '2025-01-16T08:00:00Z',
  ...overrides,
})

const buildData = (statements: Statement[], analyses: Analysis[]): DashboardData => ({
  statements,
  analyses,
})

// ─── getAvailableMonths ───────────────────────────────────────────────────────

describe('getAvailableMonths', () => {
  it('returns months in descending order', () => {
    const data = buildData(
      [
        makeStatement({ id: 'a', month: '2025-01' }),
        makeStatement({ id: 'b', month: '2025-03' }),
        makeStatement({ id: 'c', month: '2025-02' }),
      ],
      [],
    )
    expect(getAvailableMonths(data)).toEqual(['2025-03', '2025-02', '2025-01'])
  })

  it('deduplicates months across statements', () => {
    const data = buildData(
      [
        makeStatement({ id: 'a', month: '2025-01' }),
        makeStatement({ id: 'b', month: '2025-01', bank: 'sbi' }),
      ],
      [],
    )
    const months = getAvailableMonths(data)
    expect(months).toHaveLength(1)
    expect(months).toEqual(['2025-01'])
  })
})

// ─── getAvailableBanks ────────────────────────────────────────────────────────

describe('getAvailableBanks', () => {
  it('returns unique banks in alphabetical order', () => {
    const data = buildData(
      [
        makeStatement({ id: 'a', bank: 'sbi' }),
        makeStatement({ id: 'b', bank: 'hdfc' }),
        makeStatement({ id: 'c', bank: 'sbi' }), // duplicate
        makeStatement({ id: 'd', bank: 'axis' }),
      ],
      [],
    )
    expect(getAvailableBanks(data)).toEqual(['axis', 'hdfc', 'sbi'])
  })
})

// ─── filterAnalyses ───────────────────────────────────────────────────────────

describe('filterAnalyses', () => {
  it('returns all analyses when filter is null/null', () => {
    const stmtA = makeStatement({ id: 'stmt-a', month: '2025-01', bank: 'hdfc' })
    const stmtB = makeStatement({ id: 'stmt-b', month: '2025-02', bank: 'sbi' })
    const anaA = makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a', month: '2025-01' })
    const anaB = makeAnalysis({ id: 'ana-b', statement_id: 'stmt-b', month: '2025-02' })
    const data = buildData([stmtA, stmtB], [anaA, anaB])
    const filter: FilterState = { month: null, bank: null }

    const result = filterAnalyses(data, filter)
    expect(result).toHaveLength(2)
  })

  it('filters by month and returns only matching analyses', () => {
    const stmtA = makeStatement({ id: 'stmt-a', month: '2025-01', bank: 'hdfc' })
    const stmtB = makeStatement({ id: 'stmt-b', month: '2025-02', bank: 'hdfc' })
    const anaA = makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a', month: '2025-01' })
    const anaB = makeAnalysis({ id: 'ana-b', statement_id: 'stmt-b', month: '2025-02' })
    const data = buildData([stmtA, stmtB], [anaA, anaB])
    const filter: FilterState = { month: '2025-01', bank: null }

    const result = filterAnalyses(data, filter)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ana-a')
  })

  it('filters by bank by cross-referencing statements', () => {
    const stmtHdfc = makeStatement({ id: 'stmt-hdfc', month: '2025-01', bank: 'hdfc' })
    const stmtSbi = makeStatement({ id: 'stmt-sbi', month: '2025-01', bank: 'sbi' })
    const anaHdfc = makeAnalysis({ id: 'ana-hdfc', statement_id: 'stmt-hdfc', month: '2025-01' })
    const anaSbi = makeAnalysis({ id: 'ana-sbi', statement_id: 'stmt-sbi', month: '2025-01' })
    const data = buildData([stmtHdfc, stmtSbi], [anaHdfc, anaSbi])
    const filter: FilterState = { month: null, bank: 'sbi' }

    const result = filterAnalyses(data, filter)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ana-sbi')
  })

  it('returns analyses sorted descending by month', () => {
    const stmtA = makeStatement({ id: 'stmt-a', month: '2025-01', bank: 'hdfc' })
    const stmtB = makeStatement({ id: 'stmt-b', month: '2025-03', bank: 'hdfc' })
    const stmtC = makeStatement({ id: 'stmt-c', month: '2025-02', bank: 'hdfc' })
    const anaA = makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a', month: '2025-01' })
    const anaB = makeAnalysis({ id: 'ana-b', statement_id: 'stmt-b', month: '2025-03' })
    const anaC = makeAnalysis({ id: 'ana-c', statement_id: 'stmt-c', month: '2025-02' })
    const data = buildData([stmtA, stmtB, stmtC], [anaA, anaB, anaC])
    const filter: FilterState = { month: null, bank: null }

    const result = filterAnalyses(data, filter)
    expect(result.map((a) => a.month)).toEqual(['2025-03', '2025-02', '2025-01'])
  })
})

// ─── computeKpis ─────────────────────────────────────────────────────────────

describe('computeKpis', () => {
  it('returns correct totalSpend and avgMonthlySpend', () => {
    const analyses = [
      makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 4000 }),
      makeAnalysis({ id: 'b', month: '2025-02', monthly_total: 6000 }),
    ]
    const filter: FilterState = { month: null, bank: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.totalSpend).toBe(10000)
    expect(kpis.avgMonthlySpend).toBe(5000)
  })

  it('returns correct topCategory across all analyses', () => {
    const analyses = [
      makeAnalysis({
        id: 'a',
        month: '2025-01',
        category_breakdown: { food: 3000, transport: 500 },
        monthly_total: 3500,
      }),
      makeAnalysis({
        id: 'b',
        month: '2025-02',
        category_breakdown: { food: 2000, shopping: 1000 },
        monthly_total: 3000,
      }),
    ]
    const filter: FilterState = { month: null, bank: null }
    const kpis = computeKpis(analyses, filter)

    // food: 5000 total, transport: 500, shopping: 1000 → food is top
    expect(kpis.topCategory).toBe('food')
    expect(kpis.topCategoryAmount).toBe(5000)
  })

  it('returns correct monthOverMonthChange when prior month exists', () => {
    const analyses = [
      makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 4000 }),
      makeAnalysis({ id: 'b', month: '2025-02', monthly_total: 5000 }),
    ]
    const filter: FilterState = { month: '2025-02', bank: null }
    const kpis = computeKpis(analyses, filter)

    // ((5000 - 4000) / 4000) * 100 = 25
    expect(kpis.monthOverMonthChange).toBeCloseTo(25, 5)
  })

  it('returns null monthOverMonthChange when no prior data exists', () => {
    const analyses = [makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 4000 })]
    const filter: FilterState = { month: '2025-01', bank: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.monthOverMonthChange).toBeNull()
  })

  it('returns null monthOverMonthChange when filter.month is null', () => {
    const analyses = [
      makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 4000 }),
      makeAnalysis({ id: 'b', month: '2025-02', monthly_total: 5000 }),
    ]
    const filter: FilterState = { month: null, bank: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.monthOverMonthChange).toBeNull()
  })

  it('returns zero totals and null topCategory when analyses is empty', () => {
    const filter: FilterState = { month: null, bank: null }
    const kpis = computeKpis([], filter)

    expect(kpis.totalSpend).toBe(0)
    expect(kpis.avgMonthlySpend).toBe(0)
    expect(kpis.topCategory).toBeNull()
    expect(kpis.monthOverMonthChange).toBeNull()
    expect(kpis.upiShare).toBe(0)
  })

  it('computes upiShare correctly', () => {
    const analyses = [
      makeAnalysis({
        id: 'a',
        month: '2025-01',
        monthly_total: 10000,
        upi_summary: { total_spent: 4000, merchant_breakdown: [] },
      }),
    ]
    const filter: FilterState = { month: null, bank: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.upiShare).toBeCloseTo(0.4, 5)
  })
})

// ─── getSpendTrendData ────────────────────────────────────────────────────────

describe('getSpendTrendData', () => {
  it('returns chart points sorted ascending by month', () => {
    const analyses = [
      makeAnalysis({ id: 'c', month: '2025-03', monthly_total: 7000 }),
      makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 5000 }),
      makeAnalysis({ id: 'b', month: '2025-02', monthly_total: 6000 }),
    ]

    const points = getSpendTrendData(analyses)
    expect(points.map((p) => p.month)).toEqual(['2025-01', '2025-02', '2025-03'])
    expect(points.map((p) => p.total)).toEqual([5000, 6000, 7000])
  })

  it('returns an empty array for empty input', () => {
    expect(getSpendTrendData([])).toEqual([])
  })
})
