'use client'

import { useState, useCallback, useEffect } from 'react'
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

export function HomeClient(): JSX.Element {
  const token = useEmbedToken()
  const { data, isLoading: dataLoading, refresh } = useDashboardData(token)

  const [pageState, setPageState] = useState<PageState>('idle')
  const [pendingUpload, setPendingUpload] = useState<PendingUpload | null>(null)
  const [filter, setFilter] = useState<FilterState>({ month: null, bank: null, statement_id: null })
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [analyseError, setAnalyseError] = useState<string | null>(null)
  const [showUploadModal, setShowUploadModal] = useState<boolean>(false)

  const handleParsed = useCallback(
    (result: { file: File; text: string; transactions: RawTransaction[]; detection: DetectionResult }): void => {
      setUploadError(null)
      setAnalyseError(null)
      setPendingUpload(result)
      setShowUploadModal(false)
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
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token ?? ''}`,
        },
        body: JSON.stringify({
          month: pendingUpload.detection.month,
          bank: pendingUpload.detection.bank,
          account_type: pendingUpload.detection.account_type,
          card_name: pendingUpload.detection.card_name,
          last_four: pendingUpload.detection.last_four,
          transactions: pendingUpload.transactions,
          raw_text: pendingUpload.text,
        }),
      })

      // API contract: { success?: boolean; error?: string; details?: string }
      const body = (await res.json()) as { success?: boolean; error?: string; details?: string }

      if (!res.ok || body.error) {
        if (body.error === 'INSUFFICIENT_CREDITS') {
          setAnalyseError('You need at least 5 credits to analyse a statement.')
        } else {
          setAnalyseError(`Analysis failed: ${body.details ?? body.error ?? 'unknown error'} (HTTP ${res.status})`)
        }
        setPageState('error')
        return
      }

      // Commit success state before the optional refresh
      setPendingUpload(null)
      setPageState('idle')
      setShowUploadModal(false)
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

  const handleUploadClick = useCallback((): void => {
    setShowUploadModal(true)
  }, [])

  const handleCloseUploadModal = useCallback((): void => {
    setShowUploadModal(false)
  }, [])

  useEffect(() => {
    if (!showUploadModal) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setShowUploadModal(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [showUploadModal])

  // Token not yet available — show connecting spinner
  if (token === null) {
    return (
      <div
        className="min-h-dvh flex flex-col items-center justify-center gap-4"
        style={{ background: 'var(--bg)' }}
        data-testid="main-page"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--primary)"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="animate-spin"
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
        <p
          style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--muted)', letterSpacing: '-0.01em' }}
          data-testid="connecting-text"
        >
          Connecting…
        </p>
      </div>
    )
  }

  // Token present but data still loading — show full-page shimmer
  if (data === null) {
    return (
      <div
        className="min-h-dvh flex flex-col gap-5 max-w-5xl mx-auto px-4 py-10"
        style={{ background: 'var(--bg)' }}
        data-testid="main-page"
      >
        {/* Header shimmer */}
        <div className="flex flex-col gap-2">
          <div
            className="animate-pulse rounded-full"
            style={{ height: '22px', width: '140px', background: 'var(--border)' }}
            aria-hidden="true"
            data-testid="loading-shimmer"
          />
          <div
            className="animate-pulse rounded-lg"
            style={{ height: '42px', width: '200px', background: 'var(--border)' }}
            aria-hidden="true"
          />
          <div
            className="animate-pulse rounded-md"
            style={{ height: '16px', width: '160px', background: 'var(--border)' }}
            aria-hidden="true"
          />
        </div>

        {/* Upload shimmer */}
        <div
          className="animate-pulse rounded-3xl"
          style={{ height: '164px', width: '100%', background: 'var(--border)' }}
          aria-hidden="true"
        />

        {/* Filter shimmer */}
        <div className="flex gap-2">
          {[80, 64, 72, 60].map((w, i) => (
            <div
              key={i}
              className="animate-pulse rounded-full"
              style={{ height: '30px', width: `${w}px`, background: 'var(--border)' }}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* KPI shimmer */}
        <div className="kpi-row">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="animate-pulse rounded-2xl"
              style={{ height: '90px', background: 'var(--border)' }}
              aria-hidden="true"
            />
          ))}
        </div>

        {/* Chart shimmer */}
        <div
          className="animate-pulse rounded-2xl"
          style={{ height: '280px', width: '100%', background: 'var(--border)' }}
          aria-hidden="true"
        />
      </div>
    )
  }

  // Data loaded — render the full dashboard
  return (
    <div data-testid="main-page">
      <DashboardShell
        data={data}
        filter={filter}
        onFilterChange={handleFilterChange}
        onUploadClick={handleUploadClick}
        isLoading={dataLoading}
      />

      {analyseError !== null && (
        <div
          className="max-w-5xl mx-auto px-4 mt-3 flex items-start justify-between gap-2 p-3 rounded-xl text-sm"
          style={{
            background: 'var(--accent-negative-subtle)',
            border: '1px solid rgba(190, 18, 60, 0.2)',
            color: 'var(--accent-negative)',
          }}
          role="alert"
          data-testid="analyse-error-alert"
        >
          <span style={{ fontWeight: 500, fontSize: '0.82rem' }}>{analyseError}</span>
          <button
            type="button"
            onClick={handleDismissAnalyseError}
            aria-label="Dismiss error"
            className="shrink-0 font-bold"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-negative)', fontSize: '1rem', lineHeight: 1 }}
            data-testid="dismiss-analyse-error"
          >
            ×
          </button>
        </div>
      )}

      {showUploadModal && (
        <div
          data-testid="upload-modal"
          role="dialog"
          aria-modal={true}
          aria-label="Upload statement"
          onClick={handleCloseUploadModal}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => { e.stopPropagation() }}
            style={{
              background: 'var(--bg)',
              borderRadius: '1.5rem',
              padding: '2rem',
              width: 'min(480px, 90vw)',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={handleCloseUploadModal}
              aria-label="Close upload modal"
              data-testid="close-upload-modal"
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                fontSize: '1.25rem',
                lineHeight: 1,
                fontWeight: 700,
              }}
            >
              ×
            </button>

            <UploadZone
              onParsed={handleParsed}
              onError={handleUploadError}
              disabled={isUploadDisabled}
            />

            {uploadError !== null && (
              <div
                className="mt-3 flex items-start justify-between gap-2 p-3 rounded-xl text-sm"
                style={{
                  background: 'var(--accent-negative-subtle)',
                  border: '1px solid rgba(190, 18, 60, 0.2)',
                  color: 'var(--accent-negative)',
                }}
                role="alert"
                data-testid="upload-error-alert"
              >
                <span style={{ fontWeight: 500, fontSize: '0.82rem' }}>{uploadError}</span>
                <button
                  type="button"
                  onClick={handleDismissUploadError}
                  aria-label="Dismiss error"
                  className="shrink-0 font-bold"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-negative)', fontSize: '1rem', lineHeight: 1 }}
                  data-testid="dismiss-upload-error"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      )}

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
