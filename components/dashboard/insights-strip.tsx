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
