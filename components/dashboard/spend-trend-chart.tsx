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
  others: '#6b7280',
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
const SVG_HEIGHT = 240
const PAD_LEFT = 60
const PAD_RIGHT = 20
const PAD_TOP = 20
const PAD_BOTTOM = 40

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
      className="animate-pulse rounded"
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

  const barWidth = data.length > 0 ? (availableWidth / data.length) * 0.6 : 0
  const slotWidth = data.length > 0 ? availableWidth / data.length : 0

  const yTicks = maxTotal > 0 ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxTotal)) : [0]

  // Collect all categories present across all months for the legend
  const presentSlugs = Array.from(
    new Set(data.flatMap((d) => Object.keys(d.categories) as CategorySlug[])),
  ).sort((a, b) => {
    const totA = data.reduce((s, d) => s + (d.categories[a] ?? 0), 0)
    const totB = data.reduce((s, d) => s + (d.categories[b] ?? 0), 0)
    return totB - totA
  })

  return (
    <div className="card" style={{ minHeight: '280px' }} data-testid="spend-trend-chart">
      <p className="text-sm font-semibold mb-2" style={{ color: 'var(--text)' }}>
        Spend Trend
      </p>

      {/* Legend */}
      {!isLoading && presentSlugs.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
          {presentSlugs.map((slug) => (
            <div key={slug} className="flex items-center gap-1">
              <div
                style={{ width: 8, height: 8, borderRadius: 2, background: CATEGORY_COLORS[slug], flexShrink: 0 }}
              />
              <span style={{ fontSize: '0.65rem', color: 'var(--muted)' }}>
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
          <p style={{ color: 'var(--muted)' }}>No data available</p>
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
          width="100%"
          aria-label="Spend trend stacked bar chart"
          role="img"
        >
          {/* Y-axis grid lines and labels */}
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
                />
                <text
                  x={PAD_LEFT - 6}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  fontSize={10}
                  fill="var(--muted)"
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
            const segments = buildSegments(point.categories, point.total, availableHeight, maxTotal)

            return (
              <g key={point.month} data-testid={`bar-${point.month}`}>
                {segments.map((seg, si) => {
                  const isTop = si === 0
                  const isBottom = si === segments.length - 1
                  const rx = isTop ? 4 : 0
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
                      style={isBottom ? { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 } : undefined}
                    />
                  )
                })}
                {/* X-axis label */}
                <text
                  x={slotX + slotWidth / 2}
                  y={SVG_HEIGHT - PAD_BOTTOM + 16}
                  textAnchor="middle"
                  fontSize={10}
                  fill="var(--muted)"
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
            stroke="var(--border)"
            strokeWidth={1}
          />
        </svg>
      )}
    </div>
  )
}
