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

function ShimmerRows(): JSX.Element {
  return (
    <div aria-hidden="true" data-testid="shimmer-block">
      {[1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
          <div className="animate-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--border)', flexShrink: 0 }} />
          <div className="animate-pulse" style={{ height: '11px', flex: 1, borderRadius: '4px', background: 'var(--border)' }} />
        </div>
      ))}
    </div>
  )
}

export function InsightsStrip({ analyses, isLoading }: InsightsStripProps): JSX.Element {
  const insights = collectInsights(analyses)

  return (
    <div className="card" data-testid="insights-strip" style={{ padding: '16px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}>
          Insights
        </span>
        <span style={{
          fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.06em',
          background: 'var(--primary-subtle)', color: 'var(--primary)',
          borderRadius: '4px', padding: '1px 5px', textTransform: 'uppercase',
        }}>
          AI
        </span>
      </div>

      {isLoading ? (
        <ShimmerRows />
      ) : insights.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '8px' }}>
          No insights yet — upload a statement to get started.
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
                padding: '9px 0',
                borderBottom: i < insights.length - 1 ? '1px solid var(--border)' : 'none',
              }}
            >
              <span style={{
                width: 5, height: 5, borderRadius: '50%',
                background: 'var(--primary)', flexShrink: 0,
                marginTop: '1px',
                display: 'inline-block',
              }} />
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
