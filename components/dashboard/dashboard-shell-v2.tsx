'use client'

import { useMemo, useState } from 'react'
import type { DashboardData, CategorySlug } from '@/types'
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
import { StatementsModal } from '@/components/dashboard/statements-modal'
import { ChatRail } from '@/components/chat/chat-rail'
import { MobileAskSheet } from '@/components/chat/mobile-ask-sheet'

export interface DashboardShellProps {
  data: DashboardData
  filter: FilterState
  onFilterChange: (filter: FilterState) => void
  onUploadClick: () => void
  isLoading: boolean
  token: string
  refresh: () => void
}

export type { DashboardShellProps as DashboardShellV2Props }

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
    <main data-design="v2" data-testid="dashboard-shell-v2">
      <style>{`
        @media (min-width: 1024px) {
          .dashboard-v2-grid {
            grid-template-columns: 65fr 35fr;
          }
        }
        @media (max-width: 1023px) {
          .chat-rail-col {
            display: none;
          }
        }
        .bento-main {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 768px) {
          .bento-main {
            grid-template-columns: 1fr 1fr;
          }
        }
      `}</style>

      {/* Toolbar */}
      <header
        style={{
          height: 48,
          position: 'sticky',
          top: 0,
          zIndex: 30,
          background: 'var(--surface, #FFFFFF)',
          borderBottom: '1px solid var(--border, rgba(0,0,0,0.08))',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '0 16px',
        }}
      >
        {/* Logo pill - left */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: 'var(--primary, #5E6AD2)',
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

        {/* FilterBar - center */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <FilterBar
            availableMonths={availableMonths}
            availableBanks={availableBanks}
            availableCards={availableCards}
            filter={filter}
            onChange={onFilterChange}
          />
        </div>

        {/* Actions - right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onUploadClick}
            data-testid="add-statement-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 12px',
              borderRadius: '999px',
              background: 'var(--primary, #5E6AD2)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.78rem',
              fontWeight: 600,
              fontFamily: 'inherit',
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
              padding: '4px',
            }}
          >
            ···
          </button>
        </div>
      </header>

      {/* Two-column body */}
      <div
        className="dashboard-v2-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr',
          minHeight: 'calc(100dvh - 48px)',
        }}
      >
        {/* Content column */}
        <div
          style={{
            overflowY: 'auto',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
          }}
        >
          <KpiCards metrics={kpiMetrics} isLoading={isLoading} />

          <div className="bento-main">
            <SpendTrendChart data={trendData} isLoading={isLoading} />
            <CategoryChart analyses={filteredAnalyses} isLoading={isLoading} />
          </div>

          <TransactionsTable
            transactions={filteredTransactions}
            isLoading={isLoading}
            filter={filter}
            availableCategories={availableCategories}
            selectedCategory={filter.category}
            onCategoryChange={(cat) => onFilterChange({ ...filter, category: cat })}
          />

          <InsightsStrip analyses={filteredAnalyses} isLoading={isLoading} />
        </div>

        {/* Rail column - hidden on mobile via .chat-rail-col */}
        <div
          className="chat-rail-col"
          style={{
            position: 'sticky',
            top: 48,
            height: 'calc(100dvh - 48px)',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid var(--border, rgba(0,0,0,0.08))',
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
