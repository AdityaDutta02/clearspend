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

const TICKER_COLORS = ['#F97316', '#22D3EE', '#4ADE80', '#FACC15', '#F472B6', '#A78BFA']

function ShimmerRows(): JSX.Element {
  return (
    <div aria-hidden="true" data-testid="shimmer-block">
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ width: 28, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.08)' }} />
          <div style={{ flex: 1, height: 10, borderRadius: 2, background: 'rgba(255,255,255,0.06)' }} />
        </div>
      ))}
    </div>
  )
}

export function InsightsStrip({ analyses, isLoading }: InsightsStripProps): JSX.Element {
  const insights = collectInsights(analyses)

  return (
    <div
      data-testid="insights-strip"
      style={{
        background: '#0D0D0D',
        borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.07)',
        padding: '14px 16px',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      {/* Terminal header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '10px',
        paddingBottom: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)',
          }}>
            INSIGHTS
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em',
            color: '#4ADE80',
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#4ADE80',
              display: 'inline-block',
              boxShadow: '0 0 6px #4ADE80',
            }} />
            LIVE
          </span>
        </div>
        <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.2)', letterSpacing: '0.06em' }}>
          AI·ANALYSIS
        </span>
      </div>

      {isLoading ? (
        <ShimmerRows />
      ) : insights.length === 0 ? (
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.78rem', margin: 0 }}>
          No signals — upload a statement to get started.
        </p>
      ) : (
        <div role="list">
          {insights.map((insight, i) => (
            <motion.div
              key={insight}
              role="listitem"
              data-testid="insight-card"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.04, duration: 0.35 }}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '10px',
                padding: '8px 0',
                borderBottom: i < insights.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
              }}
            >
              {/* Ticker-style index */}
              <span style={{
                fontSize: '0.58rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: TICKER_COLORS[i % TICKER_COLORS.length],
                flexShrink: 0,
                minWidth: '20px',
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <p style={{
                fontSize: '0.77rem',
                lineHeight: 1.55,
                color: 'rgba(255,255,255,0.72)',
                margin: 0,
                letterSpacing: '-0.005em',
              }}>
                {insight}
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
