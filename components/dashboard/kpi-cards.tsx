import type { CategorySlug } from '@/types'
import type { KpiMetrics } from '@/lib/dashboard-data'

export interface KpiCardsProps {
  metrics: KpiMetrics
  isLoading: boolean
}

const CATEGORY_DISPLAY_NAMES: Record<CategorySlug, string> = {
  food: 'Food & Dining',
  groceries: 'Groceries',
  transport: 'Transport',
  shopping: 'Shopping',
  emi_loans: 'EMI Loans',
  utilities: 'Bills & Subs',
  entertainment: 'Entertainment',
  health: 'Health',
  travel: 'Travel',
  others: 'Others',
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function ShimmerLine({ width = '70%', height = '2rem' }: { width?: string; height?: string }): JSX.Element {
  return (
    <div
      className="animate-pulse rounded-lg"
      style={{ height, width, background: 'var(--border)' }}
      aria-hidden="true"
    />
  )
}

interface KpiCardProps {
  testId: string
  label: string
  accent?: boolean
  children: React.ReactNode
}

function KpiCard({ testId, label, accent = false, children }: KpiCardProps): JSX.Element {
  return (
    <div
      className="bezel-outer"
      data-testid={testId}
      style={{ flex: 1 }}
    >
      <div className="bezel-inner flex flex-col gap-2">
        <p
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
            color: accent ? 'var(--primary)' : 'var(--muted)',
          }}
        >
          {label}
        </p>
        <div>{children}</div>
      </div>
    </div>
  )
}

export function KpiCards({ metrics, isLoading }: KpiCardsProps): JSX.Element {
  const { totalSpend, avgMonthlySpend, topCategory, topCategoryAmount, monthOverMonthChange } = metrics

  const momIsPositive = monthOverMonthChange !== null && monthOverMonthChange >= 0
  const momColour = monthOverMonthChange === null
    ? 'var(--muted)'
    : momIsPositive
      ? 'var(--accent-negative)'
      : 'var(--accent-positive)'

  const momSign = momIsPositive ? '+' : ''

  return (
    <div className="grid grid-cols-2 gap-3 kpi-grid">

      {/* Total Spend */}
      <KpiCard testId="kpi-total-spend" label="Total Spend">
        {isLoading ? (
          <ShimmerLine />
        ) : (
          <p
            className="tabular"
            style={{
              fontSize: 'clamp(1.3rem, 3vw, 1.75rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              color: 'var(--text)',
            }}
          >
            {formatInr(totalSpend)}
          </p>
        )}
      </KpiCard>

      {/* Avg Monthly */}
      <KpiCard testId="kpi-avg-monthly" label="Avg / Month">
        {isLoading ? (
          <ShimmerLine />
        ) : (
          <p
            className="tabular"
            style={{
              fontSize: 'clamp(1.3rem, 3vw, 1.75rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              color: 'var(--text)',
            }}
          >
            {formatInr(avgMonthlySpend)}
          </p>
        )}
      </KpiCard>

      {/* Top Category */}
      <KpiCard testId="kpi-top-category" label="Top Category">
        {isLoading ? (
          <ShimmerLine width="60%" height="1.6rem" />
        ) : (
          <>
            <p
              style={{
                fontSize: 'clamp(1rem, 2.5vw, 1.25rem)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                color: 'var(--text)',
              }}
            >
              {topCategory !== null ? CATEGORY_DISPLAY_NAMES[topCategory] : '—'}
            </p>
            {topCategory !== null && (
              <p
                className="tabular"
                style={{
                  fontSize: '0.8rem',
                  color: 'var(--muted)',
                  marginTop: '4px',
                  fontWeight: 500,
                }}
              >
                {formatInr(topCategoryAmount)}
              </p>
            )}
          </>
        )}
      </KpiCard>

      {/* MoM Change */}
      <KpiCard testId="kpi-mom-change" label="vs Last Month">
        {isLoading ? (
          <ShimmerLine width="55%" />
        ) : monthOverMonthChange === null ? (
          <p
            style={{
              fontSize: 'clamp(1.3rem, 3vw, 1.75rem)',
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.1,
              color: 'var(--muted)',
            }}
          >
            —
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <p
              className="tabular"
              style={{
                fontSize: 'clamp(1.3rem, 3vw, 1.75rem)',
                fontWeight: 800,
                letterSpacing: '-0.03em',
                lineHeight: 1.1,
                color: momColour,
              }}
              data-testid="kpi-mom-value"
            >
              {`${momSign}${monthOverMonthChange.toFixed(1)}%`}
            </p>
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: 500,
                color: momColour,
                opacity: 0.7,
              }}
            >
              {momIsPositive ? '↑' : '↓'}
            </span>
          </div>
        )}
      </KpiCard>

    </div>
  )
}
