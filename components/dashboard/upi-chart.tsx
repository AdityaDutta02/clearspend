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
    <div className="flex flex-col gap-5" aria-hidden="true" data-testid="shimmer-block">
      {[72, 58, 45, 35, 26].map((w, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex justify-between">
            <div
              className="animate-pulse rounded-md"
              style={{ height: '13px', width: `${w * 0.8}%`, background: 'var(--border)' }}
            />
            <div
              className="animate-pulse rounded-md"
              style={{ height: '13px', width: '44px', background: 'var(--border)' }}
            />
          </div>
          <div
            className="animate-pulse rounded-full"
            style={{ height: '6px', width: `${w}%`, background: 'var(--border)' }}
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
      {/* Card header */}
      <div style={{ marginBottom: '20px' }}>
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
          UPI
        </p>
        <p
          style={{
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: 'var(--text)',
          }}
        >
          Top UPI Merchants
        </p>
      </div>

      {isLoading ? (
        <ShimmerBlock />
      ) : merchants.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No UPI transactions found</p>
      ) : (
        <ul className="flex flex-col gap-4" role="list">
          {merchants.map((merchant, index) => {
            const widthPct = maxTotal > 0 ? (merchant.total / maxTotal) * 100 : 0
            const rank = index + 1

            return (
              <li key={merchant.name} data-testid={`upi-merchant-${merchant.name}`}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '7px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span
                      style={{
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        color: rank === 1 ? 'var(--primary)' : 'var(--muted)',
                        opacity: rank === 1 ? 1 : 0.6,
                        letterSpacing: '0.04em',
                        minWidth: '14px',
                        textAlign: 'right',
                      }}
                    >
                      {rank}
                    </span>
                    <span
                      style={{
                        fontSize: '0.825rem',
                        fontWeight: 600,
                        color: 'var(--text)',
                        letterSpacing: '-0.01em',
                        maxWidth: '160px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {merchant.name}
                    </span>
                  </div>
                  <span
                    className="tabular"
                    style={{ fontSize: '0.825rem', fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}
                  >
                    {formatInrShort(merchant.total)}
                  </span>
                </div>

                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${widthPct}%`,
                      background: rank === 1
                        ? 'var(--primary-light)'
                        : `rgba(16, 185, 129, ${0.35 + (1 - rank / 5) * 0.45})`,
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
