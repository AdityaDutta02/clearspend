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
    <div className="flex flex-col gap-5" aria-hidden="true" data-testid="category-shimmer">
      {[80, 65, 52, 40, 30].map((w, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex justify-between">
            <div
              className="animate-pulse rounded-md"
              style={{ height: '13px', width: `${w * 0.7}%`, background: 'var(--border)' }}
            />
            <div
              className="animate-pulse rounded-md"
              style={{ height: '13px', width: '48px', background: 'var(--border)' }}
            />
          </div>
          <div
            className="animate-pulse rounded-full"
            style={{ height: '6px', width: `${w}%`, background: 'var(--border)' }}
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
      {/* Card header */}
      <div style={{ marginBottom: '20px' }}>
        <p
          style={{
            fontSize: '0.65rem',
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
        <ul className="flex flex-col gap-4" role="list">
          {categories.map(({ slug, total }) => {
            const widthPct = maxTotal > 0 ? (total / maxTotal) * 100 : 0
            const sharePct = grandTotal > 0 ? Math.round((total / grandTotal) * 100) : 0
            const color = CATEGORY_COLORS[slug]

            return (
              <li key={slug} data-testid={`category-${slug}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '7px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: color,
                        flexShrink: 0,
                        display: 'inline-block',
                      }}
                    />
                    <span
                      style={{
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        color: 'var(--text)',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {CATEGORY_DISPLAY_NAMES[slug]}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px', flexShrink: 0 }}>
                    <span
                      className="tabular"
                      style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text)' }}
                    >
                      {formatInrShort(total)}
                    </span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--muted)' }}>
                      {sharePct}%
                    </span>
                  </div>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{ width: `${widthPct}%`, background: color }}
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
