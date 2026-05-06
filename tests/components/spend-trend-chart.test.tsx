import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SpendTrendChart } from '@/components/dashboard/spend-trend-chart'
import type { ChartPoint } from '@/lib/dashboard-data'

const sampleData: ChartPoint[] = [
  { month: '2025-01', total: 25000, categories: { food: 10000, groceries: 8000, transport: 7000 } },
  { month: '2025-02', total: 32000, categories: { food: 12000, groceries: 10000, transport: 10000 } },
  { month: '2025-03', total: 18000, categories: { food: 7000, groceries: 6000, transport: 5000 } },
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

  it('renders chart container when data has items', () => {
    render(<SpendTrendChart data={sampleData} isLoading={false} />)

    const chart = screen.getByTestId('spend-trend-chart')
    expect(chart).toBeInTheDocument()
  })

  it('shows title "Monthly Spend"', () => {
    render(<SpendTrendChart data={sampleData} isLoading={false} />)

    expect(screen.getByText('Monthly Spend')).toBeInTheDocument()
  })

  it('shows "Over time" label', () => {
    render(<SpendTrendChart data={sampleData} isLoading={false} />)

    expect(screen.getByText('Over time')).toBeInTheDocument()
  })

  it('does not show shimmer when not loading', () => {
    render(<SpendTrendChart data={sampleData} isLoading={false} />)

    expect(screen.queryByTestId('shimmer-block')).not.toBeInTheDocument()
  })
})
