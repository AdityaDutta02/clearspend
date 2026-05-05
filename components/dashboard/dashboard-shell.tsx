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
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
}

const rowVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.48, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] },
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
      style={{ background: 'linear-gradient(180deg, #EFF6FF 0%, var(--bg) 220px)' }}
      data-testid="dashboard-shell"
    >
      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-5">

        {/* ── Header ── */}
        <div className="reveal">
          <div
            className="eyebrow"
            style={{
              background: 'var(--primary-subtle)',
              color: 'var(--primary)',
              marginBottom: '12px',
              fontSize: '0.6rem',
            }}
          >
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0 }} />
            ClearSpend
          </div>
          <h1
            style={{
              fontSize: 'clamp(2rem, 5vw, 3.2rem)',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              lineHeight: 1.0,
              color: 'var(--text)',
            }}
          >
            Your Financial<br />
            <span style={{ color: 'var(--primary)' }}>Picture.</span>
          </h1>
          <p
            style={{
              fontSize: '0.9rem',
              color: 'var(--muted)',
              marginTop: '8px',
              fontWeight: 400,
              letterSpacing: '-0.01em',
              maxWidth: '42ch',
            }}
          >
            Track, filter, and understand where your money goes.
          </p>
        </div>

        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="flex flex-col gap-5">

          {/* ── KPI Row ── */}
          <motion.div variants={rowVariants}>
            <KpiCards metrics={kpiMetrics} isLoading={isLoading} />
          </motion.div>

          {/* ── Filter Bar ── */}
          <motion.div variants={rowVariants}>
            <FilterBar
              availableMonths={availableMonths}
              availableBanks={availableBanks}
              availableCards={availableCards}
              filter={filter}
              onChange={onFilterChange}
            />
          </motion.div>

          {/* ── 2-col: Spend Trend + Category ── */}
          <motion.div variants={rowVariants} className="bento-main">
            <SpendTrendChart data={trendData} isLoading={isLoading} />
            <CategoryChart analyses={filteredAnalyses} isLoading={isLoading} />
          </motion.div>

          {/* ── UPI (full width) ── */}
          <motion.div variants={rowVariants}>
            <UpiChart analyses={filteredAnalyses} isLoading={isLoading} />
          </motion.div>

          {/* ── Insights Grid ── */}
          <motion.div variants={rowVariants}>
            <InsightsStrip analyses={filteredAnalyses} isLoading={isLoading} />
          </motion.div>

        </motion.div>
      </div>
    </main>
  )
}
