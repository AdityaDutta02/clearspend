import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import type { KpiMetrics } from '@/lib/dashboard-data'

const baseMetrics: KpiMetrics = {
  totalSpend: 50000,
  avgMonthlySpend: 25000,
  topCategory: 'food',
  topCategoryAmount: 15000,
  monthOverMonthChange: null,
  upiShare: 0.3,
}

describe('KpiCards', () => {
  it('renders 4 KPI cards', () => {
    render(<KpiCards metrics={baseMetrics} isLoading={false} />)

    expect(screen.getByTestId('kpi-total-spend')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-avg-monthly')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-top-category')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-mom-change')).toBeInTheDocument()
  })

  it('shows shimmer placeholders when isLoading is true', () => {
    render(<KpiCards metrics={baseMetrics} isLoading={true} />)

    // Shimmer blocks are aria-hidden so they do not appear as text
    // All four cards should be present
    const shimmerBlocks = document.querySelectorAll('.animate-pulse')
    expect(shimmerBlocks.length).toBe(4)
  })

  it('shows INR-formatted values when isLoading is false', () => {
    render(<KpiCards metrics={baseMetrics} isLoading={false} />)

    // toLocaleString('en-IN') formats 50000 as "50,000"
    const totalSpendCard = screen.getByTestId('kpi-total-spend')
    expect(totalSpendCard.textContent).toContain('₹')
    expect(totalSpendCard.textContent).toContain('50,000')

    const avgCard = screen.getByTestId('kpi-avg-monthly')
    expect(avgCard.textContent).toContain('₹')
    expect(avgCard.textContent).toContain('25,000')
  })

  it('shows category display name and amount in top category card', () => {
    render(<KpiCards metrics={baseMetrics} isLoading={false} />)

    const topCatCard = screen.getByTestId('kpi-top-category')
    expect(topCatCard.textContent).toContain('Food')
    expect(topCatCard.textContent).toContain('₹')
  })

  it('shows "—" for mom change when monthOverMonthChange is null', () => {
    render(<KpiCards metrics={{ ...baseMetrics, monthOverMonthChange: null }} isLoading={false} />)

    const momCard = screen.getByTestId('kpi-mom-change')
    expect(momCard.textContent).toContain('—')
  })

  it('shows positive change in red (accent-negative) colour when spend increased', () => {
    render(<KpiCards metrics={{ ...baseMetrics, monthOverMonthChange: 20 }} isLoading={false} />)

    const momCard = screen.getByTestId('kpi-mom-change')
    // Select the value element inside .mt-2 (the value wrapper div)
    const valueEl = momCard.querySelector('.mt-2 p') as HTMLElement | null
    expect(valueEl).not.toBeNull()
    expect(valueEl!.style.color).toBe('var(--accent-negative)')
    expect(valueEl!.textContent).toContain('+20.0%')
  })

  it('shows negative change in green (accent-positive) colour when spend decreased', () => {
    render(<KpiCards metrics={{ ...baseMetrics, monthOverMonthChange: -15 }} isLoading={false} />)

    const momCard = screen.getByTestId('kpi-mom-change')
    const valueEl = momCard.querySelector('.mt-2 p') as HTMLElement | null
    expect(valueEl).not.toBeNull()
    expect(valueEl!.style.color).toBe('var(--accent-positive)')
    expect(valueEl!.textContent).toContain('-15.0%')
  })

  it('shows "EMI Loans" for emi_loans category slug', () => {
    render(
      <KpiCards
        metrics={{ ...baseMetrics, topCategory: 'emi_loans', topCategoryAmount: 8000 }}
        isLoading={false}
      />,
    )

    const topCatCard = screen.getByTestId('kpi-top-category')
    expect(topCatCard.textContent).toContain('EMI Loans')
  })

  it('shows "—" for top category when topCategory is null', () => {
    render(
      <KpiCards
        metrics={{ ...baseMetrics, topCategory: null, topCategoryAmount: 0 }}
        isLoading={false}
      />,
    )

    const topCatCard = screen.getByTestId('kpi-top-category')
    expect(topCatCard.textContent).toContain('—')
  })
})
