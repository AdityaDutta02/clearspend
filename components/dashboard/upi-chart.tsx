import type { Analysis } from '@/types'

export interface UpiChartProps {
  analyses: Analysis[]
  isLoading: boolean
}

interface MerchantTotal {
  name: string
  total: number
}

function aggregateTopMerchants(analyses: Analysis[]): MerchantTotal[] {
  const totals = new Map<string, number>()

  for (const analysis of analyses) {
    for (const merchant of analysis.upi_summary?.merchant_breakdown ?? []) {
      totals.set(merchant.name, (totals.get(merchant.name) ?? 0) + merchant.total)
    }
  }

  return Array.from(totals.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
}

function formatInrShort(amount: number): string {
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
    <div className="flex flex-col gap-4" aria-hidden="true" data-testid="shimmer-block">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex flex-col gap-1">
          <div
            className="animate-pulse rounded"
            style={{ height: '14px', width: '60%', background: 'var(--border)' }}
          />
          <div
            className="animate-pulse rounded"
            style={{ height: '8px', width: '80%', background: 'var(--border)' }}
          />
        </div>
      ))}
    </div>
  )
}

export function UpiChart({ analyses, isLoading }: UpiChartProps): JSX.Element {
  const merchants = aggregateTopMerchants(analyses)
  const maxTotal = merchants.length > 0 ? merchants[0].total : 0

  return (
    <div className="card" data-testid="upi-chart">
      <p className="text-sm font-semibold mb-4" style={{ color: 'var(--text)' }}>
        Top UPI Merchants
      </p>

      {isLoading ? (
        <ShimmerBlock />
      ) : merchants.length === 0 ? (
        <p style={{ color: 'var(--muted)' }}>No UPI transactions found</p>
      ) : (
        <ul className="flex flex-col gap-4" role="list">
          {merchants.map((merchant) => {
            const widthPct = maxTotal > 0 ? (merchant.total / maxTotal) * 100 : 0
            return (
              <li key={merchant.name} data-testid={`upi-merchant-${merchant.name}`}>
                <div className="flex justify-between mb-1">
                  <span
                    className="text-sm font-medium truncate"
                    style={{ color: 'var(--text)', maxWidth: '70%' }}
                  >
                    {merchant.name}
                  </span>
                  <span className="text-sm" style={{ color: 'var(--muted)' }}>
                    {formatInrShort(merchant.total)}
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: '8px',
                    background: 'var(--border)',
                    borderRadius: '4px',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${widthPct}%`,
                      height: '100%',
                      background: 'var(--primary-light)',
                      borderRadius: '4px',
                      transition: 'width 0.3s ease',
                    }}
                    aria-label={`${merchant.name}: ${widthPct.toFixed(0)}% of top merchant`}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
