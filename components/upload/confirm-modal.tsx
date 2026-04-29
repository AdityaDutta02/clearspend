'use client'

import {
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import type { DetectionResult } from '@/lib/bank-detect'

export interface ConfirmModalProps {
  isOpen: boolean
  detection: DetectionResult | null
  fileName: string
  creditCost: number
  onConfirm: () => void
  onCancel: () => void
  isAnalysing: boolean
}

const MONTH_NAMES: Record<string, string> = {
  '01': 'January',
  '02': 'February',
  '03': 'March',
  '04': 'April',
  '05': 'May',
  '06': 'June',
  '07': 'July',
  '08': 'August',
  '09': 'September',
  '10': 'October',
  '11': 'November',
  '12': 'December',
}

function formatMonth(yearMonth: string | null): string {
  if (!yearMonth) return 'Unknown Period'
  const [year, month] = yearMonth.split('-')
  const monthName = MONTH_NAMES[month] ?? month
  return `${monthName} ${year}`
}

function formatBankName(bank: string | null): string {
  if (!bank) return 'Unknown Bank'
  return bank.toUpperCase()
}

function Spinner(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="animate-spin inline-block mr-2"
    >
      <line x1="12" y1="2" x2="12" y2="6" />
      <line x1="12" y1="18" x2="12" y2="22" />
      <line x1="4.93" y1="4.93" x2="7.76" y2="7.76" />
      <line x1="16.24" y1="16.24" x2="19.07" y2="19.07" />
      <line x1="2" y1="12" x2="6" y2="12" />
      <line x1="18" y1="12" x2="22" y2="12" />
      <line x1="4.93" y1="19.07" x2="7.76" y2="16.24" />
      <line x1="16.24" y1="7.76" x2="19.07" y2="4.93" />
    </svg>
  )
}

export function ConfirmModal({
  isOpen,
  detection,
  fileName,
  creditCost,
  onConfirm,
  onCancel,
  isAnalysing,
}: ConfirmModalProps): JSX.Element | null {
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const titleId = 'confirm-modal-title'
  const isUnknownBank = !detection?.bank

  useEffect((): void => {
    if (isOpen) {
      confirmButtonRef.current?.focus()
    }
  }, [isOpen])

  useEffect((): (() => void) => {
    if (!isOpen) return () => undefined

    const handleKeyDown = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape' && !isAnalysing) {
        onCancel()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return (): void => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isAnalysing, onCancel])

  const handleBackdropClick = useCallback(
    (e: MouseEvent<HTMLDivElement>): void => {
      if (!isAnalysing && e.target === e.currentTarget) {
        onCancel()
      }
    },
    [isAnalysing, onCancel],
  )

  const handleBackdropKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        if (!isAnalysing) {
          onCancel()
        }
      }
    },
    [isAnalysing, onCancel],
  )

  if (!isOpen) return null

  const bankName = formatBankName(detection?.bank ?? null)
  const accountType = detection?.account_type
    ? detection.account_type.charAt(0).toUpperCase() + detection.account_type.slice(1)
    : 'Unknown'
  const statementMonth = formatMonth(detection?.month ?? null)
  const cardLabel = detection?.card_name && detection?.last_four
    ? `${detection.card_name} ••••${detection.last_four}`
    : detection?.last_four
      ? `••••${detection.last_four}`
      : detection?.card_name ?? null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={handleBackdropClick}
      onKeyDown={handleBackdropKeyDown}
      role="presentation"
      data-testid="modal-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="card w-full"
        style={{ maxWidth: '480px', position: 'relative' }}
        data-testid="confirm-modal"
        onClick={(e: MouseEvent<HTMLDivElement>): void => e.stopPropagation()}
      >
        <h2
          id={titleId}
          className="text-lg font-semibold mb-4"
          style={{ color: 'var(--text)' }}
          data-testid="modal-title"
        >
          Confirm Analysis
        </h2>

        <div className="mb-4 space-y-2">
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            <span className="font-medium" style={{ color: 'var(--text)' }}>
              File:
            </span>{' '}
            {fileName}
          </p>

          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            <span className="font-medium" style={{ color: 'var(--text)' }}>
              Bank:
            </span>{' '}
            <span data-testid="bank-name">{bankName}</span>
          </p>

          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            <span className="font-medium" style={{ color: 'var(--text)' }}>
              Account Type:
            </span>{' '}
            {accountType}
          </p>

          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            <span className="font-medium" style={{ color: 'var(--text)' }}>
              Statement Period:
            </span>{' '}
            {statementMonth}
          </p>

          {cardLabel !== null && (
            <p className="text-sm" style={{ color: 'var(--muted)' }} data-testid="card-label">
              <span className="font-medium" style={{ color: 'var(--text)' }}>
                Card:
              </span>{' '}
              {cardLabel}
            </p>
          )}
        </div>

        {isUnknownBank && (
          <div
            className="mb-4 p-3 rounded-lg text-sm"
            style={{
              background: 'rgba(245, 158, 11, 0.08)',
              border: '1px solid rgba(245, 158, 11, 0.3)',
              color: '#92400e',
            }}
            data-testid="unknown-bank-warning"
          >
            We detected this as an unknown bank. Analysis quality may be lower.
          </div>
        )}

        <div
          className="mb-6 p-3 rounded-lg text-sm"
          style={{
            background: 'rgba(30, 64, 175, 0.06)',
            border: '1px solid rgba(30, 64, 175, 0.15)',
            color: 'var(--text)',
          }}
          data-testid="credit-cost-notice"
        >
          This analysis will use{' '}
          <strong>{creditCost} credits</strong>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isAnalysing}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-opacity"
            style={{
              color: 'var(--muted)',
              border: '1px solid var(--border)',
              background: 'transparent',
              opacity: isAnalysing ? 0.5 : 1,
              cursor: isAnalysing ? 'not-allowed' : 'pointer',
            }}
            data-testid="cancel-button"
          >
            Cancel
          </button>

          <button
            ref={confirmButtonRef}
            type="button"
            onClick={onConfirm}
            disabled={isAnalysing}
            className="px-4 py-2 text-sm font-medium rounded-lg transition-opacity"
            style={{
              color: '#ffffff',
              background: 'var(--primary)',
              opacity: isAnalysing ? 0.7 : 1,
              cursor: isAnalysing ? 'not-allowed' : 'pointer',
            }}
            data-testid="confirm-button"
          >
            {isAnalysing ? (
              <>
                <Spinner />
                Analysing…
              </>
            ) : (
              'Analyse Statement'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
