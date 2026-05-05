'use client'

import { useCallback, type MouseEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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

interface PillProps {
  layoutId: string
  isActive: boolean
  onClick: () => void
  testId: string
  children: React.ReactNode
}

function Pill({ layoutId, isActive, onClick, testId, children }: PillProps): JSX.Element {
  return (
    <button
      type="button"
      className="pill"
      aria-pressed={isActive}
      data-testid={testId}
      onClick={onClick}
      style={{
        color: isActive ? '#ffffff' : 'var(--muted)',
        background: isActive ? 'transparent' : 'rgba(15, 23, 42, 0.05)',
        transition: 'color 0.22s cubic-bezier(0.32,0.72,0,1), background 0.22s cubic-bezier(0.32,0.72,0,1)',
      }}
    >
      <AnimatePresence>
        {isActive && (
          <motion.span
            layoutId={layoutId}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.38 }}
            style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '999px',
              background: 'var(--primary)',
              boxShadow: '0 2px 10px rgba(37, 99, 235, 0.25)',
              zIndex: -1,
            }}
          />
        )}
      </AnimatePresence>
      {children}
    </button>
  )
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
    <div className="flex flex-col gap-2" role="group" aria-label="Dashboard filters">

      {/* Month pills */}
      <div className="filter-bar-scroll flex gap-1.5 overflow-x-auto pb-1">
        <Pill
          layoutId="active-month-pill"
          isActive={filter.month === null}
          onClick={handleMonthAll}
          testId="month-all"
        >
          All months
        </Pill>
        {availableMonths.map((month) => (
          <button
            key={month}
            type="button"
            className="pill"
            aria-pressed={filter.month === month}
            data-testid={`month-filter-${month}`}
            data-month={month}
            onClick={handleMonthClick}
            style={{
              color: filter.month === month ? '#ffffff' : 'var(--muted)',
              background: filter.month === month ? 'transparent' : 'rgba(12, 30, 22, 0.04)',
            }}
          >
            <AnimatePresence>
              {filter.month === month && (
                <motion.span
                  layoutId="active-month-pill"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.38 }}
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '999px',
                    background: 'var(--primary)',
                    boxShadow: '0 2px 10px rgba(37, 99, 235, 0.25)',
                    zIndex: -1,
                  }}
                />
              )}
            </AnimatePresence>
            {formatMonth(month)}
          </button>
        ))}
      </div>

      {/* Bank pills */}
      <div className="filter-bar-scroll flex gap-1.5 overflow-x-auto pb-1">
        <Pill
          layoutId="active-bank-pill"
          isActive={filter.bank === null}
          onClick={handleBankAll}
          testId="bank-all"
        >
          All banks
        </Pill>
        {availableBanks.map((bank) => {
          const isActive = filter.bank === bank && filter.statement_id === null
          return (
            <button
              key={bank}
              type="button"
              className="pill"
              aria-pressed={isActive}
              data-testid={`bank-filter-${bank}`}
              data-bank={bank}
              onClick={handleBankClick}
              style={{
                color: isActive ? '#ffffff' : 'var(--muted)',
                background: isActive ? 'transparent' : 'rgba(15, 23, 42, 0.05)',
              }}
            >
              <AnimatePresence>
                {isActive && (
                  <motion.span
                    layoutId="active-bank-pill"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.38 }}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      borderRadius: '999px',
                      background: 'var(--primary)',
                      boxShadow: '0 2px 10px rgba(37, 99, 235, 0.25)',
                      zIndex: -1,
                    }}
                  />
                )}
              </AnimatePresence>
              {bank.toUpperCase()}
            </button>
          )
        })}
      </div>

      {/* Card pills */}
      {availableCards.length > 0 && (
        <div className="filter-bar-scroll flex gap-1.5 overflow-x-auto pb-1">
          <Pill
            layoutId="active-card-pill"
            isActive={filter.statement_id === null}
            onClick={handleCardAll}
            testId="card-all"
          >
            All cards
          </Pill>
          {visibleCards.map((card) => {
            const isActive = filter.statement_id === card.statement_id
            return (
              <button
                key={card.statement_id}
                type="button"
                className="pill"
                aria-pressed={isActive}
                data-testid={`card-filter-${card.statement_id}`}
                data-statement-id={card.statement_id}
                data-bank={card.bank}
                onClick={handleCardClick}
                style={{
                  color: isActive ? '#ffffff' : 'var(--muted)',
                  background: isActive ? 'transparent' : 'rgba(15, 23, 42, 0.05)',
                }}
              >
                <AnimatePresence>
                  {isActive && (
                    <motion.span
                      layoutId="active-card-pill"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: 'spring', bounce: 0.2, duration: 0.38 }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: '999px',
                        background: 'var(--primary)',
                        boxShadow: '0 2px 10px rgba(37, 99, 235, 0.25)',
                        zIndex: -1,
                      }}
                    />
                  )}
                </AnimatePresence>
                {formatCardLabel(card)}
              </button>
            )
          })}
        </div>
      )}

    </div>
  )
}
