import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardShellV2 } from '@/components/dashboard/dashboard-shell-v2'
import type { DashboardData } from '@/types'
import type { FilterState } from '@/lib/dashboard-data'

// Stub fetch for ChatRail
vi.stubGlobal('fetch', vi.fn())

const emptyData: DashboardData = {
  statements: [],
  analyses: [],
  transactions: [],
}

const emptyFilter: FilterState = {
  month: null,
  bank: null,
  statement_id: null,
  category: null,
}

describe('DashboardShellV2', () => {
  it('renders with data-design="v2" attribute', () => {
    render(
      <DashboardShellV2
        data={emptyData}
        filter={emptyFilter}
        onFilterChange={vi.fn()}
        onUploadClick={vi.fn()}
        isLoading={false}
        token="test-token"
        refresh={vi.fn()}
      />,
    )
    expect(screen.getByTestId('dashboard-shell-v2')).toHaveAttribute('data-design', 'v2')
  })

  it('renders add statement button in toolbar', () => {
    render(
      <DashboardShellV2
        data={emptyData}
        filter={emptyFilter}
        onFilterChange={vi.fn()}
        onUploadClick={vi.fn()}
        isLoading={false}
        token="test-token"
        refresh={vi.fn()}
      />,
    )
    expect(screen.getByTestId('add-statement-btn')).toBeInTheDocument()
  })

  it('renders manage statements button in toolbar', () => {
    render(
      <DashboardShellV2
        data={emptyData}
        filter={emptyFilter}
        onFilterChange={vi.fn()}
        onUploadClick={vi.fn()}
        isLoading={false}
        token="test-token"
        refresh={vi.fn()}
      />,
    )
    expect(screen.getByTestId('manage-statements-btn')).toBeInTheDocument()
  })

  it('renders mobile ask button', () => {
    render(
      <DashboardShellV2
        data={emptyData}
        filter={emptyFilter}
        onFilterChange={vi.fn()}
        onUploadClick={vi.fn()}
        isLoading={false}
        token="test-token"
        refresh={vi.fn()}
      />,
    )
    expect(screen.getByTestId('mobile-ask-btn')).toBeInTheDocument()
  })

  it('renders chat rail', () => {
    render(
      <DashboardShellV2
        data={emptyData}
        filter={emptyFilter}
        onFilterChange={vi.fn()}
        onUploadClick={vi.fn()}
        isLoading={false}
        token="test-token"
        refresh={vi.fn()}
      />,
    )
    expect(screen.getByTestId('chat-rail')).toBeInTheDocument()
  })
})
