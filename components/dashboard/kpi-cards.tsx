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
            <p style={{ fontSize: '0.88rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)' }}>
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
