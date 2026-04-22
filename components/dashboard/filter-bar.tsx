'use client'

import { useCallback, type MouseEvent } from 'react'
import type { BankSlug } from '@/types'
import type { FilterState } from '@/lib/dashboard-data'

export interface FilterBarProps {
  availableMonths: string[] // "YYYY-MM" strings, descending
  availableBanks: BankSlug[]
  filter: FilterState
  onChange: (filter: FilterState) => void
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number)
  const shortYear = String(year).slice(-2)
  return `${MONTH_NAMES[month - 1]} '${shortYear}`
}

const PILL_CLASS = 'px-3 py-1.5 text-sm rounded-full font-medium cursor-pointer border whitespace-nowrap select-none inline-flex items-center'

function pillStyle(active: boolean): Record<string, string> {
  return active
    ? { background: 'var(--primary)', color: '#ffffff', borderColor: 'var(--primary)' }
    : { background: '#ffffff', color: 'var(--muted)', borderColor: 'var(--border)' }
}

export function FilterBar({ availableMonths, availableBanks, filter, onChange }: FilterBarProps): JSX.Element {
  const handleMonthAll = useCallback((): void => {
    onChange({ ...filter, month: null })
  }, [filter, onChange])

  const handleBankAll = useCallback((): void => {
    onChange({ ...filter, bank: null })
  }, [filter, onChange])

  // Use data-month attribute to avoid creating a new closure per pill in the map
  const handleMonthClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>): void => {
      const month = e.currentTarget.dataset.month
      if (month) onChange({ ...filter, month })
    },
    [filter, onChange],
  )

  // Use data-bank attribute to avoid creating a new closure per pill in the map
  const handleBankClick = useCallback(
    (e: MouseEvent<HTMLButtonElement>): void => {
      const bank = e.currentTarget.dataset.bank as BankSlug | undefined
      if (bank) onChange({ ...filter, bank })
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
        {availableMonths.map((month) => {
          const isActive = filter.month === month
          return (
            <button
              key={month}
              type="button"
              className={PILL_CLASS}
              style={pillStyle(isActive)}
              aria-pressed={isActive}
              data-testid={`month-filter-${month}`}
              data-month={month}
              onClick={handleMonthClick}
            >
              {formatMonth(month)}
            </button>
          )
        })}
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
        {availableBanks.map((bank) => {
          const isActive = filter.bank === bank
          return (
            <button
              key={bank}
              type="button"
              className={PILL_CLASS}
              style={pillStyle(isActive)}
              aria-pressed={isActive}
              data-testid={`bank-filter-${bank}`}
              data-bank={bank}
              onClick={handleBankClick}
            >
              {bank.toUpperCase()}
            </button>
          )
        })}
      </div>
    </div>
  )
}
