# ClearSpend Dashboard v3 — Implementation Design

**Goal:** Add transaction enhancements (category filter, search, pagination), statement management (list + delete), CSV export, and a single-shot chat assistant powered by DeepSeek-V3.2.

**Architecture:** All transaction enhancements are client-side. Statement delete is a new API route. Chat is a new API route that builds structured context from the DB and calls DeepSeek via the existing Terminal AI gateway. No new dependencies.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Postgres (via `lib/db.ts`), Terminal AI gateway (`callModel`), Recharts, existing component patterns.

---

## Feature 1 — Transaction Enhancements

### 1.1 Category Filter

Add `category: CategorySlug | null` to `FilterState` in `lib/dashboard-data.ts`.

```typescript
export interface FilterState {
  month: string | null
  bank: BankSlug | null
  statement_id: string | null
  category: CategorySlug | null   // NEW
}
```

Update `getFilteredTransactions` to apply the category filter:

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

Add a category `<select>` to `FilterBar`. It only renders when there are transactions (i.e. `availableCategories.length > 0`). The available categories are derived from the current filtered transactions in `DashboardShell` and passed as a prop.

New prop on `FilterBar`:
```typescript
availableCategories: CategorySlug[]
```

`DashboardShell` derives it:
```typescript
const availableCategories = useMemo(
  () => Array.from(new Set(filteredTransactions.map((t) => t.category))).sort(),
  [filteredTransactions],
)
```

The category select uses the same pill style as existing filters. Active state (category selected) uses `activeSelectStyle`.

When category filter changes, also reset `page` in `TransactionsTable` to 0. This is done by passing `filter.category` as a dependency in a `useEffect` inside `TransactionsTable` that resets page.

### 1.2 Search

Text input inside `TransactionsTable` header area. State lives inside `TransactionsTable` (`searchQuery: string`). Filters client-side:

```typescript
const visibleTransactions = useMemo(() => {
  const q = searchQuery.trim().toLowerCase()
  if (!q) return transactions
  return transactions.filter(
    (t) =>
      t.merchant.toLowerCase().includes(q) ||
      t.raw_description.toLowerCase().includes(q),
  )
}, [transactions, searchQuery])
```

Search input resets `page` to 0 on change.

Input style: same rounded pill style as the rest of the UI, `font-size: 0.775rem`, placeholder "Search transactions…". Rendered inline in the table header row, right-aligned next to the title.

### 1.3 Pagination

25 rows per page. State: `page: number` (0-indexed) inside `TransactionsTable`.

```typescript
const PAGE_SIZE = 25
const pageCount = Math.ceil(visibleTransactions.length / PAGE_SIZE)
const pagedTransactions = visibleTransactions.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
```

Controls rendered below the table:
- Prev button (disabled at page 0)
- "Page N of M" text
- Next button (disabled at last page)

Controls only render when `pageCount > 1`.

`page` resets to 0 when `transactions` prop changes, `searchQuery` changes, or `filter.category` changes.

---

## Feature 2 — Statement Management

### 2.1 UI

A "Manage statements" text link/button in the dashboard header (near the "Add Statement" button). Opens a modal (`role="dialog"`, `aria-modal`, Escape closes).

Modal lists all statements from `data.statements`, each row showing:
- Month (formatted: "Jan '25")
- Bank (uppercase)
- Card name + last four if available (from `analyses[statement_id].upi_summary`)
- Transaction count
- Total debit (`formatInr`)
- Delete button (trash icon, red on hover)

On delete: call `DELETE /api/statements/[id]`, optimistically remove from modal list, then call `refresh()`. If the API call fails, re-add the statement to the list and show an error.

New component: `components/dashboard/statements-modal.tsx`

### 2.2 API Route

`app/api/statements/[id]/route.ts` — `DELETE` handler.

Uses `dbList`/`dbDelete` from `lib/db.ts` (Terminal AI DB SDK — no raw SQL, gateway handles user isolation by token).

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

  // Cascade: fetch then delete transactions, analysis, statement
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

No DB migration needed — uses existing tables. Gateway enforces token-scoped isolation so no ownership check needed.

---

## Feature 3 — CSV Export

A small "Export CSV" button (with download icon) inside `TransactionsTable` header, right of the search input. Only visible when `visibleTransactions.length > 0`.

Entirely client-side:

```typescript
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
  URL.revokeObjectURL(url)
}
```

Exports the full `visibleTransactions` (post-search, pre-pagination) — all pages, not just the current page.

---

## Feature 4 — Chat Assistant

### 4.1 UI

Floating chat button, fixed bottom-right (`position: fixed; bottom: 24px; right: 24px; z-index: 40`). A rounded pill button: "Ask ClearSpend" with a chat bubble icon.

On click, opens a panel above the button:
- Width: `min(400px, 90vw)`
- Panel contains: title "Ask anything about your finances", a `<textarea>` for the question, a "Send" button, and a response area
- Close button (×) top-right of panel
- Escape key closes panel

States: `idle` | `loading` | `answered` | `error`

In `loading` state: show a subtle shimmer/spinner in the response area.
In `answered` state: show the AI response text (formatted, preserving line breaks).
In `error` state: show the error message (including `INSUFFICIENT_CREDITS` case).

Sending a new question while in `answered` state clears the previous response and goes back to `loading`.

New component: `components/chat/chat-panel.tsx`

Rendered in `home-client.tsx` (always mounted, visibility controlled by state).

### 4.2 API Route

`app/api/chat/route.ts` — `POST` handler.

Uses the same token-from-header pattern as all other routes. No separate auth/credit SDK — the gateway returns errors for insufficient credits. Credit cost is passed via `callGateway` options (or handled separately via a gateway credits check endpoint if available — fall back to catching gateway 402 errors).

**Request:** `{ question: string }`
**Response:** `{ answer: string }` or `{ error: string }`

Flow:
1. Extract token from `Authorization: Bearer <token>` header
2. Build context from DB using `dbList` (see 4.3)
3. Call `callGateway` with `model: 'deepseek/deepseek-v3.2'` and `credit_cost: 1`
4. Return `{ answer: content }`

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
    if (msg.includes('402') || msg.includes('credits') || msg.includes('INSUFFICIENT')) {
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
```

### 4.3 Context Building

`lib/ai/build-context.ts` — async function, uses `dbList` from `lib/db.ts`. Takes `token: string` (not userId — gateway handles isolation).

```typescript
import { dbList } from '@/lib/db'
import type { Statement, Analysis } from '@/types'

export async function buildFinancialContext(token: string): Promise<string> {
  const [statements, analyses] = await Promise.all([
    dbList<Statement>('statements', {}, token),
    dbList<Analysis>('analyses', {}, token),
  ])

  if (analyses.length === 0) return 'No financial data available yet.'

  // Build statement lookup for bank names
  const stmtMap = new Map(statements.map((s) => [s.id, s]))

  // Sort analyses by month descending
  const sorted = [...analyses].sort((a, b) => b.month.localeCompare(a.month))

  // Monthly totals
  const monthlyLines = sorted
    .map((a) => {
      const bank = stmtMap.get(a.statement_id)?.bank.toUpperCase() ?? '?'
      return `${a.month}: ₹${Math.round(a.monthly_total).toLocaleString('en-IN')} (${bank})`
    })
    .join(' | ')

  // All-time category breakdown
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

  // Top merchants across all analyses
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

  // Insights from all analyses (deduplicated, capped at 8)
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

Typical context size: ~800–1500 tokens for 3–6 months of data.

### 4.4 Credit Handling in Chat

Use the same `checkCredits` / `deductCredits` helpers already established in `/api/analyse`. The chat deducts 1 credit (vs 20 for analysis). The `INSUFFICIENT_CREDITS` error in the UI shows: "You need at least 1 credit to send a message."

---

## File Summary

**New files:**
- `app/api/chat/route.ts`
- `app/api/statements/[id]/route.ts`
- `lib/ai/build-context.ts`
- `components/chat/chat-panel.tsx`
- `components/dashboard/statements-modal.tsx`

**Modified files:**
- `lib/dashboard-data.ts` — add `category` to `FilterState`, update `getFilteredTransactions`
- `components/dashboard/filter-bar.tsx` — add category select
- `components/dashboard/dashboard-shell.tsx` — derive `availableCategories`, pass to FilterBar, add StatementsModal
- `components/dashboard/transactions-table.tsx` — add search, pagination, CSV export
- `app/home-client.tsx` — mount ChatPanel, add statements modal state
- `types/index.ts` — no changes needed

**No DB migrations needed.** All new API routes use existing tables.

---

## Testing

Each new file gets a co-located test:
- `tests/api/chat.test.ts` — mock `callModel` and `buildFinancialContext`, verify credit check, verify response shape
- `tests/api/statements.test.ts` — verify 404 on wrong user, verify cascade delete
- `tests/lib/build-context.test.ts` — verify context format with mock DB rows
- `tests/components/chat-panel.test.tsx` — idle/loading/answered/error states
- `tests/components/statements-modal.test.tsx` — render list, optimistic delete, error recovery
- Existing `transactions-table.test.tsx` — extend with search, pagination, CSV export cases
- Existing `filter-bar.test.tsx` — extend with category filter cases
