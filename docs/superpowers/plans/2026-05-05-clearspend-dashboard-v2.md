# ClearSpend Dashboard v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken filter pills, gradient bar chart, and UPI section with dropdown filters, a stacked area chart, and a full transactions table; move upload zone to a modal; fix KPI all-time totals and top-category font size.

**Architecture:** All changes are additive or in-place rewrites of existing components. A new `transactions-table.tsx` replaces `upi-chart.tsx`. The `DashboardData` type gains a `transactions` field fed from a parallel DB fetch. KPI computation is decoupled from card-level filtering by passing `data.analyses` instead of `filteredAnalyses`.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Recharts (AreaChart), Framer Motion, CSS custom properties.

---

### Task 1: Add `transactions` to `DashboardData` type

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Edit `DashboardData` to include transactions**

In `types/index.ts`, change:
```typescript
export interface DashboardData {
  statements: Statement[]
  analyses: Analysis[]
}
```
to:
```typescript
export interface DashboardData {
  statements: Statement[]
  analyses: Analysis[]
  transactions: Transaction[]
}
```

- [ ] **Step 2: Verify TypeScript still compiles**

Run: `node_modules/.bin/next build 2>&1 | head -40`

Expected: type errors only in files we haven't updated yet (dashboard API route, dashboard-shell). NOT a "Transaction not found" error.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat(types): add transactions to DashboardData"
```

---

### Task 2: Fetch transactions in dashboard API route

**Files:**
- Modify: `app/api/dashboard/route.ts`

- [ ] **Step 1: Rewrite dashboard route to include transactions**

Replace the entire file with:
```typescript
import { NextRequest, NextResponse } from 'next/server'
import { dbList, dbDelete } from '@/lib/db'
import type { Statement, Analysis, Transaction, DashboardData } from '@/types'

export async function GET(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [statements, analyses, transactions] = await Promise.all([
    dbList<Statement>('statements', {}, token).catch(() => [] as Statement[]),
    dbList<Analysis>('analyses', {}, token).catch(() => [] as Analysis[]),
    dbList<Transaction>('transactions', {}, token).catch(() => [] as Transaction[]),
  ])

  // Auto-delete orphan statements (no matching analysis — e.g. failed pipeline run)
  const analysedIds = new Set(analyses.map((a) => a.statement_id))
  const orphans = statements.filter((s) => !analysedIds.has(s.id))

  if (orphans.length > 0) {
    await Promise.all(
      orphans.flatMap((s) => {
        const txIds = transactions.filter((t) => t.statement_id === s.id).map((t) => t.id)
        return [
          ...txIds.map((id) => dbDelete('transactions', id, token).catch(() => undefined)),
          dbDelete('statements', s.id, token).catch(() => undefined),
        ]
      }),
    )
  }

  const cleanStatements = statements.filter((s) => analysedIds.has(s.id))
  const cleanTxIds = new Set(cleanStatements.map((s) => s.id))
  const cleanTransactions = transactions.filter((t) => cleanTxIds.has(t.statement_id))

  const data: DashboardData = { statements: cleanStatements, analyses, transactions: cleanTransactions }
  return NextResponse.json(data)
}
```

- [ ] **Step 2: Verify build**

Run: `node_modules/.bin/next build 2>&1 | head -40`

Expected: no errors in `app/api/dashboard/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add app/api/dashboard/route.ts
git commit -m "feat(api): include transactions in dashboard response"
```

---

### Task 3: Add `getFilteredTransactions` to dashboard-data lib

**Files:**
- Modify: `lib/dashboard-data.ts`

- [ ] **Step 1: Add import and helper function**

At the top of `lib/dashboard-data.ts`, change the import line:
```typescript
import type { BankSlug, CategorySlug, DashboardData, Analysis, Statement } from '@/types'
```
to:
```typescript
import type { BankSlug, CategorySlug, DashboardData, Analysis, Statement, Transaction } from '@/types'
```

Then append this function at the bottom of the file:
```typescript
export function getFilteredTransactions(data: DashboardData, filter: FilterState): Transaction[] {
  const filteredStatements = data.statements.filter((s) => {
    if (filter.month !== null && s.month !== filter.month) return false
    if (filter.bank !== null && s.bank !== filter.bank) return false
    if (filter.statement_id !== null && s.id !== filter.statement_id) return false
    return true
  })
  const statementIds = new Set(filteredStatements.map((s) => s.id))
  return data.transactions
    .filter((t) => statementIds.has(t.statement_id))
    .sort((a, b) => b.date.localeCompare(a.date))
}
```

- [ ] **Step 2: Verify build**

Run: `node_modules/.bin/next build 2>&1 | head -40`

Expected: no errors in `lib/dashboard-data.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/dashboard-data.ts
git commit -m "feat(lib): add getFilteredTransactions helper"
```

---

### Task 4: Rewrite filter bar as compact dropdowns

**Files:**
- Modify: `components/dashboard/filter-bar.tsx`

- [ ] **Step 1: Rewrite the entire file**

Replace `components/dashboard/filter-bar.tsx` with:
```typescript
'use client'

import { useCallback } from 'react'
import type { BankSlug } from '@/types'
import type { FilterState, CardDescriptor } from '@/lib/dashboard-data'

export interface FilterBarProps {
  availableMonths: string[]
  availableBanks: BankSlug[]
  availableCards: CardDescriptor[]
  filter: FilterState
  onChange: (filter: FilterState) => void
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number)
  const shortYear = String(year).slice(-2)
  return `${MONTH_NAMES[month - 1]} '${shortYear}`
}

function formatCardLabel(card: CardDescriptor): string {
  const bank = card.bank.toUpperCase()
  const parts: string[] = [bank]
  if (card.card_name) parts.push(card.card_name)
  if (card.last_four) parts.push(`••••${card.last_four}`)
  if (!card.card_name && !card.last_four) parts.push('Card')
  return parts.join(' ')
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
  background: 'var(--primary)',
  color: '#ffffff',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23ffffff' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
}

export function FilterBar({ availableMonths, availableBanks, availableCards, filter, onChange }: FilterBarProps): JSX.Element {
  const handleMonthChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      onChange({ ...filter, month: e.target.value || null })
    },
    [filter, onChange],
  )

  const handleBankChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      onChange({ ...filter, bank: (e.target.value as BankSlug) || null, statement_id: null })
    },
    [filter, onChange],
  )

  const handleCardChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      const val = e.target.value
      if (!val) {
        onChange({ ...filter, statement_id: null })
        return
      }
      const card = availableCards.find((c) => c.statement_id === val)
      if (card) onChange({ ...filter, bank: card.bank, statement_id: val })
    },
    [filter, availableCards, onChange],
  )

  const visibleCards = filter.bank !== null
    ? availableCards.filter((c) => c.bank === filter.bank)
    : availableCards

  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Dashboard filters">
      {availableMonths.length > 0 && (
        <select
          value={filter.month ?? ''}
          onChange={handleMonthChange}
          style={filter.month ? activeSelectStyle : selectStyle}
          data-testid="month-dropdown"
          aria-label="Filter by month"
        >
          <option value="">All months</option>
          {availableMonths.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
      )}

      {availableBanks.length > 0 && (
        <select
          value={filter.bank ?? ''}
          onChange={handleBankChange}
          style={filter.bank && !filter.statement_id ? activeSelectStyle : selectStyle}
          data-testid="bank-dropdown"
          aria-label="Filter by bank"
        >
          <option value="">All banks</option>
          {availableBanks.map((bank) => (
            <option key={bank} value={bank}>{bank.toUpperCase()}</option>
          ))}
        </select>
      )}

      {availableCards.length > 0 && (
        <select
          value={filter.statement_id ?? ''}
          onChange={handleCardChange}
          style={filter.statement_id ? activeSelectStyle : selectStyle}
          data-testid="card-dropdown"
          aria-label="Filter by card"
        >
          <option value="">All cards</option>
          {visibleCards.map((card) => (
            <option key={card.statement_id} value={card.statement_id}>
              {formatCardLabel(card)}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `node_modules/.bin/next build 2>&1 | head -40`

Expected: no errors in `components/dashboard/filter-bar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/filter-bar.tsx
git commit -m "feat(filter-bar): replace pill rows with compact dropdown selectors"
```

---

### Task 5: Rewrite spend trend chart as stacked area chart

**Files:**
- Modify: `components/dashboard/spend-trend-chart.tsx`

- [ ] **Step 1: Rewrite the entire file**

Replace `components/dashboard/spend-trend-chart.tsx` with:
```typescript
'use client'

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  type TooltipProps,
} from 'recharts'
import type { CategorySlug } from '@/types'
import type { ChartPoint } from '@/lib/dashboard-data'

export interface SpendTrendChartProps {
  data: ChartPoint[]
  isLoading: boolean
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CATEGORY_COLORS: Record<CategorySlug, string> = {
  food: '#f97316', groceries: '#22c55e', transport: '#3b82f6',
  shopping: '#a855f7', emi_loans: '#ef4444', utilities: '#06b6d4',
  entertainment: '#ec4899', health: '#14b8a6', travel: '#f59e0b', others: '#94a3b8',
}

const CATEGORY_DISPLAY_NAMES: Record<CategorySlug, string> = {
  food: 'Food & Dining', groceries: 'Groceries', transport: 'Transport',
  shopping: 'Shopping', emi_loans: 'EMI & Loans', utilities: 'Bills & Subs',
  entertainment: 'Entertainment', health: 'Health', travel: 'Travel', others: 'Others',
}

const ALL_CATEGORIES: CategorySlug[] = [
  'food', 'groceries', 'transport', 'shopping', 'emi_loans',
  'utilities', 'entertainment', 'health', 'travel', 'others',
]

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number)
  const shortYear = String(year).slice(-2)
  const idx = month - 1
  const monthName = idx >= 0 && idx < 12 ? MONTH_NAMES[idx] : '???'
  return `${monthName} '${shortYear}`
}

function formatInrShort(amount: number): string {
  if (amount >= 100000) {
    const l = amount / 100000
    return `₹${Number.isInteger(l) ? l : l.toFixed(1)}L`
  }
  if (amount >= 1000) return `₹${Math.round(amount / 1000)}K`
  return `₹${amount}`
}

function formatYAxis(value: number): string {
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`
  if (value >= 1000) return `₹${Math.round(value / 1000)}K`
  return `₹${value}`
}

type FlatChartRow = { month: string; total: number } & Partial<Record<CategorySlug, number>>

function CustomTooltip({ active, payload, label }: TooltipProps<number, string>): JSX.Element | null {
  if (!active || !payload?.length) return null

  // payload entries are the stacked areas; filter to non-zero, sort by value desc
  const entries = payload
    .filter((p) => (p.value ?? 0) > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const total = entries.reduce((sum, p) => sum + (p.value ?? 0), 0)

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border-medium)',
      borderRadius: '12px',
      padding: '14px 16px',
      boxShadow: 'var(--shadow-elevated)',
      minWidth: '200px',
      maxWidth: '240px',
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      zIndex: 50,
    }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {label}
      </p>
      <p className="tabular" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '10px' }}>
        {formatInrShort(total)}
      </p>
      {entries.map((p) => (
        <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: CATEGORY_COLORS[p.dataKey as CategorySlug] ?? '#94a3b8', flexShrink: 0 }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flex: 1 }}>
            {CATEGORY_DISPLAY_NAMES[p.dataKey as CategorySlug] ?? p.dataKey}
          </span>
          <span className="tabular" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>
            {formatInrShort(p.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  )
}

function ShimmerBlock(): JSX.Element {
  return (
    <div
      className="animate-pulse rounded-xl"
      style={{ height: '240px', width: '100%', background: 'var(--border)' }}
      aria-hidden="true"
      data-testid="shimmer-block"
    />
  )
}

export function SpendTrendChart({ data, isLoading }: SpendTrendChartProps): JSX.Element {
  // Determine which categories appear in the data (avoid rendering empty Area layers)
  const activeCategories = ALL_CATEGORIES.filter((slug) =>
    data.some((point) => (point.categories[slug] ?? 0) > 0),
  )

  const chartData: FlatChartRow[] = data.map((point) => {
    const row: FlatChartRow = { month: formatMonth(point.month), total: point.total }
    for (const slug of activeCategories) {
      row[slug] = point.categories[slug] ?? 0
    }
    return row
  })

  return (
    <div className="card" style={{ height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column', overflow: 'visible' }} data-testid="spend-trend-chart">

      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: '4px' }}>
            Over time
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Monthly Spend
          </p>
        </div>
        {activeCategories.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '180px', justifyContent: 'flex-end' }}>
            {activeCategories.slice(0, 5).map((slug) => (
              <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: CATEGORY_COLORS[slug] }} />
                <span style={{ fontSize: '0.6rem', color: 'var(--muted)', fontWeight: 500 }}>
                  {CATEGORY_DISPLAY_NAMES[slug].split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <ShimmerBlock />
      ) : data.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No data available</p>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: '200px', overflow: 'visible' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                {activeCategories.map((slug) => (
                  <linearGradient key={slug} id={`area-${slug}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CATEGORY_COLORS[slug]} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={CATEGORY_COLORS[slug]} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 6" stroke="var(--border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: "'Plus Jakarta Sans', system-ui", fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={formatYAxis}
                tick={{ fontSize: 10, fill: 'var(--muted)', fontFamily: "'Plus Jakarta Sans', system-ui", fontWeight: 500 }}
                tickLine={false}
                axisLine={false}
                width={52}
              />
              <Tooltip
                content={<CustomTooltip />}
                wrapperStyle={{ zIndex: 50, overflow: 'visible' }}
              />
              {activeCategories.map((slug) => (
                <Area
                  key={slug}
                  type="monotone"
                  dataKey={slug}
                  stackId="spend"
                  stroke={CATEGORY_COLORS[slug]}
                  strokeWidth={1.5}
                  fill={`url(#area-${slug})`}
                  isAnimationActive
                  animationDuration={600}
                  animationEasing="ease-out"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `node_modules/.bin/next build 2>&1 | head -40`

Expected: no errors. Recharts `AreaChart` and `Area` are already available (same package).

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/spend-trend-chart.tsx
git commit -m "feat(chart): replace bar chart with stacked area chart per category"
```

---

### Task 6: Create transactions table component

**Files:**
- Create: `components/dashboard/transactions-table.tsx`

- [ ] **Step 1: Create the file**

Create `components/dashboard/transactions-table.tsx`:
```typescript
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
              {/* Date */}
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 500, minWidth: '40px', flexShrink: 0 }}>
                {formatDate(tx.date)}
              </span>

              {/* Merchant */}
              <span style={{
                fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)',
                flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {tx.merchant || tx.raw_description}
              </span>

              {/* Category chip */}
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

              {/* Amount */}
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
```

- [ ] **Step 2: Verify build**

Run: `node_modules/.bin/next build 2>&1 | head -40`

Expected: no errors in new file.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/transactions-table.tsx
git commit -m "feat(components): add TransactionsTable component"
```

---

### Task 7: Update dashboard shell — KPI fix, swap UpiChart → TransactionsTable

**Files:**
- Modify: `components/dashboard/dashboard-shell.tsx`

- [ ] **Step 1: Rewrite the entire file**

Replace `components/dashboard/dashboard-shell.tsx` with:
```typescript
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
  const filteredAnalyses = filterAnalyses(data, filter)
  // KPIs always use all-time totals across all banks/cards; only month filter applies
  const kpiMetrics = computeKpis(data.analyses, filter)
  const availableMonths = getAvailableMonths(data)
  const availableBanks = getAvailableBanks(data)
  const availableCards = getAvailableCards(data)
  const trendData = getSpendTrendData(filteredAnalyses)
  const filteredTransactions = getFilteredTransactions(data, filter)

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
```

> **Note:** `category-chart.tsx` exports `CategoryChart`. This is already the correct import — no alias needed.

- [ ] **Step 2: Confirm category chart export name**

Run: `grep "export function" /Users/aditya/Documents/Coding\ Projects/terminal-ai-testing/credit-report-analysis/components/dashboard/category-chart.tsx`

Expected: `export function CategoryChart(`. If different, update the import name in the shell accordingly.

- [ ] **Step 3: Verify build**

Run: `node_modules/.bin/next build 2>&1 | head -60`

Expected: no errors. The `onUploadClick` prop will cause a TypeScript error in `app/page.tsx` until Task 8 is done — that's expected.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/dashboard-shell.tsx
git commit -m "feat(shell): KPI all-time totals, swap UpiChart for TransactionsTable, add upload button"
```

---

### Task 8: Move upload zone to modal in page.tsx

**Files:**
- Modify: `app/page.tsx`

- [ ] **Step 1: Rewrite app/page.tsx**

Replace the entire file with:
```typescript
'use client'

import { useState, useCallback } from 'react'
import type { RawTransaction } from '@/types'
import type { DetectionResult } from '@/lib/bank-detect'
import type { FilterState } from '@/lib/dashboard-data'
import { useEmbedToken } from '@/hooks/use-embed-token'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { UploadZone } from '@/components/upload/upload-zone'
import { ConfirmModal } from '@/components/upload/confirm-modal'

type PageState = 'idle' | 'confirming' | 'analysing' | 'error'

interface PendingUpload {
  file: File
  text: string
  transactions: RawTransaction[]
  detection: DetectionResult
}

export default function HomePage(): JSX.Element {
  const token = useEmbedToken()
  const { data, isLoading: dataLoading, refresh } = useDashboardData(token)

  const [pageState, setPageState] = useState<PageState>('idle')
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null)
  const [filter, setFilter] = useState<FilterState>({ month: null, bank: null, statement_id: null })
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [analyseError, setAnalyseError] = useState<string | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)

  const handleUploadClick = useCallback((): void => {
    setUploadError(null)
    setShowUploadModal(true)
  }, [])

  const handleParsed = useCallback(
    (result: { file: File; text: string; transactions: RawTransaction[]; detection: DetectionResult }): void => {
      setUploadError(null)
      setAnalyseError(null)
      setShowUploadModal(false)
      setPendingUpload(result)
      setPageState('confirming')
    },
    [],
  )

  const handleUploadError = useCallback((message: string): void => {
    setUploadError(message)
  }, [])

  const handleConfirm = useCallback(async (): Promise<void> => {
    if (!pendingUpload) return

    setPageState('analysing')
    setAnalyseError(null)

    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({
          month: pendingUpload.detection.month,
          bank: pendingUpload.detection.bank,
          account_type: pendingUpload.detection.account_type,
          card_name: pendingUpload.detection.card_name,
          last_four: pendingUpload.detection.last_four,
          transactions: pendingUpload.transactions,
          raw_text: pendingUpload.text,
        }),
      })

      const body = (await res.json()) as { success?: boolean; error?: string; details?: string }

      if (!res.ok || body.error) {
        if (body.error === 'INSUFFICIENT_CREDITS') {
          setAnalyseError('You need at least 5 credits to analyse a statement.')
        } else {
          setAnalyseError(`Analysis failed: ${body.details ?? body.error ?? 'unknown error'} (HTTP ${res.status})`)
        }
        setPageState('error')
        return
      }

      setPendingUpload(null)
      setPageState('idle')
      try {
        await refresh()
      } catch {
        // Non-fatal; data will be stale until next load
      }
    } catch {
      setAnalyseError('Analysis failed. Please try again.')
      setPageState('error')
    }
  }, [pendingUpload, token, refresh])

  const handleCancel = useCallback((): void => {
    setPendingUpload(null)
    setPageState('idle')
  }, [])

  const handleCloseUploadModal = useCallback((): void => {
    setShowUploadModal(false)
    setUploadError(null)
  }, [])

  const handleFilterChange = useCallback((nextFilter: FilterState): void => {
    setFilter(nextFilter)
  }, [])

  const handleDismissAnalyseError = useCallback((): void => {
    setAnalyseError(null)
    setPageState('idle')
  }, [])

  // Token not yet available — show connecting spinner
  if (token === null) {
    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center gap-4"
        style={{ background: 'var(--bg)' }}
        data-testid="main-page"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="animate-spin"
          data-testid="connecting-spinner"
        >
          <line x1="12" y1="2" x2="12" y2="6" />
          <line x1="12" y1="18" x2="12" y2="22" />
          <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
          <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
          <line x1="2" y1="12" x2="6" y2="12" />
          <line x1="18" y1="12" x2="22" y2="12" />
          <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
          <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
        </svg>
        <p
          style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--muted)', letterSpacing: '-0.01em' }}
          data-testid="connecting-text"
        >
          Connecting…
        </p>
      </div>
    )
  }

  // Token present but data still loading — show full-page shimmer
  if (data === null) {
    return (
      <div
        className="min-h-dvh flex flex-col gap-5 max-w-5xl mx-auto px-4 py-10"
        style={{ background: 'var(--bg)' }}
        data-testid="main-page"
      >
        <div className="flex flex-col gap-2">
          <div className="animate-pulse rounded-full" style={{ height: '22px', width: '140px', background: 'var(--border)' }} aria-hidden="true" data-testid="loading-shimmer" />
          <div className="animate-pulse rounded-lg" style={{ height: '42px', width: '200px', background: 'var(--border)' }} aria-hidden="true" />
          <div className="animate-pulse rounded-md" style={{ height: '16px', width: '160px', background: 'var(--border)' }} aria-hidden="true" />
        </div>
        <div className="flex gap-2">
          {[80, 64, 72, 60].map((w, i) => (
            <div key={i} className="animate-pulse rounded-full" style={{ height: '30px', width: `${w}px`, background: 'var(--border)' }} aria-hidden="true" />
          ))}
        </div>
        <div className="kpi-row">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse rounded-2xl" style={{ height: '90px', background: 'var(--border)' }} aria-hidden="true" />
          ))}
        </div>
        <div className="animate-pulse rounded-2xl" style={{ height: '280px', width: '100%', background: 'var(--border)' }} aria-hidden="true" />
      </div>
    )
  }

  return (
    <div data-testid="main-page">
      {/* ── Analyse error banner (shown after modal closes) ── */}
      {analyseError !== null && (
        <div className="max-w-5xl mx-auto px-4 pt-4">
          <div
            className="flex items-start justify-between gap-2 p-3 rounded-xl text-sm"
            style={{
              background: 'var(--accent-negative-subtle)',
              border: '1px solid rgba(190, 18, 60, 0.2)',
              color: 'var(--accent-negative)',
            }}
            role="alert"
            data-testid="analyse-error-alert"
          >
            <span style={{ fontWeight: 500, fontSize: '0.82rem' }}>{analyseError}</span>
            <button
              type="button"
              onClick={handleDismissAnalyseError}
              aria-label="Dismiss error"
              className="shrink-0 font-bold"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-negative)', fontSize: '1rem', lineHeight: 1 }}
              data-testid="dismiss-analyse-error"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <DashboardShell
        data={data}
        filter={filter}
        onFilterChange={handleFilterChange}
        onUploadClick={handleUploadClick}
        isLoading={dataLoading}
      />

      {/* ── Upload modal overlay ── */}
      {showUploadModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseUploadModal() }}
          data-testid="upload-modal-backdrop"
        >
          <div
            style={{
              background: 'var(--surface)',
              borderRadius: '1.5rem',
              padding: '24px',
              width: '100%',
              maxWidth: '520px',
              boxShadow: 'var(--shadow-modal)',
              border: '1px solid var(--border)',
              position: 'relative',
            }}
            data-testid="upload-modal"
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <p style={{ fontSize: '0.95rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
                Upload Statement
              </p>
              <button
                type="button"
                onClick={handleCloseUploadModal}
                aria-label="Close upload modal"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: '1.1rem', lineHeight: 1, padding: '4px' }}
                data-testid="close-upload-modal"
              >
                ×
              </button>
            </div>

            <UploadZone
              onParsed={handleParsed}
              onError={handleUploadError}
              disabled={pageState !== 'idle'}
            />

            {uploadError !== null && (
              <div
                className="mt-3 flex items-start justify-between gap-2 p-3 rounded-xl"
                style={{
                  background: 'var(--accent-negative-subtle)',
                  border: '1px solid rgba(190, 18, 60, 0.2)',
                  color: 'var(--accent-negative)',
                }}
                role="alert"
                data-testid="upload-error-alert"
              >
                <span style={{ fontWeight: 500, fontSize: '0.82rem' }}>{uploadError}</span>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={pageState === 'confirming' || pageState === 'analysing'}
        detection={pendingUpload?.detection ?? null}
        fileName={pendingUpload?.file.name ?? ''}
        creditCost={20}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isAnalysing={pageState === 'analysing'}
      />
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `node_modules/.bin/next build 2>&1 | head -60`

Expected: clean build with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "feat(page): move upload zone to modal, add Add Statement button"
```

---

### Task 9: Fix top category font size in KPI card

**Files:**
- Modify: `components/dashboard/kpi-cards.tsx`

- [ ] **Step 1: Reduce top category font size**

In `kpi-cards.tsx`, find the top category value paragraph (around line 197):
```typescript
<p style={{ fontSize: 'clamp(0.9rem, 1.8vw, 1.05rem)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)' }}>
```

Change to:
```typescript
<p style={{ fontSize: '0.88rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)' }}>
```

The `clamp` with a large min value causes oversized text in the constrained KPI card width. A fixed `0.88rem` fits all category names without overflow.

- [ ] **Step 2: Verify build**

Run: `node_modules/.bin/next build 2>&1 | head -20`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/kpi-cards.tsx
git commit -m "fix(kpi-cards): reduce top category font size to fit card width"
```

---

### Task 10: Delete upi-chart.tsx (replaced by transactions-table)

**Files:**
- Delete: `components/dashboard/upi-chart.tsx`

- [ ] **Step 1: Verify no remaining imports**

Run: `grep -r "upi-chart\|UpiChart" /Users/aditya/Documents/Coding\ Projects/terminal-ai-testing/credit-report-analysis/components /Users/aditya/Documents/Coding\ Projects/terminal-ai-testing/credit-report-analysis/app`

Expected: no results (the shell was updated in Task 7 to remove the import).

- [ ] **Step 2: Delete the file**

Run: `rm "/Users/aditya/Documents/Coding Projects/terminal-ai-testing/credit-report-analysis/components/dashboard/upi-chart.tsx"`

- [ ] **Step 3: Verify build still passes**

Run: `node_modules/.bin/next build 2>&1 | head -20`

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add -u components/dashboard/upi-chart.tsx
git commit -m "chore: delete upi-chart.tsx, replaced by transactions-table"
```

---

### Task 11: Build and deploy

**Files:** none (infra)

- [ ] **Step 1: Full production build**

Run: `node_modules/.bin/next build 2>&1`

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 2: Deploy via Terminal AI MCP**

Use the `mcp__terminal-ai__deploy_app` tool with `app_id: c1b53feb-f9cb-4cbc-88a5-daa8cb3e5ea5`.

- [ ] **Step 3: Verify deployment**

Use `mcp__terminal-ai__get_deployment_status` with the same app_id. Confirm status is `deployed` / `live`.

- [ ] **Step 4: Final commit if any lint/build fixes were needed**

```bash
git add -A
git commit -m "fix(build): resolve any remaining type/lint issues post-deploy"
```

---

## Self-Review Checklist

**Spec coverage:**
- [x] Stacked area chart — Task 5
- [x] Compact dropdown filter bar — Task 4
- [x] KPI all-time totals (pass `data.analyses` not `filteredAnalyses`) — Task 7
- [x] Transactions table replacing UPI chart — Tasks 1, 2, 3, 6, 7
- [x] Upload zone moved to modal — Task 8
- [x] Top category font size fix — Task 9
- [x] Tooltip overflow fix — Task 5 (`overflow: 'visible'` on chart container + `wrapperStyle`)
- [x] Delete upi-chart.tsx — Task 10
- [x] Build + deploy — Task 11

**Type consistency:**
- `DashboardData.transactions: Transaction[]` defined in Task 1, used in Tasks 2, 3, 6, 7
- `getFilteredTransactions(data, filter)` defined in Task 3, imported in Task 7
- `DashboardShellProps.onUploadClick: () => void` added in Task 7, passed in Task 8
- `TransactionsTable` props: `{ transactions: Transaction[], isLoading: boolean }` — matches Task 7 usage

**Placeholder scan:** None found. All code blocks are complete.
