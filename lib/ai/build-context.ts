import { dbList } from '@/lib/db'
import type { Statement, Analysis } from '@/types'

export async function buildFinancialContext(token: string): Promise<string> {
  const [statements, analyses] = await Promise.all([
    dbList<Statement>('statements', {}, token),
    dbList<Analysis>('analyses', {}, token),
  ])

  if (analyses.length === 0) return 'No financial data available yet.'

  const stmtMap = new Map(statements.map((s) => [s.id, s]))
  const sorted = [...analyses].sort((a, b) => b.month.localeCompare(a.month))

  const monthlyLines = sorted
    .map((a) => {
      const bank = stmtMap.get(a.statement_id)?.bank.toUpperCase() ?? '?'
      return `${a.month}: ₹${Math.round(a.monthly_total).toLocaleString('en-IN')} (${bank})`
    })
    .join(' | ')

  const categoryTotals: Record<string, number> = {}
  let grandTotal = 0
  for (const a of analyses) {
    for (const [cat, amt] of Object.entries(a.category_breakdown ?? {})) {
      categoryTotals[cat] = (categoryTotals[cat] ?? 0) + (amt ?? 0)
      grandTotal += amt ?? 0
    }
  }
  const categoryLines = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amt]) => {
      const pct = grandTotal > 0 ? Math.round((amt / grandTotal) * 100) : 0
      return `${cat}: ₹${Math.round(amt).toLocaleString('en-IN')} (${pct}%)`
    })
    .join(', ')

  const merchantMap = new Map<string, { total: number; count: number }>()
  for (const a of analyses) {
    for (const m of a.top_merchants ?? []) {
      const existing = merchantMap.get(m.name) ?? { total: 0, count: 0 }
      merchantMap.set(m.name, { total: existing.total + m.total, count: existing.count + m.count })
    }
  }
  const topMerchants = Array.from(merchantMap.entries())
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 10)
    .map(([name, { total, count }]) => `${name} ₹${Math.round(total).toLocaleString('en-IN')} (${count} txns)`)
    .join(', ')

  const allInsights = [...new Set(analyses.flatMap((a) => a.insights ?? []))].slice(0, 8).join('\n- ')

  const oldest = sorted[sorted.length - 1].month
  const newest = sorted[0].month
  const dateRange = oldest === newest ? oldest : `${oldest} to ${newest}`

  return `FINANCIAL DATA SUMMARY
Statements: ${analyses.length} months on file (${dateRange})
Monthly spend: ${monthlyLines}
Category breakdown (all-time): ${categoryLines}
Top merchants: ${topMerchants}
AI insights from your data:
- ${allInsights}`
}
