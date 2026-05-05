'use client'

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  type TooltipProps,
} from 'recharts'
import type { Analysis } from '@/types'

export interface UpiChartProps {
  analyses: Analysis[]
  isLoading: boolean
}

interface MerchantTotal {
  name: string
  shortName: string
  total: number
  rank: number
}

function aggregateTopMerchants(analyses: Analysis[]): MerchantTotal[] {
  const totals = new Map<string, number>()

  for (const analysis of analyses) {
    for (const merchant of analysis.upi_summary?.merchant_breakdown ?? []) {
      totals.set(merchant.name, (totals.get(merchant.name) ?? 0) + merchant.total)
    }
  }

  return Array.from(totals.entries())
    .map(([name, total]) => ({
      name,
      shortName: name.length > 12 ? name.slice(0, 11) + '…' : name,
      total,
      rank: 0,
    }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 5)
    .map((m, i) => ({ ...m, rank: i + 1 }))
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

function CustomTooltip({ active, payload }: TooltipProps<number, string>): JSX.Element | null {
  if (!active || !payload?.length) return null
  const item = payload[0]
  const data = item.payload as MerchantTotal

  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-medium)',
        borderRadius: '12px',
        padding: '12px 14px',
        boxShadow: 'var(--shadow-elevated)',
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      }}
    >
      <p style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text)', marginBottom: '4px' }}>
        {data.name}
      </p>
      <p
        style={{
          fontSize: '0.78rem',
          fontWeight: 700,
          color: 'var(--primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {formatInrShort(data.total)}
      </p>
    </div>
  )
}

function getBarColor(rank: number): string {
  if (rank === 1) return '#047857'
  const opacity = 0.35 + (1 - rank / 5) * 0.45
  return `rgba(16, 185, 129, ${opacity})`
}

function ShimmerBlock(): JSX.Element {
  return (
    <div className="flex flex-col gap-5" aria-hidden="true" data-testid="shimmer-block">
      {[85, 68, 52, 40, 28].map((w, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex justify-between">
            <div
              className="animate-pulse rounded-md"
              style={{ height: '12px', width: `${w * 0.7}%`, background: 'var(--border)' }}
            />
            <div
              className="animate-pulse rounded-md"
              style={{ height: '12px', width: '44px', background: 'var(--border)' }}
            />
          </div>
          <div
            className="animate-pulse rounded-full"
            style={{ height: '5px', width: `${w}%`, background: 'var(--border)' }}
          />
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
        <div style={{ flex: 1, minHeight: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={merchants}
              margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
              barCategoryGap="35%"
            >
              <XAxis
                dataKey="shortName"
                tick={{
                  fontSize: 10,
                  fill: 'var(--muted)',
                  fontFamily: "'Plus Jakarta Sans', system-ui",
                  fontWeight: 500,
                }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis hide />
              <Tooltip
                content={<CustomTooltip />}
                cursor={{ fill: 'rgba(12, 30, 22, 0.04)', radius: 6 }}
              />
              <Bar
                dataKey="total"
                radius={[5, 5, 0, 0]}
                isAnimationActive
                animationDuration={600}
                animationEasing="ease-out"
                label={{
                  position: 'top',
                  formatter: (v: number) => formatInrShort(v),
                  fontSize: 9,
                  fontWeight: 700,
                  fill: 'var(--muted)',
                  fontFamily: "'Plus Jakarta Sans', system-ui",
                }}
              >
                {merchants.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={getBarColor(entry.rank)}
                    data-testid={`upi-merchant-${entry.name}`}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
