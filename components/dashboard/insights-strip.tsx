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

function SparkleIcon(): JSX.Element {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M12 3v3m0 12v3M3 12h3m12 0h3" />
      <path d="M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1" />
    </svg>
  )
}

function ShimmerStrip(): JSX.Element {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1" aria-hidden="true" data-testid="shimmer-block">
      {[260, 220, 280].map((w, i) => (
        <div
          key={i}
          className="animate-pulse rounded-2xl"
          style={{
            minWidth: `${w}px`,
            height: '80px',
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
      {/* Card header */}
      <div style={{ marginBottom: '18px' }}>
        <p
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
          }}
        >
          AI Insights
        </p>
      </div>

      {isLoading ? (
        <ShimmerStrip />
      ) : insights.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No insights available yet</p>
      ) : (
        <div
          className="flex gap-3 overflow-x-auto pb-1"
          role="list"
          style={{ scrollbarWidth: 'none' }}
        >
          {insights.map((insight) => (
            <div
              key={insight}
              role="listitem"
              style={{
                minWidth: '248px',
                maxWidth: '312px',
                flexShrink: 0,
                padding: '2px',
                background: 'rgba(11, 25, 41, 0.03)',
                border: '1px solid rgba(11, 25, 41, 0.06)',
                borderRadius: '1rem',
              }}
              data-testid="insight-card"
            >
              <div
                style={{
                  background: 'var(--surface)',
                  borderRadius: 'calc(1rem - 2px)',
                  padding: '14px 16px',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,1)',
                  height: '100%',
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: '8px',
                    background: 'var(--primary-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: 'var(--primary)',
                  }}
                >
                  <SparkleIcon />
                </div>
                <p
                  style={{
                    fontSize: '0.8rem',
                    lineHeight: 1.55,
                    color: 'var(--text-secondary)',
                    margin: 0,
                    letterSpacing: '-0.005em',
                  }}
                >
                  {insight}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
