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
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      delay: i * 0.06,
      duration: 0.45,
      ease: [0.32, 0.72, 0, 1] as [number, number, number, number],
    },
  }),
}

interface KpiCardProps {
  index: number
  testId: string
  label: string
  children: React.ReactNode
}

function KpiCard({ index, testId, label, children }: KpiCardProps): JSX.Element {
  return (
    <motion.div
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate="visible"
      className="bezel-outer"
      data-testid={testId}
      style={{ flex: 1 }}
    >
      <div className="bezel-inner flex flex-col gap-2.5">
        <p
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.13em',
            color: 'var(--muted)',
          }}
        >
          {label}
        </p>
        <div>{children}</div>
      </div>
    </motion.div>
  )
}

export function KpiCards({ metrics, isLoading }: KpiCardsProps): JSX.Element {
  const { totalSpend, avgMonthlySpend, topCategory, topCategoryAmount, monthOverMonthChange } = metrics

  const momIsPositive = monthOverMonthChange !== null && monthOverMonthChange >= 0
  const momColour = monthOverMonthChange === null
    ? 'var(--muted)'
    : momIsPositive
      ? 'var(--accent-negative)'
      : 'var(--accent-positive)'

  const momSign = momIsPositive ? '+' : ''

  return (
    <div className="grid grid-cols-2 gap-3 kpi-grid">

      <KpiCard index={0} testId="kpi-total-spend" label="Total Spend">
        {isLoading ? (
          <ShimmerLine />
        ) : (
          <p
            className="tabular"
            style={{
              fontSize: 'clamp(1.2rem, 2.8vw, 1.6rem)',
              fontWeight: 800,
              letterSpacing: '-0.035em',
              lineHeight: 1.1,
              color: 'var(--text)',
            }}
          >
            {formatInr(totalSpend)}
          </p>
        )}
      </KpiCard>

      <KpiCard index={1} testId="kpi-avg-monthly" label="Avg / Month">
        {isLoading ? (
          <ShimmerLine />
        ) : (
          <p
            className="tabular"
            style={{
              fontSize: 'clamp(1.2rem, 2.8vw, 1.6rem)',
              fontWeight: 800,
              letterSpacing: '-0.035em',
              lineHeight: 1.1,
              color: 'var(--text)',
            }}
          >
            {formatInr(avgMonthlySpend)}
          </p>
        )}
      </KpiCard>

      <KpiCard index={2} testId="kpi-top-category" label="Top Category">
        {isLoading ? (
          <ShimmerLine width="60%" height="1.5rem" />
        ) : (
          <>
            <p
              style={{
                fontSize: 'clamp(0.95rem, 2.2vw, 1.15rem)',
                fontWeight: 700,
                letterSpacing: '-0.02em',
                lineHeight: 1.2,
                color: 'var(--text)',
              }}
            >
              {topCategory !== null ? CATEGORY_DISPLAY_NAMES[topCategory] : '—'}
            </p>
            {topCategory !== null && (
              <p
                className="tabular"
                style={{
                  fontSize: '0.75rem',
                  color: 'var(--muted)',
                  marginTop: '3px',
                  fontWeight: 500,
                }}
              >
                {formatInr(topCategoryAmount)}
              </p>
            )}
          </>
        )}
      </KpiCard>

      <KpiCard index={3} testId="kpi-mom-change" label="vs Last Month">
        {isLoading ? (
          <ShimmerLine width="55%" />
        ) : monthOverMonthChange === null ? (
          <p
            style={{
              fontSize: 'clamp(1.2rem, 2.8vw, 1.6rem)',
              fontWeight: 800,
              letterSpacing: '-0.035em',
              lineHeight: 1.1,
              color: 'var(--muted)',
            }}
          >
            —
          </p>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <p
              className="tabular"
              style={{
                fontSize: 'clamp(1.2rem, 2.8vw, 1.6rem)',
                fontWeight: 800,
                letterSpacing: '-0.035em',
                lineHeight: 1.1,
                color: momColour,
              }}
              data-testid="kpi-mom-value"
            >
              {`${momSign}${monthOverMonthChange.toFixed(1)}%`}
            </p>
            <span
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: momColour,
                lineHeight: 1,
              }}
            >
              {momIsPositive ? '↑' : '↓'}
            </span>
          </div>
        )}
      </KpiCard>

    </div>
  )
}
