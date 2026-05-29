'use client'

import { useState } from 'react'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
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

const ALL_CATEGORIES: CategorySlug[] = [
  'food', 'groceries', 'transport', 'shopping', 'emi_loans',
  'utilities', 'entertainment', 'health', 'travel', 'others',
]

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

type FlatChartRow = { month: string; total: number } & Partial<Record<CategorySlug, number>>

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
  const [activeIndex, setActiveIndex] = useState<number | null>(null)

  const activeCategories = ALL_CATEGORIES.filter((slug) =>
    data.some((point) => (point.categories[slug] ?? 0) > 0),
  )

  const chartData: FlatChartRow[] = data.map((point) => {
    const row: FlatChartRow = { month: formatMonth(point.month), total: point.total }
    for (const slug of activeCategories) {
      row[slug] = point.categories[slug] ?? 0
    }
    return row
  })

  const selectedRow = activeIndex !== null ? chartData[activeIndex] : null
  const defaultRow = chartData.length > 0 ? chartData[chartData.length - 1] : null
  const displayRow = selectedRow ?? defaultRow

  const handleClick = (data: unknown, index: number): void => {
    setActiveIndex((prev) => (prev === index ? null : index))
  }

  return (
    <div className="card" style={{ height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column', overflow: 'visible' }} data-testid="spend-trend-chart">

      {/* Header: title left, selected month summary right */}
      <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: '4px' }}>
            Over time
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Monthly Spend
          </p>
        </div>
        {displayRow && (
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '2px' }}>
              {displayRow.month}{selectedRow ? '' : ' (latest)'}
            </p>
            <p className="tabular" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              {formatInrShort(displayRow.total)}
            </p>
          </div>
        )}
      </div>

      {isLoading ? (
        <ShimmerBlock />
      ) : data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No data available</p>
        </div>
      ) : data.length === 1 ? (
        <div style={{ flex: 1, minHeight: '180px', overflow: 'visible' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              barCategoryGap="40%"
              onClick={handleClick}
              style={{ cursor: 'pointer' }}
            >
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
              {activeCategories.map((slug) => (
                <Bar
                  key={slug}
                  dataKey={slug}
                  stackId="spend"
                  fill={CATEGORY_COLORS[slug]}
                  isAnimationActive
                  animationDuration={600}
                  animationEasing="ease-out"
                  radius={activeCategories.indexOf(slug) === activeCategories.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: '180px', overflow: 'visible' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              onClick={handleClick}
              style={{ cursor: 'pointer' }}
            >
              <defs>
                {activeCategories.map((slug) => (
                  <linearGradient key={slug} id={`area-${slug}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CATEGORY_COLORS[slug]} stopOpacity={activeIndex === null ? 0.55 : 0.3} />
                    <stop offset="100%" stopColor={CATEGORY_COLORS[slug]} stopOpacity={0.03} />
                  </linearGradient>
                ))}
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
              {activeCategories.map((slug) => (
                <Area
                  key={slug}
                  type="monotone"
                  dataKey={slug}
                  stackId="spend"
                  stroke={CATEGORY_COLORS[slug]}
                  strokeWidth={1.5}
                  fill={`url(#area-${slug})`}
                  isAnimationActive
                  animationDuration={500}
                  animationEasing="ease-out"
                  activeDot={{ r: 4, strokeWidth: 2, stroke: '#fff' }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category breakdown for selected/latest month */}
      {displayRow && activeCategories.length > 0 && (
        <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', gap: '8px 16px' }}>
          {activeCategories
            .filter((slug) => (displayRow[slug] ?? 0) > 0)
            .sort((a, b) => (displayRow[b] ?? 0) - (displayRow[a] ?? 0))
            .slice(0, 5)
            .map((slug) => (
              <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: CATEGORY_COLORS[slug], flexShrink: 0 }} />
                <span style={{ fontSize: '0.68rem', color: 'var(--muted)', fontWeight: 500 }}>
                  {CATEGORY_DISPLAY_NAMES[slug].split(' ')[0]}
                </span>
                <span className="tabular" style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text)' }}>
                  {formatInrShort(displayRow[slug] ?? 0)}
                </span>
              </div>
            ))}
        </div>
      )}
    </div>
  )
}
