'use client'

import { motion } from 'framer-motion'
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

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
}

const rowVariants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.52, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] },
  },
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
      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-6">

        {/* ── Header ── */}
        <div className="reveal">
          <div
            className="eyebrow"
            style={{
              background: 'var(--primary-subtle)',
              color: 'var(--primary)',
              marginBottom: '12px',
            }}
          >
            <span
              style={{
                width: 5,
                height: 5,
                borderRadius: '50%',
                background: 'var(--primary)',
                flexShrink: 0,
              }}
            />
            Your financial picture
          </div>

          <h1
            style={{
              fontSize: 'clamp(1.8rem, 5vw, 2.75rem)',
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
              fontSize: '0.875rem',
              color: 'var(--muted)',
              marginTop: '6px',
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

        {/* ── Dashboard grid ── */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col gap-4"
        >

          {/* Row 1: KPIs + Trend Chart */}
          <motion.div variants={rowVariants} className="bento-main">
            <KpiCards metrics={kpiMetrics} isLoading={isLoading} />
            <SpendTrendChart data={trendData} isLoading={isLoading} />
          </motion.div>

          {/* Row 2: Category + UPI */}
          <motion.div variants={rowVariants} className="bento-secondary">
            <CategoryChart analyses={filteredAnalyses} isLoading={isLoading} />
            <UpiChart analyses={filteredAnalyses} isLoading={isLoading} />
          </motion.div>

          {/* Row 3: Insights */}
          <motion.div variants={rowVariants}>
            <InsightsStrip analyses={filteredAnalyses} isLoading={isLoading} />
          </motion.div>

        </motion.div>

      </div>
    </main>
  )
}
