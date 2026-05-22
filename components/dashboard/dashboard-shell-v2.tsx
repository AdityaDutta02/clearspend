'use client'

import { useMemo, useState } from 'react'
import type { DashboardData, CategorySlug } from '@/types'
import type { FilterState } from '@/lib/dashboard-data'
import type { DashboardShellProps } from '@/components/dashboard/dashboard-shell'
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
import { StatementsModal } from '@/components/dashboard/statements-modal'
import { ChatRail } from '@/components/chat/chat-rail'
import { MobileAskSheet } from '@/components/chat/mobile-ask-sheet'

export function DashboardShellV2({
  data,
  filter,
  onFilterChange,
  onUploadClick,
  isLoading,
  token,
  refresh,
}: DashboardShellProps): JSX.Element {
  const [showManageStatements, setShowManageStatements] = useState(false)

  const filteredAnalyses = useMemo(() => filterAnalyses(data, filter), [data, filter])
  const kpiMetrics = useMemo(() => computeKpis(data.analyses, filter), [data.analyses, filter])
  const availableMonths = useMemo(() => getAvailableMonths(data), [data])
  const availableBanks = useMemo(() => getAvailableBanks(data), [data])
  const availableCards = useMemo(() => getAvailableCards(data), [data])
  const trendData = useMemo(() => getSpendTrendData(filteredAnalyses), [filteredAnalyses])
  const filteredTransactions = useMemo(() => getFilteredTransactions(data, filter), [data, filter])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set(
          getFilteredTransactions(data, { ...filter, category: null })
            .filter((t) => t.type === 'debit')
            .map((t) => t.category),
        ),
      ).sort() as CategorySlug[],
    [data, filter.month, filter.bank, filter.statement_id],
  )

  return (
    <main
      data-design="v2"
      data-testid="dashboard-shell-v2"
      style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflowX: 'hidden' }}
    >
      {/* iOS-style two-row header */}
      <header className="app-header">
        {/* Row 1: nav bar — brand left, actions right */}
        <div className="nav-bar">
          <div className="header-brand">
            <span className="brand-dot" />
            <span className="brand-name">ClearSpend</span>
          </div>
          <div className="header-actions">
            <button
              type="button"
              onClick={onUploadClick}
              data-testid="add-statement-btn"
              className="btn-add"
            >
              + Add
            </button>
            <button
              type="button"
              onClick={() => setShowManageStatements(true)}
              data-testid="manage-statements-btn"
              aria-label="Manage statements"
              className="btn-more"
            >
              ···
            </button>
          </div>
        </div>

        {/* Row 2: scrollable pill filter strip */}
        <div className="filter-strip">
          <FilterBar
            availableMonths={availableMonths}
            availableBanks={availableBanks}
            availableCards={availableCards}
            filter={filter}
            onChange={onFilterChange}
          />
        </div>
      </header>

      {/* Two-column body — flex: 1 so it fills whatever height remains after header */}
      <div
        className="dashboard-v2-grid"
        style={{
          display: 'grid',
          flex: 1,
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* Content column */}
        <div
          className="content-col"
          style={{
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            minHeight: 0,
          }}
        >
          <KpiCards metrics={kpiMetrics} isLoading={isLoading} />

          <div className="bento-main">
            <SpendTrendChart data={trendData} isLoading={isLoading} />
            <CategoryChart analyses={filteredAnalyses} isLoading={isLoading} />
          </div>

          <InsightsStrip analyses={filteredAnalyses} isLoading={isLoading} />

          <TransactionsTable
            transactions={filteredTransactions}
            isLoading={isLoading}
            filter={filter}
            availableCategories={availableCategories}
            selectedCategory={filter.category}
            onCategoryChange={(cat) => onFilterChange({ ...filter, category: cat })}
          />
        </div>

        {/* Rail column - hidden on mobile via .chat-rail-col */}
        <div
          className="chat-rail-col"
          style={{
            flexDirection: 'column',
            borderLeft: '1px solid var(--border, rgba(0,0,0,0.08))',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <ChatRail token={token} style={{ height: '100%' }} />
        </div>
      </div>

      {/* Statements modal */}
      {showManageStatements && (
        <StatementsModal
          data={data}
          token={token}
          onClose={() => setShowManageStatements(false)}
          onDeleted={refresh}
        />
      )}

      {/* Mobile floating chat button */}
      <MobileAskSheet token={token} />
    </main>
  )
}
