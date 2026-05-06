import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FilterBar } from '@/components/dashboard/filter-bar'
import type { FilterState, CardDescriptor } from '@/lib/dashboard-data'

const defaultFilter: FilterState = { month: null, bank: null, statement_id: null }

const twoHdfcCards: CardDescriptor[] = [
  { statement_id: 'stmt-a', bank: 'hdfc', card_name: 'Regalia', last_four: '1234' },
  { statement_id: 'stmt-b', bank: 'hdfc', card_name: 'Millennia', last_four: '5678' },
]

describe('FilterBar — select dropdowns', () => {
  it('month dropdown renders options from availableMonths', () => {
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

  it('month dropdown is not rendered when availableMonths is empty', () => {
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
    const monthSelect = screen.getByTestId('month-dropdown') as HTMLSelectElement
    fireEvent.change(monthSelect, { target: { value: '2025-01' } })
    expect(onChange).toHaveBeenCalledWith({
      month: '2025-01',
      bank: null,
      statement_id: null,
    })
  })

  it('clearing month (selecting empty) calls onChange with month: null', () => {
    const onChange = vi.fn()
    const filter: FilterState = { month: '2025-01', bank: null, statement_id: null }
    render(
      <FilterBar
        availableMonths={['2025-01', '2025-02']}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={filter}
        onChange={onChange}
      />,
    )
    const monthSelect = screen.getByTestId('month-dropdown') as HTMLSelectElement
    fireEvent.change(monthSelect, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith({
      month: null,
      bank: null,
      statement_id: null,
    })
  })

  it('bank dropdown renders all banks', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc', 'icici']}
        availableCards={twoHdfcCards}
        filter={defaultFilter}
        onChange={onChange}
      />,
    )
    const bankSelect = screen.getByTestId('bank-dropdown') as HTMLSelectElement
    expect(bankSelect).toBeInTheDocument()
    const options = Array.from(bankSelect.options)
    expect(options).toHaveLength(3) // "All banks" + 2 banks
    expect(options[0]).toHaveTextContent('All banks')
    expect(options[1]).toHaveTextContent('HDFC')
    expect(options[2]).toHaveTextContent('ICICI')
  })

  it('selecting a bank calls onChange with bank and resets statement_id to null', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc', 'icici']}
        availableCards={twoHdfcCards}
        filter={defaultFilter}
        onChange={onChange}
      />,
    )
    const bankSelect = screen.getByTestId('bank-dropdown') as HTMLSelectElement
    fireEvent.change(bankSelect, { target: { value: 'icici' } })
    expect(onChange).toHaveBeenCalledWith({
      month: null,
      bank: 'icici',
      statement_id: null,
    })
  })

  it('clearing bank (selecting empty) calls onChange with bank: null and statement_id: null', () => {
    const onChange = vi.fn()
    const filter: FilterState = { month: null, bank: 'hdfc', statement_id: null }
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc', 'icici']}
        availableCards={twoHdfcCards}
        filter={filter}
        onChange={onChange}
      />,
    )
    const bankSelect = screen.getByTestId('bank-dropdown') as HTMLSelectElement
    fireEvent.change(bankSelect, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith({
      month: null,
      bank: null,
      statement_id: null,
    })
  })

  it('card dropdown renders options from available cards', () => {
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
    const cardSelect = screen.getByTestId('card-dropdown') as HTMLSelectElement
    expect(cardSelect).toBeInTheDocument()
    const options = Array.from(cardSelect.options)
    expect(options).toHaveLength(3) // "All cards" + 2 cards
    expect(options[0]).toHaveTextContent('All cards')
    expect(options[1]).toHaveTextContent('HDFC Regalia ••••1234')
    expect(options[2]).toHaveTextContent('HDFC Millennia ••••5678')
  })

  it('selecting a card calls onChange with bank and statement_id', () => {
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
    const cardSelect = screen.getByTestId('card-dropdown') as HTMLSelectElement
    fireEvent.change(cardSelect, { target: { value: 'stmt-a' } })
    expect(onChange).toHaveBeenCalledWith({
      month: null,
      bank: 'hdfc',
      statement_id: 'stmt-a',
    })
  })

  it('clearing card (selecting empty) calls onChange with statement_id: null', () => {
    const onChange = vi.fn()
    const filter: FilterState = { month: null, bank: null, statement_id: 'stmt-a' }
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc']}
        availableCards={twoHdfcCards}
        filter={filter}
        onChange={onChange}
      />,
    )
    const cardSelect = screen.getByTestId('card-dropdown') as HTMLSelectElement
    fireEvent.change(cardSelect, { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith({
      month: null,
      bank: null,
      statement_id: null,
    })
  })

  it('card dropdown shows only cards matching selected bank', () => {
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
    const cardSelect = screen.getByTestId('card-dropdown') as HTMLSelectElement
    const options = Array.from(cardSelect.options)
    expect(options).toHaveLength(2) // "All cards" + 1 matching card (hdfc only)
    expect(options[0]).toHaveTextContent('All cards')
    expect(options[1]).toHaveTextContent('HDFC ••••1111')
  })

  it('card dropdown shows all cards when no bank is selected', () => {
    const onChange = vi.fn()
    const mixedCards: CardDescriptor[] = [
      { statement_id: 'stmt-hdfc', bank: 'hdfc', card_name: null, last_four: '1111' },
      { statement_id: 'stmt-icici', bank: 'icici', card_name: null, last_four: '2222' },
    ]
    const filter: FilterState = { month: null, bank: null, statement_id: null }
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc', 'icici']}
        availableCards={mixedCards}
        filter={filter}
        onChange={onChange}
      />,
    )
    const cardSelect = screen.getByTestId('card-dropdown') as HTMLSelectElement
    const options = Array.from(cardSelect.options)
    expect(options).toHaveLength(3) // "All cards" + 2 cards
    expect(options[1]).toHaveTextContent('HDFC ••••1111')
    expect(options[2]).toHaveTextContent('ICICI ••••2222')
  })

  it('card label shows only bank and last four when card_name is null', () => {
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
    const cardSelect = screen.getByTestId('card-dropdown') as HTMLSelectElement
    const options = Array.from(cardSelect.options)
    expect(options[1]).toHaveTextContent('ICICI ••••9999')
  })

  it('card label shows bank + Card when both card_name and last_four are null', () => {
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
    const cardSelect = screen.getByTestId('card-dropdown') as HTMLSelectElement
    const options = Array.from(cardSelect.options)
    expect(options[1]).toHaveTextContent('SBI Card')
  })

  it('card dropdown is not rendered when availableCards is empty', () => {
    const onChange = vi.fn()
    render(
      <FilterBar
        availableMonths={[]}
        availableBanks={['hdfc']}
        availableCards={[]}
        filter={defaultFilter}
        onChange={onChange}
      />,
    )
    expect(screen.queryByTestId('card-dropdown')).not.toBeInTheDocument()
  })
})
