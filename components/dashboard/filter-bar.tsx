'use client'

import { useCallback } from 'react'
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
  if (card.card_name) return card.card_name
  if (card.last_four) return `${card.bank.toUpperCase()} ••••${card.last_four}`
  return card.bank.toUpperCase()
}

export function FilterBar({ availableMonths, availableCards, filter, onChange }: FilterBarProps): JSX.Element {
  const handleCardPill = useCallback(
    (card: CardDescriptor | null): void => {
      if (!card) {
        onChange({ ...filter, bank: null, statement_id: null })
      } else {
        onChange({ ...filter, bank: card.bank, statement_id: card.statement_id })
      }
    },
    [filter, onChange],
  )

  const handleMonthChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      onChange({ ...filter, month: e.target.value || null })
    },
    [filter, onChange],
  )

  return (
    <div className="filter-bar" role="group" aria-label="Dashboard filters">
      {/* Card pills */}
      {availableCards.length > 0 && (
        <>
          <button
            type="button"
            onClick={() => handleCardPill(null)}
            className={`card-pill${!filter.statement_id ? ' card-pill--active' : ''}`}
            data-testid="card-pill-all"
          >
            All
          </button>
          {availableCards.map((card) => (
            <button
              key={card.statement_id}
              type="button"
              onClick={() => handleCardPill(card)}
              className={`card-pill${filter.statement_id === card.statement_id ? ' card-pill--active' : ''}`}
              data-testid={`card-pill-${card.statement_id}`}
            >
              {formatCardLabel(card)}
            </button>
          ))}
          {availableMonths.length > 0 && <span className="filter-divider" aria-hidden="true" />}
        </>
      )}

      {/* Month select — compact pill */}
      {availableMonths.length > 0 && (
        <select
          value={filter.month ?? ''}
          onChange={handleMonthChange}
          className={`month-pill${filter.month ? ' month-pill--active' : ''}`}
          data-testid="month-dropdown"
          aria-label="Filter by month"
        >
          <option value="">All months</option>
          {availableMonths.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
      )}
    </div>
  )
}
