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
      {/* Toolbar — 1 row on desktop, 2 rows on mobile (filters wrap below) */}
      <header className="app-header">
        {/* Logo — left */}
        <div className="header-brand" style={{ gap: '6px' }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--primary, #5E6AD2)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '0.82rem',
              fontWeight: 700,
              color: 'var(--text, #1A1A1A)',
              letterSpacing: '-0.01em',
            }}
          >
            ClearSpend
          </span>
        </div>

        {/* FilterBar — center on desktop, full-width row 2 on mobile */}
        <div className="header-filter-slot">
          <FilterBar
            availableMonths={availableMonths}
            availableBanks={availableBanks}
            availableCards={availableCards}
            filter={filter}
            onChange={onFilterChange}
          />
        </div>

        {/* Actions — right */}
        <div className="header-actions">
          <button
            type="button"
            onClick={onUploadClick}
            data-testid="add-statement-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 14px',
              borderRadius: '999px',
              background: 'var(--primary, #5E6AD2)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              fontFamily: 'inherit',
              minHeight: 32,
            }}
          >
            + Add
          </button>
          <button
            type="button"
            onClick={() => setShowManageStatements(true)}
            data-testid="manage-statements-btn"
            aria-label="Manage statements"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted, #8A8A8A)',
              fontFamily: 'inherit',
              fontSize: '1.1rem',
              lineHeight: 1,
              padding: '8px',
              minHeight: 32,
              minWidth: 32,
            }}
          >
            ···
          </button>
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
