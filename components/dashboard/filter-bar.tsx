'use client'

import { useCallback, type MouseEvent } from 'react'
import type { BankSlug } from '@/types'
import type { FilterState, CardDescriptor } from '@/lib/dashboard-data'

export interface FilterBarProps {
  availableMonths: string[]
  availableBanks: BankSlug[]
  availableCards: CardDescriptor[]
  filter: FilterState
  onChange: (filter: FilterState) => void
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number)
  const shortYear = String(year).slice(-2)
  return `${MONTH_NAMES[month - 1]} '${shortYear}`
}

function formatCardLabel(card: CardDescriptor): string {
  const bank = card.bank.toUpperCase()
  const parts: string[] = [bank]
  if (card.card_name) parts.push(card.card_name)
  if (card.last_four) parts.push(`••••${card.last_four}`)
  if (!card.card_name && !card.last_four) parts.push('Card')
  return parts.join(' ')
}

const PILL_CLASS = 'px-3 py-1.5 text-sm rounded-full font-medium cursor-pointer border whitespace-nowrap select-none inline-flex items-center'

function pillStyle(active: boolean): Record<string, string> {
  return active
    ? { background: 'var(--primary)', color: '#ffffff', borderColor: 'var(--primary)' }
    : { background: '#ffffff', color: 'var(--muted)', borderColor: 'var(--border)' }
}

export function FilterBar({ availableMonths, availableBanks, availableCards, filter, onChange }: FilterBarProps): JSX.Element {
  const visibleCards = filter.bank !== null
    ? availableCards.filter((c) => c.bank === filter.bank)
    : availableCards

  const handleMonthAll = useCallback((): void => {
    onChange({ ...filter, month: null })
  }, [filter, onChange])

  const handleBankAll = useCallback((): void => {
    onChange({ ...filter, bank: null, statement_id: null })
  }, [filter, onChange])

  const handleCardAll = useCallback((): void => {
    onChange({ ...filter, statement_id: null })
  }, [filter, onChange])

  const handleMonthClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>): void => {
      const month = e.currentTarget.dataset.month
      if (month) onChange({ ...filter, month })
    },
    [filter, onChange],
  )

  const handleBankClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>): void => {
      const bank = e.currentTarget.dataset.bank as BankSlug | undefined
      if (bank) onChange({ ...filter, bank, statement_id: null })
    },
    [filter, onChange],
  )

  const handleCardClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>): void => {
      const statementId = e.currentTarget.dataset.statementId
      const bank = e.currentTarget.dataset.bank as BankSlug | undefined
      if (statementId && bank) onChange({ ...filter, bank, statement_id: statementId })
    },
    [filter, onChange],
  )

  return (
    <div className="flex flex-col gap-3" role="group" aria-label="Dashboard filters">
      {/* Month pills */}
      <div className="filter-bar-scroll flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          className={PILL_CLASS}
          style={pillStyle(filter.month === null)}
          aria-pressed={filter.month === null}
          data-testid="month-all"
          onClick={handleMonthAll}
        >
          All months
        </button>
        {availableMonths.map((month) => (
          <button
            key={month}
            type="button"
            className={PILL_CLASS}
            style={pillStyle(filter.month === month)}
            aria-pressed={filter.month === month}
            data-testid={`month-filter-${month}`}
            data-month={month}
            onClick={handleMonthClick}
          >
            {formatMonth(month)}
          </button>
        ))}
      </div>

      {/* Bank pills */}
      <div className="filter-bar-scroll flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          className={PILL_CLASS}
          style={pillStyle(filter.bank === null)}
          aria-pressed={filter.bank === null}
          data-testid="bank-all"
          onClick={handleBankAll}
        >
          All banks
        </button>
        {availableBanks.map((bank) => (
          <button
            key={bank}
            type="button"
            className={PILL_CLASS}
            style={pillStyle(filter.bank === bank && filter.statement_id === null)}
            aria-pressed={filter.bank === bank && filter.statement_id === null}
            data-testid={`bank-filter-${bank}`}
            data-bank={bank}
            onClick={handleBankClick}
          >
            {bank.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Card pills */}
      {availableCards.length > 0 && (
        <div className="filter-bar-scroll flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            className={PILL_CLASS}
            style={pillStyle(filter.statement_id === null)}
            aria-pressed={filter.statement_id === null}
            data-testid="card-all"
            onClick={handleCardAll}
          >
            All cards
          </button>
          {visibleCards.map((card) => (
            <button
              key={card.statement_id}
              type="button"
              className={PILL_CLASS}
              style={pillStyle(filter.statement_id === card.statement_id)}
              aria-pressed={filter.statement_id === card.statement_id}
              data-testid={`card-filter-${card.statement_id}`}
              data-statement-id={card.statement_id}
              data-bank={card.bank}
              onClick={handleCardClick}
            >
              {formatCardLabel(card)}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
