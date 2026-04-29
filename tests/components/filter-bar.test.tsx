import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '@/components/dashboard/filter-bar'
import type { FilterState, CardDescriptor } from '@/lib/dashboard-data'

const defaultFilter: FilterState = { month: null, bank: null, statement_id: null }

const twoHdfcCards: CardDescriptor[] = [
  { statement_id: 'stmt-a', bank: 'hdfc', card_name: 'Regalia', last_four: '1234' },
  { statement_id: 'stmt-b', bank: 'hdfc', card_name: 'Millennia', last_four: '5678' },
]

describe('FilterBar — card pills', () => {
  it('renders a card pill for each available card', () => {
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
    expect(screen.getByTestId('card-all')).toBeInTheDocument()
    expect(screen.getByTestId('card-filter-stmt-a')).toHaveTextContent('HDFC Regalia ••••1234')
    expect(screen.getByTestId('card-filter-stmt-b')).toHaveTextContent('HDFC Millennia ••••5678')
  })

  it('card pill shows only bank and last four when card_name is null', () => {
    const onChange = vi.fn()
    const cards: CardDescriptor[] = [
      { statement_id: 'stmt-x', bank: 'icici', card_name: null, last_four: '9999' },
    ]
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['icici']}
        availableCards={cards}
        filter={defaultFilter}
        onChange={onChange}
      />,
    )
    expect(screen.getByTestId('card-filter-stmt-x')).toHaveTextContent('ICICI ••••9999')
  })

  it('card pill shows bank + Card when both card_name and last_four are null', () => {
    const onChange = vi.fn()
    const cards: CardDescriptor[] = [
      { statement_id: 'stmt-y', bank: 'sbi', card_name: null, last_four: null },
    ]
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['sbi']}
        availableCards={cards}
        filter={defaultFilter}
        onChange={onChange}
      />,
    )
    expect(screen.getByTestId('card-filter-stmt-y')).toHaveTextContent('SBI Card')
  })

  it('clicking a card pill calls onChange with statement_id and matching bank', () => {
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
    fireEvent.click(screen.getByTestId('card-filter-stmt-a'))
    expect(onChange).toHaveBeenCalledWith({
      month: null,
      bank: 'hdfc',
      statement_id: 'stmt-a',
    })
  })

  it('clicking All cards resets statement_id to null', () => {
    const onChange = vi.fn()
    const filter: FilterState = { month: null, bank: 'hdfc', statement_id: 'stmt-a' }
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={filter}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByTestId('card-all'))
    expect(onChange).toHaveBeenCalledWith({ month: null, bank: 'hdfc', statement_id: null })
  })

  it('clicking a bank pill resets statement_id to null', () => {
    const onChange = vi.fn()
    const filter: FilterState = { month: null, bank: 'hdfc', statement_id: 'stmt-a' }
    render(
      <FilterBar
        availableMonths={['2025-01']}
        availableBanks={['hdfc', 'icici']}
        availableCards={twoHdfcCards}
        filter={filter}
        onChange={onChange}
      />,
    )
    fireEvent.click(screen.getByTestId('bank-filter-icici'))
    expect(onChange).toHaveBeenCalledWith({ month: null, bank: 'icici', statement_id: null })
  })

  it('card row shows only cards matching selected bank', () => {
    const onChange = vi.fn()
    const mixedCards: CardDescriptor[] = [
      { statement_id: 'stmt-hdfc', bank: 'hdfc', card_name: null, last_four: '1111' },
      { statement_id: 'stmt-icici', bank: 'icici', card_name: null, last_four: '2222' },
    ]
    const filter: FilterState = { month: null, bank: 'hdfc', statement_id: null }
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc', 'icici']}
        availableCards={mixedCards}
        filter={filter}
        onChange={onChange}
      />,
    )
    expect(screen.getByTestId('card-filter-stmt-hdfc')).toBeInTheDocument()
    expect(screen.queryByTestId('card-filter-stmt-icici')).not.toBeInTheDocument()
  })
})
