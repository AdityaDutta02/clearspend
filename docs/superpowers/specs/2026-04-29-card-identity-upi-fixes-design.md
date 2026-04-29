# Design: Card Identity, Multi-Card Support, UPI Fix, NaN Fix

**Date:** 2026-04-29
**Status:** Approved

## Problem Areas

1. Bank/name extraction fails on some PDFs — no filename fallback
2. No card-level identity (card name, last four digits) — multiple cards from same bank indistinguishable
3. UPI VPA format not matched by current regex — UPI chart empty
4. Total spend shows garbage / avg spend shows NaN — DB returns numeric fields as strings

---

## 1. Data Model

### `types/index.ts`

Add to `Statement`:
```ts
card_name: string | null   // e.g. "Regalia", "Millennia" — null if unknown
last_four: string | null   // e.g. "1234" — null if unknown
```

Add to `ParsedStatement`:
```ts
card_name: string | null
last_four: string | null
```

### `lib/bank-detect.ts`

`DetectionResult` gains:
```ts
card_name: string | null
last_four: string | null
```

`detectBankAndMonth` signature changes to:
```ts
detectBankAndMonth(headerText: string, fileName?: string): DetectionResult
```

### `lib/dashboard-data.ts`

`FilterState` gains:
```ts
statement_id: string | null  // null = all cards
```

`FilterBarProps` gains:
```ts
availableCards: Array<{
  statement_id: string
  bank: BankSlug
  card_name: string | null
  last_four: string | null
}>
```

---

## 2. Extraction Pipeline (`lib/bank-detect.ts`)

Detection order — stop at first match for each field:

**Bank slug:**
1. Filename: regex against known bank slugs (`hdfc`, `icici`, `sbi`, `axis`, `kotak`, `yes`, `pnb`, `bob`, `canara`, `indusind`)
2. Header text: existing `BANK_PATTERNS` regex array

**Month:**
1. Filename: patterns like `dec2024`, `12-2024`, `2024-12`, `december_2024`
2. Header text: existing named + numeric month regex

**last_four:**
1. Header text: `\b(\d{4})\b` near keywords `card`, `account`, `ending`, `no.`, `number`
2. Filename: any 4-digit sequence

**card_name:**
1. Header text: scan for known product name list per bank:
   - HDFC: Regalia, Millennia, MoneyBack, Diners, Infinia, Freedom, Pixel, Tata Neu
   - ICICI: Coral, Sapphiro, Rubyx, Amazon Pay, MakeMyTrip, Emeralde
   - Axis: Flipkart, Magnus, Ace, Vistara, Reserve, Select
   - SBI: SimplyCLICK, SimplySAVE, Elite, Prime, Cashback
   - Kotak: League, Royale, White Reserve, Mojo
   - (others: skip for now, `null`)
2. Filename: same product name scan

All fields remain `null` if not found — no AI call, no errors thrown.

---

## 3. PDF Parser (`lib/pdf-parser.ts`)

- Pass `file.name` to `detectBankAndMonth`
- Propagate `card_name` and `last_four` into `ParsedStatement`
- Fix `extractUpiRef`:
  ```ts
  // Priority 1: VPA format (swiggy@sbi, 9876543210@ybl)
  const vpa = description.match(/([a-zA-Z0-9._\-]+@[a-zA-Z]{2,})/i)
  if (vpa) return vpa[1]
  // Priority 2: UPI followed by alphanumeric code
  const code = description.match(/UPI[\/\-\s]+([A-Z0-9]{6,})/i)
  return code ? code[1] : null
  ```

---

## 4. API Route (`app/api/analyse/route.ts`)

- `AnalyseRequestSchema` gains `card_name` and `last_four` (both optional string/null)
- Pass both through to `dbInsert<Statement>`
- `upiTxs` filter changed from `tx.upi_merchant` to `tx.upi_ref` so transactions with unresolved merchants still appear in `upi_summary` (raw VPA used as fallback name if `upi_merchant` is null)
- Coerce `category_breakdown` amounts via `Number()` before insertion

---

## 5. Filter Bar (`components/dashboard/filter-bar.tsx`)

Three pill rows:
1. **Month row** — unchanged
2. **Bank row** — unchanged, but selecting a bank filters the card row
3. **Card row** — new, shows cards for selected bank (or all if "All banks")

Card pill label logic:
- `card_name` + `last_four` → `HDFC Regalia ••••1234`
- `last_four` only → `HDFC ••••1234`
- Neither → `HDFC Card`

Interaction:
- Selecting a card pill sets `statement_id` and auto-sets `bank` to that card's bank
- Selecting "All cards" resets `statement_id` to `null`
- Selecting a bank pill resets `statement_id` to `null` (card row re-filters)
- Selecting "All banks" resets both `bank` and `statement_id` to `null`

---

## 6. Confirm Modal (`components/upload/confirm-modal.tsx`)

Add a row to the detection summary:
- `Card:` row showing `card_name` + masked `last_four` (e.g. `Regalia ••••1234`)
- If both null: row hidden

---

## 7. Dashboard Data (`lib/dashboard-data.ts`)

New export:
```ts
getAvailableCards(data: DashboardData): Array<{
  statement_id: string
  bank: BankSlug
  card_name: string | null
  last_four: string | null
}>
```

`filterAnalyses` updated — when `filter.statement_id` is set, filter to analyses whose `statement_id` matches.

`computeKpis` — coerce all numeric fields from DB:
```ts
Number(a.monthly_total) || 0
Number(a.upi_summary?.total_spent) || 0
```

---

## 8. UPI Fallback

If UPI resolution AI call fails or returns empty, `upi_merchant` stays null. `upi_summary.merchant_breakdown` uses raw `upi_ref` (VPA) as the merchant name for transactions where `upi_merchant` is null but `upi_ref` exists. This ensures the chart always shows something for UPI transactions.

---

## Files Changed

| File | Change |
|------|--------|
| `types/index.ts` | Add `card_name`, `last_four` to `Statement` + `ParsedStatement` |
| `lib/bank-detect.ts` | Add filename param, card_name/last_four extraction |
| `lib/pdf-parser.ts` | Pass filename, fix UPI regex, propagate card fields |
| `app/api/analyse/route.ts` | Accept card fields, fix upiTxs filter, coerce amounts |
| `lib/dashboard-data.ts` | Add `getAvailableCards`, update `filterAnalyses`, coerce in `computeKpis` |
| `components/upload/confirm-modal.tsx` | Show card row |
| `components/dashboard/filter-bar.tsx` | Add card pill row, update FilterBarProps |
| `components/dashboard/dashboard-shell.tsx` | Pass `availableCards` to FilterBar |
| `lib/ai/categorise.ts` | Coerce amounts from AI response |

---

## Out of Scope

- AI fallback for bank/month detection (deferred unless regex+filename fails frequently in production)
- Card deduplication across months (same card, different month statements correctly appear as separate statements — this is correct behaviour)
- Editing detected card name/last_four in the confirm modal (user can re-upload with a renamed file if needed)
