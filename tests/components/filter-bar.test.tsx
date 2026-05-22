import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '@/components/dashboard/filter-bar'
import type { FilterState, CardDescriptor } from '@/lib/dashboard-data'

const defaultFilter: FilterState = { month: null, bank: null, statement_id: null, category: null }

const twoHdfcCards: CardDescriptor[] = [
  { statement_id: 'stmt-a', bank: 'hdfc', card_name: 'Regalia', last_four: '1234' },
  { statement_id: 'stmt-b', bank: 'hdfc', card_name: 'Millennia', last_four: '5678' },
]

describe('FilterBar — month select', () => {
  it('renders month options from availableMonths', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        availableMonths={['2025-01', '2025-02']}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={defaultFilter}
        onChange={onChange}
      />,
    )
    const monthSelect = screen.getByTestId('month-dropdown') as HTMLSelectElement
    expect(monthSelect).toBeInTheDocument()
    const options = Array.from(monthSelect.options)
    expect(options).toHaveLength(3) // "All months" + 2 months
    expect(options[0]).toHaveTextContent('All months')
    expect(options[1]).toHaveTextContent("Jan '25")
    expect(options[2]).toHaveTextContent("Feb '25")
  })

  it('not rendered when availableMonths is empty', () => {
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={defaultFilter}
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('month-dropdown')).not.toBeInTheDocument()
  })

  it('selecting a month calls onChange with month value', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        availableMonths={['2025-01', '2025-02']}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={defaultFilter}
        onChange={onChange}
      />,
    )
    fireEvent.change(screen.getByTestId('month-dropdown'), { target: { value: '2025-01' } })
    expect(onChange).toHaveBeenCalledWith({ month: '2025-01', bank: null, statement_id: null, category: null })
  })

  it('selecting empty month calls onChange with month: null', () => {
    const onChange = vi.fn()
    const filter: FilterState = { month: '2025-01', bank: null, statement_id: null, category: null }
    render(
      <FilterBar
        availableMonths={['2025-01', '2025-02']}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={filter}
        onChange={onChange}
      />,
    )
    fireEvent.change(screen.getByTestId('month-dropdown'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith({ month: null, bank: null, statement_id: null, category: null })
  })
})

describe('FilterBar — card pills', () => {
  it('renders All pill and one pill per card', () => {
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={defaultFilter}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('card-pill-all')).toBeInTheDocument()
    expect(screen.getByTestId('card-pill-stmt-a')).toHaveTextContent('Regalia')
    expect(screen.getByTestId('card-pill-stmt-b')).toHaveTextContent('Millennia')
  })

  it('not rendered when availableCards is empty', () => {
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={[]}
        availableCards={[]}
        filter={defaultFilter}
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('card-pill-all')).not.toBeInTheDocument()
  })

  it('clicking a card pill calls onChange with bank and statement_id', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={defaultFilter}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByTestId('card-pill-stmt-a'))
    expect(onChange).toHaveBeenCalledWith({ month: null, bank: 'hdfc', statement_id: 'stmt-a', category: null })
  })

  it('clicking All pill clears bank and statement_id', () => {
    const onChange = vi.fn()
    const filter: FilterState = { month: null, bank: 'hdfc', statement_id: 'stmt-a', category: null }
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={filter}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByTestId('card-pill-all'))
    expect(onChange).toHaveBeenCalledWith({ month: null, bank: null, statement_id: null, category: null })
  })

  it('active pill has card-pill--active class', () => {
    const filter: FilterState = { month: null, bank: 'hdfc', statement_id: 'stmt-a', category: null }
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={filter}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('card-pill-stmt-a').className).toContain('card-pill--active')
    expect(screen.getByTestId('card-pill-all').className).not.toContain('card-pill--active')
  })

  it('All pill has card-pill--active class when no card selected', () => {
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={defaultFilter}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('card-pill-all').className).toContain('card-pill--active')
  })

  it('card label uses card_name when available', () => {
    const cards: CardDescriptor[] = [
      { statement_id: 'stmt-a', bank: 'hdfc', card_name: 'Regalia', last_four: '1234' },
    ]
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc']}
        availableCards={cards}
        filter={defaultFilter}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('card-pill-stmt-a')).toHaveTextContent('Regalia')
  })

  it('card label shows bank + last four when card_name is null', () => {
    const cards: CardDescriptor[] = [
      { statement_id: 'stmt-x', bank: 'icici', card_name: null, last_four: '9999' },
    ]
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['icici']}
        availableCards={cards}
        filter={defaultFilter}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('card-pill-stmt-x')).toHaveTextContent('ICICI ••••9999')
  })

  it('card label shows bank only when card_name and last_four are null', () => {
    const cards: CardDescriptor[] = [
      { statement_id: 'stmt-y', bank: 'sbi', card_name: null, last_four: null },
    ]
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['sbi']}
        availableCards={cards}
        filter={defaultFilter}
        onChange={vi.fn()}
      />,
    )
    expect(screen.getByTestId('card-pill-stmt-y')).toHaveTextContent('SBI')
  })

  it('shows all cards regardless of selected bank', () => {
    const mixedCards: CardDescriptor[] = [
      { statement_id: 'stmt-hdfc', bank: 'hdfc', card_name: null, last_four: '1111' },
      { statement_id: 'stmt-icici', bank: 'icici', card_name: null, last_four: '2222' },
    ]
    const filter: FilterState = { month: null, bank: 'hdfc', statement_id: null, category: null }
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc', 'icici']}
        availableCards={mixedCards}
        filter={filter}
        onChange={vi.fn()}
      />,
    )
    // Both cards visible regardless of bank filter
    expect(screen.getByTestId('card-pill-stmt-hdfc')).toBeInTheDocument()
    expect(screen.getByTestId('card-pill-stmt-icici')).toBeInTheDocument()
  })
})

describe('FilterBar — no bank dropdown', () => {
  it('bank-dropdown is not present', () => {
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc', 'icici']}
        availableCards={twoHdfcCards}
        filter={defaultFilter}
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('bank-dropdown')).not.toBeInTheDocument()
  })
})

describe('FilterBar — category', () => {
  it('category-dropdown is not present (moved to TransactionsTable)', () => {
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={[]}
        availableCards={[]}
        filter={{ month: null, bank: null, statement_id: null, category: null }}
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryByTestId('category-dropdown')).not.toBeInTheDocument()
  })
})
