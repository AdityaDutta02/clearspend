import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UpiChart } from '@/components/dashboard/upi-chart'
import { makeAnalysis } from '../utils/factories'

const analysisWithMerchants = makeAnalysis({
  upi_summary: {
    total_spent: 15000,
    merchant_breakdown: [
      { name: 'Swiggy', total: 5000, count: 10 },
      { name: 'Zomato', total: 4000, count: 8 },
      { name: 'PhonePe', total: 3000, count: 6 },
      { name: 'Paytm', total: 2000, count: 4 },
      { name: 'GPay', total: 1000, count: 2 },
      { name: 'BHIM', total: 500, count: 1 },
    ],
  },
})

describe('UpiChart', () => {
  it('renders loading state when isLoading is true', () => {
    render(<UpiChart analyses={[]} isLoading={true} />)

    const shimmer = screen.getByTestId('shimmer-block')
    expect(shimmer).toBeInTheDocument()
    expect(shimmer).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows "No UPI transactions found" when no UPI data', () => {
    render(<UpiChart analyses={[]} isLoading={false} />)

    expect(screen.getByText('No UPI transactions found')).toBeInTheDocument()
  })

  it('shows "No UPI transactions found" when analyses have empty merchant breakdowns', () => {
    render(<UpiChart analyses={[makeAnalysis()]} isLoading={false} />)

    expect(screen.getByText('No UPI transactions found')).toBeInTheDocument()
  })

  it('renders merchant names and amounts from analyses', () => {
    render(<UpiChart analyses={[analysisWithMerchants]} isLoading={false} />)

    expect(screen.getByText('Swiggy')).toBeInTheDocument()
    expect(screen.getByText('Zomato')).toBeInTheDocument()
    expect(screen.getByText('PhonePe')).toBeInTheDocument()
  })

  it('shows at most 5 merchants', () => {
    render(<UpiChart analyses={[analysisWithMerchants]} isLoading={false} />)

    const merchantItems = screen.getAllByTestId(/^upi-merchant-/)
    expect(merchantItems).toHaveLength(5)
  })

  it('aggregates merchant totals across multiple analyses', () => {
    const analysis1 = makeAnalysis({
      id: 'a1',
      upi_summary: {
        total_spent: 5000,
        merchant_breakdown: [{ name: 'Swiggy', total: 5000, count: 10 }],
      },
    })
    const analysis2 = makeAnalysis({
      id: 'a2',
      upi_summary: {
        total_spent: 3000,
        merchant_breakdown: [{ name: 'Swiggy', total: 3000, count: 6 }],
      },
    })

    render(<UpiChart analyses={[analysis1, analysis2]} isLoading={false} />)

    // Swiggy should appear once (aggregated)
    const swiggyItems = screen.getAllByText('Swiggy')
    expect(swiggyItems).toHaveLength(1)
  })

  it('shows title "Top UPI Merchants"', () => {
    render(<UpiChart analyses={[analysisWithMerchants]} isLoading={false} />)

    expect(screen.getByText('Top UPI Merchants')).toBeInTheDocument()
  })
})
