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
  others: '#6b7280',
}

interface CategoryTotal {
  slug: CategorySlug
  total: number
}

function aggregateCategories(analyses: Analysis[]): CategoryTotal[] {
  const totals = new Map<CategorySlug, number>()

  for (const analysis of analyses) {
    for (const [slug, amount] of Object.entries(analysis.category_breakdown ?? {})) {
      const key = slug as CategorySlug
      totals.set(key, (totals.get(key) ?? 0) + (amount ?? 0))
    }
  }

  return Array.from(totals.entries())
    .map(([slug, total]) => ({ slug, total }))
    .filter(({ total }) => total > 0)
    .sort((a, b) => b.total - a.total)
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

function ShimmerBlock(): JSX.Element {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true" data-testid="category-shimmer">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex flex-col gap-1">
          <div
            className="animate-pulse rounded"
            style={{ height: '14px', width: '50%', background: 'var(--border)' }}
          />
          <div
            className="animate-pulse rounded"
            style={{ height: '8px', width: '75%', background: 'var(--border)' }}
          />
        </div>
      ))}
    </div>
  )
}

export function CategoryChart({ analyses, isLoading }: CategoryChartProps): JSX.Element {
  const categories = aggregateCategories(analyses)
  const grandTotal = categories.reduce((s, c) => s + c.total, 0)
  const maxTotal = categories.length > 0 ? categories[0].total : 0

  return (
    <div className="card" data-testid="category-chart">
      <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>
        Spend by Category
      </p>

      {isLoading ? (
        <ShimmerBlock />
      ) : categories.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No spend data available</p>
      ) : (
        <ul className="flex flex-col gap-4" role="list">
          {categories.map(({ slug, total }) => {
            const widthPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
            const sharePct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0
            const color = CATEGORY_COLORS[slug]
            return (
              <li key={slug} data-testid={`category-${slug}`}>
                <div className="flex justify-between mb-1">
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--text)', maxWidth: '65%' }}
                  >
                    {CATEGORY_DISPLAY_NAMES[slug]}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>
                    {formatInrShort(total)}{' '}
                    <span style={{ fontSize: '0.7rem' }}>{sharePct}%</span>
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: 'var(--border)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${widthPct}%`,
                      height: '100%',
                      background: color,
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }}
                    aria-label={`${CATEGORY_DISPLAY_NAMES[slug]}: ${sharePct}% of total`}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
