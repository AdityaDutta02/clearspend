'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
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
  food: '#f97316',
  groceries: '#22c55e',
  transport: '#3b82f6',
  shopping: '#a855f7',
  emi_loans: '#ef4444',
  utilities: '#06b6d4',
  entertainment: '#ec4899',
  health: '#14b8a6',
  travel: '#f59e0b',
  others: '#94a3b8',
}

const CATEGORY_DISPLAY_NAMES: Record<CategorySlug, string> = {
  food: 'Food & Dining',
  groceries: 'Groceries',
  transport: 'Transport',
  shopping: 'Shopping',
  emi_loans: 'EMI & Loans',
  utilities: 'Bills & Subs',
  entertainment: 'Entertainment',
  health: 'Health',
  travel: 'Travel',
  others: 'Others',
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
  if (amount >= 1000) {
    return `₹${Math.round(amount / 1000)}K`
  }
  return `₹${amount}`
}

function formatYAxis(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${Math.round(value / 1000)}K`
  return `₹${value}`
}

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>): JSX.Element | null {
  if (!active || !payload?.length) return null
  const items = payload.filter((p) => (p.value ?? 0) > 0)
  const total = items.reduce((s, p) => s + (p.value ?? 0), 0)

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: '14px',
        padding: '14px 16px',
        boxShadow: 'var(--shadow-elevated)',
        minWidth: '200px',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <p
        style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          color: 'var(--muted)',
          marginBottom: '10px',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}
      >
        {label}
      </p>
      {items.map((item) => (
        <div
          key={item.dataKey}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}
        >
          <div
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: item.fill as string,
              flexShrink: 0,
            }}
          />
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', flex: 1 }}>
            {CATEGORY_DISPLAY_NAMES[item.dataKey as CategorySlug] ?? item.dataKey}
          </span>
          <span
            style={{
              fontSize: '0.78rem',
              fontWeight: 700,
              color: 'var(--text)',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {formatInrShort(item.value as number)}
          </span>
        </div>
      ))}
      {items.length > 1 && (
        <div
          style={{
            borderTop: '1px solid var(--border)',
            marginTop: '8px',
            paddingTop: '8px',
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--muted)' }}>Total</span>
          <span
            style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}
          >
            {formatInrShort(total)}
          </span>
        </div>
      )}
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
  const presentSlugs = Array.from(
    new Set(data.flatMap((d) => Object.keys(d.categories ?? {}) as CategorySlug[])),
  ).sort((a, b) => {
    const totA = data.reduce((s, d) => s + ((d.categories ?? {})[a] ?? 0), 0)
    const totB = data.reduce((s, d) => s + ((d.categories ?? {})[b] ?? 0), 0)
    return totB - totA
  })

  const chartData = data.map((point) => ({
    month: formatMonth(point.month),
    ...(point.categories ?? {}),
  }))

  return (
    <div className="card" style={{ height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column' }} data-testid="spend-trend-chart">

      <div style={{ marginBottom: '16px' }}>
        <p
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--muted)',
            marginBottom: '4px',
          }}
        >
          Over time
        </p>
        <p
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
          }}
        >
          Spend Trend
        </p>
      </div>

      {!isLoading && presentSlugs.length > 0 && (
        <div
          className="flex flex-wrap gap-x-3 gap-y-1"
          style={{ marginBottom: '16px' }}
        >
          {presentSlugs.map((slug) => (
            <div key={slug} className="flex items-center gap-1.5">
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: CATEGORY_COLORS[slug],
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  color: 'var(--muted)',
                  letterSpacing: '0.01em',
                }}
              >
                {CATEGORY_DISPLAY_NAMES[slug]}
              </span>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <ShimmerBlock />
      ) : data.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No data available</p>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              barCategoryGap="38%"
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 6"
                stroke="var(--border)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                tick={{
                  fontSize: 10,
                  fill: 'var(--muted)',
                  fontFamily: "'Plus Jakarta Sans', system-ui",
                  fontWeight: 500,
                }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{
                  fontSize: 10,
                  fill: 'var(--muted)',
                  fontFamily: "'Plus Jakarta Sans', system-ui",
                  fontWeight: 500,
                }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(12, 30, 22, 0.04)', radius: 6 }}
              />
              {presentSlugs.map((slug) => (
                <Bar
                  key={slug}
                  dataKey={slug}
                  stackId="spend"
                  fill={CATEGORY_COLORS[slug]}
                  isAnimationActive
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
