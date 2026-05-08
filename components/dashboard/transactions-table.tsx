'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import type { Transaction, CategorySlug } from '@/types'
import type { FilterState } from '@/lib/dashboard-data'

export interface TransactionsTableProps {
  transactions: Transaction[]
  isLoading: boolean
  filter: FilterState
  availableCategories: CategorySlug[]
  selectedCategory: CategorySlug | null
  onCategoryChange: (cat: CategorySlug | null) => void
}

const CATEGORY_COLORS: Record<CategorySlug, string> = {
  food: '#f97316', groceries: '#22c55e', transport: '#3b82f6',
  shopping: '#a855f7', emi_loans: '#ef4444', utilities: '#06b6d4',
  entertainment: '#ec4899', health: '#14b8a6', travel: '#f59e0b', others: '#94a3b8',
}

const CATEGORY_BG: Record<CategorySlug, string> = {
  food: 'rgba(249,115,22,0.1)', groceries: 'rgba(34,197,94,0.1)', transport: 'rgba(59,130,246,0.1)',
  shopping: 'rgba(168,85,247,0.1)', emi_loans: 'rgba(239,68,68,0.1)', utilities: 'rgba(6,182,212,0.1)',
  entertainment: 'rgba(236,72,153,0.1)', health: 'rgba(20,184,166,0.1)', travel: 'rgba(245,158,11,0.1)', others: 'rgba(148,163,184,0.1)',
}

const CATEGORY_DISPLAY_NAMES: Record<CategorySlug, string> = {
  food: 'Food', groceries: 'Groceries', transport: 'Transport',
  shopping: 'Shopping', emi_loans: 'EMI', utilities: 'Bills',
  entertainment: 'Entertainment', health: 'Health', travel: 'Travel', others: 'Others',
}

const CATEGORY_FILTER_NAMES: Record<CategorySlug, string> = {
  food: 'Food & Dining', groceries: 'Groceries', transport: 'Transport',
  shopping: 'Shopping', emi_loans: 'EMI & Loans', utilities: 'Bills & Subs',
  entertainment: 'Entertainment', health: 'Health', travel: 'Travel', others: 'Others',
}

const selectStyle: React.CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  background: 'rgba(15, 23, 42, 0.05)',
  border: '1px solid transparent',
  borderRadius: '999px',
  padding: '5px 32px 5px 14px',
  fontSize: '0.775rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  color: 'var(--muted)',
  cursor: 'pointer',
  outline: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2364748B' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  transition: 'background-color 0.18s ease, color 0.18s ease',
}

const activeSelectStyle: React.CSSProperties = {
  ...selectStyle,
  backgroundColor: 'var(--primary)',
  color: '#ffffff',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23ffffff' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
}

const PAGE_SIZE = 10

function formatDate(dateStr: string): string {
  const parts = dateStr.split('-').map(Number)
  if (parts.length < 3 || parts.some(isNaN)) return dateStr
  const [, month, day] = parts
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day} ${MONTHS[month - 1]}`
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function exportCsv(transactions: Transaction[]): void {
  const headers = ['Date', 'Merchant', 'Category', 'Amount', 'Type']
  const rows = transactions.map((t) => [
    t.date,
    `"${t.merchant.replace(/"/g, '""')}"`,
    t.category,
    t.amount.toString(),
    t.type,
  ])
  const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'clearspend-transactions.csv'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

function ShimmerRow(): JSX.Element {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
      <div className="animate-pulse rounded-md" style={{ height: '12px', width: '40px', background: 'var(--border)', flexShrink: 0 }} />
      <div className="animate-pulse rounded-md" style={{ height: '12px', flex: 1, background: 'var(--border)' }} />
      <div className="animate-pulse rounded-full" style={{ height: '20px', width: '60px', background: 'var(--border)', flexShrink: 0 }} />
      <div className="animate-pulse rounded-md" style={{ height: '12px', width: '56px', background: 'var(--border)', flexShrink: 0 }} />
    </div>
  )
}

export function TransactionsTable({
  transactions,
  isLoading,
  filter,
  availableCategories = [],
  selectedCategory = null,
  onCategoryChange = () => undefined,
}: TransactionsTableProps): JSX.Element {
  const [searchQuery, setSearchQuery] = useState('')
  const [page, setPage] = useState(0)

  const debits = useMemo(
    () => transactions.filter((t) => t.type === 'debit'),
    [transactions],
  )

  const visibleTransactions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return debits
    return debits.filter(
      (t) =>
        t.merchant.toLowerCase().includes(q) ||
        t.raw_description.toLowerCase().includes(q),
    )
  }, [debits, searchQuery])

  useEffect(() => { setPage(0) }, [visibleTransactions])

  const categoryTotal = useMemo(
    () => selectedCategory ? debits.reduce((sum, t) => sum + Number(t.amount), 0) : null,
    [debits, selectedCategory],
  )

  const pageCount = Math.ceil(visibleTransactions.length / PAGE_SIZE)
  const pagedTransactions = visibleTransactions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>): void => {
    setSearchQuery(e.target.value)
  }, [])

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }} data-testid="transactions-table">

      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: '4px' }}>
          Recent
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px' }}>
            <p style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', margin: 0 }}>
              Transactions
            </p>
            {categoryTotal !== null && (
              <span className="tabular" style={{
                fontSize: '0.82rem', fontWeight: 700,
                color: 'var(--primary)', letterSpacing: '-0.01em',
              }}>
                {formatInr(categoryTotal)}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {visibleTransactions.length > 0 && (
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 500 }}>
                {visibleTransactions.length} shown
              </span>
            )}
            {availableCategories.length > 0 && (
              <select
                value={selectedCategory ?? ''}
                onChange={(e) => onCategoryChange((e.target.value as CategorySlug) || null)}
                style={selectedCategory ? activeSelectStyle : selectStyle}
                data-testid="category-dropdown"
                aria-label="Filter by category"
              >
                <option value="">All categories</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>{CATEGORY_FILTER_NAMES[cat] ?? cat}</option>
                ))}
              </select>
            )}
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search transactions…"
              data-testid="transaction-search"
              style={{
                appearance: 'none',
                background: 'rgba(15,23,42,0.05)',
                border: '1px solid transparent',
                borderRadius: '999px',
                padding: '5px 14px',
                fontSize: '0.775rem',
                fontFamily: 'inherit',
                color: 'var(--text)',
                outline: 'none',
                width: '160px',
              }}
            />
            {visibleTransactions.length > 0 && (
              <button
                type="button"
                onClick={() => exportCsv(visibleTransactions)}
                data-testid="export-csv-btn"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '5px 12px',
                  borderRadius: '999px',
                  background: 'rgba(15,23,42,0.05)',
                  border: '1px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.7rem',
                  fontWeight: 600,
                  fontFamily: 'inherit',
                  color: 'var(--muted)',
                }}
              >
                Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div aria-hidden="true" data-testid="shimmer-block">
          {Array.from({ length: 6 }, (_, i) => <ShimmerRow key={i} />)}
        </div>
      ) : pagedTransactions.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No transactions found</p>
        </div>
      ) : (
        <div className="transactions-rows">
          {pagedTransactions.map((tx) => (
            <div
              key={tx.id}
              data-testid={`transaction-row-${tx.id}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 0',
                borderBottom: '1px solid var(--border)',
              }}
            >
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 500, minWidth: '40px', flexShrink: 0 }}>
                {formatDate(tx.date)}
              </span>
              <span style={{
                fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {tx.merchant || tx.raw_description}
              </span>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700,
                color: CATEGORY_COLORS[tx.category],
                background: CATEGORY_BG[tx.category],
                borderRadius: '999px',
                padding: '3px 8px',
                flexShrink: 0,
                whiteSpace: 'nowrap',
              }}>
                {CATEGORY_DISPLAY_NAMES[tx.category]}
              </span>
              <span className="tabular" style={{
                fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)',
                flexShrink: 0, minWidth: '64px', textAlign: 'right',
              }}>
                {formatInr(tx.amount)}
              </span>
            </div>
          ))}
        </div>
      )}

      {pageCount > 1 && (
        <div
          data-testid="pagination-controls"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginTop: '12px' }}
        >
          <button
            type="button"
            onClick={() => setPage((p) => p - 1)}
            disabled={page === 0}
            data-testid="pagination-prev"
            style={{
              padding: '4px 12px', borderRadius: '999px', border: '1px solid var(--border)',
              background: 'none', cursor: page === 0 ? 'default' : 'pointer',
              fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--muted)',
              opacity: page === 0 ? 0.4 : 1,
            }}
          >
            Prev
          </button>
          <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
            Page {page + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => p + 1)}
            disabled={page === pageCount - 1}
            data-testid="pagination-next"
            style={{
              padding: '4px 12px', borderRadius: '999px', border: '1px solid var(--border)',
              background: 'none', cursor: page === pageCount - 1 ? 'default' : 'pointer',
              fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--muted)',
              opacity: page === pageCount - 1 ? 0.4 : 1,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
