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
  const bank = card.bank.toUpperCase()
  const parts: string[] = [bank]
  if (card.card_name) parts.push(card.card_name)
  if (card.last_four) parts.push(`••••${card.last_four}`)
  if (!card.card_name && !card.last_four) parts.push('Card')
  return parts.join(' ')
}

const selectStyle: React.CSSProperties = {
  appearance: 'none',
  WebkitAppearance: 'none',
  background: 'rgba(15, 23, 42, 0.05)',
  border: '1px solid transparent',
  borderRadius: '999px',
  padding: '5px 32px 5px 14px',
  fontSize: '0.775rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  color: 'var(--muted)',
  cursor: 'pointer',
  outline: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2364748B' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 12px center',
  transition: 'background-color 0.18s ease, color 0.18s ease',
}

const activeSelectStyle: React.CSSProperties = {
  ...selectStyle,
  backgroundColor: 'var(--primary)',
  color: '#ffffff',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23ffffff' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
}

export function FilterBar({ availableMonths, availableBanks, availableCards, filter, onChange }: FilterBarProps): JSX.Element {
  const handleMonthChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      onChange({ ...filter, month: e.target.value || null })
    },
    [filter, onChange],
  )

  const handleBankChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      onChange({ ...filter, bank: (e.target.value as BankSlug) || null, statement_id: null })
    },
    [filter, onChange],
  )

  const handleCardChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>): void => {
      const val = e.target.value
      if (!val) {
        onChange({ ...filter, statement_id: null })
        return
      }
      const card = availableCards.find((c) => c.statement_id === val)
      if (card) onChange({ ...filter, bank: card.bank, statement_id: val })
    },
    [filter, availableCards, onChange],
  )

  const visibleCards = filter.bank !== null
    ? availableCards.filter((c) => c.bank === filter.bank)
    : availableCards

  return (
    <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Dashboard filters">
      {availableMonths.length > 0 && (
        <select
          value={filter.month ?? ''}
          onChange={handleMonthChange}
          style={filter.month ? activeSelectStyle : selectStyle}
          data-testid="month-dropdown"
          aria-label="Filter by month"
        >
          <option value="">All months</option>
          {availableMonths.map((m) => (
            <option key={m} value={m}>{formatMonth(m)}</option>
          ))}
        </select>
      )}

      {availableBanks.length > 0 && (
        <select
          value={filter.bank ?? ''}
          onChange={handleBankChange}
          style={filter.bank && !filter.statement_id ? activeSelectStyle : selectStyle}
          data-testid="bank-dropdown"
          aria-label="Filter by bank"
        >
          <option value="">All banks</option>
          {availableBanks.map((bank) => (
            <option key={bank} value={bank}>{bank.toUpperCase()}</option>
          ))}
        </select>
      )}

      {availableCards.length > 0 && (
        <select
          value={filter.statement_id ?? ''}
          onChange={handleCardChange}
          style={filter.statement_id ? activeSelectStyle : selectStyle}
          data-testid="card-dropdown"
          aria-label="Filter by card"
        >
          <option value="">All cards</option>
          {visibleCards.map((card) => (
            <option key={card.statement_id} value={card.statement_id}>
              {formatCardLabel(card)}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
