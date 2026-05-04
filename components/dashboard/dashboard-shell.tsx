import type { DashboardData } from '@/types'
import type { FilterState } from '@/lib/dashboard-data'
import {
  filterAnalyses,
  computeKpis,
  getSpendTrendData,
  getAvailableMonths,
  getAvailableBanks,
  getAvailableCards,
} from '@/lib/dashboard-data'
import { FilterBar } from '@/components/dashboard/filter-bar'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { SpendTrendChart } from '@/components/dashboard/spend-trend-chart'
import { UpiChart } from '@/components/dashboard/upi-chart'
import { CategoryChart } from '@/components/dashboard/category-chart'
import { InsightsStrip } from '@/components/dashboard/insights-strip'

export interface DashboardShellProps {
  data: DashboardData
  filter: FilterState
  onFilterChange: (filter: FilterState) => void
  isLoading: boolean
}

export function DashboardShell({
  data,
  filter,
  onFilterChange,
  isLoading,
}: DashboardShellProps): JSX.Element {
  const filteredAnalyses = filterAnalyses(data, filter)
  const kpiMetrics = computeKpis(filteredAnalyses, filter)
  const availableMonths = getAvailableMonths(data)
  const availableBanks = getAvailableBanks(data)
  const availableCards = getAvailableCards(data)
  const trendData = getSpendTrendData(filteredAnalyses)

  return (
    <main
      className="min-h-dvh"
      style={{ background: 'var(--bg)' }}
      data-testid="dashboard-shell"
    >
      <div className="max-w-5xl mx-auto px-4 py-10 flex flex-col gap-7">

        {/* ── Header ── */}
        <div className="reveal">
          <div
            className="eyebrow"
            style={{
              background: 'var(--primary-subtle)',
              color: 'var(--primary)',
              marginBottom: '14px',
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: 'var(--primary)',
                flexShrink: 0,
              }}
            />
            Your financial picture
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.9rem, 5vw, 3rem)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1.0,
              color: 'var(--text)',
            }}
          >
            Clear<span style={{ color: 'var(--primary-light)' }}>Spend</span>
          </h1>

          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--muted)',
              marginTop: '8px',
              fontWeight: 400,
              letterSpacing: '-0.01em',
            }}
          >
            Your money, finally legible.
          </p>
        </div>

        {/* ── Filter bar ── */}
        <div className="reveal reveal-d1">
          <FilterBar
            availableMonths={availableMonths}
            availableBanks={availableBanks}
            availableCards={availableCards}
            filter={filter}
            onChange={onFilterChange}
          />
        </div>

        {/* ── KPI row ── */}
        <div className="reveal reveal-d2">
          <KpiCards metrics={kpiMetrics} isLoading={isLoading} />
        </div>

        {/* ── Hero: Spend Trend (full width) ── */}
        <div className="reveal reveal-d3">
          <SpendTrendChart data={trendData} isLoading={isLoading} />
        </div>

        {/* ── Bento row: Category (40%) + UPI (60%) ── */}
        <div className="grid grid-cols-1 gap-5 reveal reveal-d4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
          <CategoryChart analyses={filteredAnalyses} isLoading={isLoading} />
          <UpiChart analyses={filteredAnalyses} isLoading={isLoading} />
        </div>

        {/* ── Insights (full width) ── */}
        <div className="reveal reveal-d5">
          <InsightsStrip analyses={filteredAnalyses} isLoading={isLoading} />
        </div>

      </div>
    </main>
  )
}
