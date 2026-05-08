# ClearSpend Dashboard v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add category filter, search, pagination, CSV export, statement management, and a single-shot DeepSeek chat assistant to the ClearSpend dashboard.

**Architecture:** Transaction enhancements are pure client-side state. Statement delete is a new `DELETE /api/statements/[id]` route using the existing `dbList`/`dbDelete` SDK. Chat is `POST /api/chat` that builds structured context from DB then calls `callGateway` with `deepseek/deepseek-v3.2`.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Terminal AI DB SDK (`dbList`/`dbDelete`), Terminal AI gateway (`callGateway`), React, Vitest + Testing Library.

---

## Key codebase facts (read before touching any file)

- DB access: `dbList(table, filters, token)` / `dbDelete(table, id, token)` — no raw SQL, no `user_id` column, gateway isolates by token automatically.
- AI calls: `callGateway(messages, token, { model: 'deepseek/deepseek-v3.2' })` — returns `{ content, credits_charged, ... }`.
- All API routes extract token from `req.headers.get('authorization')?.replace('Bearer ', '')`.
- Tests: Vitest + jsdom + Testing Library. Mock DB with `vi.mock('@/lib/db')`, mock gateway with `vi.mock('@/lib/terminal-ai')`.
- `FilterState` lives in `lib/dashboard-data.ts`. Currently: `{ month, bank, statement_id }`.
- `TransactionsTable` currently hard-caps debits at `.slice(0, 20)`.
- `FilterBar` existing tests in `tests/components/filter-bar.test.tsx` use `defaultFilter` literals — ALL must gain `category: null` after Task 1.

---

## Task 1: Add `category` to FilterState + update getFilteredTransactions

**Files:**
- Modify: `lib/dashboard-data.ts`
- Modify: `app/home-client.tsx` (filter init)
- Modify: `tests/lib/dashboard-data.test.ts`

- [ ] **Step 1: Write failing tests for category filter**

Add to `tests/lib/dashboard-data.test.ts` (after existing `getFilteredTransactions` tests — add this describe block; if the function isn't tested yet, add it):

```typescript
// add this import at top if not present:
import { getFilteredTransactions } from '@/lib/dashboard-data'
import type { Transaction } from '@/types'

const makeTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  statement_id: 'stmt-1',
  date: '2025-01-15',
  amount: 500,
  type: 'debit',
  merchant: 'McDonald\'s',
  category: 'food',
  upi_ref: null,
  upi_merchant: null,
  raw_description: 'UPI-MCD',
  ...overrides,
})

describe('getFilteredTransactions — category filter', () => {
  const stmt = makeStatement({ id: 'stmt-1', month: '2025-01', bank: 'hdfc' })
  const data = {
    statements: [stmt],
    analyses: [],
    transactions: [
      makeTransaction({ id: 'tx-1', category: 'food' }),
      makeTransaction({ id: 'tx-2', category: 'transport' }),
      makeTransaction({ id: 'tx-3', category: 'food' }),
    ],
  }

  it('returns all transactions when category is null', () => {
    const result = getFilteredTransactions(data, {
      month: null, bank: null, statement_id: null, category: null,
    })
    expect(result).toHaveLength(3)
  })

  it('filters to only the selected category', () => {
    const result = getFilteredTransactions(data, {
      month: null, bank: null, statement_id: null, category: 'food',
    })
    expect(result).toHaveLength(2)
    expect(result.every((t) => t.category === 'food')).toBe(true)
  })

  it('returns empty array when no transactions match category', () => {
    const result = getFilteredTransactions(data, {
      month: null, bank: null, statement_id: null, category: 'groceries',
    })
    expect(result).toHaveLength(0)
  })

  it('sorts results by amount descending', () => {
    const d = {
      ...data,
      transactions: [
        makeTransaction({ id: 'tx-a', amount: 100, category: 'food' }),
        makeTransaction({ id: 'tx-b', amount: 500, category: 'food' }),
        makeTransaction({ id: 'tx-c', amount: 200, category: 'food' }),
      ],
    }
    const result = getFilteredTransactions(d, {
      month: null, bank: null, statement_id: null, category: null,
    })
    expect(result.map((t) => t.amount)).toEqual([500, 200, 100])
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd "/Users/aditya/Documents/Coding Projects/terminal-ai-testing/credit-report-analysis" && npx vitest run tests/lib/dashboard-data.test.ts 2>&1 | tail -20
```

Expected: TypeScript error — `category` missing from `FilterState` object literals.

- [ ] **Step 3: Update FilterState and getFilteredTransactions in lib/dashboard-data.ts**

Find `FilterState` interface (around line 1–20) and add `category`:

```typescript
export interface FilterState {
  month: string | null
  bank: BankSlug | null
  statement_id: string | null
  category: CategorySlug | null
}
```

Find `getFilteredTransactions` and replace the full function:

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
    .filter((t) => {
      if (!statementIds.has(t.statement_id)) return false
      if (filter.category !== null && t.category !== filter.category) return false
      return true
    })
    .sort((a, b) => b.amount - a.amount)
}
```

- [ ] **Step 4: Fix filter init in app/home-client.tsx**

Find the line:
```typescript
const [filter, setFilter] = useState<FilterState>({ month: null, bank: null, statement_id: null })
```
Replace with:
```typescript
const [filter, setFilter] = useState<FilterState>({ month: null, bank: null, statement_id: null, category: null })
```

- [ ] **Step 5: Run tests — confirm new tests pass**

```bash
npx vitest run tests/lib/dashboard-data.test.ts 2>&1 | tail -20
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add lib/dashboard-data.ts app/home-client.tsx tests/lib/dashboard-data.test.ts
git commit -m "feat(filter): add category field to FilterState and getFilteredTransactions"
```

---

## Task 2: FilterBar category select + DashboardShell wiring

**Files:**
- Modify: `components/dashboard/filter-bar.tsx`
- Modify: `components/dashboard/dashboard-shell.tsx`
- Modify: `tests/components/filter-bar.test.tsx`

- [ ] **Step 1: Update all FilterState literals in filter-bar tests**

In `tests/components/filter-bar.test.tsx`, replace every occurrence of `{ month: null, bank: null, statement_id: null }` with `{ month: null, bank: null, statement_id: null, category: null }`.

Also update all `toHaveBeenCalledWith` assertions that check the full filter object — each must include `category: null` (or the category value if relevant). For example:

```typescript
// existing assertion for selecting a month:
expect(onChange).toHaveBeenCalledWith({
  month: '2025-01', bank: null, statement_id: null, category: null,
})
// existing assertion for selecting a bank:
expect(onChange).toHaveBeenCalledWith({
  month: null, bank: 'icici', statement_id: null, category: null,
})
// existing assertion for clearing bank:
expect(onChange).toHaveBeenCalledWith({
  month: null, bank: null, statement_id: null, category: null,
})
// existing assertion for selecting a card:
expect(onChange).toHaveBeenCalledWith({
  month: null, bank: 'hdfc', statement_id: 'stmt-a', category: null,
})
// existing assertion for clearing card:
expect(onChange).toHaveBeenCalledWith({
  month: null, bank: null, statement_id: null, category: null,
})
```

Then add new tests at the bottom of the `describe` block:

```typescript
  it('category dropdown renders options from availableCategories', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={[]}
        availableCards={[]}
        availableCategories={['food', 'transport']}
        filter={{ month: null, bank: null, statement_id: null, category: null }}
        onChange={onChange}
      />,
    )
    const catSelect = screen.getByTestId('category-dropdown') as HTMLSelectElement
    expect(catSelect).toBeInTheDocument()
    const options = Array.from(catSelect.options)
    expect(options).toHaveLength(3) // "All categories" + 2
    expect(options[0]).toHaveTextContent('All categories')
  })

  it('category dropdown is not rendered when availableCategories is empty', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={[]}
        availableCards={[]}
        availableCategories={[]}
        filter={{ month: null, bank: null, statement_id: null, category: null }}
        onChange={onChange}
      />,
    )
    expect(screen.queryByTestId('category-dropdown')).not.toBeInTheDocument()
  })

  it('selecting a category calls onChange with category value', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={[]}
        availableCards={[]}
        availableCategories={['food', 'transport']}
        filter={{ month: null, bank: null, statement_id: null, category: null }}
        onChange={onChange}
      />,
    )
    const catSelect = screen.getByTestId('category-dropdown') as HTMLSelectElement
    fireEvent.change(catSelect, { target: { value: 'food' } })
    expect(onChange).toHaveBeenCalledWith({
      month: null, bank: null, statement_id: null, category: 'food',
    })
  })

  it('clearing category calls onChange with category: null', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={[]}
        availableCards={[]}
        availableCategories={['food']}
        filter={{ month: null, bank: null, statement_id: null, category: 'food' }}
        onChange={onChange}
      />,
    )
    const catSelect = screen.getByTestId('category-dropdown') as HTMLSelectElement
    fireEvent.change(catSelect, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith({
      month: null, bank: null, statement_id: null, category: null,
    })
  })
```

- [ ] **Step 2: Run to confirm failures**

```bash
npx vitest run tests/components/filter-bar.test.tsx 2>&1 | tail -20
```

Expected: TypeScript errors about missing `availableCategories` prop and missing `category` in filter literals.

- [ ] **Step 3: Update FilterBar component**

In `components/dashboard/filter-bar.tsx`:

Add `CategorySlug` to the import:
```typescript
import type { BankSlug, CategorySlug } from '@/types'
```

Add to `FilterBarProps` interface:
```typescript
export interface FilterBarProps {
  availableMonths: string[]
  availableBanks: BankSlug[]
  availableCards: CardDescriptor[]
  availableCategories: CategorySlug[]
  filter: FilterState
  onChange: (filter: FilterState) => void
}
```

Add `handleCategoryChange` after the existing handlers:
```typescript
const handleCategoryChange = useCallback(
  (e: React.ChangeEvent<HTMLSelectElement>): void => {
    onChange({ ...filter, category: (e.target.value as CategorySlug) || null })
  },
  [filter, onChange],
)
```

Add the category `<select>` inside the return, after the card dropdown:
```tsx
{availableCategories.length > 0 && (
  <select
    value={filter.category ?? ''}
    onChange={handleCategoryChange}
    style={filter.category ? activeSelectStyle : selectStyle}
    data-testid="category-dropdown"
    aria-label="Filter by category"
  >
    <option value="">All categories</option>
    {availableCategories.map((cat) => (
      <option key={cat} value={cat}>{CATEGORY_DISPLAY_NAMES[cat]}</option>
    ))}
  </select>
)}
```

Add `CATEGORY_DISPLAY_NAMES` constant (same values as in transactions-table):
```typescript
const CATEGORY_DISPLAY_NAMES: Record<CategorySlug, string> = {
  food: 'Food & Dining', groceries: 'Groceries', transport: 'Transport',
  shopping: 'Shopping', emi_loans: 'EMI & Loans', utilities: 'Bills & Subs',
  entertainment: 'Entertainment', health: 'Health', travel: 'Travel', others: 'Others',
}
```

Destructure `availableCategories` in the function signature:
```typescript
export function FilterBar({ availableMonths, availableBanks, availableCards, availableCategories, filter, onChange }: FilterBarProps): JSX.Element {
```

- [ ] **Step 4: Update DashboardShell**

In `components/dashboard/dashboard-shell.tsx`:

Add `CategorySlug` to the types import:
```typescript
import type { DashboardData, CategorySlug } from '@/types'
```

Add `availableCategories` useMemo after the existing `availableCards` useMemo:
```typescript
const availableCategories = useMemo(
  () =>
    Array.from(
      new Set(
        getFilteredTransactions(data, { ...filter, category: null })
          .filter((t) => t.type === 'debit')
          .map((t) => t.category),
      ),
    ).sort() as CategorySlug[],
  [data, filter],
)
```

Pass `availableCategories` to `FilterBar`:
```tsx
<FilterBar
  availableMonths={availableMonths}
  availableBanks={availableBanks}
  availableCards={availableCards}
  availableCategories={availableCategories}
  filter={filter}
  onChange={onFilterChange}
/>
```

- [ ] **Step 5: Run tests — all pass**

```bash
npx vitest run tests/components/filter-bar.test.tsx 2>&1 | tail -20
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/filter-bar.tsx components/dashboard/dashboard-shell.tsx tests/components/filter-bar.test.tsx
git commit -m "feat(filter): add category filter dropdown to FilterBar"
```

---

## Task 3: TransactionsTable — search, pagination, CSV export

**Files:**
- Modify: `components/dashboard/transactions-table.tsx`
- Modify: `tests/components/transactions-table.test.tsx`

- [ ] **Step 1: Update existing tests + add new ones**

In `tests/components/transactions-table.test.tsx`:

Add `fireEvent, waitFor` to the import:
```typescript
import { render, screen, fireEvent } from '@testing-library/react'
```

**Update the "20-item limit" describe block** — rename to `'pagination'` and replace its contents:
```typescript
describe('pagination', () => {
  it('shows all debits when count is <= 25 (no pagination controls)', () => {
    const transactions = Array.from({ length: 25 }, (_, i) =>
      createTransaction({ id: `tx-${i + 1}`, merchant: `Merchant ${i + 1}` }),
    )
    render(<TransactionsTable transactions={transactions} isLoading={false} />)
    for (let i = 1; i <= 25; i++) {
      expect(screen.getByTestId(`transaction-row-tx-${i}`)).toBeInTheDocument()
    }
    expect(screen.queryByTestId('pagination-controls')).not.toBeInTheDocument()
  })

  it('shows only first 25 debits on page 1 when given 30', () => {
    const transactions = Array.from({ length: 30 }, (_, i) =>
      createTransaction({ id: `tx-${i + 1}`, merchant: `Merchant ${i + 1}` }),
    )
    render(<TransactionsTable transactions={transactions} isLoading={false} />)
    expect(screen.getByTestId('transaction-row-tx-1')).toBeInTheDocument()
    expect(screen.getByTestId('transaction-row-tx-25')).toBeInTheDocument()
    expect(screen.queryByTestId('transaction-row-tx-26')).not.toBeInTheDocument()
    expect(screen.getByTestId('pagination-controls')).toBeInTheDocument()
  })

  it('shows next page after clicking Next', () => {
    const transactions = Array.from({ length: 30 }, (_, i) =>
      createTransaction({ id: `tx-${i + 1}`, merchant: `Merchant ${i + 1}` }),
    )
    render(<TransactionsTable transactions={transactions} isLoading={false} />)
    fireEvent.click(screen.getByTestId('pagination-next'))
    expect(screen.queryByTestId('transaction-row-tx-1')).not.toBeInTheDocument()
    expect(screen.getByTestId('transaction-row-tx-26')).toBeInTheDocument()
  })

  it('Prev button is disabled on first page', () => {
    const transactions = Array.from({ length: 30 }, (_, i) =>
      createTransaction({ id: `tx-${i + 1}` }),
    )
    render(<TransactionsTable transactions={transactions} isLoading={false} />)
    expect(screen.getByTestId('pagination-prev')).toBeDisabled()
  })

  it('Next button is disabled on last page', () => {
    const transactions = Array.from({ length: 30 }, (_, i) =>
      createTransaction({ id: `tx-${i + 1}` }),
    )
    render(<TransactionsTable transactions={transactions} isLoading={false} />)
    fireEvent.click(screen.getByTestId('pagination-next'))
    expect(screen.getByTestId('pagination-next')).toBeDisabled()
  })
})
```

**Update the "header count" tests** that reference `20 shown`:
- Change `'20 shown'` → `'25 shown'` in the test "shows exactly 20 when given 25 debits" (rename test too: "shows 25 shown when given 25 debits")
- Change `'20 shown'` → `'20 shown'` in "shows correct count when at limit (20)" — this still shows 20 (no change needed, 20 < 25 so no pagination)

**Add search tests** after the pagination block:
```typescript
describe('search', () => {
  it('renders search input', () => {
    render(<TransactionsTable transactions={[createTransaction()]} isLoading={false} />)
    expect(screen.getByTestId('transaction-search')).toBeInTheDocument()
  })

  it('filters transactions by merchant name', () => {
    const transactions = [
      createTransaction({ id: 'tx-1', merchant: 'Swiggy' }),
      createTransaction({ id: 'tx-2', merchant: 'Uber' }),
    ]
    render(<TransactionsTable transactions={transactions} isLoading={false} />)
    fireEvent.change(screen.getByTestId('transaction-search'), { target: { value: 'swiggy' } })
    expect(screen.getByTestId('transaction-row-tx-1')).toBeInTheDocument()
    expect(screen.queryByTestId('transaction-row-tx-2')).not.toBeInTheDocument()
  })

  it('filters transactions by raw_description', () => {
    const transactions = [
      createTransaction({ id: 'tx-1', merchant: '', raw_description: 'UPI-ZOMATO-123' }),
      createTransaction({ id: 'tx-2', merchant: 'Uber', raw_description: 'UPI-UBER-456' }),
    ]
    render(<TransactionsTable transactions={transactions} isLoading={false} />)
    fireEvent.change(screen.getByTestId('transaction-search'), { target: { value: 'zomato' } })
    expect(screen.getByTestId('transaction-row-tx-1')).toBeInTheDocument()
    expect(screen.queryByTestId('transaction-row-tx-2')).not.toBeInTheDocument()
  })

  it('shows empty state when search matches nothing', () => {
    render(<TransactionsTable transactions={[createTransaction({ merchant: 'Swiggy' })]} isLoading={false} />)
    fireEvent.change(screen.getByTestId('transaction-search'), { target: { value: 'zzz' } })
    expect(screen.getByText('No transactions found')).toBeInTheDocument()
  })
})
```

**Add CSV export test:**
```typescript
describe('CSV export', () => {
  it('renders export button when transactions exist', () => {
    render(<TransactionsTable transactions={[createTransaction()]} isLoading={false} />)
    expect(screen.getByTestId('export-csv-btn')).toBeInTheDocument()
  })

  it('does not render export button when no transactions', () => {
    render(<TransactionsTable transactions={[]} isLoading={false} />)
    expect(screen.queryByTestId('export-csv-btn')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run to confirm failures**

```bash
npx vitest run tests/components/transactions-table.test.tsx 2>&1 | tail -20
```

Expected: failures on pagination, search, CSV tests.

- [ ] **Step 3: Rewrite TransactionsTable component**

Replace `components/dashboard/transactions-table.tsx` entirely:

```typescript
'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
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

const PAGE_SIZE = 25

function formatDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-').map(Number)
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
    `"${(t.merchant || t.raw_description).replace(/"/g, '""')}"`,
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
  URL.revokeObjectURL(url)
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
          <p style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Transactions
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {visibleTransactions.length > 0 && (
              <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 500 }}>
                {visibleTransactions.length} shown
              </span>
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
        <div>
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
```

- [ ] **Step 4: Run tests — all pass**

```bash
npx vitest run tests/components/transactions-table.test.tsx 2>&1 | tail -20
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/transactions-table.tsx tests/components/transactions-table.test.tsx
git commit -m "feat(transactions): add search, pagination (25/page), and CSV export"
```

---

## Task 4: Statement delete API route

**Files:**
- Create: `app/api/statements/[id]/route.ts`
- Create: `tests/api/statements.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/statements.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'
import * as db from '@/lib/db'

vi.mock('@/lib/db')

describe('DELETE /api/statements/[id]', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns 401 when no token', async () => {
    const { NextRequest } = await import('next/server')
    const { DELETE } = await import('@/app/api/statements/[id]/route')
    const req = new NextRequest('http://localhost/api/statements/stmt-1', { method: 'DELETE' })
    const res = await DELETE(req, { params: { id: 'stmt-1' } })
    expect(res.status).toBe(401)
  })

  it('deletes transactions, analyses, and statement in order', async () => {
    vi.mocked(db.dbList).mockImplementation(async (table: string) => {
      if (table === 'transactions') return [{ id: 'tx-1' }, { id: 'tx-2' }] as never
      if (table === 'analyses') return [{ id: 'ana-1' }] as never
      return []
    })
    vi.mocked(db.dbDelete).mockResolvedValue(undefined)

    const { NextRequest } = await import('next/server')
    const { DELETE } = await import('@/app/api/statements/[id]/route')
    const req = new NextRequest('http://localhost/api/statements/stmt-1', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token' },
    })
    const res = await DELETE(req, { params: { id: 'stmt-1' } })
    const body = await res.json() as { success: boolean }

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(db.dbDelete).toHaveBeenCalledWith('transactions', 'tx-1', 'token')
    expect(db.dbDelete).toHaveBeenCalledWith('transactions', 'tx-2', 'token')
    expect(db.dbDelete).toHaveBeenCalledWith('analyses', 'ana-1', 'token')
    expect(db.dbDelete).toHaveBeenCalledWith('statements', 'stmt-1', 'token')
  })

  it('returns 200 when statement has no transactions or analyses', async () => {
    vi.mocked(db.dbList).mockResolvedValue([])
    vi.mocked(db.dbDelete).mockResolvedValue(undefined)

    const { NextRequest } = await import('next/server')
    const { DELETE } = await import('@/app/api/statements/[id]/route')
    const req = new NextRequest('http://localhost/api/statements/stmt-empty', {
      method: 'DELETE',
      headers: { Authorization: 'Bearer token' },
    })
    const res = await DELETE(req, { params: { id: 'stmt-empty' } })
    expect(res.status).toBe(200)
    expect(db.dbDelete).toHaveBeenCalledWith('statements', 'stmt-empty', 'token')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run tests/api/statements.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the route**

Create `app/api/statements/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { dbList, dbDelete } from '@/lib/db'
import type { Transaction, Analysis } from '@/types'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const statementId = params.id

  const [transactions, analyses] = await Promise.all([
    dbList<Transaction>('transactions', { statement_id: statementId }, token),
    dbList<Analysis>('analyses', { statement_id: statementId }, token),
  ])

  await Promise.all([
    ...transactions.map((t) => dbDelete('transactions', t.id, token)),
    ...analyses.map((a) => dbDelete('analyses', a.id, token)),
  ])
  await dbDelete('statements', statementId, token)

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 4: Run tests — all pass**

```bash
npx vitest run tests/api/statements.test.ts 2>&1 | tail -10
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/statements tests/api/statements.test.ts
git commit -m "feat(api): add DELETE /api/statements/[id] with cascade delete"
```

---

## Task 5: StatementsModal component

**Files:**
- Create: `components/dashboard/statements-modal.tsx`
- Create: `tests/components/statements-modal.test.tsx`
- Modify: `components/dashboard/dashboard-shell.tsx`
- Modify: `app/home-client.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/statements-modal.test.tsx`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { StatementsModal } from '@/components/dashboard/statements-modal'
import type { Statement, Analysis } from '@/types'

const makeStatement = (overrides: Partial<Statement> = {}): Statement => ({
  id: 'stmt-1',
  month: '2025-01',
  bank: 'hdfc',
  account_type: 'credit',
  transaction_count: 10,
  total_debit: 5000,
  total_credit: 1000,
  currency: 'INR',
  uploaded_at: '2025-01-15T10:00:00Z',
  ...overrides,
})

const makeAnalysis = (overrides: Partial<Analysis> = {}): Analysis => ({
  id: 'ana-1',
  statement_id: 'stmt-1',
  month: '2025-01',
  category_breakdown: {},
  top_merchants: [],
  upi_summary: { total_spent: 0, merchant_breakdown: [], card_name: 'Regalia', last_four: '1234' },
  monthly_total: 5000,
  insights: [],
  generated_at: '2025-01-16T08:00:00Z',
  ...overrides,
})

describe('StatementsModal', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('does not render when isOpen is false', () => {
    render(
      <StatementsModal
        isOpen={false}
        statements={[makeStatement()]}
        analyses={[makeAnalysis()]}
        token="tok"
        onClose={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('renders statement list when open', () => {
    render(
      <StatementsModal
        isOpen={true}
        statements={[makeStatement()]}
        analyses={[makeAnalysis()]}
        token="tok"
        onClose={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText("Jan '25")).toBeInTheDocument()
    expect(screen.getByText('HDFC')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', () => {
    const onClose = vi.fn()
    render(
      <StatementsModal
        isOpen={true}
        statements={[makeStatement()]}
        analyses={[makeAnalysis()]}
        token="tok"
        onClose={onClose}
        onDeleted={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('statements-modal-close'))
    expect(onClose).toHaveBeenCalled()
  })

  it('optimistically removes statement on delete and calls onDeleted', async () => {
    const onDeleted = vi.fn().mockResolvedValue(undefined)
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) })

    render(
      <StatementsModal
        isOpen={true}
        statements={[makeStatement({ id: 'stmt-1' }), makeStatement({ id: 'stmt-2', month: '2025-02' })]}
        analyses={[makeAnalysis({ statement_id: 'stmt-1' }), makeAnalysis({ id: 'ana-2', statement_id: 'stmt-2', month: '2025-02' })]}
        token="tok"
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />,
    )
    fireEvent.click(screen.getByTestId('delete-stmt-stmt-1'))
    await waitFor(() => {
      expect(screen.queryByText("Jan '25")).not.toBeInTheDocument()
    })
    expect(onDeleted).toHaveBeenCalled()
  })

  it('restores statement on delete failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false })

    render(
      <StatementsModal
        isOpen={true}
        statements={[makeStatement()]}
        analyses={[makeAnalysis()]}
        token="tok"
        onClose={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByTestId('delete-stmt-stmt-1'))
    await waitFor(() => {
      expect(screen.getByText("Jan '25")).toBeInTheDocument()
      expect(screen.getByText('Failed to delete. Please try again.')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run tests/components/statements-modal.test.tsx 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create StatementsModal component**

Create `components/dashboard/statements-modal.tsx`:

```typescript
'use client'

import { useState, useEffect, useCallback } from 'react'
import type { Statement, Analysis } from '@/types'

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number)
  return `${MONTH_NAMES[month - 1]} '${String(year).slice(-2)}`
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

export interface StatementsModalProps {
  isOpen: boolean
  statements: Statement[]
  analyses: Analysis[]
  token: string
  onClose: () => void
  onDeleted: () => Promise<void>
}

export function StatementsModal({
  isOpen,
  statements,
  analyses,
  token,
  onClose,
  onDeleted,
}: StatementsModalProps): JSX.Element | null {
  const [localStatements, setLocalStatements] = useState<Statement[]>(statements)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  useEffect(() => { setLocalStatements(statements) }, [statements])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, onClose])

  const analysisMap = new Map(analyses.map((a) => [a.statement_id, a]))

  const handleDelete = useCallback(async (id: string): Promise<void> => {
    const backup = localStatements
    setLocalStatements((prev) => prev.filter((s) => s.id !== id))
    setDeleteError(null)
    try {
      const res = await fetch(`/api/statements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Delete failed')
      await onDeleted()
    } catch {
      setLocalStatements(backup)
      setDeleteError('Failed to delete. Please try again.')
    }
  }, [localStatements, token, onDeleted])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal={true}
      aria-label="Manage statements"
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => { e.stopPropagation() }}
        style={{
          background: 'var(--bg)', borderRadius: '1.5rem', padding: '2rem',
          width: 'min(560px, 90vw)', position: 'relative', maxHeight: '80vh',
          display: 'flex', flexDirection: 'column',
        }}
      >
        <button
          type="button"
          onClick={onClose}
          data-testid="statements-modal-close"
          aria-label="Close"
          style={{
            position: 'absolute', top: '1rem', right: '1rem',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--muted)', fontSize: '1.25rem', lineHeight: 1, fontWeight: 700,
          }}
        >
          ×
        </button>

        <p style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: '16px' }}>
          Manage Statements
        </p>

        {deleteError !== null && (
          <p style={{ fontSize: '0.8rem', color: 'var(--accent-negative)', marginBottom: '12px' }}>
            {deleteError}
          </p>
        )}

        {localStatements.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem', textAlign: 'center', padding: '24px 0' }}>
            No statements uploaded yet.
          </p>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {localStatements.map((s) => {
              const analysis = analysisMap.get(s.id)
              const cardName = analysis?.upi_summary?.card_name
              const lastFour = analysis?.upi_summary?.last_four
              return (
                <div
                  key={s.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '10px 0', borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1.3 }}>
                      {formatMonth(s.month)} · {s.bank.toUpperCase()}
                      {cardName ? ` · ${cardName}` : ''}
                      {lastFour ? ` ••••${lastFour}` : ''}
                    </p>
                    <p style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '2px' }}>
                      {s.transaction_count} txns · {formatInr(s.total_debit)} spent
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleDelete(s.id)}
                    data-testid={`delete-stmt-${s.id}`}
                    aria-label={`Delete ${formatMonth(s.month)} statement`}
                    style={{
                      background: 'none', border: '1px solid var(--border)',
                      borderRadius: '8px', padding: '6px 10px', cursor: 'pointer',
                      fontSize: '0.75rem', color: 'var(--accent-negative)',
                      fontFamily: 'inherit', fontWeight: 600,
                    }}
                  >
                    Delete
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Wire up in DashboardShell and home-client.tsx**

In `components/dashboard/dashboard-shell.tsx`, add `onManageClick` prop:

```typescript
export interface DashboardShellProps {
  data: DashboardData
  filter: FilterState
  onFilterChange: (filter: FilterState) => void
  onUploadClick: () => void
  onManageClick: () => void
  isLoading: boolean
}
```

Destructure `onManageClick` and add a "Manage" button in the header section, after the "Add Statement" button:

```tsx
<button
  type="button"
  onClick={onManageClick}
  data-testid="manage-statements-btn"
  style={{
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', borderRadius: '999px',
    background: 'rgba(15,23,42,0.06)', color: 'var(--text)',
    border: 'none', cursor: 'pointer', fontSize: '0.8rem',
    fontWeight: 600, fontFamily: 'inherit', letterSpacing: '-0.01em',
    flexShrink: 0, marginTop: '4px',
  }}
>
  Manage
</button>
```

In `app/home-client.tsx`:

Add `showStatementsModal` state:
```typescript
const [showStatementsModal, setShowStatementsModal] = useState<boolean>(false)
```

Add handlers:
```typescript
const handleManageClick = useCallback((): void => {
  setShowStatementsModal(true)
}, [])

const handleCloseStatementsModal = useCallback((): void => {
  setShowStatementsModal(false)
}, [])
```

Pass `onManageClick={handleManageClick}` to `DashboardShell`.

Import and render `StatementsModal` inside the data-loaded section (after `DashboardShell`):
```tsx
import { StatementsModal } from '@/components/dashboard/statements-modal'

// Inside the data-loaded JSX:
<StatementsModal
  isOpen={showStatementsModal}
  statements={data.statements}
  analyses={data.analyses}
  token={token ?? ''}
  onClose={handleCloseStatementsModal}
  onDeleted={refresh}
/>
```

- [ ] **Step 5: Run tests — all pass**

```bash
npx vitest run tests/components/statements-modal.test.tsx 2>&1 | tail -10
```

Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/statements-modal.tsx tests/components/statements-modal.test.tsx components/dashboard/dashboard-shell.tsx app/home-client.tsx
git commit -m "feat(statements): add statement management modal with cascade delete"
```

---

## Task 6: build-context.ts

**Files:**
- Create: `lib/ai/build-context.ts`
- Create: `tests/lib/build-context.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/build-context.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'
import * as db from '@/lib/db'

vi.mock('@/lib/db')

describe('buildFinancialContext', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns no-data message when analyses is empty', async () => {
    vi.mocked(db.dbList).mockResolvedValue([])
    const { buildFinancialContext } = await import('@/lib/ai/build-context')
    const result = await buildFinancialContext('token')
    expect(result).toBe('No financial data available yet.')
  })

  it('includes monthly totals in context', async () => {
    vi.mocked(db.dbList).mockImplementation(async (table: string) => {
      if (table === 'statements') {
        return [{ id: 'stmt-1', statement_id: 'stmt-1', bank: 'hdfc', month: '2025-01' }] as never
      }
      if (table === 'analyses') {
        return [{
          id: 'ana-1', statement_id: 'stmt-1', month: '2025-01',
          monthly_total: 50000, category_breakdown: { food: 20000, transport: 10000 },
          top_merchants: [{ name: 'Swiggy', total: 15000, count: 10 }],
          insights: ['Spend on food is high'],
        }] as never
      }
      return []
    })
    const { buildFinancialContext } = await import('@/lib/ai/build-context')
    const result = await buildFinancialContext('token')
    expect(result).toContain('2025-01')
    expect(result).toContain('50,000')
    expect(result).toContain('Swiggy')
    expect(result).toContain('food')
    expect(result).toContain('Spend on food is high')
  })

  it('includes date range in context', async () => {
    vi.mocked(db.dbList).mockImplementation(async (table: string) => {
      if (table === 'statements') return [] as never
      if (table === 'analyses') {
        return [
          { id: 'a1', statement_id: 's1', month: '2025-01', monthly_total: 10000, category_breakdown: {}, top_merchants: [], insights: [] },
          { id: 'a2', statement_id: 's2', month: '2025-03', monthly_total: 12000, category_breakdown: {}, top_merchants: [], insights: [] },
        ] as never
      }
      return []
    })
    const { buildFinancialContext } = await import('@/lib/ai/build-context')
    const result = await buildFinancialContext('token')
    expect(result).toContain('2025-01 to 2025-03')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run tests/lib/build-context.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create build-context.ts**

Create `lib/ai/build-context.ts`:

```typescript
import { dbList } from '@/lib/db'
import type { Statement, Analysis } from '@/types'

export async function buildFinancialContext(token: string): Promise<string> {
  const [statements, analyses] = await Promise.all([
    dbList<Statement>('statements', {}, token),
    dbList<Analysis>('analyses', {}, token),
  ])

  if (analyses.length === 0) return 'No financial data available yet.'

  const stmtMap = new Map(statements.map((s) => [s.id, s]))
  const sorted = [...analyses].sort((a, b) => b.month.localeCompare(a.month))

  const monthlyLines = sorted
    .map((a) => {
      const bank = stmtMap.get(a.statement_id)?.bank.toUpperCase() ?? '?'
      return `${a.month}: ₹${Math.round(a.monthly_total).toLocaleString('en-IN')} (${bank})`
    })
    .join(' | ')

  const categoryTotals: Record<string, number> = {}
  let grandTotal = 0
  for (const a of analyses) {
    for (const [cat, amt] of Object.entries(a.category_breakdown ?? {})) {
      categoryTotals[cat] = (categoryTotals[cat] ?? 0) + (amt ?? 0)
      grandTotal += amt ?? 0
    }
  }
  const categoryLines = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([cat, amt]) => {
      const pct = grandTotal > 0 ? Math.round((amt / grandTotal) * 100) : 0
      return `${cat}: ₹${Math.round(amt).toLocaleString('en-IN')} (${pct}%)`
    })
    .join(', ')

  const merchantMap = new Map<string, { total: number; count: number }>()
  for (const a of analyses) {
    for (const m of a.top_merchants ?? []) {
      const existing = merchantMap.get(m.name) ?? { total: 0, count: 0 }
      merchantMap.set(m.name, { total: existing.total + m.total, count: existing.count + m.count })
    }
  }
  const topMerchants = Array.from(merchantMap.entries())
    .sort(([, a], [, b]) => b.total - a.total)
    .slice(0, 10)
    .map(([name, { total, count }]) => `${name} ₹${Math.round(total).toLocaleString('en-IN')} (${count} txns)`)
    .join(', ')

  const allInsights = [...new Set(analyses.flatMap((a) => a.insights ?? []))].slice(0, 8).join('\n- ')

  const oldest = sorted[sorted.length - 1].month
  const newest = sorted[0].month
  const dateRange = oldest === newest ? oldest : `${oldest} to ${newest}`

  return `FINANCIAL DATA SUMMARY
Statements: ${analyses.length} months on file (${dateRange})
Monthly spend: ${monthlyLines}
Category breakdown (all-time): ${categoryLines}
Top merchants: ${topMerchants}
AI insights from your data:
- ${allInsights}`
}
```

- [ ] **Step 4: Run tests — all pass**

```bash
npx vitest run tests/lib/build-context.test.ts 2>&1 | tail -10
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add lib/ai/build-context.ts tests/lib/build-context.test.ts
git commit -m "feat(ai): add buildFinancialContext for chat context building"
```

---

## Task 7: Chat API route

**Files:**
- Create: `app/api/chat/route.ts`
- Create: `tests/api/chat.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/api/chat.test.ts`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'
import * as terminalAi from '@/lib/terminal-ai'
import * as buildContextModule from '@/lib/ai/build-context'

vi.mock('@/lib/terminal-ai')
vi.mock('@/lib/ai/build-context')

describe('POST /api/chat', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns 401 when no token', async () => {
    const { NextRequest } = await import('next/server')
    const { POST } = await import('@/app/api/chat/route')
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      body: JSON.stringify({ question: 'test' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it('returns 400 when question is empty', async () => {
    const { NextRequest } = await import('next/server')
    const { POST } = await import('@/app/api/chat/route')
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer token' },
      body: JSON.stringify({ question: '   ' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('returns answer from gateway', async () => {
    vi.mocked(buildContextModule.buildFinancialContext).mockResolvedValue('mock context')
    vi.mocked(terminalAi.callGateway).mockResolvedValue({
      id: 'r1', content: 'Cut Swiggy orders in half.', model_used: 'deepseek',
      usage: { input_tokens: 100, output_tokens: 20 }, credits_charged: 1,
    })

    const { NextRequest } = await import('next/server')
    const { POST } = await import('@/app/api/chat/route')
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'How do I reduce food spend?' }),
    })
    const res = await POST(req)
    const body = await res.json() as { answer: string }

    expect(res.status).toBe(200)
    expect(body.answer).toBe('Cut Swiggy orders in half.')
    expect(terminalAi.callGateway).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user', content: 'How do I reduce food spend?' }),
      ]),
      'token',
      { model: 'deepseek/deepseek-v3.2' },
    )
  })

  it('returns INSUFFICIENT_CREDITS error when gateway returns 402', async () => {
    vi.mocked(buildContextModule.buildFinancialContext).mockResolvedValue('context')
    vi.mocked(terminalAi.callGateway).mockRejectedValue(new Error('Gateway error (402): insufficient credits'))

    const { NextRequest } = await import('next/server')
    const { POST } = await import('@/app/api/chat/route')
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'test' }),
    })
    const res = await POST(req)
    const body = await res.json() as { error: string }

    expect(res.status).toBe(402)
    expect(body.error).toBe('INSUFFICIENT_CREDITS')
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run tests/api/chat.test.ts 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the route**

Create `app/api/chat/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { callGateway } from '@/lib/terminal-ai'
import { buildFinancialContext } from '@/lib/ai/build-context'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { question?: string }
  const question = body.question?.trim()
  if (!question) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  }

  const context = await buildFinancialContext(token)

  const messages = [
    {
      role: 'system',
      content: `You are ClearSpend, a personal financial advisor. You have access to the user's real spending data below. Answer questions concisely and actionably. Use INR amounts. If the data doesn't support a specific answer, say so honestly.\n\n${context}`,
    },
    { role: 'user', content: question },
  ]

  try {
    const result = await callGateway(messages, token, { model: 'deepseek/deepseek-v3.2' })
    return NextResponse.json({ answer: result.content })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg.includes('402') || msg.toLowerCase().includes('credit') || msg.includes('INSUFFICIENT')) {
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

- [ ] **Step 4: Run tests — all pass**

```bash
npx vitest run tests/api/chat.test.ts 2>&1 | tail -10
```

Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/chat/route.ts tests/api/chat.test.ts
git commit -m "feat(api): add POST /api/chat with DeepSeek context-aware financial assistant"
```

---

## Task 8: ChatPanel component + home-client.tsx integration

**Files:**
- Create: `components/chat/chat-panel.tsx`
- Create: `tests/components/chat-panel.test.tsx`
- Modify: `app/home-client.tsx`

- [ ] **Step 1: Write the failing test**

Create `tests/components/chat-panel.test.tsx`:

```typescript
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatPanel } from '@/components/chat/chat-panel'

describe('ChatPanel', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('renders chat button', () => {
    render(<ChatPanel token="tok" />)
    expect(screen.getByTestId('chat-open-btn')).toBeInTheDocument()
  })

  it('panel is not visible initially', () => {
    render(<ChatPanel token="tok" />)
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
  })

  it('opens panel on button click', () => {
    render(<ChatPanel token="tok" />)
    fireEvent.click(screen.getByTestId('chat-open-btn'))
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('closes panel on close button click', () => {
    render(<ChatPanel token="tok" />)
    fireEvent.click(screen.getByTestId('chat-open-btn'))
    fireEvent.click(screen.getByTestId('chat-close-btn'))
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
  })

  it('send button is disabled when textarea is empty', () => {
    render(<ChatPanel token="tok" />)
    fireEvent.click(screen.getByTestId('chat-open-btn'))
    expect(screen.getByTestId('chat-send-btn')).toBeDisabled()
  })

  it('send button is enabled when textarea has text', () => {
    render(<ChatPanel token="tok" />)
    fireEvent.click(screen.getByTestId('chat-open-btn'))
    fireEvent.change(screen.getByTestId('chat-textarea'), { target: { value: 'How to save?' } })
    expect(screen.getByTestId('chat-send-btn')).not.toBeDisabled()
  })

  it('shows answer after successful send', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ answer: 'Cut food spend by cooking at home.' }),
    })
    render(<ChatPanel token="tok" />)
    fireEvent.click(screen.getByTestId('chat-open-btn'))
    fireEvent.change(screen.getByTestId('chat-textarea'), { target: { value: 'How to reduce food spend?' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('chat-answer')).toBeInTheDocument()
      expect(screen.getByText('Cut food spend by cooking at home.')).toBeInTheDocument()
    })
  })

  it('shows INSUFFICIENT_CREDITS error message', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'INSUFFICIENT_CREDITS' }),
    })
    render(<ChatPanel token="tok" />)
    fireEvent.click(screen.getByTestId('chat-open-btn'))
    fireEvent.change(screen.getByTestId('chat-textarea'), { target: { value: 'test' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))
    await waitFor(() => {
      expect(screen.getByTestId('chat-error')).toBeInTheDocument()
      expect(screen.getByText('You need at least 1 credit to send a message.')).toBeInTheDocument()
    })
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npx vitest run tests/components/chat-panel.test.tsx 2>&1 | tail -10
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create ChatPanel component**

Create `components/chat/chat-panel.tsx`:

```typescript
'use client'

import { useState, useCallback, useEffect } from 'react'

export interface ChatPanelProps {
  token: string
}

type ChatState = 'idle' | 'loading' | 'answered' | 'error'

export function ChatPanel({ token }: ChatPanelProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [chatState, setChatState] = useState<ChatState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent): void => { if (e.key === 'Escape') setIsOpen(false) }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen])

  const handleSend = useCallback(async (): Promise<void> => {
    if (!question.trim() || chatState === 'loading') return
    setChatState('loading')
    setAnswer(null)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: question.trim() }),
      })
      const body = await res.json() as { answer?: string; error?: string }
      if (!res.ok || body.error) {
        setErrorMsg(
          body.error === 'INSUFFICIENT_CREDITS'
            ? 'You need at least 1 credit to send a message.'
            : (body.error ?? 'Something went wrong.'),
        )
        setChatState('error')
      } else {
        setAnswer(body.answer ?? '')
        setChatState('answered')
      }
    } catch {
      setErrorMsg('Network error. Please try again.')
      setChatState('error')
    }
  }, [question, chatState, token])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }, [handleSend])

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        data-testid="chat-open-btn"
        style={{
          position: 'fixed', bottom: '24px', right: '24px', zIndex: 40,
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '10px 20px', borderRadius: '999px',
          background: 'var(--primary)', color: '#fff',
          border: 'none', cursor: 'pointer',
          fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit',
          letterSpacing: '-0.01em',
          boxShadow: '0 4px 16px rgba(37,99,235,0.35)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        Ask ClearSpend
      </button>

      {/* Panel */}
      {isOpen && (
        <div
          data-testid="chat-panel"
          style={{
            position: 'fixed', bottom: '80px', right: '24px', zIndex: 40,
            width: 'min(400px, calc(100vw - 48px))',
            background: 'var(--bg)',
            borderRadius: '1.5rem',
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            border: '1px solid var(--border-medium)',
            padding: '1.5rem',
            display: 'flex', flexDirection: 'column', gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <p style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}>
              Ask about your finances
            </p>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              data-testid="chat-close-btn"
              aria-label="Close chat"
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: '1.2rem', lineHeight: 1, fontWeight: 700,
              }}
            >
              ×
            </button>
          </div>

          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. How can I reduce my food spend next month?"
            data-testid="chat-textarea"
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box',
              background: 'rgba(15,23,42,0.05)',
              border: '1px solid var(--border)',
              borderRadius: '12px', padding: '10px 14px',
              fontSize: '0.82rem', fontFamily: 'inherit',
              color: 'var(--text)', resize: 'none', outline: 'none',
              lineHeight: 1.5,
            }}
          />

          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={!question.trim() || chatState === 'loading'}
            data-testid="chat-send-btn"
            style={{
              padding: '9px 20px', borderRadius: '999px',
              background: 'var(--primary)', color: '#fff',
              border: 'none', cursor: !question.trim() || chatState === 'loading' ? 'default' : 'pointer',
              fontSize: '0.82rem', fontWeight: 700, fontFamily: 'inherit',
              opacity: !question.trim() || chatState === 'loading' ? 0.5 : 1,
              alignSelf: 'flex-end',
            }}
          >
            {chatState === 'loading' ? 'Thinking…' : 'Send'}
          </button>

          {chatState === 'loading' && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <div className="animate-pulse rounded-md" style={{ height: '10px', width: '100%', background: 'var(--border)' }} />
            </div>
          )}

          {chatState === 'answered' && answer !== null && (
            <div
              data-testid="chat-answer"
              style={{
                fontSize: '0.82rem', color: 'var(--text)', lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                background: 'rgba(15,23,42,0.03)',
                borderRadius: '12px', padding: '12px 14px',
                border: '1px solid var(--border)',
              }}
            >
              {answer}
            </div>
          )}

          {chatState === 'error' && errorMsg !== null && (
            <div
              data-testid="chat-error"
              style={{
                fontSize: '0.8rem', color: 'var(--accent-negative)',
                background: 'var(--accent-negative-subtle)',
                borderRadius: '10px', padding: '10px 12px',
                border: '1px solid rgba(190,18,60,0.2)',
              }}
            >
              {errorMsg}
            </div>
          )}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 4: Mount ChatPanel in home-client.tsx**

Add import:
```typescript
import { ChatPanel } from '@/components/chat/chat-panel'
```

In the data-loaded JSX section (the final `return`), add `<ChatPanel>` after `<ConfirmModal>`:
```tsx
{token !== null && <ChatPanel token={token} />}
```

Place it outside the `data-testid="main-page"` div so it's always rendered at the document level when the token is available. It renders its own `position: fixed` elements so placement in JSX doesn't affect visual position.

- [ ] **Step 5: Run all tests**

```bash
npx vitest run tests/components/chat-panel.test.tsx 2>&1 | tail -10
```

Expected: All pass.

- [ ] **Step 6: Run full test suite**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: All tests pass (no regressions).

- [ ] **Step 7: Commit**

```bash
git add components/chat/chat-panel.tsx tests/components/chat-panel.test.tsx app/home-client.tsx
git commit -m "feat(chat): add floating ChatPanel with DeepSeek-powered single-shot Q&A"
```

---

## Final: Build and deploy

- [ ] **Step 1: Full test run before build**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: All pass.

- [ ] **Step 2: Build**

```bash
node_modules/.bin/next build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` with `ƒ /` (dynamic).

- [ ] **Step 3: Commit build artifacts and deploy**

```bash
git add -f .next/standalone .next/static
git commit -m "build: dashboard v3 — category filter, search, pagination, statements mgmt, chat"
git push origin deploy
```

Then trigger redeploy via `mcp__terminal-ai__redeploy_app` with `app_id: c1b53feb-f9cb-4cbc-88a5-daa8cb3e5ea5`.
