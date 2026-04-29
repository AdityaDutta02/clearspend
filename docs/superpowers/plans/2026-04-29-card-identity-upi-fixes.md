# Card Identity, Multi-Card Support, UPI Fix, NaN Fix — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add card-level identity (card name + last four) to statements, enable per-card filtering in the dashboard, fix UPI VPA extraction so the UPI chart populates, and coerce DB numeric fields to prevent NaN/garbage in KPI cards.

**Architecture:** Data model gains `card_name` and `last_four` on `Statement` and `ParsedStatement`. Detection runs filename-first then header-text regex (no AI call). Filter state gains `statement_id` for card-level scoping. UPI regex is replaced to match VPA format. All numeric fields coerced via `Number()` at read time.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Vitest + Testing Library, Terminal AI DB (schemaless JSON store)

---

## File Map

| File | Change |
|------|--------|
| `types/index.ts` | Add `card_name`, `last_four` to `Statement` + `ParsedStatement` |
| `lib/bank-detect.ts` | Add `fileName` param; extract `card_name`, `last_four`; extend `DetectionResult` |
| `lib/pdf-parser.ts` | Pass `file.name`; fix UPI regex; propagate card fields |
| `lib/dashboard-data.ts` | Add `statement_id` to `FilterState`; add `getAvailableCards`; update `filterAnalyses`; coerce numerics in `computeKpis` |
| `app/api/analyse/route.ts` | Accept `card_name`/`last_four`; fix `upiTxs` filter; VPA fallback name; coerce amounts |
| `lib/ai/upi-resolve.ts` | No change needed (fix is in route.ts) |
| `components/upload/confirm-modal.tsx` | Show card row (`card_name` + masked `last_four`) |
| `components/dashboard/filter-bar.tsx` | Add card pill row; update `FilterBarProps` |
| `components/dashboard/dashboard-shell.tsx` | Call `getAvailableCards`; pass to `FilterBar`; remove `getAvailableBanks` |
| `app/page.tsx` | Update `FilterState` initial value to include `statement_id: null` |
| `tests/bank-detect.test.ts` | Add filename + card extraction tests |
| `tests/lib/dashboard-data.test.ts` | Update `makeStatement` fixture; add card filter + coercion tests |
| `tests/components/confirm-modal.test.tsx` | Add card row rendering tests |
| `tests/components/filter-bar.test.tsx` | Create; add card pill tests |
| `tests/api/analyse.test.ts` | Update `mockStatement` fixture; add card fields + UPI fix test |

---

## Task 1: Update types

**Files:**
- Modify: `types/index.ts`

- [ ] **Step 1: Add card fields to `Statement` and `ParsedStatement`**

In `types/index.ts`, update the two interfaces:

```ts
export interface Statement {
  id: string
  month: string
  bank: BankSlug
  account_type: AccountType
  transaction_count: number
  total_debit: number
  total_credit: number
  currency: 'INR'
  uploaded_at: string
  card_name: string | null
  last_four: string | null
}

export interface ParsedStatement {
  bank: BankSlug | null
  month: string | null
  account_type: AccountType
  transactions: RawTransaction[]
  raw_header: string
  raw_text: string
  card_name: string | null
  last_four: string | null
}
```

- [ ] **Step 2: Run the full test suite to see what breaks**

```bash
npm test 2>&1 | tail -30
```

Expected: some tests fail because `makeStatement` fixtures are missing `card_name`/`last_four`. Note which test files fail — you will fix them in later tasks.

- [ ] **Step 3: Commit**

```bash
git add types/index.ts
git commit -m "feat(types): add card_name and last_four to Statement and ParsedStatement"
```

---

## Task 2: Update `bank-detect.ts`

**Files:**
- Modify: `lib/bank-detect.ts`
- Modify: `tests/bank-detect.test.ts`

- [ ] **Step 1: Write failing tests for filename detection and card extraction**

Replace the entire content of `tests/bank-detect.test.ts`:

```ts
import { detectBankAndMonth } from '@/lib/bank-detect'

describe('detectBankAndMonth — existing header detection', () => {
  it('detects HDFC from header', () => {
    const result = detectBankAndMonth('HDFC Bank Credit Card Statement\nStatement Period: March 2024')
    expect(result.bank).toBe('hdfc')
    expect(result.month).toBe('2024-03')
  })

  it('detects SBI from header', () => {
    const result = detectBankAndMonth('State Bank of India\nAccount Statement February 2024')
    expect(result.bank).toBe('sbi')
    expect(result.month).toBe('2024-02')
  })

  it('detects ICICI from header', () => {
    const result = detectBankAndMonth('ICICI Bank Limited\nJan 2024')
    expect(result.bank).toBe('icici')
    expect(result.month).toBe('2024-01')
  })

  it('returns null for unrecognised bank', () => {
    const result = detectBankAndMonth('Some random text without bank name')
    expect(result.bank).toBeNull()
    expect(result.month).toBeNull()
  })

  it('detects credit account type', () => {
    const result = detectBankAndMonth('HDFC Bank Credit Card Statement')
    expect(result.account_type).toBe('credit')
  })

  it('defaults to debit when no credit card mention', () => {
    const result = detectBankAndMonth('HDFC Bank Account Statement')
    expect(result.account_type).toBe('debit')
  })
})

describe('detectBankAndMonth — filename detection', () => {
  it('detects bank from filename when header has none', () => {
    const result = detectBankAndMonth('random text', 'HDFC_CC_Statement_Dec2024.pdf')
    expect(result.bank).toBe('hdfc')
  })

  it('detects month from filename pattern dec2024', () => {
    const result = detectBankAndMonth('', 'HDFC_CC_Dec2024.pdf')
    expect(result.month).toBe('2024-12')
  })

  it('detects month from filename pattern 12-2024', () => {
    const result = detectBankAndMonth('', 'statement_12-2024.pdf')
    expect(result.month).toBe('2024-12')
  })

  it('detects month from filename pattern december_2024', () => {
    const result = detectBankAndMonth('', 'ICICI_december_2024.pdf')
    expect(result.month).toBe('2024-12')
  })

  it('header detection takes priority over filename for bank', () => {
    const result = detectBankAndMonth('ICICI Bank Credit Card', 'HDFC_statement.pdf')
    expect(result.bank).toBe('icici')
  })

  it('header detection takes priority over filename for month', () => {
    const result = detectBankAndMonth('Statement Period: January 2024', 'statement_feb2024.pdf')
    expect(result.month).toBe('2024-01')
  })
})

describe('detectBankAndMonth — last_four extraction', () => {
  it('extracts last four from header near "card"', () => {
    const result = detectBankAndMonth('HDFC Bank Credit Card\nCard Number ending 4321')
    expect(result.last_four).toBe('4321')
  })

  it('extracts last four from header near "ending"', () => {
    const result = detectBankAndMonth('HDFC Bank\nAccount ending in 9876')
    expect(result.last_four).toBe('9876')
  })

  it('extracts last four from filename when header has none', () => {
    const result = detectBankAndMonth('HDFC Bank Credit Card', 'HDFC_CC_1234.pdf')
    expect(result.last_four).toBe('1234')
  })

  it('returns null last_four when not found', () => {
    const result = detectBankAndMonth('HDFC Bank Credit Card Statement March 2024')
    expect(result.last_four).toBeNull()
  })
})

describe('detectBankAndMonth — card_name extraction', () => {
  it('extracts HDFC Regalia from header', () => {
    const result = detectBankAndMonth('HDFC Bank Regalia Credit Card Statement')
    expect(result.card_name).toBe('Regalia')
  })

  it('extracts HDFC Millennia from header', () => {
    const result = detectBankAndMonth('HDFC Bank Millennia Credit Card')
    expect(result.card_name).toBe('Millennia')
  })

  it('extracts ICICI Amazon Pay from header', () => {
    const result = detectBankAndMonth('ICICI Bank Amazon Pay Credit Card Statement')
    expect(result.card_name).toBe('Amazon Pay')
  })

  it('extracts Axis Flipkart from filename', () => {
    const result = detectBankAndMonth('Axis Bank Credit Card', 'Axis_Flipkart_statement.pdf')
    expect(result.card_name).toBe('Flipkart')
  })

  it('returns null card_name when not found', () => {
    const result = detectBankAndMonth('HDFC Bank Credit Card Statement March 2024')
    expect(result.card_name).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/bank-detect.test.ts 2>&1 | tail -20
```

Expected: multiple failures — `last_four` and `card_name` undefined, filename detection not working.

- [ ] **Step 3: Implement the updated `lib/bank-detect.ts`**

Replace the entire file:

```ts
import type { BankSlug, AccountType } from '@/types'

export interface DetectionResult {
  bank: BankSlug | null
  month: string | null
  account_type: AccountType
  card_name: string | null
  last_four: string | null
}

const BANK_PATTERNS: Array<{ pattern: RegExp; slug: BankSlug }> = [
  { pattern: /hdfc/i, slug: 'hdfc' },
  { pattern: /state bank of india|sbi/i, slug: 'sbi' },
  { pattern: /icici/i, slug: 'icici' },
  { pattern: /axis/i, slug: 'axis' },
  { pattern: /kotak/i, slug: 'kotak' },
  { pattern: /yes bank/i, slug: 'yes' },
  { pattern: /punjab national|pnb/i, slug: 'pnb' },
  { pattern: /bank of baroda|bob/i, slug: 'bob' },
  { pattern: /canara/i, slug: 'canara' },
  { pattern: /indusind/i, slug: 'indusind' },
]

const MONTH_NAMES: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04',
  jun: '06', jul: '07', aug: '08', sep: '09',
  oct: '10', nov: '11', dec: '12',
}

// Known card product names per bank (order matters — longer names first to avoid partial match)
const CARD_NAMES: string[] = [
  // Multi-word first
  'Amazon Pay', 'MakeMyTrip', 'Tata Neu', 'Yes First', 'Flipkart Axis',
  // HDFC
  'Regalia Gold', 'Regalia', 'Millennia', 'MoneyBack', 'Diners Club', 'Infinia', 'Freedom', 'Pixel', 'Tata',
  // ICICI
  'Coral', 'Sapphiro', 'Rubyx', 'Emeralde',
  // Axis
  'Flipkart', 'Magnus', 'Vistara', 'Reserve', 'Select', 'Neo',
  // SBI
  'SimplyCLICK', 'SimplySAVE', 'Elite', 'Prime', 'Cashback',
  // Kotak
  'League', 'Royale', 'White Reserve', 'Mojo',
]

function detectBank(text: string): BankSlug | null {
  return BANK_PATTERNS.find(({ pattern }) => pattern.test(text))?.slug ?? null
}

function detectMonth(text: string): string | null {
  const named = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})\b/i,
  )
  if (named) {
    const m = MONTH_NAMES[named[1].toLowerCase()]
    return `${named[2]}-${m}`
  }

  // "12-2024" or "12/2024"
  const mmyyyy = text.match(/\b(0?[1-9]|1[0-2])[\/\-](\d{4})\b/)
  if (mmyyyy) return `${mmyyyy[2]}-${mmyyyy[1].padStart(2, '0')}`

  // "dec2024" or "december2024" in filenames
  const compact = text.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)_?(\d{4})\b/i,
  )
  if (compact) {
    const m = MONTH_NAMES[compact[1].toLowerCase()]
    return `${compact[2]}-${m}`
  }

  const numeric = text.match(/\b(\d{4})-(\d{2})\b/)
  if (numeric) return `${numeric[1]}-${numeric[2]}`

  return null
}

function detectLastFour(headerText: string, fileName: string): string | null {
  // Look for 4-digit sequence near card/account/ending keywords in header
  const contextMatch = headerText.match(
    /(?:card|account|ending|no\.?|number)[^\d]{0,20}(\d{4})\b/i,
  )
  if (contextMatch) return contextMatch[1]

  // Fallback: any standalone 4-digit sequence in filename
  const fileMatch = fileName.replace(/\.pdf$/i, '').match(/\b(\d{4})\b/)
  if (fileMatch) return fileMatch[1]

  return null
}

function detectCardName(text: string): string | null {
  for (const name of CARD_NAMES) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) return name
  }
  return null
}

export function detectBankAndMonth(headerText: string, fileName = ''): DetectionResult {
  const fileNameNoExt = fileName.replace(/\.pdf$/i, '')

  const bank = detectBank(headerText) ?? detectBank(fileNameNoExt)
  const month = detectMonth(headerText) ?? detectMonth(fileNameNoExt)
  const account_type: AccountType = /credit card/i.test(headerText) ? 'credit' : 'debit'
  const last_four = detectLastFour(headerText, fileNameNoExt)
  const card_name = detectCardName(headerText) ?? detectCardName(fileNameNoExt)

  return { bank, month, account_type, card_name, last_four }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/bank-detect.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/bank-detect.ts tests/bank-detect.test.ts
git commit -m "feat(bank-detect): filename detection, card_name and last_four extraction"
```

---

## Task 3: Update `pdf-parser.ts`

**Files:**
- Modify: `lib/pdf-parser.ts`

- [ ] **Step 1: Update `pdf-parser.ts`**

Replace the file content:

```ts
'use client'

import type { PDFDocumentProxy } from 'pdfjs-dist'
import type { ParsedStatement, RawTransaction } from '@/types'
import { stripPii } from '@/lib/pii-stripper'
import { detectBankAndMonth } from '@/lib/bank-detect'

async function getPdfJs() {
  const pdfjs = await import('pdfjs-dist')
  pdfjs.GlobalWorkerOptions.workerSrc =
    `//unpkg.com/pdfjs-dist@${String(pdfjs.version)}/build/pdf.worker.min.mjs`
  return pdfjs
}

export class PdfPasswordError extends Error {
  constructor() {
    super('PDF is password-protected')
    this.name = 'PdfPasswordError'
  }
}

export interface PdfParseOptions {
  password?: string
}

export async function parsePdf(
  file: File,
  options: PdfParseOptions = {},
): Promise<ParsedStatement> {
  const pdfjs = await getPdfJs()
  const arrayBuffer = await file.arrayBuffer()

  let doc: PDFDocumentProxy
  try {
    doc = await pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      password: options.password,
    }).promise
  } catch (err) {
    if (
      err !== null &&
      typeof err === 'object' &&
      (err as { name?: string }).name === 'PasswordException'
    ) {
      throw new PdfPasswordError()
    }
    throw err
  }

  const pages: string[] = []
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const content = await page.getTextContent()
    pages.push(content.items.map((item) => ('str' in item ? item.str : '')).join(' '))
  }

  const fullText = pages.join('\n')
  const headerText = pages[0] ?? ''
  const { bank, month, account_type, card_name, last_four } = detectBankAndMonth(headerText, file.name)
  const transactions = extractTransactions(fullText)

  return {
    bank,
    month,
    account_type,
    card_name,
    last_four,
    transactions,
    raw_header: stripPii(headerText.slice(0, 500)),
    raw_text: stripPii(fullText.slice(0, 15000)),
  }
}

function extractTransactions(text: string): RawTransaction[] {
  const transactions: RawTransaction[] = []
  const linePattern =
    /(\d{2}[\/\-]\d{2}[\/\-]\d{4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(Dr|Cr|DR|CR)?/g

  for (const match of text.matchAll(linePattern)) {
    const [, rawDate, rawDesc, rawAmount, drCr] = match
    const date = normaliseDate(rawDate)
    const amount = parseFloat(rawAmount.replace(/,/g, ''))
    const type = drCr?.toUpperCase() === 'CR' ? 'credit' : 'debit'
    const description = stripPii(rawDesc.trim())
    const upiRef = extractUpiRef(description)
    transactions.push({ date, amount, type, description, upi_ref: upiRef })
  }

  return transactions
}

function normaliseDate(raw: string): string {
  const parts = raw.split(/[\/\-]/)
  if (parts.length !== 3) return raw
  const [dd, mm, yyyy] = parts
  return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`
}

function extractUpiRef(description: string): string | null {
  // Priority 1: VPA format — merchant@bank (e.g. swiggy@sbi, 9876543210@ybl)
  const vpa = description.match(/([a-zA-Z0-9._\-]+@[a-zA-Z]{2,})/i)
  if (vpa) return vpa[1]
  // Priority 2: UPI followed by alphanumeric code (legacy format)
  const code = description.match(/UPI[\/\-\s]+([A-Z0-9]{6,})/i)
  return code ? code[1] : null
}
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test 2>&1 | tail -30
```

Expected: existing tests still pass. No new failures beyond the ones already broken from Task 1.

- [ ] **Step 3: Commit**

```bash
git add lib/pdf-parser.ts
git commit -m "fix(pdf-parser): pass filename to detectBankAndMonth, fix UPI VPA regex"
```

---

## Task 4: Update `dashboard-data.ts`

**Files:**
- Modify: `lib/dashboard-data.ts`
- Modify: `tests/lib/dashboard-data.test.ts`

- [ ] **Step 1: Write failing tests for new functionality**

In `tests/lib/dashboard-data.test.ts`, update the `makeStatement` local factory to include new fields, then add new test sections. Replace the entire file:

```ts
import { describe, it, expect } from 'vitest'
import {
  getAvailableMonths,
  getAvailableBanks,
  getAvailableCards,
  filterAnalyses,
  computeKpis,
  getSpendTrendData,
} from '@/lib/dashboard-data'
import type { FilterState } from '@/lib/dashboard-data'
import type { DashboardData, Statement, Analysis } from '@/types'

// ─── Fixtures ────────────────────────────────────────────────────────────────

const makeStatement = (overrides: Partial<Statement>): Statement => ({
  id: 'stmt-1',
  month: '2025-01',
  bank: 'hdfc',
  account_type: 'debit',
  transaction_count: 10,
  total_debit: 5000,
  total_credit: 1000,
  currency: 'INR',
  uploaded_at: '2025-01-15T10:00:00Z',
  card_name: null,
  last_four: null,
  ...overrides,
})

const makeAnalysis = (overrides: Partial<Analysis>): Analysis => ({
  id: 'ana-1',
  statement_id: 'stmt-1',
  month: '2025-01',
  category_breakdown: { food: 2000, transport: 1000 },
  top_merchants: [{ name: 'Zomato', total: 1500, count: 5 }],
  upi_summary: { total_spent: 1000, merchant_breakdown: [] },
  monthly_total: 5000,
  insights: [],
  generated_at: '2025-01-16T08:00:00Z',
  ...overrides,
})

const buildData = (statements: Statement[], analyses: Analysis[]): DashboardData => ({
  statements,
  analyses,
})

// ─── getAvailableMonths ───────────────────────────────────────────────────────

describe('getAvailableMonths', () => {
  it('returns months in descending order', () => {
    const data = buildData(
      [
        makeStatement({ id: 'a', month: '2025-01' }),
        makeStatement({ id: 'b', month: '2025-03' }),
        makeStatement({ id: 'c', month: '2025-02' }),
      ],
      [
        makeAnalysis({ id: 'x', statement_id: 'a', month: '2025-01' }),
        makeAnalysis({ id: 'y', statement_id: 'b', month: '2025-03' }),
        makeAnalysis({ id: 'z', statement_id: 'c', month: '2025-02' }),
      ],
    )
    expect(getAvailableMonths(data)).toEqual(['2025-03', '2025-02', '2025-01'])
  })

  it('deduplicates months across statements', () => {
    const data = buildData(
      [
        makeStatement({ id: 'a', month: '2025-01' }),
        makeStatement({ id: 'b', month: '2025-01', bank: 'sbi' }),
      ],
      [
        makeAnalysis({ id: 'x', statement_id: 'a' }),
        makeAnalysis({ id: 'y', statement_id: 'b' }),
      ],
    )
    const months = getAvailableMonths(data)
    expect(months).toHaveLength(1)
    expect(months).toEqual(['2025-01'])
  })
})

// ─── getAvailableBanks ────────────────────────────────────────────────────────

describe('getAvailableBanks', () => {
  it('returns unique banks in alphabetical order', () => {
    const data = buildData(
      [
        makeStatement({ id: 'a', bank: 'sbi' }),
        makeStatement({ id: 'b', bank: 'hdfc' }),
        makeStatement({ id: 'c', bank: 'sbi' }),
        makeStatement({ id: 'd', bank: 'axis' }),
      ],
      [
        makeAnalysis({ id: 'w', statement_id: 'a' }),
        makeAnalysis({ id: 'x', statement_id: 'b' }),
        makeAnalysis({ id: 'y', statement_id: 'c' }),
        makeAnalysis({ id: 'z', statement_id: 'd' }),
      ],
    )
    expect(getAvailableBanks(data)).toEqual(['axis', 'hdfc', 'sbi'])
  })
})

// ─── getAvailableCards ────────────────────────────────────────────────────────

describe('getAvailableCards', () => {
  it('returns one entry per analysed statement', () => {
    const data = buildData(
      [
        makeStatement({ id: 'stmt-a', bank: 'hdfc', card_name: 'Regalia', last_four: '1234' }),
        makeStatement({ id: 'stmt-b', bank: 'hdfc', card_name: 'Millennia', last_four: '5678' }),
      ],
      [
        makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a' }),
        makeAnalysis({ id: 'ana-b', statement_id: 'stmt-b' }),
      ],
    )
    const cards = getAvailableCards(data)
    expect(cards).toHaveLength(2)
    expect(cards[0]).toEqual({ statement_id: 'stmt-a', bank: 'hdfc', card_name: 'Regalia', last_four: '1234' })
    expect(cards[1]).toEqual({ statement_id: 'stmt-b', bank: 'hdfc', card_name: 'Millennia', last_four: '5678' })
  })

  it('excludes statements with no matching analysis', () => {
    const data = buildData(
      [
        makeStatement({ id: 'stmt-a' }),
        makeStatement({ id: 'stmt-b' }),
      ],
      [makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a' })],
    )
    const cards = getAvailableCards(data)
    expect(cards).toHaveLength(1)
    expect(cards[0].statement_id).toBe('stmt-a')
  })
})

// ─── filterAnalyses ───────────────────────────────────────────────────────────

describe('filterAnalyses', () => {
  it('returns all analyses when filter is null/null/null', () => {
    const stmtA = makeStatement({ id: 'stmt-a', month: '2025-01', bank: 'hdfc' })
    const stmtB = makeStatement({ id: 'stmt-b', month: '2025-02', bank: 'sbi' })
    const anaA = makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a', month: '2025-01' })
    const anaB = makeAnalysis({ id: 'ana-b', statement_id: 'stmt-b', month: '2025-02' })
    const data = buildData([stmtA, stmtB], [anaA, anaB])
    const filter: FilterState = { month: null, bank: null, statement_id: null }

    const result = filterAnalyses(data, filter)
    expect(result).toHaveLength(2)
  })

  it('filters by month and returns only matching analyses', () => {
    const stmtA = makeStatement({ id: 'stmt-a', month: '2025-01', bank: 'hdfc' })
    const stmtB = makeStatement({ id: 'stmt-b', month: '2025-02', bank: 'hdfc' })
    const anaA = makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a', month: '2025-01' })
    const anaB = makeAnalysis({ id: 'ana-b', statement_id: 'stmt-b', month: '2025-02' })
    const data = buildData([stmtA, stmtB], [anaA, anaB])
    const filter: FilterState = { month: '2025-01', bank: null, statement_id: null }

    const result = filterAnalyses(data, filter)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ana-a')
  })

  it('filters by bank by cross-referencing statements', () => {
    const stmtHdfc = makeStatement({ id: 'stmt-hdfc', month: '2025-01', bank: 'hdfc' })
    const stmtSbi = makeStatement({ id: 'stmt-sbi', month: '2025-01', bank: 'sbi' })
    const anaHdfc = makeAnalysis({ id: 'ana-hdfc', statement_id: 'stmt-hdfc', month: '2025-01' })
    const anaSbi = makeAnalysis({ id: 'ana-sbi', statement_id: 'stmt-sbi', month: '2025-01' })
    const data = buildData([stmtHdfc, stmtSbi], [anaHdfc, anaSbi])
    const filter: FilterState = { month: null, bank: 'sbi', statement_id: null }

    const result = filterAnalyses(data, filter)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ana-sbi')
  })

  it('filters by statement_id for card-level scoping', () => {
    const stmtA = makeStatement({ id: 'stmt-a', bank: 'hdfc', month: '2025-01' })
    const stmtB = makeStatement({ id: 'stmt-b', bank: 'hdfc', month: '2025-01' })
    const anaA = makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a', month: '2025-01' })
    const anaB = makeAnalysis({ id: 'ana-b', statement_id: 'stmt-b', month: '2025-01' })
    const data = buildData([stmtA, stmtB], [anaA, anaB])
    const filter: FilterState = { month: null, bank: null, statement_id: 'stmt-a' }

    const result = filterAnalyses(data, filter)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('ana-a')
  })

  it('returns analyses sorted descending by month', () => {
    const stmtA = makeStatement({ id: 'stmt-a', month: '2025-01', bank: 'hdfc' })
    const stmtB = makeStatement({ id: 'stmt-b', month: '2025-03', bank: 'hdfc' })
    const stmtC = makeStatement({ id: 'stmt-c', month: '2025-02', bank: 'hdfc' })
    const anaA = makeAnalysis({ id: 'ana-a', statement_id: 'stmt-a', month: '2025-01' })
    const anaB = makeAnalysis({ id: 'ana-b', statement_id: 'stmt-b', month: '2025-03' })
    const anaC = makeAnalysis({ id: 'ana-c', statement_id: 'stmt-c', month: '2025-02' })
    const data = buildData([stmtA, stmtB, stmtC], [anaA, anaB, anaC])
    const filter: FilterState = { month: null, bank: null, statement_id: null }

    const result = filterAnalyses(data, filter)
    expect(result.map((a) => a.month)).toEqual(['2025-03', '2025-02', '2025-01'])
  })
})

// ─── computeKpis ─────────────────────────────────────────────────────────────

describe('computeKpis', () => {
  it('returns correct totalSpend and avgMonthlySpend', () => {
    const analyses = [
      makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 4000 }),
      makeAnalysis({ id: 'b', month: '2025-02', monthly_total: 6000 }),
    ]
    const filter: FilterState = { month: null, bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.totalSpend).toBe(10000)
    expect(kpis.avgMonthlySpend).toBe(5000)
  })

  it('coerces string monthly_total from DB without NaN', () => {
    const analyses = [
      makeAnalysis({ id: 'a', month: '2025-01', monthly_total: '4000' as unknown as number }),
      makeAnalysis({ id: 'b', month: '2025-02', monthly_total: '6000' as unknown as number }),
    ]
    const filter: FilterState = { month: null, bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.totalSpend).toBe(10000)
    expect(kpis.avgMonthlySpend).toBe(5000)
  })

  it('coerces string upi total_spent without NaN', () => {
    const analyses = [
      makeAnalysis({
        id: 'a',
        month: '2025-01',
        monthly_total: 10000,
        upi_summary: { total_spent: '4000' as unknown as number, merchant_breakdown: [] },
      }),
    ]
    const filter: FilterState = { month: null, bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.upiShare).toBeCloseTo(0.4, 5)
  })

  it('returns correct topCategory across all analyses', () => {
    const analyses = [
      makeAnalysis({ id: 'a', month: '2025-01', category_breakdown: { food: 3000, transport: 500 }, monthly_total: 3500 }),
      makeAnalysis({ id: 'b', month: '2025-02', category_breakdown: { food: 2000, shopping: 1000 }, monthly_total: 3000 }),
    ]
    const filter: FilterState = { month: null, bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.topCategory).toBe('food')
    expect(kpis.topCategoryAmount).toBe(5000)
  })

  it('returns correct monthOverMonthChange when prior month exists', () => {
    const analyses = [
      makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 4000 }),
      makeAnalysis({ id: 'b', month: '2025-02', monthly_total: 5000 }),
    ]
    const filter: FilterState = { month: '2025-02', bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.monthOverMonthChange).toBeCloseTo(25, 5)
  })

  it('returns null monthOverMonthChange when no prior data exists', () => {
    const analyses = [makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 4000 })]
    const filter: FilterState = { month: '2025-01', bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.monthOverMonthChange).toBeNull()
  })

  it('returns null monthOverMonthChange when filter.month is null', () => {
    const analyses = [
      makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 4000 }),
      makeAnalysis({ id: 'b', month: '2025-02', monthly_total: 5000 }),
    ]
    const filter: FilterState = { month: null, bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.monthOverMonthChange).toBeNull()
  })

  it('returns zero totals and null topCategory when analyses is empty', () => {
    const filter: FilterState = { month: null, bank: null, statement_id: null }
    const kpis = computeKpis([], filter)

    expect(kpis.totalSpend).toBe(0)
    expect(kpis.avgMonthlySpend).toBe(0)
    expect(kpis.topCategory).toBeNull()
    expect(kpis.monthOverMonthChange).toBeNull()
    expect(kpis.upiShare).toBe(0)
  })

  it('computes upiShare correctly', () => {
    const analyses = [
      makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 10000, upi_summary: { total_spent: 4000, merchant_breakdown: [] } }),
    ]
    const filter: FilterState = { month: null, bank: null, statement_id: null }
    const kpis = computeKpis(analyses, filter)

    expect(kpis.upiShare).toBeCloseTo(0.4, 5)
  })
})

// ─── getSpendTrendData ────────────────────────────────────────────────────────

describe('getSpendTrendData', () => {
  it('returns chart points sorted ascending by month', () => {
    const analyses = [
      makeAnalysis({ id: 'c', month: '2025-03', monthly_total: 7000 }),
      makeAnalysis({ id: 'a', month: '2025-01', monthly_total: 5000 }),
      makeAnalysis({ id: 'b', month: '2025-02', monthly_total: 6000 }),
    ]

    const points = getSpendTrendData(analyses)
    expect(points.map((p) => p.month)).toEqual(['2025-01', '2025-02', '2025-03'])
    expect(points.map((p) => p.total)).toEqual([5000, 6000, 7000])
  })

  it('returns an empty array for empty input', () => {
    expect(getSpendTrendData([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/lib/dashboard-data.test.ts 2>&1 | tail -20
```

Expected: failures on `getAvailableCards` (not exported), `statement_id` filter, and string coercion tests.

- [ ] **Step 3: Implement the updated `lib/dashboard-data.ts`**

Replace the entire file:

```ts
import type { BankSlug, CategorySlug, DashboardData, Analysis, Statement } from '@/types'

export interface FilterState {
  month: string | null
  bank: BankSlug | null
  statement_id: string | null
}

export interface KpiMetrics {
  totalSpend: number
  avgMonthlySpend: number
  topCategory: CategorySlug | null
  topCategoryAmount: number
  monthOverMonthChange: number | null
  upiShare: number
}

export interface ChartPoint {
  month: string
  total: number
}

export interface CardDescriptor {
  statement_id: string
  bank: BankSlug
  card_name: string | null
  last_four: string | null
}

export function getAvailableMonths(data: DashboardData): string[] {
  const analysedIds = new Set(data.analyses.map((a) => a.statement_id))
  const months = Array.from(
    new Set(data.statements.filter((s) => analysedIds.has(s.id)).map((s) => s.month)),
  )
  return months.sort((a, b) => b.localeCompare(a))
}

export function getAvailableBanks(data: DashboardData): BankSlug[] {
  const analysedIds = new Set(data.analyses.map((a) => a.statement_id))
  const banks = Array.from(
    new Set(data.statements.filter((s) => analysedIds.has(s.id)).map((s) => s.bank)),
  )
  return banks.sort()
}

export function getAvailableCards(data: DashboardData): CardDescriptor[] {
  const analysedIds = new Set(data.analyses.map((a) => a.statement_id))
  return data.statements
    .filter((s) => analysedIds.has(s.id))
    .map((s) => ({
      statement_id: s.id,
      bank: s.bank,
      card_name: s.card_name ?? null,
      last_four: s.last_four ?? null,
    }))
}

export function filterAnalyses(data: DashboardData, filter: FilterState): Analysis[] {
  const { statements, analyses } = data

  const filteredStatements = statements.filter((s) => {
    if (filter.month !== null && s.month !== filter.month) return false
    if (filter.bank !== null && s.bank !== filter.bank) return false
    if (filter.statement_id !== null && s.id !== filter.statement_id) return false
    return true
  })

  const statementIds = new Set(filteredStatements.map((s) => s.id))
  return analyses.filter((a) => statementIds.has(a.statement_id))
    .sort((a, b) => b.month.localeCompare(a.month))
}

export function computeKpis(analyses: Analysis[], filter: FilterState): KpiMetrics {
  const currentAnalyses =
    filter.month !== null ? analyses.filter((a) => a.month === filter.month) : analyses

  if (currentAnalyses.length === 0) {
    return { totalSpend: 0, avgMonthlySpend: 0, topCategory: null, topCategoryAmount: 0, monthOverMonthChange: null, upiShare: 0 }
  }

  const totalSpend = currentAnalyses.reduce((sum, a) => sum + (Number(a.monthly_total) || 0), 0)
  const distinctMonths = new Set(currentAnalyses.map((a) => a.month)).size
  const avgMonthlySpend = distinctMonths > 0 ? totalSpend / distinctMonths : 0

  const categoryTotals: Partial<Record<CategorySlug, number>> = {}
  for (const analysis of currentAnalyses) {
    for (const [slug, amount] of Object.entries(analysis.category_breakdown) as [CategorySlug, number][]) {
      categoryTotals[slug] = (categoryTotals[slug] ?? 0) + (Number(amount) || 0)
    }
  }

  let topCategory: CategorySlug | null = null
  let topCategoryAmount = 0
  for (const [slug, amount] of Object.entries(categoryTotals) as [CategorySlug, number][]) {
    if (amount > topCategoryAmount) {
      topCategoryAmount = amount
      topCategory = slug
    }
  }

  let monthOverMonthChange: number | null = null
  if (filter.month !== null) {
    const [year, month] = filter.month.split('-').map(Number)
    const priorDate = new Date(year, month - 2, 1)
    const priorMonth = `${priorDate.getFullYear()}-${String(priorDate.getMonth() + 1).padStart(2, '0')}`
    const priorAnalyses = analyses.filter((a) => a.month === priorMonth)
    if (priorAnalyses.length > 0) {
      const priorTotal = priorAnalyses.reduce((sum, a) => sum + (Number(a.monthly_total) || 0), 0)
      if (priorTotal !== 0) {
        monthOverMonthChange = ((totalSpend - priorTotal) / priorTotal) * 100
      }
    }
  }

  const totalUpiSpent = currentAnalyses.reduce((sum, a) => sum + (Number(a.upi_summary?.total_spent) || 0), 0)
  const upiShare = totalSpend > 0 ? totalUpiSpent / totalSpend : 0

  return { totalSpend, avgMonthlySpend, topCategory, topCategoryAmount, monthOverMonthChange, upiShare }
}

export function getSpendTrendData(analyses: Analysis[]): Array<{ month: string; total: number }> {
  return analyses
    .map((a) => ({ month: a.month, total: Number(a.monthly_total) || 0 }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/lib/dashboard-data.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/dashboard-data.ts tests/lib/dashboard-data.test.ts
git commit -m "feat(dashboard-data): add getAvailableCards, statement_id filter, coerce DB numerics"
```

---

## Task 5: Update `app/api/analyse/route.ts`

**Files:**
- Modify: `app/api/analyse/route.ts`
- Modify: `tests/api/analyse.test.ts`

- [ ] **Step 1: Update `mockStatement` fixture and add card + UPI tests**

In `tests/api/analyse.test.ts`, update `mockStatement` and add two tests. Replace the file:

```ts
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/analyse/route'
import * as db from '@/lib/db'
import * as categorise from '@/lib/ai/categorise'
import * as upiResolve from '@/lib/ai/upi-resolve'
import * as insights from '@/lib/ai/insights'

vi.mock('@/lib/db')
vi.mock('@/lib/ai/categorise')
vi.mock('@/lib/ai/upi-resolve')
vi.mock('@/lib/ai/insights')

const mockStatement = {
  id: 'stmt-1', month: '2024-01', bank: 'hdfc', account_type: 'debit',
  transaction_count: 1, total_debit: 500, total_credit: 0, currency: 'INR',
  uploaded_at: 'now', card_name: null, last_four: null,
}

const mockAnalysis = {
  id: 'anal-1', statement_id: 'stmt-1', month: '2024-01',
  category_breakdown: {}, top_merchants: [], upi_summary: { total_spent: 0, merchant_breakdown: [] },
  monthly_total: 500, insights: [], generated_at: 'now',
}

describe('POST /api/analyse', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns 401 when no token', async () => {
    const req = new Request('http://localhost/api/analyse', { method: 'POST', body: '{}' })
    const { NextRequest } = await import('next/server')
    const res = await POST(new NextRequest(req))
    expect(res.status).toBe(401)
  })

  it('returns 400 for invalid body', async () => {
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/analyse', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: 'bad', bank: 'hdfc', account_type: 'debit', transactions: [] }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('stores card_name and last_four in statement when provided', async () => {
    vi.mocked(db.dbInsert).mockResolvedValueOnce(mockStatement as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce(mockAnalysis as never)
    vi.mocked(db.dbList).mockResolvedValue([])
    vi.mocked(categorise.categoriseTransactions).mockResolvedValue([
      { id: 'stmt-1_0', date: '2024-01-01', amount: 500, type: 'debit', description: 'ATM', upi_ref: null, merchant: 'ATM', category: 'others' },
    ])
    vi.mocked(upiResolve.resolveUpiMerchants).mockResolvedValue([
      { id: 'stmt-1_0', upi_ref: null, merchant: 'ATM', description: 'ATM', upi_merchant: null },
    ])
    vi.mocked(insights.generateInsights).mockResolvedValue([])

    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/analyse', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month: '2024-01', bank: 'hdfc', account_type: 'debit',
        card_name: 'Regalia', last_four: '1234',
        transactions: [{ date: '2024-01-01', amount: 500, type: 'debit', description: 'ATM withdrawal', upi_ref: null }],
      }),
    })
    await POST(req)

    const firstInsertCall = vi.mocked(db.dbInsert).mock.calls[0]
    expect(firstInsertCall[1]).toMatchObject({ card_name: 'Regalia', last_four: '1234' })
  })

  it('includes transactions with upi_ref in upi_summary even when upi_merchant is null', async () => {
    vi.mocked(db.dbInsert).mockResolvedValueOnce(mockStatement as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce(mockAnalysis as never)
    vi.mocked(db.dbList).mockResolvedValue([])
    vi.mocked(categorise.categoriseTransactions).mockResolvedValue([
      { id: 'stmt-1_0', date: '2024-01-01', amount: 300, type: 'debit', description: 'swiggy@sbi', upi_ref: 'swiggy@sbi', merchant: 'Swiggy', category: 'food' },
    ])
    // AI resolution fails — returns null merchant
    vi.mocked(upiResolve.resolveUpiMerchants).mockResolvedValue([
      { id: 'stmt-1_0', upi_ref: 'swiggy@sbi', merchant: 'Swiggy', description: 'swiggy@sbi', upi_merchant: null },
    ])
    vi.mocked(insights.generateInsights).mockResolvedValue([])

    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/analyse', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month: '2024-01', bank: 'hdfc', account_type: 'debit',
        transactions: [{ date: '2024-01-01', amount: 300, type: 'debit', description: 'swiggy@sbi', upi_ref: 'swiggy@sbi' }],
      }),
    })
    await POST(req)

    // Third dbInsert is the analysis
    const analysisInsert = vi.mocked(db.dbInsert).mock.calls[2]
    const upiSummary = (analysisInsert[1] as Record<string, unknown>).upi_summary as { total_spent: number; merchant_breakdown: Array<{ name: string }> }
    expect(upiSummary.total_spent).toBe(300)
    expect(upiSummary.merchant_breakdown[0].name).toBe('swiggy@sbi') // VPA fallback
  })

  it('returns statement and analysis on success', async () => {
    vi.mocked(db.dbInsert).mockResolvedValueOnce(mockStatement as never)
      .mockResolvedValueOnce({} as never)
      .mockResolvedValueOnce(mockAnalysis as never)
    vi.mocked(db.dbList).mockResolvedValue([])
    vi.mocked(categorise.categoriseTransactions).mockResolvedValue([
      { id: 'stmt-1_0', date: '2024-01-01', amount: 500, type: 'debit', description: 'ATM', upi_ref: null, merchant: 'ATM', category: 'others' },
    ])
    vi.mocked(upiResolve.resolveUpiMerchants).mockResolvedValue([
      { id: 'stmt-1_0', upi_ref: null, merchant: 'ATM', description: 'ATM', upi_merchant: null },
    ])
    vi.mocked(insights.generateInsights).mockResolvedValue(['Spend on track'])

    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/analyse', {
      method: 'POST',
      headers: { Authorization: 'Bearer token', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        month: '2024-01', bank: 'hdfc', account_type: 'debit',
        transactions: [{ date: '2024-01-01', amount: 500, type: 'debit', description: 'ATM withdrawal', upi_ref: null }],
      }),
    })
    const res = await POST(req)
    const data = await res.json()
    expect(res.status).toBe(200)
    expect(data.analysis).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to see them fail**

```bash
npm test tests/api/analyse.test.ts 2>&1 | tail -20
```

Expected: card_name/last_four test fails (not in schema yet), UPI fallback test fails.

- [ ] **Step 3: Update `app/api/analyse/route.ts`**

Update the schema and two sections. The changes are:

1. Add `card_name` and `last_four` to `AnalyseRequestSchema` (after `account_type` line):
```ts
  card_name: z.string().nullable().optional(),
  last_four: z.string().nullable().optional(),
```

2. Destructure them from `parsed.data` (after the existing destructuring):
```ts
  const { month, bank, account_type, transactions: rawTxs } = parsed.data
  const rawText = parsed.data.raw_text
  const cardName = parsed.data.card_name ?? null
  const lastFour = parsed.data.last_four ?? null
```

3. Add to the `dbInsert<Statement>` call (after `currency: 'INR'`):
```ts
      card_name: cardName,
      last_four: lastFour,
```

4. Replace the `upiTxs` block (lines ~157-163) with VPA fallback logic:
```ts
    // Use upi_ref (not upi_merchant) to detect UPI transactions
    // Fall back to the raw VPA as merchant name if AI resolution produced null
    const upiTxs = debits.filter((tx) => tx.upi_ref !== null)
    const upiMerchantTotalsMap = new Map<string, { total: number; count: number }>()
    for (const tx of upiTxs) {
      const name = tx.upi_merchant ?? tx.upi_ref!
      const prev = upiMerchantTotalsMap.get(name) ?? { total: 0, count: 0 }
      upiMerchantTotalsMap.set(name, { total: prev.total + tx.amount, count: prev.count + 1 })
    }
```

5. Update `upi_summary.total_spent` line:
```ts
        total_spent: upiTxs.reduce((s, tx) => s + tx.amount, 0),
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/api/analyse.test.ts 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add app/api/analyse/route.ts tests/api/analyse.test.ts
git commit -m "feat(analyse): accept card fields, fix UPI detection to use upi_ref with VPA fallback"
```

---

## Task 6: Update `confirm-modal.tsx`

**Files:**
- Modify: `components/upload/confirm-modal.tsx`
- Modify: `tests/components/confirm-modal.test.tsx`

- [ ] **Step 1: Write failing tests for card row rendering**

In `tests/components/confirm-modal.test.tsx`, add these tests after the existing ones (keep all existing tests, append):

```ts
  it('shows card row with card_name and masked last_four when both present', () => {
    render(
      <ConfirmModal
        {...defaultProps()}
        isOpen={true}
        detection={{ bank: 'hdfc', month: '2025-01', account_type: 'credit', card_name: 'Regalia', last_four: '1234' }}
      />,
    )
    expect(screen.getByTestId('card-row')).toHaveTextContent('Regalia ••••1234')
  })

  it('shows card row with only masked last_four when card_name is null', () => {
    render(
      <ConfirmModal
        {...defaultProps()}
        isOpen={true}
        detection={{ bank: 'hdfc', month: '2025-01', account_type: 'credit', card_name: null, last_four: '5678' }}
      />,
    )
    expect(screen.getByTestId('card-row')).toHaveTextContent('••••5678')
  })

  it('hides card row when both card_name and last_four are null', () => {
    render(
      <ConfirmModal
        {...defaultProps()}
        isOpen={true}
        detection={{ bank: 'hdfc', month: '2025-01', account_type: 'credit', card_name: null, last_four: null }}
      />,
    )
    expect(screen.queryByTestId('card-row')).not.toBeInTheDocument()
  })
```

Also update `DETECTION_HDFC` and `DETECTION_UNKNOWN` fixtures at the top of the file to include the new fields:

```ts
const DETECTION_HDFC: DetectionResult = {
  bank: 'hdfc',
  month: '2025-01',
  account_type: 'debit',
  card_name: null,
  last_four: null,
}

const DETECTION_UNKNOWN: DetectionResult = {
  bank: null,
  month: '2025-02',
  account_type: 'credit',
  card_name: null,
  last_four: null,
}
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/components/confirm-modal.test.tsx 2>&1 | tail -20
```

Expected: 3 new tests fail (card-row testid not found).

- [ ] **Step 3: Add card row to `confirm-modal.tsx`**

In the `<div className="mb-4 space-y-2">` block, add after the existing `<p>` elements (after the Account Type `<p>`, before the closing `</div>`):

```tsx
          {(detection?.card_name ?? detection?.last_four) && (
            <p className="text-sm" style={{ color: 'var(--muted)' }} data-testid="card-row">
              <span className="font-medium" style={{ color: 'var(--text)' }}>
                Card:
              </span>{' '}
              {[
                detection?.card_name,
                detection?.last_four ? `••••${detection.last_four}` : null,
              ]
                .filter(Boolean)
                .join(' ')}
            </p>
          )}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/components/confirm-modal.test.tsx 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/upload/confirm-modal.tsx tests/components/confirm-modal.test.tsx
git commit -m "feat(confirm-modal): show card name and last four digits"
```

---

## Task 7: Update `filter-bar.tsx` with card pill row

**Files:**
- Modify: `components/dashboard/filter-bar.tsx`
- Create: `tests/components/filter-bar.test.tsx`

- [ ] **Step 1: Write failing tests**

Create `tests/components/filter-bar.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '@/components/dashboard/filter-bar'
import type { FilterState, CardDescriptor } from '@/lib/dashboard-data'

const defaultFilter: FilterState = { month: null, bank: null, statement_id: null }

const twoHdfcCards: CardDescriptor[] = [
  { statement_id: 'stmt-a', bank: 'hdfc', card_name: 'Regalia', last_four: '1234' },
  { statement_id: 'stmt-b', bank: 'hdfc', card_name: 'Millennia', last_four: '5678' },
]

describe('FilterBar — card pills', () => {
  it('renders a card pill for each available card', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={defaultFilter}
        onChange={onChange}
      />,
    )
    expect(screen.getByTestId('card-all')).toBeInTheDocument()
    expect(screen.getByTestId('card-filter-stmt-a')).toHaveTextContent('HDFC Regalia ••••1234')
    expect(screen.getByTestId('card-filter-stmt-b')).toHaveTextContent('HDFC Millennia ••••5678')
  })

  it('card pill shows only bank and last four when card_name is null', () => {
    const onChange = vi.fn()
    const cards: CardDescriptor[] = [
      { statement_id: 'stmt-x', bank: 'icici', card_name: null, last_four: '9999' },
    ]
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['icici']}
        availableCards={cards}
        filter={defaultFilter}
        onChange={onChange}
      />,
    )
    expect(screen.getByTestId('card-filter-stmt-x')).toHaveTextContent('ICICI ••••9999')
  })

  it('card pill shows bank + Card when both card_name and last_four are null', () => {
    const onChange = vi.fn()
    const cards: CardDescriptor[] = [
      { statement_id: 'stmt-y', bank: 'sbi', card_name: null, last_four: null },
    ]
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['sbi']}
        availableCards={cards}
        filter={defaultFilter}
        onChange={onChange}
      />,
    )
    expect(screen.getByTestId('card-filter-stmt-y')).toHaveTextContent('SBI Card')
  })

  it('clicking a card pill calls onChange with statement_id and matching bank', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={defaultFilter}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByTestId('card-filter-stmt-a'))
    expect(onChange).toHaveBeenCalledWith({
      month: null,
      bank: 'hdfc',
      statement_id: 'stmt-a',
    })
  })

  it('clicking All cards resets statement_id to null', () => {
    const onChange = vi.fn()
    const filter: FilterState = { month: null, bank: 'hdfc', statement_id: 'stmt-a' }
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={filter}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByTestId('card-all'))
    expect(onChange).toHaveBeenCalledWith({ month: null, bank: 'hdfc', statement_id: null })
  })

  it('clicking a bank pill resets statement_id to null', () => {
    const onChange = vi.fn()
    const filter: FilterState = { month: null, bank: 'hdfc', statement_id: 'stmt-a' }
    render(
      <FilterBar
        availableMonths={['2025-01']}
        availableBanks={['hdfc', 'icici']}
        availableCards={twoHdfcCards}
        filter={filter}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByTestId('bank-filter-icici'))
    expect(onChange).toHaveBeenCalledWith({ month: null, bank: 'icici', statement_id: null })
  })

  it('card row shows only cards matching selected bank', () => {
    const onChange = vi.fn()
    const mixedCards: CardDescriptor[] = [
      { statement_id: 'stmt-hdfc', bank: 'hdfc', card_name: null, last_four: '1111' },
      { statement_id: 'stmt-icici', bank: 'icici', card_name: null, last_four: '2222' },
    ]
    const filter: FilterState = { month: null, bank: 'hdfc', statement_id: null }
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc', 'icici']}
        availableCards={mixedCards}
        filter={filter}
        onChange={onChange}
      />,
    )
    expect(screen.getByTestId('card-filter-stmt-hdfc')).toBeInTheDocument()
    expect(screen.queryByTestId('card-filter-stmt-icici')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test tests/components/filter-bar.test.tsx 2>&1 | tail -20
```

Expected: file not importable or all tests fail — `availableCards` prop doesn't exist yet.

- [ ] **Step 3: Rewrite `components/dashboard/filter-bar.tsx`**

```tsx
'use client'

import { useCallback, type MouseEvent } from 'react'
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

const PILL_CLASS = 'px-3 py-1.5 text-sm rounded-full font-medium cursor-pointer border whitespace-nowrap select-none inline-flex items-center'

function pillStyle(active: boolean): Record<string, string> {
  return active
    ? { background: 'var(--primary)', color: '#ffffff', borderColor: 'var(--primary)' }
    : { background: '#ffffff', color: 'var(--muted)', borderColor: 'var(--border)' }
}

export function FilterBar({ availableMonths, availableBanks, availableCards, filter, onChange }: FilterBarProps): JSX.Element {
  const visibleCards = filter.bank !== null
    ? availableCards.filter((c) => c.bank === filter.bank)
    : availableCards

  const handleMonthAll = useCallback((): void => {
    onChange({ ...filter, month: null })
  }, [filter, onChange])

  const handleBankAll = useCallback((): void => {
    onChange({ ...filter, bank: null, statement_id: null })
  }, [filter, onChange])

  const handleCardAll = useCallback((): void => {
    onChange({ ...filter, statement_id: null })
  }, [filter, onChange])

  const handleMonthClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>): void => {
      const month = e.currentTarget.dataset.month
      if (month) onChange({ ...filter, month })
    },
    [filter, onChange],
  )

  const handleBankClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>): void => {
      const bank = e.currentTarget.dataset.bank as BankSlug | undefined
      if (bank) onChange({ ...filter, bank, statement_id: null })
    },
    [filter, onChange],
  )

  const handleCardClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>): void => {
      const statementId = e.currentTarget.dataset.statementId
      const bank = e.currentTarget.dataset.bank as BankSlug | undefined
      if (statementId && bank) onChange({ ...filter, bank, statement_id: statementId })
    },
    [filter, onChange],
  )

  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Dashboard filters">
      {/* Month pills */}
      <div className="filter-bar-scroll flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          className={PILL_CLASS}
          style={pillStyle(filter.month === null)}
          aria-pressed={filter.month === null}
          data-testid="month-all"
          onClick={handleMonthAll}
        >
          All months
        </button>
        {availableMonths.map((month) => (
          <button
            key={month}
            type="button"
            className={PILL_CLASS}
            style={pillStyle(filter.month === month)}
            aria-pressed={filter.month === month}
            data-testid={`month-filter-${month}`}
            data-month={month}
            onClick={handleMonthClick}
          >
            {formatMonth(month)}
          </button>
        ))}
      </div>

      {/* Bank pills */}
      <div className="filter-bar-scroll flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          className={PILL_CLASS}
          style={pillStyle(filter.bank === null)}
          aria-pressed={filter.bank === null}
          data-testid="bank-all"
          onClick={handleBankAll}
        >
          All banks
        </button>
        {availableBanks.map((bank) => (
          <button
            key={bank}
            type="button"
            className={PILL_CLASS}
            style={pillStyle(filter.bank === bank && filter.statement_id === null)}
            aria-pressed={filter.bank === bank && filter.statement_id === null}
            data-testid={`bank-filter-${bank}`}
            data-bank={bank}
            onClick={handleBankClick}
          >
            {bank.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Card pills */}
      {availableCards.length > 0 && (
        <div className="filter-bar-scroll flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            className={PILL_CLASS}
            style={pillStyle(filter.statement_id === null)}
            aria-pressed={filter.statement_id === null}
            data-testid="card-all"
            onClick={handleCardAll}
          >
            All cards
          </button>
          {visibleCards.map((card) => (
            <button
              key={card.statement_id}
              type="button"
              className={PILL_CLASS}
              style={pillStyle(filter.statement_id === card.statement_id)}
              aria-pressed={filter.statement_id === card.statement_id}
              data-testid={`card-filter-${card.statement_id}`}
              data-statement-id={card.statement_id}
              data-bank={card.bank}
              onClick={handleCardClick}
            >
              {formatCardLabel(card)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test tests/components/filter-bar.test.tsx 2>&1 | tail -20
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/filter-bar.tsx tests/components/filter-bar.test.tsx
git commit -m "feat(filter-bar): add card pill row with per-card filtering"
```

---

## Task 8: Wire up `dashboard-shell.tsx` and `page.tsx`

**Files:**
- Modify: `components/dashboard/dashboard-shell.tsx`
- Modify: `app/page.tsx`
- Modify: `tests/components/dashboard-shell.test.tsx`

- [ ] **Step 1: Check existing dashboard-shell tests**

```bash
cat tests/components/dashboard-shell.test.tsx
```

Note which lines construct `FilterState` — they need `statement_id: null` added.

- [ ] **Step 2: Update `components/dashboard/dashboard-shell.tsx`**

Replace the entire file:

```tsx
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
import { InsightsStrip } from '@/components/dashboard/insights-strip'

export interface DashboardShellProps {
  data: DashboardData
  filter: FilterState
  onFilterChange: (filter: FilterState) => void
  isLoading: boolean
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
      style={{ background: 'var(--background)' }}
      data-testid="dashboard-shell"
    >
      <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-6">
        <div>
          <h1 className="font-bold text-2xl" style={{ color: 'var(--text)' }}>
            ClearSpend
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Your money, finally legible.
          </p>
        </div>

        <FilterBar
          availableMonths={availableMonths}
          availableBanks={availableBanks}
          availableCards={availableCards}
          filter={filter}
          onChange={onFilterChange}
        />

        <KpiCards metrics={kpiMetrics} isLoading={isLoading} />

        <SpendTrendChart data={trendData} isLoading={isLoading} />

        <UpiChart analyses={filteredAnalyses} isLoading={isLoading} />

        <InsightsStrip analyses={filteredAnalyses} isLoading={isLoading} />
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Update `app/page.tsx` initial FilterState**

Find this line in `app/page.tsx`:
```ts
  const [filter, setFilter] = useState<FilterState>({ month: null, bank: null })
```

Change it to:
```ts
  const [filter, setFilter] = useState<FilterState>({ month: null, bank: null, statement_id: null })
```

- [ ] **Step 4: Update dashboard-shell tests to add `statement_id: null` to any `FilterState` fixtures**

Open `tests/components/dashboard-shell.test.tsx` and find every occurrence of `{ month: null, bank: null }` or any `FilterState` literal. Add `statement_id: null` to each one.

- [ ] **Step 5: Run the full test suite**

```bash
npm test 2>&1 | tail -30
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/dashboard-shell.tsx app/page.tsx tests/components/dashboard-shell.test.tsx
git commit -m "feat(dashboard-shell): wire availableCards to FilterBar, update FilterState init"
```

---

## Task 9: Fix `tests/utils/factories.ts` and remaining broken fixtures

**Files:**
- Modify: `tests/utils/factories.ts`
- Modify: any remaining test files with stale `Statement` fixtures

- [ ] **Step 1: Run the full test suite and note any remaining failures**

```bash
npm test 2>&1 | grep -E "FAIL|×|✗" | head -30
```

- [ ] **Step 2: Add `makeStatement` to `tests/utils/factories.ts`**

Add to `tests/utils/factories.ts`:

```ts
import type { Analysis, Statement } from '@/types'

export function makeStatement(overrides: Partial<Statement> = {}): Statement {
  return {
    id: 's1',
    month: '2025-01',
    bank: 'hdfc',
    account_type: 'credit',
    transaction_count: 5,
    total_debit: 1000,
    total_credit: 0,
    currency: 'INR',
    uploaded_at: '2025-01-31T00:00:00Z',
    card_name: null,
    last_four: null,
    ...overrides,
  }
}

export function makeAnalysis(overrides: Partial<Analysis> = {}): Analysis {
  return {
    id: 'a1',
    statement_id: 's1',
    month: '2025-01',
    category_breakdown: {},
    top_merchants: [],
    upi_summary: {
      total_spent: 0,
      merchant_breakdown: [],
    },
    monthly_total: 0,
    insights: [],
    generated_at: '2025-01-31T00:00:00Z',
    ...overrides,
  }
}
```

- [ ] **Step 3: Fix any remaining test failures found in Step 1**

For each failing test file, add `card_name: null, last_four: null` to any inline `Statement` literals, and `statement_id: null` to any `FilterState` literals.

- [ ] **Step 4: Run the full test suite**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests pass, 0 failures.

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "test: update fixtures with card_name, last_four, statement_id fields"
```

---

## Task 10: Build, verify, deploy

- [ ] **Step 1: Run full test suite one final time**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 2: Build using the correct command**

```bash
node_modules/.bin/next build 2>&1 | tail -20
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Verify client bundle includes card fields**

```bash
grep -l "last_four\|card_name" .next/static/chunks/app/page-*.js 2>/dev/null | head -3
```

Expected: at least one file found.

- [ ] **Step 4: Sync build artifacts to deploy branch**

```bash
rsync -a --delete .next/standalone/ /tmp/clearspend-standalone/
rsync -a --delete .next/static/ /tmp/clearspend-static/
git checkout deploy
rsync -a --delete /tmp/clearspend-standalone/ .next/standalone/
rsync -a --delete /tmp/clearspend-static/ .next/static/
git add -f .next/standalone .next/static
git commit -m "deploy: card identity, UPI fix, NaN fix — build from main"
git push origin deploy
```

- [ ] **Step 5: Switch back to main**

```bash
git checkout main
```
