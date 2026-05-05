'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  type TooltipProps,
} from 'recharts'
import type { Analysis, CategorySlug } from '@/types'

export interface CategoryChartProps {
  analyses: Analysis[]
  isLoading: boolean
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

interface CategoryTotal {
  slug: CategorySlug
  name: string
  total: number
  share: number
}

function aggregateCategories(analyses: Analysis[]): CategoryTotal[] {
  const totals = new Map<CategorySlug, number>()

  for (const analysis of analyses) {
    for (const [slug, amount] of Object.entries(analysis.category_breakdown ?? {})) {
      const key = slug as CategorySlug
      totals.set(key, (totals.get(key) ?? 0) + (amount ?? 0))
    }
  }

  const rows = Array.from(totals.entries())
    .map(([slug, total]) => ({ slug, total }))
    .filter(({ total }) => total > 0)
    .sort((a, b) => b.total - a.total)

  const grand = rows.reduce((s, r) => s + r.total, 0)

  return rows.map(({ slug, total }) => ({
    slug,
    name: CATEGORY_DISPLAY_NAMES[slug],
    total,
    share: grand > 0 ? Math.round((total / grand) * 100) : 0,
  }))
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

function CustomTooltip({ active, payload }: TooltipProps<number, string>): JSX.Element | null {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const data = item.payload as CategoryTotal

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: '12px',
        padding: '12px 14px',
        boxShadow: 'var(--shadow-elevated)',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: CATEGORY_COLORS[data.slug],
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)' }}>
          {data.name}
        </span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '20px' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
          {formatInrShort(data.total)}
        </span>
        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)' }}>
          {data.share}% of total
        </span>
      </div>
    </div>
  )
}

function ShimmerBlock(): JSX.Element {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true" data-testid="category-shimmer">
      {[80, 65, 52, 40, 30].map((w, i) => (
        <div key={i} className="flex items-center gap-3">
          <div
            className="animate-pulse rounded"
            style={{ height: '12px', width: '80px', background: 'var(--border)', flexShrink: 0 }}
          />
          <div
            className="animate-pulse rounded-full"
            style={{ height: '20px', width: `${w}%`, background: 'var(--border)', borderRadius: '4px' }}
          />
          <div
            className="animate-pulse rounded"
            style={{ height: '12px', width: '40px', background: 'var(--border)', flexShrink: 0 }}
          />
        </div>
      ))}
    </div>
  )
}

export function CategoryChart({ analyses, isLoading }: CategoryChartProps): JSX.Element {
  const categories = aggregateCategories(analyses)

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }} data-testid="category-chart">

      <div style={{ marginBottom: '20px' }}>
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
          Breakdown
        </p>
        <p
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
          }}
        >
          Spend by Category
        </p>
      </div>

      {isLoading ? (
        <ShimmerBlock />
      ) : categories.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No spend data available</p>
      ) : (
        <div style={{ flex: 1, minHeight: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={categories}
              margin={{ top: 0, right: 52, bottom: 0, left: 0 }}
              barCategoryGap="30%"
            >
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                width={82}
                tick={{
                  fontSize: 11,
                  fill: 'var(--text-secondary)',
                  fontFamily: "'Plus Jakarta Sans', system-ui",
                  fontWeight: 500,
                }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(15, 23, 42, 0.04)', radius: 4 }}
              />
              <Bar
                dataKey="total"
                radius={[0, 4, 4, 0]}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
                label={{
                  position: 'right',
                  formatter: (v: number) => formatInrShort(v),
                  fontSize: 10,
                  fontWeight: 700,
                  fill: 'var(--muted)',
                  fontFamily: "'Plus Jakarta Sans', system-ui",
                }}
              >
                {categories.map((entry) => (
                  <Cell
                    key={entry.slug}
                    fill={CATEGORY_COLORS[entry.slug]}
                    data-testid={`category-${entry.slug}`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
