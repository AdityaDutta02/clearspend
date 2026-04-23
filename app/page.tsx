'use client'

import { useState, useCallback } from 'react'
import type { RawTransaction } from '@/types'
import type { DetectionResult } from '@/lib/bank-detect'
import type { FilterState } from '@/lib/dashboard-data'
import { useEmbedToken } from '@/hooks/use-embed-token'
import { useDashboardData } from '@/hooks/use-dashboard-data'
import { DashboardShell } from '@/components/dashboard/dashboard-shell'
import { UploadZone } from '@/components/upload/upload-zone'
import { ConfirmModal } from '@/components/upload/confirm-modal'

type PageState = 'idle' | 'confirming' | 'analysing' | 'error'

interface PendingUpload {
  file: File
  text: string
  transactions: RawTransaction[]
  detection: DetectionResult
}

export default function HomePage(): JSX.Element {
  const token = useEmbedToken()
  const { data, isLoading: dataLoading, refresh } = useDashboardData(token)

  const [pageState, setPageState] = useState<PageState>('idle')
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null)
  const [filter, setFilter] = useState<FilterState>({ month: null, bank: null })
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [analyseError, setAnalyseError] = useState<string | null>(null)

  const handleParsed = useCallback(
    (result: { file: File; text: string; transactions: RawTransaction[]; detection: DetectionResult }): void => {
      setUploadError(null)
      setAnalyseError(null)
      setPendingUpload(result)
      setPageState('confirming')
    },
    [],
  )

  const handleUploadError = useCallback((message: string): void => {
    setUploadError(message)
  }, [])

  const handleConfirm = useCallback(async (): Promise<void> => {
    if (!pendingUpload) return

    setPageState('analysing')
    setAnalyseError(null)

    try {
      const res = await fetch('/api/analyse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: pendingUpload.detection.month,
          bank: pendingUpload.detection.bank,
          account_type: pendingUpload.detection.account_type,
          transactions: pendingUpload.transactions,
          raw_text: pendingUpload.text,
        }),
      })

      // API contract: { success?: boolean; error?: string } — validated by server schema
      const body = (await res.json()) as { success?: boolean; error?: string }

      if (!res.ok || body.error) {
        if (body.error === 'INSUFFICIENT_CREDITS') {
          setAnalyseError('You need at least 5 credits to analyse a statement.')
        } else {
          setAnalyseError('Analysis failed. Please try again.')
        }
        setPageState('error')
        return
      }

      // Commit success state before the optional refresh
      setPendingUpload(null)
      setPageState('idle')
      try {
        await refresh()
      } catch {
        // Refresh failure is non-fatal; data will be stale until next load
      }
    } catch {
      setAnalyseError('Analysis failed. Please try again.')
      setPageState('error')
    }
  }, [pendingUpload, token, refresh])

  const handleCancel = useCallback((): void => {
    setPendingUpload(null)
    setPageState('idle')
  }, [])

  const handleFilterChange = useCallback((nextFilter: FilterState): void => {
    setFilter(nextFilter)
  }, [])

  const handleDismissUploadError = useCallback((): void => {
    setUploadError(null)
  }, [])

  const handleDismissAnalyseError = useCallback((): void => {
    setAnalyseError(null)
    setPageState('idle')
  }, [])

  const isUploadDisabled = pageState !== 'idle'

  // Token not yet available — show connecting spinner
  if (token === null) {
    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center gap-3"
        style={{ background: 'var(--background)' }}
        data-testid="main-page"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="animate-spin"
          style={{ color: 'var(--primary)' }}
          data-testid="connecting-spinner"
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
        <p className="text-sm" style={{ color: 'var(--muted)' }} data-testid="connecting-text">
          Connecting…
        </p>
      </div>
    )
  }

  // Token present but data still loading — show full-page shimmer
  if (data === null) {
    return (
      <div
        className="min-h-dvh flex flex-col gap-4 max-w-4xl mx-auto px-4 py-8"
        style={{ background: 'var(--background)' }}
        data-testid="main-page"
      >
        <div
          className="animate-pulse rounded"
          style={{ height: '2rem', width: '40%', background: 'var(--border)' }}
          aria-hidden="true"
          data-testid="loading-shimmer"
        />
        <div
          className="animate-pulse rounded"
          style={{ height: '1rem', width: '25%', background: 'var(--border)' }}
          aria-hidden="true"
        />
        <div
          className="animate-pulse rounded"
          style={{ height: '3rem', width: '100%', background: 'var(--border)' }}
          aria-hidden="true"
        />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded"
              style={{ height: '6rem', background: 'var(--border)' }}
              aria-hidden="true"
            />
          ))}
        </div>
        <div
          className="animate-pulse rounded"
          style={{ height: '16rem', width: '100%', background: 'var(--border)' }}
          aria-hidden="true"
        />
      </div>
    )
  }

  // Data loaded — render the full dashboard
  return (
    <div data-testid="main-page">
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-2">
        <UploadZone
          onParsed={handleParsed}
          onError={handleUploadError}
          disabled={isUploadDisabled}
        />

        {uploadError !== null && (
          <div
            className="mt-3 flex items-start justify-between gap-2 p-3 rounded-lg text-sm"
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#991b1b',
            }}
            role="alert"
            data-testid="upload-error-alert"
          >
            <span>{uploadError}</span>
            <button
              type="button"
              onClick={handleDismissUploadError}
              aria-label="Dismiss error"
              className="shrink-0 font-bold"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}
              data-testid="dismiss-upload-error"
            >
              ×
            </button>
          </div>
        )}

        {analyseError !== null && (
          <div
            className="mt-3 p-3 rounded-lg text-sm flex items-start justify-between gap-2"
            style={{
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#991b1b',
            }}
            role="alert"
            data-testid="analyse-error-alert"
          >
            <span>{analyseError}</span>
            <button
              type="button"
              onClick={handleDismissAnalyseError}
              aria-label="Dismiss error"
              className="shrink-0 font-bold"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#991b1b' }}
              data-testid="dismiss-analyse-error"
            >
              ×
            </button>
          </div>
        )}
      </div>

      <DashboardShell
        data={data}
        filter={filter}
        onFilterChange={handleFilterChange}
        isLoading={dataLoading}
      />

      <ConfirmModal
        isOpen={pageState === 'confirming' || pageState === 'analysing'}
        detection={pendingUpload?.detection ?? null}
        fileName={pendingUpload?.file.name ?? ''}
        creditCost={20}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isAnalysing={pageState === 'analysing'}
      />
    </div>
  )
}
