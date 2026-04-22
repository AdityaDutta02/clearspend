import { callModel } from '@/lib/terminal-ai'
import type { CategorySlug } from '@/types'
import { extractJsonArray } from './utils'

const SYSTEM_PROMPT = `You are a personal finance advisor for Indian users.
Given spend data, generate 3-5 short insight strings.
Rules:
- Max 12 words per insight
- Use Indian context (Rs., UPI, EMI)
- Be specific with numbers
- No fluff, no hedging
Return JSON array of strings only. No prose.`

export async function generateInsights(
  categoryBreakdown: Partial<Record<CategorySlug, number>>,
  topMerchants: Array<{ name: string; total: number; count: number }>,
  monthlyTotal: number,
  priorMonthTotal: number | null,
  token: string,
): Promise<string[]> {
  const input = {
    category_breakdown: categoryBreakdown,
    top_merchants: topMerchants.slice(0, 5),
    monthly_total: monthlyTotal,
    prior_month_total: priorMonthTotal,
  }

  try {
    const content = await callModel(
      'google/gemini-2.5-flash-lite',
      [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: JSON.stringify(input) },
      ],
      token,
    )
    const parsed = JSON.parse(extractJsonArray(content)) as string[]
    return parsed.slice(0, 5)
  } catch {
    return buildFallbackInsights(categoryBreakdown, monthlyTotal, priorMonthTotal)
  }
}

function buildFallbackInsights(
  breakdown: Partial<Record<CategorySlug, number>>,
  total: number,
  prior: number | null,
): string[] {
  const insights: string[] = []
  const entries = Object.entries(breakdown).sort(([, a], [, b]) => (b ?? 0) - (a ?? 0))
  const top = entries[0]
  if (top && total > 0) {
    const pct = Math.round(((top[1] ?? 0) / total) * 100)
    insights.push(`${top[0]} is your biggest spend at ${pct}%`)
  }
  if (prior !== null && prior > 0) {
    const change = Math.round(((total - prior) / prior) * 100)
    insights.push(
      change > 0
        ? `Spending up ${change}% vs last month`
        : `Spending down ${Math.abs(change)}% vs last month`,
    )
  }
  return insights
}
