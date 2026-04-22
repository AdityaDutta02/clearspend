import type { DashboardData } from '@/types'
import type { FilterState } from '@/lib/dashboard-data'
import {
  filterAnalyses,
  computeKpis,
  getSpendTrendData,
  getAvailableMonths,
  getAvailableBanks,
} from '@/lib/dashboard-data'
import { FilterBar } from '@/components/dashboard/filter-bar'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { SpendTrendChart } from '@/components/dashboard/spend-trend-chart'
import { UpiChart } from '@/components/dashboard/upi-chart'
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
  const trendData = getSpendTrendData(filteredAnalyses)

  return (
    <main
      className="min-h-dvh"
      style={{ background: 'var(--background)' }}
      data-testid="dashboard-shell"
    >
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <h1
            className="font-bold text-2xl"
            style={{ color: 'var(--text)' }}
          >
            ClearSpend
          </h1>
          <p
            className="text-sm mt-1"
            style={{ color: 'var(--muted)' }}
          >
            Your money, finally legible.
          </p>
        </div>

        <FilterBar
          availableMonths={availableMonths}
          availableBanks={availableBanks}
          filter={filter}
          onChange={onFilterChange}
        />

        <KpiCards metrics={kpiMetrics} isLoading={isLoading} />

        <SpendTrendChart data={trendData} isLoading={isLoading} />

        <UpiChart analyses={filteredAnalyses} isLoading={isLoading} />

        <InsightsStrip analyses={filteredAnalyses} isLoading={isLoading} />
      </div>
    </main>
  )
}
