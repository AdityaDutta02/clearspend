'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  type TooltipProps,
} from 'recharts'
import type { CategorySlug } from '@/types'
import type { ChartPoint } from '@/lib/dashboard-data'

export interface SpendTrendChartProps {
  data: ChartPoint[]
  isLoading: boolean
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CATEGORY_COLORS: Record<CategorySlug, string> = {
  food: '#f97316', groceries: '#22c55e', transport: '#3b82f6',
  shopping: '#a855f7', emi_loans: '#ef4444', utilities: '#06b6d4',
  entertainment: '#ec4899', health: '#14b8a6', travel: '#f59e0b', others: '#94a3b8',
}

const CATEGORY_DISPLAY_NAMES: Record<CategorySlug, string> = {
  food: 'Food & Dining', groceries: 'Groceries', transport: 'Transport',
  shopping: 'Shopping', emi_loans: 'EMI & Loans', utilities: 'Bills & Subs',
  entertainment: 'Entertainment', health: 'Health', travel: 'Travel', others: 'Others',
}

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number)
  const shortYear = String(year).slice(-2)
  const idx = month - 1
  const monthName = idx >= 0 && idx < 12 ? MONTH_NAMES[idx] : '???'
  return `${monthName} '${shortYear}`
}

function formatInrShort(amount: number): string {
  if (amount >= 100000) {
    const l = amount / 100000
    return `₹${Number.isInteger(l) ? l : l.toFixed(1)}L`
  }
  if (amount >= 1000) return `₹${Math.round(amount / 1000)}K`
  return `₹${amount}`
}

function formatYAxis(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${Math.round(value / 1000)}K`
  return `₹${value}`
}

interface ChartRow {
  month: string
  total: number
  categories: Partial<Record<CategorySlug, number>>
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>): JSX.Element | null {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as ChartRow
  const catEntries = (Object.entries(row.categories ?? {}) as [CategorySlug, number][])
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border-medium)',
      borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow-elevated)',
      minWidth: '200px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {row.month}
      </p>
      <p className="tabular" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '10px' }}>
        {formatInrShort(row.total)}
      </p>
      {catEntries.map(([slug, amount]) => (
        <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: CATEGORY_COLORS[slug], flexShrink: 0 }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flex: 1 }}>
            {CATEGORY_DISPLAY_NAMES[slug]}
          </span>
          <span className="tabular" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>
            {formatInrShort(amount)}
          </span>
        </div>
      ))}
    </div>
  )
}

function ShimmerBlock(): JSX.Element {
  return (
    <div
      className="animate-pulse rounded-xl"
      style={{ height: '240px', width: '100%', background: 'var(--border)' }}
      aria-hidden="true"
      data-testid="shimmer-block"
    />
  )
}

export function SpendTrendChart({ data, isLoading }: SpendTrendChartProps): JSX.Element {
  const chartData: ChartRow[] = data.map((point) => ({
    month: formatMonth(point.month),
    total: point.total,
    categories: point.categories ?? {},
  }))

  const average = chartData.length > 0
    ? Math.round(chartData.reduce((s, d) => s + d.total, 0) / chartData.length)
    : 0

  return (
    <div className="card" style={{ height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column' }} data-testid="spend-trend-chart">

      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: '4px' }}>
            Over time
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Monthly Spend
          </p>
        </div>
        {!isLoading && average > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary-subtle)', borderRadius: '8px', padding: '5px 10px', flexShrink: 0 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
              Avg {formatInrShort(average)}/mo
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <ShimmerBlock />
      ) : data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No data available</p>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="40%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#93C5FD" stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: "'Plus Jakarta Sans', system-ui", fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: "'Plus Jakarta Sans', system-ui", fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15, 23, 42, 0.04)', radius: 6 }} />
              {average > 0 && (
                <ReferenceLine
                  y={average}
                  stroke="#2563EB"
                  strokeDasharray="4 4"
                  strokeOpacity={0.35}
                  strokeWidth={1.5}
                />
              )}
              <Bar
                dataKey="total"
                fill="url(#spendGradient)"
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
