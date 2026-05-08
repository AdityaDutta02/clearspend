# ClearSpend UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete premium visual redesign of ClearSpend — new blue-slate token system, asymmetric KPI layout with a hero card, gradient spend chart, progress-bar UPI list, grid insights, and a bold header — while keeping every data flow, API call, and test ID exactly intact.

**Architecture:** Replace green token system with a considered blue-slate palette. Add a subtle top-of-page blue gradient wash. Use asymmetric `2fr 1fr 1fr 1fr` KPI grid (Total Spend is the hero). Use a `linearGradient` fill on the spend trend bars. Replace horizontal insights scroll with a responsive grid. Zero changes to lib/, hooks/, or API layer.

**Tech Stack:** Next.js 14 App Router, Framer Motion, Recharts, Plus Jakarta Sans, Tailwind CSS v3 + CSS custom properties.

---

## File Map

| File | Change |
|---|---|
| `app/globals.css` | New token system, asymmetric kpi-row grid, hero card class, page gradient |
| `app/page.tsx` | Update loading shimmer classes, tighten top padding |
| `components/dashboard/dashboard-shell.tsx` | New layout: bold header → KPI row → filter → 2-col chart → UPI → insights |
| `components/dashboard/kpi-cards.tsx` | Asymmetric 4-card row: Total Spend hero (2fr wide), 3 smaller KPIs, bigger numbers |
| `components/dashboard/spend-trend-chart.tsx` | Monthly totals + SVG linearGradient bar fill + avg reference line |
| `components/dashboard/category-chart.tsx` | Update cursor tint from green to slate |
| `components/dashboard/upi-chart.tsx` | Ranked list with progress bars (remove Recharts BarChart) |
| `components/dashboard/insights-strip.tsx` | Responsive 2–3 col grid (remove horizontal scroll) |
| `components/dashboard/filter-bar.tsx` | Update pill shadow from green to blue |
| `components/upload/upload-zone.tsx` | Update drag-over tint from green to blue |
| `components/upload/confirm-modal.tsx` | Update backdrop + button shadow from green to blue |

---

## Task 1: New Design Token System (globals.css)

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Replace the entire contents of `app/globals.css`**

```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap');

@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Surfaces */
  --bg: #F8FAFC;
  --surface: #FFFFFF;
  --surface-raised: #F1F5F9;
  --surface-hover: #EFF6FF;

  /* Typography */
  --text: #0F172A;
  --text-secondary: #334155;
  --muted: #64748B;

  /* Accent — blue */
  --primary: #2563EB;
  --primary-light: #3B82F6;
  --primary-subtle: rgba(37, 99, 235, 0.07);
  --primary-border: rgba(37, 99, 235, 0.2);

  /* Semantic */
  --accent-positive: #059669;
  --accent-negative: #DC2626;
  --accent-negative-subtle: rgba(220, 38, 38, 0.07);

  /* Borders */
  --border: rgba(15, 23, 42, 0.07);
  --border-medium: rgba(15, 23, 42, 0.13);

  /* Shadows — layered, ambient, blue-tinted */
  --shadow-card:
    0 0 0 1px rgba(15, 23, 42, 0.05),
    0 1px 3px rgba(15, 23, 42, 0.04),
    0 4px 16px rgba(15, 23, 42, 0.04);
  --shadow-card-hover:
    0 0 0 1px rgba(15, 23, 42, 0.07),
    0 2px 8px rgba(15, 23, 42, 0.06),
    0 12px 32px rgba(15, 23, 42, 0.07);
  --shadow-elevated:
    0 0 0 1px rgba(15, 23, 42, 0.06),
    0 4px 12px rgba(15, 23, 42, 0.06),
    0 20px 48px rgba(15, 23, 42, 0.08);
  --shadow-modal:
    0 0 0 1px rgba(15, 23, 42, 0.08),
    0 8px 24px rgba(15, 23, 42, 0.09),
    0 40px 100px rgba(15, 23, 42, 0.14);
}

/* ─── Base ─────────────────────────────────────────── */
html,
body {
  min-height: 100dvh;
  background: var(--bg);
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 100;
  opacity: 0.014;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23noise)'/%3E%3C/svg%3E");
}

/* ─── Card ──────────────────────────────────────────── */
.card {
  background: var(--surface);
  border-radius: 1rem;
  box-shadow: var(--shadow-card);
  border: 1px solid var(--border);
  padding: 24px;
  position: relative;
  transition: box-shadow 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 1);
  pointer-events: none;
  z-index: 1;
}

/* ─── KPI card (standard) ───────────────────────────── */
.kpi-card {
  background: var(--surface);
  border-radius: 1rem;
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  position: relative;
  overflow: hidden;
  min-width: 0;
  transition: box-shadow 0.25s cubic-bezier(0.32, 0.72, 0, 1), transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
}

.kpi-card::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 1);
  pointer-events: none;
}

.kpi-card:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-1px);
}

/* ─── KPI hero card (Total Spend — wider, accented) ─── */
.kpi-card-hero {
  background: linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, #ffffff 55%);
  border-left: 3px solid var(--primary);
  padding: 22px 24px;
}

.kpi-card-hero:hover {
  box-shadow: var(--shadow-card-hover);
  transform: translateY(-1px);
}

/* ─── KPI row (asymmetric: hero 2fr + 3 equal 1fr) ──── */
.kpi-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

@media (min-width: 768px) {
  .kpi-row {
    grid-template-columns: 2fr 1fr 1fr 1fr;
  }
}

/* ─── Stat badge ────────────────────────────────────── */
.stat-badge {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1.4;
}

.stat-badge-positive {
  background: rgba(5, 150, 105, 0.1);
  color: var(--accent-positive);
}

.stat-badge-negative {
  background: rgba(220, 38, 38, 0.1);
  color: var(--accent-negative);
}

.stat-badge-neutral {
  background: rgba(100, 116, 139, 0.1);
  color: var(--muted);
}

/* ─── Bento main (chart + category) ────────────────── */
.bento-main {
  display: grid;
  grid-template-columns: 1fr;
  gap: 16px;
}

@media (min-width: 768px) {
  .bento-main {
    grid-template-columns: 3fr 2fr;
    align-items: stretch;
  }
}

/* ─── Insights grid ──────────────────────────────────── */
.insights-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 640px) {
  .insights-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1024px) {
  .insights-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

/* ─── Scroll-reveal animations ──────────────────────── */
@keyframes reveal-up {
  from { opacity: 0; transform: translateY(14px); }
  to   { opacity: 1; transform: translateY(0); }
}

.reveal { animation: reveal-up 0.55s cubic-bezier(0.32, 0.72, 0, 1) both; }
.reveal-d1 { animation-delay: 0.06s; }
.reveal-d2 { animation-delay: 0.12s; }
.reveal-d3 { animation-delay: 0.18s; }
.reveal-d4 { animation-delay: 0.24s; }
.reveal-d5 { animation-delay: 0.30s; }

/* ─── Pill / chip ───────────────────────────────────── */
.pill {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 5px 14px;
  border-radius: 999px;
  font-size: 0.775rem;
  font-weight: 600;
  font-family: inherit;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid transparent;
  background: none;
  transition: color 0.22s cubic-bezier(0.32, 0.72, 0, 1);
  user-select: none;
}

.pill-inactive {
  background: rgba(15, 23, 42, 0.05);
  color: var(--muted);
  border-color: transparent;
}

.pill-inactive:hover {
  background: rgba(15, 23, 42, 0.08);
  color: var(--text-secondary);
}

/* ─── Eyebrow tag ───────────────────────────────────── */
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

/* ─── Progress bar ──────────────────────────────────── */
.progress-track {
  width: 100%;
  height: 4px;
  background: var(--border);
  border-radius: 999px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.7s cubic-bezier(0.32, 0.72, 0, 1);
}

/* ─── Recharts overrides ────────────────────────────── */
.recharts-default-tooltip { display: none !important; }
.recharts-tooltip-wrapper { outline: none !important; }
.recharts-cartesian-axis-tick-value {
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif !important;
}

/* ─── Filter bar scrollbar ──────────────────────────── */
.filter-bar-scroll { scrollbar-width: none; }
.filter-bar-scroll::-webkit-scrollbar { display: none; }

/* ─── Utilities ─────────────────────────────────────── */
.tabular { font-variant-numeric: tabular-nums; }

/* ─── Responsive ─────────────────────────────────────── */
@media (max-width: 640px) {
  .card { padding: 16px; border-radius: 0.875rem; }
  .kpi-card { padding: 14px 16px; }
  .kpi-card-hero { padding: 16px 18px; }
}

/* ─── Reduced motion ─────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd "/Users/aditya/Documents/Coding Projects/terminal-ai-testing/credit-report-analysis"
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "refactor(ui): replace green tokens with blue-slate palette + asymmetric kpi-row"
```

---

## Task 2: KPI Cards — Asymmetric Hero Layout

**Files:**
- Modify: `components/dashboard/kpi-cards.tsx`

The new layout: `kpi-row` grid is `2fr 1fr 1fr 1fr` on desktop. Total Spend takes the `2fr` column with `.kpi-card-hero` class (gradient bg, left accent border). The other 3 use standard `.kpi-card`. KPI numbers at `clamp(1.6rem, 3.2vw, 2rem)` — data is the product, make it readable.

- [ ] **Step 1: Replace the full contents of `components/dashboard/kpi-cards.tsx`**

```tsx
'use client'

import { motion } from 'framer-motion'
import type { CategorySlug } from '@/types'
import type { KpiMetrics } from '@/lib/dashboard-data'

export interface KpiCardsProps {
  metrics: KpiMetrics
  isLoading: boolean
}

const CATEGORY_DISPLAY_NAMES: Record<CategorySlug, string> = {
  food: 'Food & Dining',
  groceries: 'Groceries',
  transport: 'Transport',
  shopping: 'Shopping',
  emi_loans: 'EMI Loans',
  utilities: 'Bills & Subs',
  entertainment: 'Entertainment',
  health: 'Health',
  travel: 'Travel',
  others: 'Others',
}

function formatInr(amount: number): string {
  return `₹${amount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
}

function formatInrShort(amount: number): string {
  if (amount >= 100000) {
    const l = amount / 100000
    return `₹${Number.isInteger(l) ? l : l.toFixed(1)}L`
  }
  if (amount >= 1000) return `₹${Math.round(amount / 1000)}K`
  return `₹${amount}`
}

function ShimmerLine({ width = '70%', height = '2rem' }: { width?: string; height?: string }): JSX.Element {
  return (
    <div
      className="animate-pulse rounded-lg"
      style={{ height, width, background: 'var(--border)' }}
      aria-hidden="true"
    />
  )
}

const cardVariants = {
  hidden: { opacity: 0, y: 14, scale: 0.98 },
  visible: (i: number) => ({
    opacity: 1, y: 0, scale: 1,
    transition: { delay: i * 0.06, duration: 0.45, ease: [0.32, 0.72, 0, 1] as [number, number, number, number] },
  }),
}

function AvgIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  )
}

function CategoryIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}

function TrendIcon(): JSX.Element {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
    </svg>
  )
}

function KpiIconBadge({ children }: { children: React.ReactNode }): JSX.Element {
  return (
    <div style={{
      width: 26, height: 26, borderRadius: '8px',
      background: 'var(--primary-subtle)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--primary)', flexShrink: 0,
    }}>
      {children}
    </div>
  )
}

export function KpiCards({ metrics, isLoading }: KpiCardsProps): JSX.Element {
  const { totalSpend, avgMonthlySpend, topCategory, topCategoryAmount, monthOverMonthChange } = metrics

  const momIsPositive = monthOverMonthChange !== null && monthOverMonthChange >= 0
  const momBadgeClass = monthOverMonthChange === null
    ? 'stat-badge stat-badge-neutral'
    : momIsPositive ? 'stat-badge stat-badge-negative' : 'stat-badge stat-badge-positive'
  const momSign = momIsPositive ? '+' : ''

  const bigNumStyle: React.CSSProperties = {
    fontSize: 'clamp(1.5rem, 3.2vw, 2rem)',
    fontWeight: 800,
    letterSpacing: '-0.04em',
    lineHeight: 1.05,
    color: 'var(--text)',
  }

  const smallNumStyle: React.CSSProperties = {
    fontSize: 'clamp(1.2rem, 2.4vw, 1.55rem)',
    fontWeight: 800,
    letterSpacing: '-0.035em',
    lineHeight: 1.1,
    color: 'var(--text)',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: '0.62rem',
    fontWeight: 700,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.1em',
    color: 'var(--muted)',
  }

  return (
    <div className="kpi-row">

      {/* ── Total Spend — hero card ── */}
      <motion.div
        custom={0}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="kpi-card kpi-card-hero"
        data-testid="kpi-total-spend"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={labelStyle}>Total Spend</p>
          <div style={{
            width: 28, height: 28, borderRadius: '8px',
            background: 'rgba(37, 99, 235, 0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--primary)',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
            </svg>
          </div>
        </div>
        {isLoading ? (
          <ShimmerLine height="2.5rem" />
        ) : (
          <>
            <p className="tabular" style={bigNumStyle}>{formatInr(totalSpend)}</p>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 500 }}>
              across all statements
            </p>
          </>
        )}
      </motion.div>

      {/* ── Avg / Month ── */}
      <motion.div
        custom={1}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="kpi-card"
        data-testid="kpi-avg-monthly"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={labelStyle}>Avg / Month</p>
          <KpiIconBadge><AvgIcon /></KpiIconBadge>
        </div>
        {isLoading ? <ShimmerLine /> : (
          <p className="tabular" style={smallNumStyle}>{formatInr(avgMonthlySpend)}</p>
        )}
      </motion.div>

      {/* ── Top Category ── */}
      <motion.div
        custom={2}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="kpi-card"
        data-testid="kpi-top-category"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={labelStyle}>Top Category</p>
          <KpiIconBadge><CategoryIcon /></KpiIconBadge>
        </div>
        {isLoading ? <ShimmerLine width="60%" height="1.5rem" /> : (
          <>
            <p style={{ fontSize: 'clamp(0.9rem, 1.8vw, 1.05rem)', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)' }}>
              {topCategory !== null ? CATEGORY_DISPLAY_NAMES[topCategory] : '—'}
            </p>
            {topCategory !== null && (
              <p className="tabular" style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 500 }}>
                {formatInrShort(topCategoryAmount)}
              </p>
            )}
          </>
        )}
      </motion.div>

      {/* ── vs Last Month ── */}
      <motion.div
        custom={3}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="kpi-card"
        data-testid="kpi-mom-change"
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={labelStyle}>vs Last Month</p>
          <KpiIconBadge><TrendIcon /></KpiIconBadge>
        </div>
        {isLoading ? <ShimmerLine width="55%" /> : monthOverMonthChange === null ? (
          <p style={{ ...smallNumStyle, color: 'var(--muted)' }}>—</p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <p className="tabular" style={smallNumStyle} data-testid="kpi-mom-value">
              {`${momSign}${monthOverMonthChange.toFixed(1)}%`}
            </p>
            <span className={momBadgeClass}>{momIsPositive ? '↑' : '↓'}</span>
          </div>
        )}
      </motion.div>

    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/kpi-cards.tsx
git commit -m "refactor(ui): asymmetric KPI hero card (2fr) + larger numbers, blue accent"
```

---

## Task 3: Spend Trend Chart — Monthly Bars + Gradient Fill

**Files:**
- Modify: `components/dashboard/spend-trend-chart.tsx`

One clean bar per month = total spend. SVG `<linearGradient>` for the bar fill (blue top → lighter blue bottom). Average reference line (dashed). On hover: tooltip shows full category breakdown. This replaces the 10-color stacked bar chart.

- [ ] **Step 1: Replace the full contents of `components/dashboard/spend-trend-chart.tsx`**

```tsx
'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
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

interface ChartRow {
  month: string
  total: number
  categories: Partial<Record<CategorySlug, number>>
}

function CustomTooltip({ active, payload }: TooltipProps<number, string>): JSX.Element | null {
  if (!active || !payload?.length) return null
  const row = payload[0].payload as ChartRow
  const catEntries = (Object.entries(row.categories ?? {}) as [CategorySlug, number][])
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border-medium)',
      borderRadius: '12px', padding: '14px 16px', boxShadow: 'var(--shadow-elevated)',
      minWidth: '200px', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
    }}>
      <p style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
        {row.month}
      </p>
      <p className="tabular" style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', marginBottom: '10px' }}>
        {formatInrShort(row.total)}
      </p>
      {catEntries.map(([slug, amount]) => (
        <div key={slug} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: CATEGORY_COLORS[slug], flexShrink: 0 }} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flex: 1 }}>
            {CATEGORY_DISPLAY_NAMES[slug]}
          </span>
          <span className="tabular" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text)' }}>
            {formatInrShort(amount)}
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
  const chartData: ChartRow[] = data.map((point) => ({
    month: formatMonth(point.month),
    total: point.total,
    categories: point.categories ?? {},
  }))

  const average = chartData.length > 0
    ? Math.round(chartData.reduce((s, d) => s + d.total, 0) / chartData.length)
    : 0

  return (
    <div className="card" style={{ height: '100%', minHeight: '300px', display: 'flex', flexDirection: 'column' }} data-testid="spend-trend-chart">

      <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
        <div>
          <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: '4px' }}>
            Over time
          </p>
          <p style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
            Monthly Spend
          </p>
        </div>
        {!isLoading && average > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'var(--primary-subtle)', borderRadius: '8px', padding: '5px 10px', flexShrink: 0 }}>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--primary)', whiteSpace: 'nowrap' }}>
              Avg {formatInrShort(average)}/mo
            </span>
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
        <div style={{ flex: 1, minHeight: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} barCategoryGap="40%" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="spendGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2563EB" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#93C5FD" stopOpacity={0.5} />
                </linearGradient>
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
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(15, 23, 42, 0.04)', radius: 6 }} />
              {average > 0 && (
                <ReferenceLine
                  y={average}
                  stroke="#2563EB"
                  strokeDasharray="4 4"
                  strokeOpacity={0.35}
                  strokeWidth={1.5}
                />
              )}
              <Bar
                dataKey="total"
                fill="url(#spendGradient)"
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/spend-trend-chart.tsx
git commit -m "refactor(ui): monthly spend bars with SVG gradient fill + avg reference line"
```

---

## Task 4: Category Chart — Update Cursor Tint

**Files:**
- Modify: `components/dashboard/category-chart.tsx`

One targeted change: update the green-tinted cursor fill to neutral slate.

- [ ] **Step 1: Update cursor color in category-chart.tsx**

Find:
```tsx
                cursor={{ fill: 'rgba(12, 30, 22, 0.04)', radius: 4 }}
```
Replace with:
```tsx
                cursor={{ fill: 'rgba(15, 23, 42, 0.04)', radius: 4 }}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/category-chart.tsx
git commit -m "refactor(ui): update category chart cursor to neutral slate tint"
```

---

## Task 5: UPI Chart — Ranked List with Progress Bars

**Files:**
- Modify: `components/dashboard/upi-chart.tsx`

Replace the Recharts `BarChart` entirely with a ranked list. Each merchant: rank badge (numbered circle in blue gradient) + name + amount + progress bar. Far more readable than a chart with 5 tiny bars. Keep `aggregateTopMerchants` logic identical. Keep `data-testid="upi-merchant-${m.name}"`.

- [ ] **Step 1: Replace the full contents of `components/dashboard/upi-chart.tsx`**

```tsx
'use client'

import type { Analysis } from '@/types'

export interface UpiChartProps {
  analyses: Analysis[]
  isLoading: boolean
}

interface MerchantTotal {
  name: string
  total: number
  rank: number
  share: number
}

function aggregateTopMerchants(analyses: Analysis[]): MerchantTotal[] {
  const totals = new Map<string, number>()

  for (const analysis of analyses) {
    for (const merchant of analysis.upi_summary?.merchant_breakdown ?? []) {
      totals.set(merchant.name, (totals.get(merchant.name) ?? 0) + merchant.total)
    }
  }

  const sorted = Array.from(totals.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const max = sorted[0]?.total ?? 1

  return sorted.map((m, i) => ({
    name: m.name,
    total: m.total,
    rank: i + 1,
    share: Math.round((m.total / max) * 100),
  }))
}

function formatInrShort(amount: number): string {
  if (amount >= 100000) {
    const l = amount / 100000
    return `₹${Number.isInteger(l) ? l : l.toFixed(1)}L`
  }
  if (amount >= 1000) return `₹${Math.round(amount / 1000)}K`
  return `₹${amount}`
}

const RANK_COLORS = ['#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD']

function ShimmerBlock(): JSX.Element {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true" data-testid="shimmer-block">
      {[100, 80, 62, 48, 34].map((w, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex justify-between">
            <div className="animate-pulse rounded-md" style={{ height: '12px', width: `${w * 0.6}%`, background: 'var(--border)' }} />
            <div className="animate-pulse rounded-md" style={{ height: '12px', width: '44px', background: 'var(--border)' }} />
          </div>
          <div className="animate-pulse rounded-full" style={{ height: '4px', width: `${w}%`, background: 'var(--border)' }} />
        </div>
      ))}
    </div>
  )
}

export function UpiChart({ analyses, isLoading }: UpiChartProps): JSX.Element {
  const merchants = aggregateTopMerchants(analyses)

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }} data-testid="upi-chart">

      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: '4px' }}>
          UPI
        </p>
        <p style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          Top UPI Merchants
        </p>
      </div>

      {isLoading ? (
        <ShimmerBlock />
      ) : merchants.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No UPI transactions found</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {merchants.map((m) => (
            <div key={m.name} data-testid={`upi-merchant-${m.name}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: RANK_COLORS[m.rank - 1] ?? '#94a3b8',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6rem', fontWeight: 800, color: '#fff', flexShrink: 0,
                  }}>
                    {m.rank}
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}
                  </span>
                </div>
                <span className="tabular" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', flexShrink: 0, marginLeft: '8px' }}>
                  {formatInrShort(m.total)}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${m.share}%`, background: RANK_COLORS[m.rank - 1] ?? '#94a3b8', opacity: 0.75 }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/upi-chart.tsx
git commit -m "refactor(ui): replace UPI bar chart with ranked list + progress bars"
```

---

## Task 6: Insights — Grid Layout

**Files:**
- Modify: `components/dashboard/insights-strip.tsx`

Remove `overflow-x-auto` horizontal scroll. Use `.insights-grid` (2-col sm+, 3-col lg+). Cap at 6 insights. Keep all Framer Motion stagger animations. Update insight icon to a cleaner circle-info shape.

- [ ] **Step 1: Replace the full contents of `components/dashboard/insights-strip.tsx`**

```tsx
'use client'

import { motion } from 'framer-motion'
import type { Analysis } from '@/types'

export interface InsightsStripProps {
  analyses: Analysis[]
  isLoading: boolean
}

const MAX_INSIGHTS = 6

function collectInsights(analyses: Analysis[]): string[] {
  const seen = new Set<string>()
  const result: string[] = []

  for (const analysis of analyses) {
    for (const insight of analysis.insights ?? []) {
      if (!seen.has(insight) && result.length < MAX_INSIGHTS) {
        seen.add(insight)
        result.push(insight)
      }
    }
  }

  return result
}

function InsightIcon(): JSX.Element {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10"/>
      <path d="M12 16v-4M12 8h.01"/>
    </svg>
  )
}

function ShimmerGrid(): JSX.Element {
  return (
    <div className="insights-grid" aria-hidden="true" data-testid="shimmer-block">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="animate-pulse rounded-2xl" style={{ height: '88px', background: 'var(--border)' }} />
      ))}
    </div>
  )
}

export function InsightsStrip({ analyses, isLoading }: InsightsStripProps): JSX.Element {
  const insights = collectInsights(analyses)

  return (
    <div className="card" data-testid="insights-strip">
      <div style={{ marginBottom: '18px' }}>
        <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: '4px' }}>
          Powered by AI
        </p>
        <p style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          Insights
        </p>
      </div>

      {isLoading ? (
        <ShimmerGrid />
      ) : insights.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
          No insights yet — upload a statement to get started.
        </p>
      ) : (
        <div className="insights-grid" role="list">
          {insights.map((insight, i) => (
            <motion.div
              key={insight}
              role="listitem"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
              data-testid="insight-card"
            >
              <div style={{
                background: 'var(--surface-raised)',
                borderRadius: '12px',
                padding: '14px 16px',
                display: 'flex',
                gap: '12px',
                alignItems: 'flex-start',
                border: '1px solid var(--border)',
                borderLeft: '3px solid var(--primary)',
                height: '100%',
              }}>
                <div style={{
                  width: 26, height: 26, borderRadius: '8px',
                  background: 'var(--primary-subtle)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, color: 'var(--primary)', marginTop: '1px',
                }}>
                  <InsightIcon />
                </div>
                <p style={{ fontSize: '0.78rem', lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0, letterSpacing: '-0.005em' }}>
                  {insight}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/insights-strip.tsx
git commit -m "refactor(ui): insights grid layout (remove horizontal scroll, max 6 cards)"
```

---

## Task 7: Filter Bar — Blue Accent

**Files:**
- Modify: `components/dashboard/filter-bar.tsx`

Update: replace all 4 occurrences of `boxShadow: '0 2px 10px rgba(4, 120, 87, 0.35)'` with the blue equivalent, and replace all `background: 'rgba(12, 30, 22, 0.04)'` inactive pill bg with neutral slate.

- [ ] **Step 1: Replace all green-specific values in filter-bar.tsx**

There are **4** `motion.span` active pill backgrounds (one in `Pill` component + 3 inline in the month/bank/card loops). All use:
```tsx
                    boxShadow: '0 2px 10px rgba(4, 120, 87, 0.35)',
```
Replace ALL 4 with:
```tsx
                    boxShadow: '0 2px 10px rgba(37, 99, 235, 0.25)',
```

There are **4** inactive button style backgrounds:
```tsx
              background: 'rgba(12, 30, 22, 0.04)',
```
Replace ALL 4 with:
```tsx
              background: 'rgba(15, 23, 42, 0.05)',
```

Use `replace_all: true` on each edit to catch every occurrence.

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/filter-bar.tsx
git commit -m "refactor(ui): update filter pill shadow and inactive bg to blue-slate"
```

---

## Task 8: Dashboard Shell — Bold Header + Page Gradient

**Files:**
- Modify: `components/dashboard/dashboard-shell.tsx`

New header: bold `clamp(2rem, 5vw, 3.2rem)` heading + "CLEARSPEND" eyebrow tag above it. Add a subtle `linear-gradient(180deg, #EFF6FF 0%, var(--bg) 220px)` wash to the `<main>` element so the header sits in a faint blue band that fades to the neutral bg below. Layout order: header → KPIs → filter → bento chart → UPI → insights.

- [ ] **Step 1: Replace the full contents of `components/dashboard/dashboard-shell.tsx`**

```tsx
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
} from '@/lib/dashboard-data'
import { FilterBar } from '@/components/dashboard/filter-bar'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { SpendTrendChart } from '@/components/dashboard/spend-trend-chart'
import { UpiChart } from '@/components/dashboard/upi-chart'
import { CategoryChart } from '@/components/dashboard/category-chart'
import { InsightsStrip } from '@/components/dashboard/insights-strip'

export interface DashboardShellProps {
  data: DashboardData
  filter: FilterState
  onFilterChange: (filter: FilterState) => void
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
      style={{ background: 'linear-gradient(180deg, #EFF6FF 0%, var(--bg) 220px)' }}
      data-testid="dashboard-shell"
    >
      <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col gap-5">

        {/* ── Header ── */}
        <div className="reveal">
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

          {/* ── UPI (full width) ── */}
          <motion.div variants={rowVariants}>
            <UpiChart analyses={filteredAnalyses} isLoading={isLoading} />
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

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/dashboard-shell.tsx
git commit -m "refactor(ui): bold header with page gradient, ClearSpend eyebrow, new layout"
```

---

## Task 9: Upload Zone — Blue Drag-Over Tint

**Files:**
- Modify: `components/upload/upload-zone.tsx`

Two targeted style changes: outer wrapper bg on idle from green-tinted to neutral, drag-over inner bg from green to blue. All logic, handlers, and test IDs unchanged.

- [ ] **Step 1: Update green-tinted values in upload-zone.tsx**

Find:
```tsx
        background: isDragOver ? 'var(--primary-subtle)' : 'rgba(12, 30, 22, 0.025)',
```
Replace with:
```tsx
        background: isDragOver ? 'var(--primary-subtle)' : 'rgba(15, 23, 42, 0.02)',
```

Find:
```tsx
          background: isDragOver ? 'rgba(4,120,87,0.04)' : 'var(--surface)',
```
Replace with:
```tsx
          background: isDragOver ? 'rgba(37, 99, 235, 0.04)' : 'var(--surface)',
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/upload/upload-zone.tsx
git commit -m "refactor(ui): upload zone drag-over tint from green to blue"
```

---

## Task 10: Confirm Modal — Blue Backdrop + Button Shadow

**Files:**
- Modify: `components/upload/confirm-modal.tsx`

Three targeted changes. All logic, animations, and test IDs unchanged.

- [ ] **Step 1: Update three green-specific values in confirm-modal.tsx**

Find (backdrop background):
```tsx
            background: 'rgba(12, 30, 22, 0.45)',
```
Replace with:
```tsx
            background: 'rgba(15, 23, 42, 0.4)',
```

Find (outer dialog wrapper):
```tsx
            background: 'rgba(12, 30, 22, 0.04)',
            border: '1px solid rgba(12, 30, 22, 0.08)',
```
Replace with:
```tsx
            background: 'rgba(15, 23, 42, 0.04)',
            border: '1px solid rgba(15, 23, 42, 0.08)',
```

Find (confirm button shadow):
```tsx
                    boxShadow: isAnalysing ? 'none' : '0 2px 10px rgba(4,120,87,0.35)',
```
Replace with:
```tsx
                    boxShadow: isAnalysing ? 'none' : '0 2px 10px rgba(37, 99, 235, 0.3)',
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/upload/confirm-modal.tsx
git commit -m "refactor(ui): confirm modal backdrop and button shadow from green to blue"
```

---

## Task 11: Page — Update Loading Shimmer + Top Padding

**Files:**
- Modify: `app/page.tsx`

Update the data-loading shimmer to use `.kpi-row` class instead of the old `.kpi-grid`. Tighten the upload zone top padding from `pt-8` to `pt-6`.

- [ ] **Step 1: Update loading shimmer KPI grid class**

Find:
```tsx
        <div className="grid grid-cols-2 gap-3 kpi-grid">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-3xl"
              style={{ height: '90px', background: 'var(--border)' }}
              aria-hidden="true"
            />
          ))}
        </div>
```
Replace with:
```tsx
        <div className="kpi-row">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl"
              style={{ height: '90px', background: 'var(--border)' }}
              aria-hidden="true"
            />
          ))}
        </div>
```

Find:
```tsx
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-2">
```
Replace with:
```tsx
      <div className="max-w-5xl mx-auto px-4 pt-6 pb-2">
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/page.tsx
git commit -m "refactor(ui): update page shimmer to kpi-row, tighten top padding"
```

---

## Task 12: Build, Force-Add, Push, Redeploy

**Files:** `.next/static/`, `.next/standalone/`

- [ ] **Step 1: Run production build**

```bash
cd "/Users/aditya/Documents/Coding Projects/terminal-ai-testing/credit-report-analysis"
node_modules/.bin/next build 2>&1
```

Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 2: Force-add all Next.js output**

```bash
git add -f .next/static/ .next/standalone/
```

- [ ] **Step 3: Verify new chunk hashes in the HTML**

```bash
grep -o 'static/[^"]*"' .next/standalone/.next/server/app/index.html | head -8
```

Expected: CSS and JS chunk filenames are new (different from the previously deployed hashes: `1eab46f5ca1eac04.css`, `page-71b27632c50a9c77.js`).

- [ ] **Step 4: Commit build artifacts**

```bash
git commit -m "build: production build for premium blue-slate UI redesign"
```

- [ ] **Step 5: Push**

```bash
git push origin deploy
```

- [ ] **Step 6: Redeploy via Terminal AI MCP**

Use `mcp__terminal-ai__redeploy_app` with `app_id: "c1b53feb-f9cb-4cbc-88a5-daa8cb3e5ea5"`.
Poll `mcp__terminal-ai__get_deployment_status` until `"status": "live"`.

---

## Self-Review

| Requirement | Task | Visual-Impact Check |
|---|---|---|
| No green | Tasks 1, 7, 9, 10 | ✅ Blue-slate throughout |
| No 4 equal KPI cards | Task 2 | ✅ `2fr 1fr 1fr 1fr` asymmetric |
| Bold header | Task 8 | ✅ `clamp(2rem, 5vw, 3.2rem)` + eyebrow |
| Page gradient wash | Tasks 1 + 8 | ✅ `#EFF6FF → var(--bg)` over 220px |
| Gradient bar fill | Task 3 | ✅ SVG `linearGradient` on bars |
| Spend chart more useful | Task 3 | ✅ Monthly totals + avg reference + category tooltip |
| No horizontal insights scroll | Task 6 | ✅ 2-3 col grid |
| UPI readable | Task 5 | ✅ Ranked list + progress bars |
| Functionality unchanged | All | ✅ No lib/hooks/api changes |
| All test IDs intact | All | ✅ All `data-testid` attributes preserved |
