import type { CategorySlug } from '@/types'
import type { KpiMetrics } from '@/lib/dashboard-data'

export interface KpiCardsProps {
  metrics: KpiMetrics
  isLoading: boolean
}

const CATEGORY_DISPLAY_NAMES: Record<CategorySlug, string> = {
  food: 'Food',
  transport: 'Transport',
  shopping: 'Shopping',
  emi_loans: 'EMI Loans',
  upi: 'UPI',
  utilities: 'Utilities',
  entertainment: 'Entertainment',
  health: 'Health',
  travel: 'Travel',
  others: 'Others',
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function ShimmerBlock(): JSX.Element {
  return (
    <div
      className="animate-pulse rounded"
      style={{ height: '2rem', width: '70%', background: 'var(--border)' }}
      aria-hidden="true"
    />
  )
}

interface KpiCardProps {
  testId: string
  label: string
  children: React.ReactNode
}

function KpiCard({ testId, label, children }: KpiCardProps): JSX.Element {
  return (
    <div className="card" data-testid={testId}>
      <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--muted)' }}>
        {label}
      </p>
      <div className="mt-2">{children}</div>
    </div>
  )
}

export function KpiCards({ metrics, isLoading }: KpiCardsProps): JSX.Element {
  const { totalSpend, avgMonthlySpend, topCategory, topCategoryAmount, monthOverMonthChange } = metrics

  const momColour =
    monthOverMonthChange === null
      ? undefined
      : monthOverMonthChange >= 0
        ? 'var(--accent-negative)' // spending went up = negative for user
        : 'var(--accent-positive)' // spending went down = positive for user

  const momSign = monthOverMonthChange !== null && monthOverMonthChange >= 0 ? '+' : ''

  return (
    <div className="grid grid-cols-2 gap-4 kpi-grid">
      {/* Total Spend */}
      <KpiCard testId="kpi-total-spend" label="Total Spend">
        {isLoading ? (
          <ShimmerBlock />
        ) : (
          <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {formatInr(totalSpend)}
          </p>
        )}
      </KpiCard>

      {/* Avg Monthly */}
      <KpiCard testId="kpi-avg-monthly" label="Avg / Month">
        {isLoading ? (
          <ShimmerBlock />
        ) : (
          <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
            {formatInr(avgMonthlySpend)}
          </p>
        )}
      </KpiCard>

      {/* Top Category */}
      <KpiCard testId="kpi-top-category" label="Top Category">
        {isLoading ? (
          <ShimmerBlock />
        ) : (
          <>
            <p className="text-2xl font-bold" style={{ color: 'var(--text)' }}>
              {topCategory !== null ? CATEGORY_DISPLAY_NAMES[topCategory] : '—'}
            </p>
            {topCategory !== null && (
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                {formatInr(topCategoryAmount)}
              </p>
            )}
          </>
        )}
      </KpiCard>

      {/* MoM Change */}
      <KpiCard testId="kpi-mom-change" label="vs Last Month">
        {isLoading ? (
          <ShimmerBlock />
        ) : monthOverMonthChange === null ? (
          <p className="text-2xl font-bold" style={{ color: 'var(--muted)' }}>
            —
          </p>
        ) : (
          <p className="text-2xl font-bold" style={{ color: momColour }} data-testid="kpi-mom-value">
            {`${momSign}${monthOverMonthChange.toFixed(1)}%`}
          </p>
        )}
      </KpiCard>
    </div>
  )
}
