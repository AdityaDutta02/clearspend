'use client'

import { useMemo } from 'react'
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
  getFilteredTransactions,
} from '@/lib/dashboard-data'
import { FilterBar } from '@/components/dashboard/filter-bar'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { SpendTrendChart } from '@/components/dashboard/spend-trend-chart'
import { CategoryChart } from '@/components/dashboard/category-chart'
import { TransactionsTable } from '@/components/dashboard/transactions-table'
import { InsightsStrip } from '@/components/dashboard/insights-strip'

export interface DashboardShellProps {
  data: DashboardData
  filter: FilterState
  onFilterChange: (filter: FilterState) => void
  onUploadClick: () => void
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
  onUploadClick,
  isLoading,
}: DashboardShellProps): JSX.Element {
  const filteredAnalyses = useMemo(() => filterAnalyses(data, filter), [data, filter])
  // KPIs always use all-time totals across all banks/cards; only month filter applies
  const kpiMetrics = useMemo(() => computeKpis(data.analyses, filter), [data.analyses, filter])
  const availableMonths = useMemo(() => getAvailableMonths(data), [data])
  const availableBanks = useMemo(() => getAvailableBanks(data), [data])
  const availableCards = useMemo(() => getAvailableCards(data), [data])
  const trendData = useMemo(() => getSpendTrendData(filteredAnalyses), [filteredAnalyses])
  const filteredTransactions = useMemo(() => getFilteredTransactions(data, filter), [data, filter])

  return (
    <main
      className="min-h-dvh"
      style={{ background: 'linear-gradient(180deg, #EFF6FF 0%, var(--bg) 220px)' }}
      data-testid="dashboard-shell"
    >
      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-5">

        {/* ── Header ── */}
        <div className="reveal" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div>
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

          {/* ── Upload button ── */}
          <button
            type="button"
            onClick={onUploadClick}
            data-testid="add-statement-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              borderRadius: '999px',
              background: 'var(--primary)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 700,
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              flexShrink: 0,
              marginTop: '4px',
              boxShadow: '0 2px 10px rgba(37,99,235,0.25)',
              transition: 'opacity 0.18s ease, transform 0.18s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add Statement
          </button>
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

          {/* ── Transactions (full width) ── */}
          <motion.div variants={rowVariants}>
            <TransactionsTable transactions={filteredTransactions} isLoading={isLoading} />
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
