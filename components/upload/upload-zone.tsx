'use client'

import { useRef, useState, useCallback, type DragEvent, type KeyboardEvent, type ChangeEvent } from 'react'
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

type UploadState = 'idle' | 'drag-over' | 'loading'

function CloudUploadIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polyline points="16 16 12 12 8 16" />
      <line x1="12" y1="12" x2="12" y2="21" />
      <path d="M20.39 18.39A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.3" />
    </svg>
  )
}

function Spinner(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
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
  const [pendingFileName, setPendingFileName] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = useCallback(
    async (file: File): Promise<void> => {
      if (!isPdfFile(file)) {
        onError('Only PDF files are supported. Please select a PDF bank statement.')
        return
      }

      setPendingFileName(file.name)
      setState('loading')

      try {
        const parsed: ParsedStatement = await parsePdf(file)

        const detection: DetectionResult = {
          bank: parsed.bank,
          month: parsed.month,
          account_type: parsed.account_type,
        }

        onParsed({
          file,
          text: parsed.raw_header,
          transactions: parsed.transactions,
          detection,
        })
      } catch (err) {
        if (err instanceof PdfPasswordError) {
          onError('This PDF is password protected. Please remove the password and try again.')
        } else {
          onError('Could not read this PDF. Please try a different file.')
        }
      } finally {
        setState('idle')
        setPendingFileName(null)
        if (inputRef.current) {
          inputRef.current.value = ''
        }
      }
    },
    [onParsed, onError],
  )

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>): void => {
      e.preventDefault()
      e.stopPropagation()
      if (!disabled && state !== 'loading') {
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
      if (disabled || state === 'loading') return

      setState('idle')
      const file = e.dataTransfer.files[0]
      if (file) {
        void processFile(file)
      }
    },
    [disabled, state, processFile],
  )

  const handleClick = useCallback((): void => {
    if (disabled || state === 'loading') return
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

  const borderColor = isDragOver ? 'var(--primary-light)' : 'var(--border)'
  const backgroundColor = isDragOver ? 'rgba(59, 130, 246, 0.05)' : 'transparent'

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Upload PDF statement"
      aria-disabled={disabled || isLoading}
      data-testid="upload-zone"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        border: `2px dashed ${borderColor}`,
        borderRadius: '16px',
        backgroundColor,
        minHeight: '200px',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled || isLoading ? 'not-allowed' : 'pointer',
        transition: 'border-color 0.2s ease, background-color 0.2s ease',
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

      {isLoading ? (
        <>
          <div style={{ color: 'var(--primary)' }}>
            <Spinner />
          </div>
          <p
            className="text-sm font-medium"
            style={{ color: 'var(--muted)' }}
            data-testid="loading-text"
          >
            Parsing PDF…
          </p>
          {pendingFileName && (
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {pendingFileName}
            </p>
          )}
        </>
      ) : (
        <>
          <div style={{ color: isDragOver ? 'var(--primary-light)' : 'var(--muted)' }}>
            <CloudUploadIcon />
          </div>
          <div className="text-center">
            <p
              className="font-semibold text-base"
              style={{ color: 'var(--text)' }}
              data-testid="upload-heading"
            >
              Drop your bank statement here
            </p>
            <p
              className="text-sm mt-1"
              style={{ color: 'var(--muted)' }}
              data-testid="upload-subtext"
            >
              or click to browse · PDF only
            </p>
          </div>
          {pendingFileName && (
            <p
              className="text-xs mt-1 font-medium"
              style={{ color: 'var(--primary)' }}
              data-testid="pending-filename"
            >
              {pendingFileName}
            </p>
          )}
        </>
      )}
    </div>
  )
}
