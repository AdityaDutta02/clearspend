import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import type { DashboardData } from '@/types'
import type { FilterState } from '@/lib/dashboard-data'
import { makeAnalysis } from '@/tests/utils/factories'

// Mock dashboard sub-components that are not under test here
vi.mock('@/components/dashboard/filter-bar', () => ({
  FilterBar: ({ onChange }: { availableMonths: string[]; availableBanks: string[]; filter: FilterState; onChange: (f: FilterState) => void }) => (
    <div data-testid="filter-bar" onClick={() => onChange({ month: null, bank: null })} />
  ),
}))

vi.mock('@/components/dashboard/kpi-cards', () => ({
  KpiCards: ({ metrics }: { metrics: { totalSpend: number }; isLoading: boolean }) => (
    <div data-testid="kpi-cards">
      <div data-testid="kpi-total-spend">{metrics.totalSpend}</div>
      <div data-testid="kpi-avg-monthly" />
      <div data-testid="kpi-top-category" />
      <div data-testid="kpi-mom-change" />
    </div>
  ),
}))

vi.mock('@/components/dashboard/spend-trend-chart', () => ({
  SpendTrendChart: ({ data }: { data: unknown[]; isLoading: boolean }) => (
    <div data-testid="spend-trend-chart">{JSON.stringify(data)}</div>
  ),
}))

vi.mock('@/components/dashboard/upi-chart', () => ({
  UpiChart: ({ analyses }: { analyses: unknown[]; isLoading: boolean }) => (
    <div data-testid="upi-chart" data-count={analyses.length} />
  ),
}))

vi.mock('@/components/dashboard/insights-strip', () => ({
  InsightsStrip: ({ analyses }: { analyses: unknown[]; isLoading: boolean }) => (
    <div data-testid="insights-strip" data-count={analyses.length} />
  ),
}))

const makeData = (overrides: Partial<DashboardData> = {}): DashboardData => ({
  statements: [],
  analyses: [],
  ...overrides,
})

const defaultFilter: FilterState = { month: null, bank: null }

describe('DashboardShell', () => {
  it('renders the ClearSpend header', () => {
    render(
      <DashboardShell
        data={makeData()}
        filter={defaultFilter}
        onFilterChange={vi.fn()}
        isLoading={false}
      />,
    )

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('ClearSpend')
  })

  it('renders the tagline text', () => {
    render(
      <DashboardShell
        data={makeData()}
        filter={defaultFilter}
        onFilterChange={vi.fn()}
        isLoading={false}
      />,
    )

    expect(screen.getByText('Your money, finally legible.')).toBeInTheDocument()
  })

  it('renders the FilterBar', () => {
    render(
      <DashboardShell
        data={makeData()}
        filter={defaultFilter}
        onFilterChange={vi.fn()}
        isLoading={false}
      />,
    )

    expect(screen.getByTestId('filter-bar')).toBeInTheDocument()
  })

  it('renders all dashboard sections', () => {
    render(
      <DashboardShell
        data={makeData()}
        filter={defaultFilter}
        onFilterChange={vi.fn()}
        isLoading={false}
      />,
    )

    expect(screen.getByTestId('kpi-cards')).toBeInTheDocument()
    expect(screen.getByTestId('spend-trend-chart')).toBeInTheDocument()
    expect(screen.getByTestId('upi-chart')).toBeInTheDocument()
    expect(screen.getByTestId('insights-strip')).toBeInTheDocument()
  })

  it('renders 4 KPI card area when data has analyses', () => {
    const analyses = [
      makeAnalysis({ id: 'a1', statement_id: 's1', month: '2025-01', monthly_total: 10000 }),
      makeAnalysis({ id: 'a2', statement_id: 's2', month: '2025-02', monthly_total: 20000 }),
    ]
    const data: DashboardData = {
      statements: [
        {
          id: 's1',
          month: '2025-01',
          bank: 'hdfc',
          account_type: 'debit',
          transaction_count: 5,
          total_debit: 10000,
          total_credit: 0,
          currency: 'INR',
          uploaded_at: '2025-01-31T00:00:00Z',
        },
        {
          id: 's2',
          month: '2025-02',
          bank: 'hdfc',
          account_type: 'debit',
          transaction_count: 8,
          total_debit: 20000,
          total_credit: 0,
          currency: 'INR',
          uploaded_at: '2025-02-28T00:00:00Z',
        },
      ],
      analyses,
    }

    render(
      <DashboardShell
        data={data}
        filter={defaultFilter}
        onFilterChange={vi.fn()}
        isLoading={false}
      />,
    )

    // KpiCards mock renders 4 distinct card elements
    expect(screen.getByTestId('kpi-total-spend')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-avg-monthly')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-top-category')).toBeInTheDocument()
    expect(screen.getByTestId('kpi-mom-change')).toBeInTheDocument()
    // totalSpend reflects sum of all analyses (10000 + 20000 = 30000)
    expect(screen.getByTestId('kpi-total-spend')).toHaveTextContent('30000')
  })

  it('passes filtered analyses correctly to charts', () => {
    const analyses = [
      makeAnalysis({ id: 'a1', statement_id: 's1', month: '2025-01' }),
      makeAnalysis({ id: 'a2', statement_id: 's2', month: '2025-02' }),
    ]
    const data: DashboardData = {
      statements: [
        {
          id: 's1',
          month: '2025-01',
          bank: 'hdfc',
          account_type: 'debit',
          transaction_count: 2,
          total_debit: 5000,
          total_credit: 0,
          currency: 'INR',
          uploaded_at: '2025-01-31T00:00:00Z',
        },
        {
          id: 's2',
          month: '2025-02',
          bank: 'sbi',
          account_type: 'debit',
          transaction_count: 3,
          total_debit: 7000,
          total_credit: 0,
          currency: 'INR',
          uploaded_at: '2025-02-28T00:00:00Z',
        },
      ],
      analyses,
    }

    // Filter to month 2025-01 — only s1/a1 should pass
    const filter: FilterState = { month: '2025-01', bank: null }

    render(
      <DashboardShell
        data={data}
        filter={filter}
        onFilterChange={vi.fn()}
        isLoading={false}
      />,
    )

    // UpiChart and InsightsStrip both receive filteredAnalyses; with month filter only 1 passes
    expect(screen.getByTestId('upi-chart').getAttribute('data-count')).toBe('1')
    expect(screen.getByTestId('insights-strip').getAttribute('data-count')).toBe('1')
  })

  it('has correct data-testid on root element', () => {
    render(
      <DashboardShell
        data={makeData()}
        filter={defaultFilter}
        onFilterChange={vi.fn()}
        isLoading={false}
      />,
    )

    expect(screen.getByTestId('dashboard-shell')).toBeInTheDocument()
  })
})
