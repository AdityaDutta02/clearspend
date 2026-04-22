import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import type { DashboardData } from '@/types'
import { makeAnalysis } from '@/tests/utils/factories'

// ---------- Module mocks (declared before imports of the module under test) ----------

vi.mock('@/hooks/use-embed-token', () => ({
  useEmbedToken: vi.fn(),
}))

vi.mock('@/hooks/use-dashboard-data', () => ({
  useDashboardData: vi.fn(),
}))

vi.mock('@/components/dashboard/dashboard-shell', () => ({
  DashboardShell: () => <div data-testid="dashboard-shell" />,
}))

vi.mock('@/components/upload/upload-zone', () => ({
  UploadZone: ({
    onParsed,
    onError,
    disabled,
  }: {
    onParsed: (r: unknown) => void
    onError: (msg: string) => void
    disabled: boolean
  }) => (
    <div
      data-testid="upload-zone"
      data-disabled={disabled}
      // Expose triggers via custom events for testing
      onClick={() =>
        onParsed({
          file: new File(['pdf'], 'statement.pdf', { type: 'application/pdf' }),
          text: 'header text',
          transactions: [],
          detection: { bank: 'hdfc', month: '2025-01', account_type: 'debit' },
        })
      }
      onKeyDown={(e) => {
        if (e.key === 'error') onError('some upload error')
      }}
    />
  ),
}))

vi.mock('@/components/upload/confirm-modal', () => ({
  ConfirmModal: ({
    isOpen,
    onConfirm,
    onCancel,
    isAnalysing,
  }: {
    isOpen: boolean
    onConfirm: () => void
    onCancel: () => void
    isAnalysing: boolean
  }) =>
    isOpen ? (
      <div data-testid="confirm-modal" data-analysing={isAnalysing}>
        <button data-testid="modal-confirm" onClick={onConfirm}>
          Confirm
        </button>
        <button data-testid="modal-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    ) : null,
}))

// Import module under test AFTER mocks are registered
import HomePage from '@/app/page'
import { useEmbedToken } from '@/hooks/use-embed-token'
import { useDashboardData } from '@/hooks/use-dashboard-data'

// ---------- Helpers ----------

const mockUseEmbedToken = useEmbedToken as Mock
const mockUseDashboardData = useDashboardData as Mock

const SAMPLE_DATA: DashboardData = {
  statements: [
    {
      id: 's1',
      month: '2025-01',
      bank: 'hdfc',
      account_type: 'debit',
      transaction_count: 3,
      total_debit: 5000,
      total_credit: 0,
      currency: 'INR',
      uploaded_at: '2025-01-31T00:00:00Z',
    },
  ],
  analyses: [makeAnalysis({ id: 'a1', statement_id: 's1', month: '2025-01' })],
}

function setupHooks({
  token = 'test-token',
  data = SAMPLE_DATA,
  isLoading = false,
}: {
  token?: string | null
  data?: DashboardData | null
  isLoading?: boolean
} = {}): { refresh: Mock } {
  const refresh = vi.fn()
  mockUseEmbedToken.mockReturnValue(token)
  mockUseDashboardData.mockReturnValue({ data, error: undefined, isLoading, refresh })
  return { refresh }
}

// ---------- Tests ----------

describe('HomePage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset fetch mock
    global.fetch = vi.fn()
  })

  it('shows "Connecting…" text when token is null', () => {
    setupHooks({ token: null })
    render(<HomePage />)

    expect(screen.getByTestId('connecting-text')).toHaveTextContent('Connecting…')
    expect(screen.queryByTestId('dashboard-shell')).not.toBeInTheDocument()
  })

  it('shows loading shimmer when token is present but data is loading', () => {
    setupHooks({ token: 'test-token', data: null, isLoading: true })
    render(<HomePage />)

    expect(screen.getByTestId('loading-shimmer')).toBeInTheDocument()
    expect(screen.queryByTestId('dashboard-shell')).not.toBeInTheDocument()
  })

  it('renders dashboard shell when data is loaded', () => {
    setupHooks()
    render(<HomePage />)

    expect(screen.getByTestId('dashboard-shell')).toBeInTheDocument()
    expect(screen.getByTestId('upload-zone')).toBeInTheDocument()
  })

  it('transitions to confirming state after UploadZone.onParsed fires', async () => {
    setupHooks()
    render(<HomePage />)

    expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument()

    // Simulate onParsed by clicking the mock UploadZone
    fireEvent.click(screen.getByTestId('upload-zone'))

    await waitFor(() => {
      expect(screen.getByTestId('confirm-modal')).toBeInTheDocument()
    })
  })

  it('calls POST /api/analyse on modal confirm', async () => {
    const { refresh } = setupHooks()
    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    })

    render(<HomePage />)

    // Open confirm modal
    fireEvent.click(screen.getByTestId('upload-zone'))
    await screen.findByTestId('confirm-modal')

    // Confirm
    await act(async () => {
      fireEvent.click(screen.getByTestId('modal-confirm'))
    })

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/analyse',
        expect.objectContaining({ method: 'POST' }),
      )
    })

    expect(refresh).toHaveBeenCalled()
  })

  it('shows INSUFFICIENT_CREDITS error message when API returns that error', async () => {
    setupHooks()
    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'INSUFFICIENT_CREDITS' }),
    })

    render(<HomePage />)

    // Open confirm modal
    fireEvent.click(screen.getByTestId('upload-zone'))
    await screen.findByTestId('confirm-modal')

    // Confirm
    await act(async () => {
      fireEvent.click(screen.getByTestId('modal-confirm'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('analyse-error-alert')).toHaveTextContent(
        'You need at least 5 credits to analyse a statement.',
      )
    })
  })

  it('shows generic error message on non-INSUFFICIENT_CREDITS failure', async () => {
    setupHooks()
    ;(global.fetch as Mock).mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'UNKNOWN_ERROR' }),
    })

    render(<HomePage />)

    fireEvent.click(screen.getByTestId('upload-zone'))
    await screen.findByTestId('confirm-modal')

    await act(async () => {
      fireEvent.click(screen.getByTestId('modal-confirm'))
    })

    await waitFor(() => {
      expect(screen.getByTestId('analyse-error-alert')).toHaveTextContent(
        'Analysis failed. Please try again.',
      )
    })
  })

  it('clears pending and hides modal on Cancel', async () => {
    setupHooks()
    render(<HomePage />)

    fireEvent.click(screen.getByTestId('upload-zone'))
    await screen.findByTestId('confirm-modal')

    fireEvent.click(screen.getByTestId('modal-cancel'))

    await waitFor(() => {
      expect(screen.queryByTestId('confirm-modal')).not.toBeInTheDocument()
    })
  })

  it('disables UploadZone when in confirming state', async () => {
    setupHooks()
    render(<HomePage />)

    fireEvent.click(screen.getByTestId('upload-zone'))
    await screen.findByTestId('confirm-modal')

    expect(screen.getByTestId('upload-zone').getAttribute('data-disabled')).toBe('true')
  })

  it('renders main page data-testid in all states', () => {
    setupHooks({ token: null })
    const { unmount } = render(<HomePage />)
    expect(screen.getByTestId('main-page')).toBeInTheDocument()
    unmount()

    setupHooks({ token: 'tok', data: null, isLoading: true })
    render(<HomePage />)
    expect(screen.getByTestId('main-page')).toBeInTheDocument()
  })
})
