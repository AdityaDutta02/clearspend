'use client'

import type { Analysis } from '@/types'

export interface UpiChartProps {
  analyses: Analysis[]
  isLoading: boolean
}

interface MerchantTotal {
  name: string
  total: number
  rank: number
  share: number
}

function aggregateTopMerchants(analyses: Analysis[]): MerchantTotal[] {
  const totals = new Map<string, number>()

  for (const analysis of analyses) {
    for (const merchant of analysis.upi_summary?.merchant_breakdown ?? []) {
      totals.set(merchant.name, (totals.get(merchant.name) ?? 0) + merchant.total)
    }
  }

  const sorted = Array.from(totals.entries())
    .map(([name, total]) => ({ name, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)

  const max = sorted[0]?.total ?? 1

  return sorted.map((m, i) => ({
    name: m.name,
    total: m.total,
    rank: i + 1,
    share: Math.round((m.total / max) * 100),
  }))
}

function formatInrShort(amount: number): string {
  if (amount >= 100000) {
    const l = amount / 100000
    return `₹${Number.isInteger(l) ? l : l.toFixed(1)}L`
  }
  if (amount >= 1000) return `₹${Math.round(amount / 1000)}K`
  return `₹${amount}`
}

const RANK_COLORS = ['#1D4ED8', '#2563EB', '#3B82F6', '#60A5FA', '#93C5FD']

function ShimmerBlock(): JSX.Element {
  return (
    <div className="flex flex-col gap-4" aria-hidden="true" data-testid="shimmer-block">
      {[100, 80, 62, 48, 34].map((w, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex justify-between">
            <div className="animate-pulse rounded-md" style={{ height: '12px', width: `${w * 0.6}%`, background: 'var(--border)' }} />
            <div className="animate-pulse rounded-md" style={{ height: '12px', width: '44px', background: 'var(--border)' }} />
          </div>
          <div className="animate-pulse rounded-full" style={{ height: '4px', width: `${w}%`, background: 'var(--border)' }} />
        </div>
      ))}
    </div>
  )
}

export function UpiChart({ analyses, isLoading }: UpiChartProps): JSX.Element {
  const merchants = aggregateTopMerchants(analyses)

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }} data-testid="upi-chart">

      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--muted)', marginBottom: '4px' }}>
          UPI
        </p>
        <p style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text)' }}>
          Top UPI Merchants
        </p>
      </div>

      {isLoading ? (
        <ShimmerBlock />
      ) : merchants.length === 0 ? (
        <p style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>No UPI transactions found</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {merchants.map((m) => (
            <div key={m.name} data-testid={`upi-merchant-${m.name}`}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <span style={{
                    width: 18, height: 18, borderRadius: '50%',
                    background: RANK_COLORS[m.rank - 1] ?? '#94a3b8',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '0.6rem', fontWeight: 800, color: '#fff', flexShrink: 0,
                  }}>
                    {m.rank}
                  </span>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.name}
                  </span>
                </div>
                <span className="tabular" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text)', flexShrink: 0, marginLeft: '8px' }}>
                  {formatInrShort(m.total)}
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill"
                  style={{ width: `${m.share}%`, background: RANK_COLORS[m.rank - 1] ?? '#94a3b8', opacity: 0.75 }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
