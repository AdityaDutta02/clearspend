'use client'

import {
  useEffect,
  useRef,
  useCallback,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  '01': 'January', '02': 'February', '03': 'March', '04': 'April',
  '05': 'May', '06': 'June', '07': 'July', '08': 'August',
  '09': 'September', '10': 'October', '11': 'November', '12': 'December',
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
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="animate-spin inline-block"
      style={{ marginRight: '6px', verticalAlign: 'middle' }}
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

interface DetailRowProps {
  label: string
  value: string
  testId?: string
}

function DetailRow({ label, value, testId }: DetailRowProps): JSX.Element {
  return (
    <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}>
      <span
        style={{
          fontSize: '0.65rem',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--muted)',
          minWidth: '108px',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{ fontSize: '0.825rem', fontWeight: 500, color: 'var(--text)' }}
        data-testid={testId}
      >
        {value}
      </span>
    </div>
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
      setTimeout(() => confirmButtonRef.current?.focus(), 60)
    }
  }, [isOpen])

  useEffect((): (() => void) => {
    if (!isOpen) return () => undefined

    const handleKeyDown = (e: globalThis.KeyboardEvent): void => {
      if (e.key === 'Escape' && !isAnalysing) onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return (): void => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, isAnalysing, onCancel])

  const handleBackdropClick = useCallback(
    (e: MouseEvent<HTMLDivElement>): void => {
      if (!isAnalysing && e.target === e.currentTarget) onCancel()
    },
    [isAnalysing, onCancel],
  )

  const handleBackdropKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if ((e.key === 'Enter' || e.key === ' ') && !isAnalysing) onCancel()
    },
    [isAnalysing, onCancel],
  )

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
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            background: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
          }}
          onClick={handleBackdropClick}
          onKeyDown={handleBackdropKeyDown}
          role="presentation"
          data-testid="modal-backdrop"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.3, ease: [0.32, 0.72, 0, 1] }}
            style={{
              padding: '2px',
              background: 'rgba(15, 23, 42, 0.04)',
              border: '1px solid rgba(15, 23, 42, 0.08)',
              borderRadius: '1.5rem',
              width: '100%',
              maxWidth: '460px',
              boxShadow: 'var(--shadow-modal)',
            }}
            onClick={(e: MouseEvent<HTMLDivElement>): void => e.stopPropagation()}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
              data-testid="confirm-modal"
              style={{
                background: 'var(--surface)',
                borderRadius: 'calc(1.5rem - 2px)',
                padding: '28px',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,1)',
              }}
            >
              <h2
                id={titleId}
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  letterSpacing: '-0.03em',
                  color: 'var(--text)',
                  marginBottom: '20px',
                }}
                data-testid="modal-title"
              >
                Confirm Analysis
              </h2>

              <div
                style={{
                  background: 'var(--surface-raised)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px',
                  padding: '16px',
                  marginBottom: '14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <DetailRow label="File" value={fileName} />
                <DetailRow label="Bank" value={bankName} testId="bank-name" />
                <DetailRow label="Account" value={accountType} />
                <DetailRow label="Period" value={statementMonth} />
                {cardLabel !== null && (
                  <DetailRow label="Card" value={cardLabel} testId="card-label" />
                )}
              </div>

              {isUnknownBank && (
                <div
                  style={{
                    marginBottom: '10px',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    fontSize: '0.78rem',
                    lineHeight: 1.5,
                    background: 'rgba(245, 158, 11, 0.07)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    color: '#92400e',
                    fontWeight: 500,
                  }}
                  data-testid="unknown-bank-warning"
                >
                  Unknown bank detected. Analysis quality may be lower.
                </div>
              )}

              <div
                style={{
                  marginBottom: '22px',
                  padding: '11px 14px',
                  borderRadius: '10px',
                  fontSize: '0.78rem',
                  lineHeight: 1.5,
                  background: 'var(--primary-subtle)',
                  border: '1px solid var(--primary-border)',
                  color: 'var(--primary)',
                  fontWeight: 500,
                }}
                data-testid="credit-cost-notice"
              >
                This analysis will use <strong style={{ fontWeight: 800 }}>{creditCost} credits</strong>
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={isAnalysing}
                  data-testid="cancel-button"
                  style={{
                    padding: '9px 20px',
                    borderRadius: '999px',
                    border: '1px solid var(--border-medium)',
                    background: 'transparent',
                    color: 'var(--muted)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: isAnalysing ? 'not-allowed' : 'pointer',
                    opacity: isAnalysing ? 0.5 : 1,
                    transition: 'all 0.2s cubic-bezier(0.32,0.72,0,1)',
                  }}
                >
                  Cancel
                </button>

                <button
                  ref={confirmButtonRef}
                  type="button"
                  onClick={onConfirm}
                  disabled={isAnalysing}
                  data-testid="confirm-button"
                  style={{
                    padding: '9px 20px',
                    borderRadius: '999px',
                    border: 'none',
                    background: 'var(--primary)',
                    color: '#ffffff',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: isAnalysing ? 'not-allowed' : 'pointer',
                    opacity: isAnalysing ? 0.75 : 1,
                    transition: 'all 0.2s cubic-bezier(0.32,0.72,0,1)',
                    boxShadow: isAnalysing ? 'none' : '0 2px 10px rgba(37, 99, 235, 0.3)',
                  }}
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
