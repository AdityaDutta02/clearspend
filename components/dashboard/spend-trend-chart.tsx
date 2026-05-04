import type { CategorySlug } from '@/types'
import type { ChartPoint } from '@/lib/dashboard-data'

export interface SpendTrendChartProps {
  data: ChartPoint[] // sorted ascending by month, deduplicated by month
  isLoading: boolean
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const CATEGORY_COLORS: Record<CategorySlug, string> = {
  food: '#f97316',
  groceries: '#22c55e',
  transport: '#3b82f6',
  shopping: '#a855f7',
  emi_loans: '#ef4444',
  utilities: '#06b6d4',
  entertainment: '#ec4899',
  health: '#14b8a6',
  travel: '#f59e0b',
  others: '#94a3b8',
}

const CATEGORY_DISPLAY_NAMES: Record<CategorySlug, string> = {
  food: 'Food & Dining',
  groceries: 'Groceries',
  transport: 'Transport',
  shopping: 'Shopping',
  emi_loans: 'EMI & Loans',
  utilities: 'Bills & Subs',
  entertainment: 'Entertainment',
  health: 'Health',
  travel: 'Travel',
  others: 'Others',
}

const SVG_WIDTH = 600
const SVG_HEIGHT = 220
const PAD_LEFT = 56
const PAD_RIGHT = 16
const PAD_TOP = 16
const PAD_BOTTOM = 36

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number)
  const shortYear = String(year).slice(-2)
  const idx = month - 1
  const monthName = idx >= 0 && idx < 12 ? MONTH_NAMES[idx] : '???'
  return `${monthName} '${shortYear}`
}

function formatYAxisLabel(amount: number): string {
  if (amount >= 100000) {
    const l = amount / 100000
    return `₹${Number.isInteger(l) ? l : l.toFixed(1)}L`
  }
  if (amount >= 1000) {
    return `₹${Math.round(amount / 1000)}K`
  }
  return `₹${amount}`
}

function ShimmerBlock(): JSX.Element {
  return (
    <div
      className="animate-pulse rounded-xl"
      style={{ height: '200px', width: '100%', background: 'var(--border)' }}
      aria-hidden="true"
      data-testid="shimmer-block"
    />
  )
}

interface StackSegment {
  slug: CategorySlug
  amount: number
  y: number
  height: number
}

function buildSegments(
  categories: Partial<Record<CategorySlug, number>>,
  total: number,
  availableHeight: number,
  maxTotal: number,
): StackSegment[] {
  if (maxTotal === 0) return []

  const entries = (Object.entries(categories) as [CategorySlug, number][])
    .filter(([, v]) => v > 0)
    .sort(([, a], [, b]) => b - a)

  const totalBarHeight = (total / maxTotal) * availableHeight
  const baseY = PAD_TOP + availableHeight

  const segments: StackSegment[] = []
  let usedHeight = 0

  for (const [slug, amount] of entries) {
    const segH = (amount / total) * totalBarHeight
    segments.push({
      slug,
      amount,
      y: baseY - usedHeight - segH,
      height: segH,
    })
    usedHeight += segH
  }

  return segments
}

export function SpendTrendChart({ data, isLoading }: SpendTrendChartProps): JSX.Element {
  const availableWidth = SVG_WIDTH - PAD_LEFT - PAD_RIGHT
  const availableHeight = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM

  const maxTotal = data.length > 0 ? Math.max(...data.map((d) => d.total)) : 0

  const barWidth = data.length > 0 ? (availableWidth / data.length) * 0.52 : 0
  const slotWidth = data.length > 0 ? availableWidth / data.length : 0

  const yTicks = maxTotal > 0 ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxTotal)) : [0]

  const presentSlugs = Array.from(
    new Set(data.flatMap((d) => Object.keys(d.categories ?? {}) as CategorySlug[])),
  ).sort((a, b) => {
    const totA = data.reduce((s, d) => s + ((d.categories ?? {})[a] ?? 0), 0)
    const totB = data.reduce((s, d) => s + ((d.categories ?? {})[b] ?? 0), 0)
    return totB - totA
  })

  return (
    <div className="card" style={{ minHeight: '280px' }} data-testid="spend-trend-chart">

      {/* Card header */}
      <div style={{ marginBottom: '16px' }}>
        <p
          style={{
            fontSize: '0.65rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--muted)',
            marginBottom: '4px',
          }}
        >
          Over time
        </p>
        <p
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
          }}
        >
          Spend Trend
        </p>
      </div>

      {/* Legend */}
      {!isLoading && presentSlugs.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-4">
          {presentSlugs.map((slug) => (
            <div key={slug} className="flex items-center gap-1.5">
              <div
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: CATEGORY_COLORS[slug],
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: '0.62rem', fontWeight: 600, color: 'var(--muted)', letterSpacing: '0.01em' }}>
                {CATEGORY_DISPLAY_NAMES[slug]}
              </span>
            </div>
          ))}
        </div>
      )}

      {isLoading ? (
        <ShimmerBlock />
      ) : data.length === 0 ? (
        <div
          style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No data available</p>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          width="100%"
          aria-label="Spend trend stacked bar chart"
          role="img"
        >
          {/* Y-axis grid lines */}
          {yTicks.map((tick) => {
            const y = PAD_TOP + availableHeight - (maxTotal > 0 ? (tick / maxTotal) * availableHeight : 0)
            return (
              <g key={tick}>
                <line
                  x1={PAD_LEFT}
                  y1={y}
                  x2={SVG_WIDTH - PAD_RIGHT}
                  y2={y}
                  stroke="var(--border)"
                  strokeWidth={1}
                  strokeDasharray={tick === 0 ? undefined : '3 4'}
                />
                <text
                  x={PAD_LEFT - 8}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={9}
                  fill="var(--muted)"
                  fontFamily="'Plus Jakarta Sans', system-ui"
                  fontWeight={500}
                >
                  {formatYAxisLabel(tick)}
                </text>
              </g>
            )
          })}

          {/* Stacked bars */}
          {data.map((point, index) => {
            const slotX = PAD_LEFT + index * slotWidth
            const barX = slotX + (slotWidth - barWidth) / 2
            const segments = buildSegments(point.categories ?? {}, point.total, availableHeight, maxTotal)

            return (
              <g key={point.month} data-testid={`bar-${point.month}`}>
                {segments.map((seg, si) => {
                  const isTop = si === 0
                  const rx = isTop ? 3 : 0
                  const h = Math.max(seg.height, 1)
                  return (
                    <rect
                      key={seg.slug}
                      x={barX}
                      y={seg.y}
                      width={barWidth}
                      height={h}
                      rx={isTop ? rx : 0}
                      ry={isTop ? rx : 0}
                      fill={CATEGORY_COLORS[seg.slug]}
                      aria-label={`${CATEGORY_DISPLAY_NAMES[seg.slug]} ${formatYAxisLabel(seg.amount)}`}
                    />
                  )
                })}

                {/* X-axis label */}
                <text
                  x={slotX + slotWidth / 2}
                  y={SVG_HEIGHT - PAD_BOTTOM + 14}
                  textAnchor="middle"
                  fontSize={9}
                  fill="var(--muted)"
                  fontFamily="'Plus Jakarta Sans', system-ui"
                  fontWeight={500}
                >
                  {formatMonth(point.month)}
                </text>
              </g>
            )
          })}

          {/* X-axis baseline */}
          <line
            x1={PAD_LEFT}
            y1={PAD_TOP + availableHeight}
            x2={SVG_WIDTH - PAD_RIGHT}
            y2={PAD_TOP + availableHeight}
            stroke="var(--border-medium)"
            strokeWidth={1}
          />
        </svg>
      )}
    </div>
  )
}
