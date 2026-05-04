'use client'

import {
  useRef,
  useState,
  useCallback,
  type DragEvent,
  type KeyboardEvent,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { parsePdf, PdfPasswordError } from '@/lib/pdf-parser'
import type { RawTransaction, ParsedStatement } from '@/types'
import type { DetectionResult } from '@/lib/bank-detect'

export interface UploadZoneProps {
  onParsed: (result: {
    file: File
    text: string
    transactions: RawTransaction[]
    detection: DetectionResult
  }) => void
  onError: (message: string) => void
  disabled?: boolean
}

type UploadState = 'idle' | 'drag-over' | 'loading' | 'password-prompt'

function UploadIcon({ active }: { active: boolean }): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke={active ? 'var(--primary-light)' : 'var(--muted)'}
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transition: 'stroke 0.22s cubic-bezier(0.32,0.72,0,1)' }}
    >
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}

function LockIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="32"
      height="32"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--primary)"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function Spinner(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--primary)"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className="animate-spin"
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

function isPdfFile(file: File): boolean {
  const mimeOk = file.type === 'application/pdf'
  const extOk = file.name.toLowerCase().endsWith('.pdf')
  return mimeOk || extOk
}

export function UploadZone({ onParsed, onError, disabled = false }: UploadZoneProps): JSX.Element {
  const [state, setState] = useState<UploadState>('idle')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const resetToIdle = useCallback((): void => {
    setState('idle')
    setPendingFile(null)
    setPassword('')
    setPasswordError(false)
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }, [])

  const dispatchParsed = useCallback(
    (file: File, parsed: ParsedStatement): void => {
      const detection: DetectionResult = {
        bank: parsed.bank,
        month: parsed.month,
        account_type: parsed.account_type,
        card_name: parsed.card_name,
        last_four: parsed.last_four,
      }
      onParsed({
        file,
        text: parsed.raw_text,
        transactions: parsed.transactions,
        detection,
      })
    },
    [onParsed],
  )

  const processFile = useCallback(
    async (file: File, pw?: string): Promise<void> => {
      if (!isPdfFile(file)) {
        onError('Only PDF files are supported. Please select a PDF bank statement.')
        return
      }

      setState('loading')

      try {
        const parsed: ParsedStatement = await parsePdf(file, pw ? { password: pw } : {})
        resetToIdle()
        dispatchParsed(file, parsed)
      } catch (err) {
        if (err instanceof PdfPasswordError) {
          setPendingFile(file)
          setPasswordError(pw !== undefined)
          setPassword('')
          setState('password-prompt')
        } else {
          resetToIdle()
          onError('Could not read this PDF. Please try a different file.')
        }
      }
    },
    [onError, resetToIdle, dispatchParsed],
  )

  const handlePasswordSubmit = useCallback(
    (e: FormEvent<HTMLFormElement>): void => {
      e.preventDefault()
      if (!pendingFile || !password.trim()) return
      void processFile(pendingFile, password)
    },
    [pendingFile, password, processFile],
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled && state !== 'loading' && state !== 'password-prompt') {
        setState('drag-over')
      }
    },
    [disabled, state],
  )

  const handleDragLeave = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      e.preventDefault()
      e.stopPropagation()
      if (state === 'drag-over') {
        setState('idle')
      }
    },
    [state],
  )

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      e.preventDefault()
      e.stopPropagation()
      if (disabled || state === 'loading' || state === 'password-prompt') return

      setState('idle')
      const file = e.dataTransfer.files[0]
      if (file) {
        void processFile(file)
      }
    },
    [disabled, state, processFile],
  )

  const handleClick = useCallback((): void => {
    if (disabled || state === 'loading' || state === 'password-prompt') return
    inputRef.current?.click()
  }, [disabled, state])

  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>): void => {
      const file = e.target.files?.[0]
      if (file) {
        void processFile(file)
      }
    },
    [processFile],
  )

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>): void => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        handleClick()
      }
    },
    [handleClick],
  )

  const isDragOver = state === 'drag-over'
  const isLoading = state === 'loading'
  const isPasswordPrompt = state === 'password-prompt'

  return (
    /* Double-bezel outer shell */
    <div
      style={{
        padding: '2px',
        borderRadius: '1.5rem',
        background: isDragOver
          ? 'var(--primary-subtle)'
          : 'rgba(11, 25, 41, 0.03)',
        border: isDragOver
          ? '1.5px solid var(--primary-border)'
          : '1.5px dashed var(--border-medium)',
        transition: 'all 0.28s cubic-bezier(0.32,0.72,0,1)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <div
        role={isPasswordPrompt ? undefined : 'button'}
        tabIndex={isPasswordPrompt ? undefined : 0}
        aria-label={isPasswordPrompt ? undefined : 'Upload PDF statement'}
        aria-disabled={isPasswordPrompt ? undefined : disabled || isLoading}
        data-testid="upload-zone"
        onClick={isPasswordPrompt ? undefined : handleClick}
        onKeyDown={isPasswordPrompt ? undefined : handleKeyDown}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          background: isDragOver ? 'rgba(4,120,87,0.04)' : 'var(--surface)',
          borderRadius: 'calc(1.5rem - 2px)',
          minHeight: '160px',
          cursor: isPasswordPrompt ? 'default' : disabled || isLoading ? 'not-allowed' : 'pointer',
          transition: 'background 0.28s cubic-bezier(0.32,0.72,0,1)',
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,1)',
        }}
        className="flex flex-col items-center justify-center gap-3 p-8 select-none"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          onChange={handleChange}
          className="hidden"
          aria-hidden="true"
          tabIndex={-1}
          data-testid="upload-input"
        />

        {isLoading && (
          <>
            <Spinner />
            <div style={{ textAlign: 'center' }}>
              <p
                style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.01em' }}
                data-testid="loading-text"
              >
                Parsing PDF…
              </p>
              {pendingFile && (
                <p style={{ fontSize: '0.75rem', color: 'var(--muted)', marginTop: '3px' }}>
                  {pendingFile.name}
                </p>
              )}
            </div>
          </>
        )}

        {isPasswordPrompt && (
          <>
            <div style={{ color: 'var(--primary)' }}>
              <LockIcon />
            </div>
            <p
              style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em' }}
            >
              PDF is password protected
            </p>
            {passwordError && (
              <p
                style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent-negative)' }}
                data-testid="password-error"
              >
                Incorrect password. Try again.
              </p>
            )}
            <form
              onSubmit={handlePasswordSubmit}
              className="flex flex-col items-center gap-2 w-full max-w-xs"
              onClick={(e) => e.stopPropagation()}
            >
              <input
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value) }}
                placeholder="Enter PDF password"
                autoFocus
                data-testid="password-input"
                style={{
                  width: '100%',
                  padding: '9px 14px',
                  borderRadius: '10px',
                  border: `1px solid ${passwordError ? 'var(--accent-negative)' : 'var(--border-medium)'}`,
                  background: 'var(--surface-raised)',
                  color: 'var(--text)',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  outline: 'none',
                  transition: 'border-color 0.2s',
                }}
              />
              <div className="flex gap-2 w-full">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); resetToIdle() }}
                  data-testid="password-cancel"
                  style={{
                    flex: 1,
                    padding: '9px',
                    borderRadius: '10px',
                    border: '1px solid var(--border-medium)',
                    background: 'transparent',
                    color: 'var(--muted)',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.32,0.72,0,1)',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!password.trim()}
                  data-testid="password-submit"
                  style={{
                    flex: 1,
                    padding: '9px',
                    borderRadius: '10px',
                    border: 'none',
                    background: password.trim() ? 'var(--primary)' : 'var(--border)',
                    color: password.trim() ? '#fff' : 'var(--muted)',
                    fontSize: '13px',
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: password.trim() ? 'pointer' : 'not-allowed',
                    transition: 'all 0.22s cubic-bezier(0.32,0.72,0,1)',
                  }}
                >
                  Unlock
                </button>
              </div>
            </form>
          </>
        )}

        {!isLoading && !isPasswordPrompt && (
          <>
            <UploadIcon active={isDragOver} />
            <div style={{ textAlign: 'center' }}>
              <p
                style={{
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  color: 'var(--text)',
                  letterSpacing: '-0.02em',
                }}
                data-testid="upload-heading"
              >
                Drop your bank statement here
              </p>
              <p
                style={{
                  fontSize: '0.78rem',
                  color: 'var(--muted)',
                  marginTop: '4px',
                  fontWeight: 400,
                }}
                data-testid="upload-subtext"
              >
                or click to browse · PDF only
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
