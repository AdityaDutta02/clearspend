import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpendTrendChart } from '@/components/dashboard/spend-trend-chart'
import type { ChartPoint } from '@/lib/dashboard-data'

const sampleData: ChartPoint[] = [
  { month: '2025-01', total: 25000 },
  { month: '2025-02', total: 32000 },
  { month: '2025-03', total: 18000 },
]

describe('SpendTrendChart', () => {
  it('renders loading state with shimmer when isLoading is true', () => {
    render(<SpendTrendChart data={[]} isLoading={true} />)

    const shimmer = screen.getByTestId('shimmer-block')
    expect(shimmer).toBeInTheDocument()
    expect(shimmer).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows "No data available" when data is empty array', () => {
    render(<SpendTrendChart data={[]} isLoading={false} />)

    expect(screen.getByText('No data available')).toBeInTheDocument()
  })

  it('renders SVG bars for each data point when data has items', () => {
    render(<SpendTrendChart data={sampleData} isLoading={false} />)

    const chart = screen.getByTestId('spend-trend-chart')
    expect(chart).toBeInTheDocument()

    // SVG should be present
    const svg = chart.querySelector('svg')
    expect(svg).toBeInTheDocument()

    // Each data point should have a bar group
    for (const point of sampleData) {
      expect(screen.getByTestId(`bar-${point.month}`)).toBeInTheDocument()
    }
  })

  it('correct number of bars matches data length', () => {
    render(<SpendTrendChart data={sampleData} isLoading={false} />)

    const chart = screen.getByTestId('spend-trend-chart')
    const barGroups = chart.querySelectorAll('[data-testid^="bar-"]')
    expect(barGroups).toHaveLength(sampleData.length)
  })

  it('shows title "Spend Trend"', () => {
    render(<SpendTrendChart data={sampleData} isLoading={false} />)

    expect(screen.getByText('Spend Trend')).toBeInTheDocument()
  })

  it('does not show shimmer when not loading', () => {
    render(<SpendTrendChart data={sampleData} isLoading={false} />)

    expect(screen.queryByTestId('shimmer-block')).not.toBeInTheDocument()
  })
})
