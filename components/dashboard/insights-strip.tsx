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

function LightbulbIcon(): JSX.Element {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--primary)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <path d="M9 18h6" />
      <path d="M10 22h4" />
      <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z" />
    </svg>
  )
}

function ShimmerStrip(): JSX.Element {
  return (
    <div className="flex gap-3 overflow-x-auto pb-1" aria-hidden="true" data-testid="shimmer-block">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="animate-pulse rounded-xl"
          style={{
            minWidth: '240px',
            height: '72px',
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
      <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>
        AI Insights
      </p>

      {isLoading ? (
        <ShimmerStrip />
      ) : insights.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No insights available yet</p>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-1" role="list">
          {insights.map((insight) => (
            <div
              key={insight}
              role="listitem"
              style={{
                minWidth: '240px',
                maxWidth: '320px',
                flexShrink: 0,
                background: '#ffffff',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                gap: '8px',
                alignItems: 'flex-start',
              }}
              data-testid="insight-card"
            >
              <LightbulbIcon />
              <p className="text-sm" style={{ color: 'var(--text)', margin: 0 }}>
                {insight}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
