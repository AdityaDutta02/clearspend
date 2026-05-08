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

const TICKER_COLORS = ['#F97316', '#0891B2', '#16A34A', '#CA8A04', '#9333EA', '#E11D48']

function ShimmerRows(): JSX.Element {
  return (
    <div aria-hidden="true" data-testid="shimmer-block">
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'flex', gap: '12px', padding: '9px 0', borderBottom: '1px solid var(--border)' }}>
          <div className="animate-pulse" style={{ width: 20, height: 10, borderRadius: 2, background: 'var(--border)', flexShrink: 0 }} />
          <div className="animate-pulse" style={{ flex: 1, height: 10, borderRadius: 2, background: 'var(--border)' }} />
        </div>
      ))}
    </div>
  )
}

export function InsightsStrip({ analyses, isLoading }: InsightsStripProps): JSX.Element {
  const insights = collectInsights(analyses)

  return (
    <div
      className="card"
      data-testid="insights-strip"
      style={{ padding: '14px 16px' }}
    >
      {/* Terminal header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '8px',
        paddingBottom: '8px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.14em',
            textTransform: 'uppercase', color: 'var(--text)',
          }}>
            Insights
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em',
            color: '#16A34A',
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: '#16A34A', display: 'inline-block',
            }} />
            LIVE
          </span>
        </div>
        <span style={{
          fontSize: '0.58rem', fontWeight: 600, letterSpacing: '0.1em',
          textTransform: 'uppercase', color: 'var(--muted)',
        }}>
          AI · Analysis
        </span>
      </div>

      {isLoading ? (
        <ShimmerRows />
      ) : insights.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.78rem', margin: 0 }}>
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
              transition={{ delay: i * 0.04, duration: 0.3 }}
              style={{
                display: 'flex',
                alignItems: 'baseline',
                gap: '10px',
                padding: '8px 0',
                borderBottom: i < insights.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span style={{
                fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em',
                color: TICKER_COLORS[i % TICKER_COLORS.length],
                flexShrink: 0, minWidth: '18px',
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <p style={{
                fontSize: '0.78rem', lineHeight: 1.55,
                color: 'var(--text-secondary)', margin: 0,
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
