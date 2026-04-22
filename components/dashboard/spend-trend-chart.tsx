import type { ChartPoint } from '@/lib/dashboard-data'

export interface SpendTrendChartProps {
  data: ChartPoint[] // sorted ascending by month
  isLoading: boolean
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const SVG_WIDTH = 600
const SVG_HEIGHT = 240
const PAD_LEFT = 60
const PAD_RIGHT = 20
const PAD_TOP = 20
const PAD_BOTTOM = 40

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number)
  const shortYear = String(year).slice(-2)
  return `${MONTH_NAMES[month - 1]} '${shortYear}`
}

function formatYAxisLabel(amount: number): string {
  if (amount >= 100000) {
    return `₹${(amount / 100000).toFixed(1)}L`
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

export function SpendTrendChart({ data, isLoading }: SpendTrendChartProps): JSX.Element {
  const availableWidth = SVG_WIDTH - PAD_LEFT - PAD_RIGHT
  const availableHeight = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM

  const maxTotal = data.length > 0 ? Math.max(...data.map((d) => d.total)) : 0

  const barWidth = data.length > 0 ? (availableWidth / data.length) * 0.6 : 0
  const slotWidth = data.length > 0 ? availableWidth / data.length : 0

  // Y-axis tick values: 0, 25%, 50%, 75%, 100% of max
  const yTicks = maxTotal > 0 ? [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(f * maxTotal)) : [0]

  return (
    <div className="card" style={{ minHeight: '280px' }} data-testid="spend-trend-chart">
      <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>
        Spend Trend
      </p>

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
          aria-label="Spend trend bar chart"
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

          {/* Bars */}
          {data.map((point, index) => {
            const barHeight = maxTotal > 0 ? (point.total / maxTotal) * availableHeight : 0
            const slotX = PAD_LEFT + index * slotWidth
            const barX = slotX + (slotWidth - barWidth) / 2
            const barY = PAD_TOP + availableHeight - barHeight

            return (
              <g key={point.month} data-testid={`bar-${point.month}`}>
                {/* Rounded top corners via clipPath trick with rect + separate rounded rect */}
                <rect
                  x={barX}
                  y={barY + 4}
                  width={barWidth}
                  height={Math.max(barHeight - 4, 0)}
                  fill="var(--primary)"
                />
                {barHeight > 4 && (
                  <rect
                    x={barX}
                    y={barY}
                    width={barWidth}
                    height={8}
                    rx={4}
                    ry={4}
                    fill="var(--primary)"
                  />
                )}
                {barHeight <= 4 && barHeight > 0 && (
                  <rect
                    x={barX}
                    y={barY}
                    width={barWidth}
                    height={barHeight}
                    rx={2}
                    ry={2}
                    fill="var(--primary)"
                  />
                )}
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
