import { describe, it, expect } from 'vitest'
import {
  getAvailableMonths,
  getAvailableBanks,
  getAvailableCards,
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
      [
        makeAnalysis({ id: 'x', statement_id: 'a', month: '2025-01' }),
        makeAnalysis({ id: 'y', statement_id: 'b', month: '2025-03' }),
        makeAnalysis({ id: 'z', statement_id: 'c', month: '2025-02' }),
      ],
    )
    expect(getAvailableMonths(data)).toEqual(['2025-03', '2025-02', '2025-01'])
  })

  it('deduplicates months across statements', () => {
    const data = buildData(
      [
        makeStatement({ id: 'a', month: '2025-01' }),
        makeStatement({ id: 'b', month: '2025-01', bank: 'sbi' }),
      ],
      [
        makeAnalysis({ id: 'x', statement_id: 'a' }),
        makeAnalysis({ id: 'y', statement_id: 'b' }),
      ],
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
        makeStatement({ id: 'c', bank: 'sbi' }),
        makeStatement({ id: 'd', bank: 'axis' }),
      ],
      [
        makeAnalysis({ id: 'w', statement_id: 'a' }),
        makeAnalysis({ id: 'x', statement_id: 'b' }),
        makeAnalysis({ id: 'y', statement_id: 'c' }),
        makeAnalysis({ id: 'z', statement_id: 'd' }),
      ],
    )
    expect(getAvailableBanks(data)).toEqual(['axis', 'hdfc', 'sbi'])
  })
})

// ─── getAvailableCards ────────────────────────────────────────────────────────

describe('getAvailableCards', () => {
  it('returns one entry per analysed statement with card info from upi_summary', () => {
    const data = buildData(
      [
        makeStatement({ id: 'stmt-a', bank: 'hdfc' }),
        makeStatement({ id: 'stmt-b', bank: 'hdfc' }),
      ],
      [
        makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a', upi_summary: { total_spent: 0, merchant_breakdown: [], card_name: 'Regalia', last_four: '1234' } }),
        makeAnalysis({ id: 'ana-b', statement_id: 'stmt-b', upi_summary: { total_spent: 0, merchant_breakdown: [], card_name: 'Millennia', last_four: '5678' } }),
      ],
    )
    const cards = getAvailableCards(data)
    expect(cards).toHaveLength(2)
    expect(cards[0]).toEqual({ statement_id: 'stmt-a', bank: 'hdfc', card_name: 'Regalia', last_four: '1234' })
    expect(cards[1]).toEqual({ statement_id: 'stmt-b', bank: 'hdfc', card_name: 'Millennia', last_four: '5678' })
  })

  it('excludes statements with no matching analysis', () => {
    const data = buildData(
      [
        makeStatement({ id: 'stmt-a' }),
        makeStatement({ id: 'stmt-b' }),
      ],
      [makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a' })],
    )
    const cards = getAvailableCards(data)
    expect(cards).toHaveLength(1)
    expect(cards[0].statement_id).toBe('stmt-a')
  })
})

// ─── filterAnalyses ───────────────────────────────────────────────────────────

describe('filterAnalyses', () => {
  it('returns all analyses when filter is null/null/null', () => {
    const stmtA = makeStatement({ id: 'stmt-a', month: '2025-01', bank: 'hdfc' })
    const stmtB = makeStatement({ id: 'stmt-b', month: '2025-02', bank: 'sbi' })
    const anaA = makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a', month: '2025-01' })
    const anaB = makeAnalysis({ id: 'ana-b', statement_id: 'stmt-b', month: '2025-02' })
    const data = buildData([stmtA, stmtB], [anaA, anaB])
    const filter: FilterState = { month: null, bank: null, statement_id: null }

    const result = filterAnalyses(data, filter)
    expect(result).toHaveLength(2)
  })

  it('filters by month and returns only matching analyses', () => {
    const stmtA = makeStatement({ id: 'stmt-a', month: '2025-01', bank: 'hdfc' })
    const stmtB = makeStatement({ id: 'stmt-b', month: '2025-02', bank: 'hdfc' })
    const anaA = makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a', month: '2025-01' })
    const anaB = makeAnalysis({ id: 'ana-b', statement_id: 'stmt-b', month: '2025-02' })
    const data = buildData([stmtA, stmtB], [anaA, anaB])
    const filter: FilterState = { month: '2025-01', bank: null, statement_id: null }

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
    const filter: FilterState = { month: null, bank: 'sbi', statement_id: null }

    const result = filterAnalyses(data, filter)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ana-sbi')
  })

  it('filters by statement_id for card-level scoping', () => {
    const stmtA = makeStatement({ id: 'stmt-a', bank: 'hdfc', month: '2025-01' })
    const stmtB = makeStatement({ id: 'stmt-b', bank: 'hdfc', month: '2025-01' })
    const anaA = makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a', month: '2025-01' })
    const anaB = makeAnalysis({ id: 'ana-b', statement_id: 'stmt-b', month: '2025-01' })
    const data = buildData([stmtA, stmtB], [anaA, anaB])
    const filter: FilterState = { month: null, bank: null, statement_id: 'stmt-a' }

    const result = filterAnalyses(data, filter)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ana-a')
  })

  it('returns analyses sorted descending by month', () => {
    const stmtA = makeStatement({ id: 'stmt-a', month: '2025-01', bank: 'hdfc' })
    const stmtB = makeStatement({ id: 'stmt-b', month: '2025-03', bank: 'hdfc' })
    const stmtC = makeStatement({ id: 'stmt-c', month: '2025-02', bank: 'hdfc' })
    const anaA = makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a', month: '2025-01' })
    const anaB = makeAnalysis({ id: 'ana-b', statement_id: 'stmt-b', month: '2025-03' })
    const anaC = makeAnalysis({ id: 'ana-c', statement_id: 'stmt-c', month: '2025-02' })
    const data = buildData([stmtA, stmtB, stmtC], [anaA, anaB, anaC])
    const filter: FilterState = { month: null, bank: null, statement_id: null }

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
    const filter: FilterState = { month: null, bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.totalSpend).toBe(10000)
    expect(kpis.avgMonthlySpend).toBe(5000)
  })

  it('coerces string monthly_total from DB without NaN', () => {
    const analyses = [
      makeAnalysis({ id: 'a', month: '2025-01', monthly_total: '4000' as unknown as number }),
      makeAnalysis({ id: 'b', month: '2025-02', monthly_total: '6000' as unknown as number }),
    ]
    const filter: FilterState = { month: null, bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.totalSpend).toBe(10000)
    expect(kpis.avgMonthlySpend).toBe(5000)
  })

  it('coerces string upi total_spent without NaN', () => {
    const analyses = [
      makeAnalysis({
        id: 'a',
        month: '2025-01',
        monthly_total: 10000,
        upi_summary: { total_spent: '4000' as unknown as number, merchant_breakdown: [] },
      }),
    ]
    const filter: FilterState = { month: null, bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.upiShare).toBeCloseTo(0.4, 5)
  })

  it('returns correct topCategory across all analyses', () => {
    const analyses = [
      makeAnalysis({ id: 'a', month: '2025-01', category_breakdown: { food: 3000, transport: 500 }, monthly_total: 3500 }),
      makeAnalysis({ id: 'b', month: '2025-02', category_breakdown: { food: 2000, shopping: 1000 }, monthly_total: 3000 }),
    ]
    const filter: FilterState = { month: null, bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.topCategory).toBe('food')
    expect(kpis.topCategoryAmount).toBe(5000)
  })

  it('returns correct monthOverMonthChange when prior month exists', () => {
    const analyses = [
      makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 4000 }),
      makeAnalysis({ id: 'b', month: '2025-02', monthly_total: 5000 }),
    ]
    const filter: FilterState = { month: '2025-02', bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.monthOverMonthChange).toBeCloseTo(25, 5)
  })

  it('returns null monthOverMonthChange when no prior data exists', () => {
    const analyses = [makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 4000 })]
    const filter: FilterState = { month: '2025-01', bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.monthOverMonthChange).toBeNull()
  })

  it('returns null monthOverMonthChange when filter.month is null', () => {
    const analyses = [
      makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 4000 }),
      makeAnalysis({ id: 'b', month: '2025-02', monthly_total: 5000 }),
    ]
    const filter: FilterState = { month: null, bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.monthOverMonthChange).toBeNull()
  })

  it('returns zero totals and null topCategory when analyses is empty', () => {
    const filter: FilterState = { month: null, bank: null, statement_id: null }
    const kpis = computeKpis([], filter)

    expect(kpis.totalSpend).toBe(0)
    expect(kpis.avgMonthlySpend).toBe(0)
    expect(kpis.topCategory).toBeNull()
    expect(kpis.monthOverMonthChange).toBeNull()
    expect(kpis.upiShare).toBe(0)
  })

  it('computes upiShare correctly', () => {
    const analyses = [
      makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 10000, upi_summary: { total_spent: 4000, merchant_breakdown: [] } }),
    ]
    const filter: FilterState = { month: null, bank: null, statement_id: null }
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
