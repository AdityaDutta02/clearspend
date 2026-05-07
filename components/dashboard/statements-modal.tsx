'use client'

import { useEffect, useState } from 'react'
import type { DashboardData, Statement } from '@/types'

export interface StatementsModalProps {
  data: DashboardData
  token: string
  onClose: () => void
  onDeleted: () => void
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-').map(Number)
  const shortYear = String(year).slice(-2)
  return `${MONTH_NAMES[month - 1]} '${shortYear}`
}

function formatInr(amount: number): string {
  return '₹' + Math.round(amount).toLocaleString('en-IN')
}

export function StatementsModal({ data, token, onClose, onDeleted }: StatementsModalProps): JSX.Element {
  const [visibleIds, setVisibleIds] = useState<string[]>(() => data.statements.map((s) => s.id))
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const visibleStatements = data.statements.filter((s) => visibleIds.includes(s.id))

  function getAnalysis(statementId: string) {
    return data.analyses.find((a) => a.statement_id === statementId) ?? null
  }

  function getTransactionCount(statementId: string): number {
    return data.transactions.filter((t) => t.statement_id === statementId).length
  }

  function getTotalDebit(statementId: string): number {
    return data.transactions
      .filter((t) => t.statement_id === statementId && t.type === 'debit')
      .reduce((sum, t) => sum + t.amount, 0)
  }

  function getCardLabel(stmt: Statement): string {
    const analysis = getAnalysis(stmt.id)
    const upi = analysis?.upi_summary
    const parts: string[] = []
    if (upi?.card_name) parts.push(upi.card_name)
    if (upi?.last_four) parts.push(`••••${upi.last_four}`)
    return parts.join(' ')
  }

  async function handleDelete(stmt: Statement): Promise<void> {
    // Optimistic removal
    setVisibleIds((prev) => prev.filter((id) => id !== stmt.id))
    setRowErrors((prev) => {
      const next = { ...prev }
      delete next[stmt.id]
      return next
    })

    try {
      const res = await fetch(`/api/statements/${stmt.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!res.ok) {
        throw new Error('Delete failed')
      }

      onDeleted()
    } catch {
      // Restore the row on failure
      setVisibleIds((prev) => {
        const idx = data.statements.findIndex((s) => s.id === stmt.id)
        const next = [...prev]
        // Re-insert in original order
        let insertAt = next.length
        for (let i = 0; i < data.statements.length; i++) {
          if (data.statements[i].id === stmt.id) {
            insertAt = next.filter((id) => data.statements.findIndex((s) => s.id === id) < i).length
            break
          }
        }
        next.splice(insertAt, 0, stmt.id)
        return next
      })
      setRowErrors((prev) => ({ ...prev, [stmt.id]: 'Failed to delete. Please try again.' }))
    }
  }

  return (
    <div
      data-testid="statements-modal"
      role="dialog"
      aria-modal="true"
      aria-label="Manage statements"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 60,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: 'var(--bg, #fff)',
          borderRadius: '1.5rem',
          padding: '2rem',
          width: 'min(640px, 92vw)',
          maxHeight: '80vh',
          overflowY: 'auto',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text, #0f172a)', margin: 0 }}>
            Manage Statements
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close manage statements"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--muted, #64748b)',
              fontSize: '1.25rem',
              lineHeight: 1,
              fontWeight: 700,
              padding: '4px 8px',
            }}
          >
            ×
          </button>
        </div>

        {/* Statement list */}
        {visibleStatements.length === 0 ? (
          <p style={{ color: 'var(--muted, #64748b)', fontSize: '0.875rem', textAlign: 'center', padding: '2rem 0' }}>
            No statements uploaded yet.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {visibleStatements.map((stmt) => {
              const cardLabel = getCardLabel(stmt)
              const txCount = getTransactionCount(stmt.id)
              const totalDebit = getTotalDebit(stmt.id)
              const hasError = Boolean(rowErrors[stmt.id])

              return (
                <div key={stmt.id}>
                  <div
                    data-testid={`statement-row-${stmt.id}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      padding: '0.75rem 1rem',
                      borderRadius: '0.75rem',
                      background: hasError
                        ? 'rgba(190,18,60,0.04)'
                        : 'rgba(15,23,42,0.03)',
                      border: hasError
                        ? '1px solid rgba(190,18,60,0.2)'
                        : '1px solid transparent',
                    }}
                  >
                    {/* Month */}
                    <span style={{ minWidth: '56px', fontSize: '0.82rem', fontWeight: 700, color: 'var(--text, #0f172a)' }}>
                      {formatMonth(stmt.month)}
                    </span>

                    {/* Bank */}
                    <span style={{ minWidth: '56px', fontSize: '0.78rem', fontWeight: 600, color: 'var(--primary, #2563eb)', textTransform: 'uppercase' }}>
                      {stmt.bank.toUpperCase()}
                    </span>

                    {/* Card label */}
                    <span style={{ flex: 1, fontSize: '0.78rem', color: 'var(--muted, #64748b)' }}>
                      {cardLabel || '—'}
                    </span>

                    {/* Transaction count */}
                    <span style={{ fontSize: '0.78rem', color: 'var(--muted, #64748b)', whiteSpace: 'nowrap' }}>
                      {txCount} txn{txCount !== 1 ? 's' : ''}
                    </span>

                    {/* Total debit */}
                    <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text, #0f172a)', whiteSpace: 'nowrap', minWidth: '80px', textAlign: 'right' }}>
                      {formatInr(totalDebit)}
                    </span>

                    {/* Delete button */}
                    <DeleteButton stmtId={stmt.id} onDelete={() => handleDelete(stmt)} />
                  </div>

                  {/* Per-row error */}
                  {rowErrors[stmt.id] && (
                    <p
                      data-testid={`error-msg-${stmt.id}`}
                      style={{
                        margin: '4px 12px 0',
                        fontSize: '0.75rem',
                        color: 'var(--accent-negative, #be123c)',
                      }}
                    >
                      {rowErrors[stmt.id]}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

interface DeleteButtonProps {
  stmtId: string
  onDelete: () => void
}

function DeleteButton({ stmtId, onDelete }: DeleteButtonProps): JSX.Element {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      data-testid={`delete-btn-${stmtId}`}
      onClick={onDelete}
      aria-label="Delete statement"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px',
        borderRadius: '6px',
        color: hovered ? '#be123c' : 'var(--muted, #64748b)',
        transition: 'color 0.15s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
        <path d="M10 11v6" />
        <path d="M14 11v6" />
        <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
      </svg>
    </button>
  )
}
