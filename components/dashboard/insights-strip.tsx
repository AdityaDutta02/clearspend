'use client'

import { motion } from 'framer-motion'
import type { Analysis } from '@/types'

export interface InsightsStripProps {
  analyses: Analysis[]
  isLoading: boolean
}

const MAX_INSIGHTS = 10

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
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 2a7 7 0 0 1 7 7c0 2.5-1.3 4.7-3.3 6L15 18H9l-.3-2.9A7 7 0 0 1 12 2z" />
      <line x1="9" y1="21" x2="15" y2="21" />
      <line x1="10" y1="21" x2="14" y2="21" strokeWidth="2" />
    </svg>
  )
}

function ShimmerStrip(): JSX.Element {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1" aria-hidden="true" data-testid="shimmer-block">
      {[260, 220, 280, 240].map((w, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl"
          style={{
            minWidth: `${w}px`,
            height: '90px',
            background: 'var(--border)',
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  )
}

export function InsightsStrip({ analyses, isLoading }: InsightsStripProps): JSX.Element {
  const insights = collectInsights(analyses)

  return (
    <div className="card" data-testid="insights-strip">
      <div style={{ marginBottom: '18px' }}>
        <p
          style={{
            fontSize: '0.6rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--muted)',
            marginBottom: '4px',
          }}
        >
          Powered by AI
        </p>
        <p
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
          }}
        >
          Insights
        </p>
      </div>

      {isLoading ? (
        <ShimmerStrip />
      ) : insights.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>
          No insights yet — upload a statement to get started.
        </p>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto pb-1"
          role="list"
          style={{ scrollbarWidth: 'none' }}
        >
          {insights.map((insight, i) => (
            <motion.div
              key={insight}
              role="listitem"
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: i * 0.05,
                duration: 0.4,
                ease: [0.32, 0.72, 0, 1],
              }}
              style={{
                minWidth: '248px',
                maxWidth: '320px',
                flexShrink: 0,
              }}
              data-testid="insight-card"
            >
              <div
                style={{
                  background: 'var(--surface-raised)',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'flex-start',
                  border: '1px solid var(--border)',
                  borderLeft: '3px solid var(--primary-light)',
                  height: '100%',
                  transition: 'box-shadow 0.22s cubic-bezier(0.32,0.72,0,1), transform 0.22s cubic-bezier(0.32,0.72,0,1)',
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: '8px',
                    background: 'var(--primary-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'var(--primary)',
                    marginTop: '1px',
                  }}
                >
                  <InsightIcon />
                </div>
                <p
                  style={{
                    fontSize: '0.78rem',
                    lineHeight: 1.6,
                    color: 'var(--text-secondary)',
                    margin: 0,
                    letterSpacing: '-0.005em',
                  }}
                >
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
