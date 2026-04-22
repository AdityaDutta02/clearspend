import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { InsightsStrip } from '@/components/dashboard/insights-strip'
import { makeAnalysis } from '../utils/factories'

describe('InsightsStrip', () => {
  it('renders loading state when isLoading is true', () => {
    render(<InsightsStrip analyses={[]} isLoading={true} />)

    const shimmer = screen.getByTestId('shimmer-block')
    expect(shimmer).toBeInTheDocument()
    expect(shimmer).toHaveAttribute('aria-hidden', 'true')
  })

  it('shows "No insights available yet" when insights are empty', () => {
    render(<InsightsStrip analyses={[]} isLoading={false} />)

    expect(screen.getByText('No insights available yet')).toBeInTheDocument()
  })

  it('shows "No insights available yet" when analyses have no insights', () => {
    render(<InsightsStrip analyses={[makeAnalysis()]} isLoading={false} />)

    expect(screen.getByText('No insights available yet')).toBeInTheDocument()
  })

  it('renders insight text from analyses', () => {
    const analysis = makeAnalysis({
      insights: ['Your food spending increased by 20% this month.', 'You made 15 UPI transactions.'],
    })

    render(<InsightsStrip analyses={[analysis]} isLoading={false} />)

    expect(screen.getByText('Your food spending increased by 20% this month.')).toBeInTheDocument()
    expect(screen.getByText('You made 15 UPI transactions.')).toBeInTheDocument()
  })

  it('deduplicates insights with same text', () => {
    const sharedInsight = 'Your spending is above average.'
    const analysis1 = makeAnalysis({ id: 'a1', insights: [sharedInsight] })
    const analysis2 = makeAnalysis({ id: 'a2', insights: [sharedInsight] })

    render(<InsightsStrip analyses={[analysis1, analysis2]} isLoading={false} />)

    const matchingElements = screen.getAllByText(sharedInsight)
    expect(matchingElements).toHaveLength(1)
  })

  it('limits to 10 insights max', () => {
    const manyInsights = Array.from({ length: 15 }, (_, i) => `Insight number ${i + 1}`)
    const analysis = makeAnalysis({ insights: manyInsights })

    render(<InsightsStrip analyses={[analysis]} isLoading={false} />)

    const insightCards = screen.getAllByTestId('insight-card')
    expect(insightCards).toHaveLength(10)
  })

  it('collects insights across multiple analyses', () => {
    const analysis1 = makeAnalysis({ id: 'a1', insights: ['Insight A'] })
    const analysis2 = makeAnalysis({ id: 'a2', insights: ['Insight B'] })

    render(<InsightsStrip analyses={[analysis1, analysis2]} isLoading={false} />)

    expect(screen.getByText('Insight A')).toBeInTheDocument()
    expect(screen.getByText('Insight B')).toBeInTheDocument()
  })

  it('shows title "AI Insights"', () => {
    render(<InsightsStrip analyses={[makeAnalysis({ insights: ['Test insight'] })]} isLoading={false} />)

    expect(screen.getByText('AI Insights')).toBeInTheDocument()
  })
})
