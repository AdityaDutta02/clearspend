import type { BankSlug, CategorySlug, DashboardData, Analysis, Statement } from '@/types'

export interface FilterState {
  month: string | null // "YYYY-MM" or null for all
  bank: BankSlug | null // or null for all
  statement_id: string | null // null = all cards
}

export type CardDescriptor = {
  statement_id: string
  bank: BankSlug
  card_name: string | null
  last_four: string | null
}

export interface KpiMetrics {
  totalSpend: number
  avgMonthlySpend: number
  topCategory: CategorySlug | null
  topCategoryAmount: number
  monthOverMonthChange: number | null
  upiShare: number
}

export interface ChartPoint {
  month: string // "YYYY-MM"
  total: number
}

export function getAvailableMonths(data: DashboardData): string[] {
  const analysedIds = new Set(data.analyses.map((a) => a.statement_id))
  const months = Array.from(
    new Set(data.statements.filter((s) => analysedIds.has(s.id)).map((s) => s.month)),
  )
  return months.sort((a, b) => b.localeCompare(a))
}

export function getAvailableCards(data: DashboardData): CardDescriptor[] {
  const statementMap = new Map(data.statements.map((s) => [s.id, s]))
  return data.analyses.map((a) => {
    const stmt = statementMap.get(a.statement_id)
    return {
      statement_id: a.statement_id,
      bank: stmt?.bank ?? ('hdfc' as BankSlug),
      card_name: a.upi_summary?.card_name ?? null,
      last_four: a.upi_summary?.last_four ?? null,
    }
  })
}

export function getAvailableBanks(data: DashboardData): BankSlug[] {
  const analysedIds = new Set(data.analyses.map((a) => a.statement_id))
  const banks = Array.from(
    new Set(data.statements.filter((s) => analysedIds.has(s.id)).map((s) => s.bank)),
  )
  return banks.sort()
}

export function filterAnalyses(data: DashboardData, filter: FilterState): Analysis[] {
  const { statements, analyses } = data

  const filteredStatements = statements.filter((s) => {
    if (filter.month !== null && s.month !== filter.month) return false
    if (filter.bank !== null && s.bank !== filter.bank) return false
    if (filter.statement_id !== null && s.id !== filter.statement_id) return false
    return true
  })

  const statementIds = new Set(filteredStatements.map((s) => s.id))

  const filtered = analyses.filter((a) => statementIds.has(a.statement_id))

  return filtered.sort((a, b) => b.month.localeCompare(a.month))
}

/**
 * Computes KPI metrics from a set of analyses.
 *
 * The `analyses` array should be pre-filtered by bank (if needed) but should
 * contain ALL months so that month-over-month change can be computed when
 * `filter.month` is set. Internally, this function scopes totalSpend and
 * category aggregates to `filter.month` when provided.
 */
export function computeKpis(analyses: Analysis[], filter: FilterState): KpiMetrics {
  // Determine which analyses count as "current" for metrics
  const currentAnalyses =
    filter.month !== null ? analyses.filter((a) => a.month === filter.month) : analyses

  if (currentAnalyses.length === 0) {
    return {
      totalSpend: 0,
      avgMonthlySpend: 0,
      topCategory: null,
      topCategoryAmount: 0,
      monthOverMonthChange: null,
      upiShare: 0,
    }
  }

  const totalSpend = currentAnalyses.reduce((sum, a) => sum + (Number(a.monthly_total) || 0), 0)
  const distinctMonths = new Set(currentAnalyses.map((a) => a.month)).size
  const avgMonthlySpend = distinctMonths > 0 ? totalSpend / distinctMonths : 0

  // Aggregate category totals across current analyses
  const categoryTotals: Partial<Record<CategorySlug, number>> = {}
  for (const analysis of currentAnalyses) {
    // category_breakdown is typed as Partial<Record<CategorySlug, number>>; Object.entries
    // widens keys to string, cast is safe because API guarantees CategorySlug keys
    for (const [slug, amount] of Object.entries(analysis.category_breakdown) as [CategorySlug, number][]) {
      categoryTotals[slug] = (categoryTotals[slug] ?? 0) + amount
    }
  }

  let topCategory: CategorySlug | null = null
  let topCategoryAmount = 0
  // categoryTotals keys are CategorySlug by construction above; cast is safe
  for (const [slug, amount] of Object.entries(categoryTotals) as [CategorySlug, number][]) {
    if (amount > topCategoryAmount) {
      topCategoryAmount = amount
      topCategory = slug
    }
  }

  // Month-over-month change: only when a specific month filter is active
  let monthOverMonthChange: number | null = null
  if (filter.month !== null) {
    const [year, month] = filter.month.split('-').map(Number)
    // Build prior month string (handles January → December of prior year)
    const priorDate = new Date(year, month - 2, 1) // month is 1-based, subtract 2 for zero-indexed previous
    const priorMonth = `${priorDate.getFullYear()}-${String(priorDate.getMonth() + 1).padStart(2, '0')}`

    const priorAnalyses = analyses.filter((a) => a.month === priorMonth)
    if (priorAnalyses.length > 0) {
      const priorTotal = priorAnalyses.reduce((sum, a) => sum + (Number(a.monthly_total) || 0), 0)
      if (priorTotal !== 0) {
        monthOverMonthChange = ((totalSpend - priorTotal) / priorTotal) * 100
      }
    }
  }

  const totalUpiSpent = currentAnalyses.reduce((sum, a) => sum + (Number(a.upi_summary?.total_spent) || 0), 0)
  const upiShare = totalSpend > 0 ? totalUpiSpent / totalSpend : 0

  return {
    totalSpend,
    avgMonthlySpend,
    topCategory,
    topCategoryAmount,
    monthOverMonthChange,
    upiShare,
  }
}

export function getSpendTrendData(analyses: Analysis[]): ChartPoint[] {
  return analyses
    .map((a) => ({ month: a.month, total: Number(a.monthly_total) || 0 }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
