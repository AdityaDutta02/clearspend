'use client'

import type { Transaction, CategorySlug } from '@/types'

export interface TransactionsTableProps {
  transactions: Transaction[]
  isLoading: boolean
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

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number)
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${day} ${MONTHS[month - 1]}`
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
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

export function TransactionsTable({ transactions, isLoading }: TransactionsTableProps): JSX.Element {
  const debits = transactions
    .filter((t) => t.type === 'debit')
    .slice(0, 20)

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column' }} data-testid="transactions-table">

      <div style={{ marginBottom: '16px' }}>
        <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: '4px' }}>
          Recent
        </p>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <p style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Transactions
          </p>
          {debits.length > 0 && (
            <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 500 }}>
              {debits.length} shown
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div aria-hidden="true" data-testid="shimmer-block">
          {Array.from({ length: 6 }, (_, i) => <ShimmerRow key={i} />)}
        </div>
      ) : debits.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No transactions found</p>
        </div>
      ) : (
        <div>
          {debits.map((tx) => (
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
    </div>
  )
}
