import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmModal } from '@/components/upload/confirm-modal'
import type { DetectionResult } from '@/lib/bank-detect'

const DETECTION_HDFC: DetectionResult = {
  bank: 'hdfc',
  month: '2025-01',
  account_type: 'debit',
}

const DETECTION_UNKNOWN: DetectionResult = {
  bank: null,
  month: '2025-02',
  account_type: 'credit',
}

describe('ConfirmModal', () => {
  let onConfirm: ReturnType<typeof vi.fn>
  let onCancel: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onConfirm = vi.fn()
    onCancel = vi.fn()
    vi.clearAllMocks()
  })

  const defaultProps = () => ({
    fileName: 'march-statement.pdf',
    creditCost: 20,
    onConfirm,
    onCancel,
    isAnalysing: false,
  })

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <ConfirmModal
        {...defaultProps()}
        isOpen={false}
        detection={DETECTION_HDFC}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('renders modal with bank name when isOpen is true and detection has bank', () => {
    render(
      <ConfirmModal
        {...defaultProps()}
        isOpen={true}
        detection={DETECTION_HDFC}
      />,
    )

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByTestId('bank-name')).toHaveTextContent('HDFC')
    expect(screen.queryByTestId('unknown-bank-warning')).not.toBeInTheDocument()
  })

  it('shows "Unknown Bank" warning when detection.bank is null', () => {
    render(
      <ConfirmModal
        {...defaultProps()}
        isOpen={true}
        detection={DETECTION_UNKNOWN}
      />,
    )

    expect(screen.getByTestId('bank-name')).toHaveTextContent('Unknown Bank')
    const warning = screen.getByTestId('unknown-bank-warning')
    expect(warning).toBeInTheDocument()
    expect(warning).toHaveTextContent(
      'We detected this as an unknown bank. Analysis quality may be lower.',
    )
  })

  it('calls onCancel when Cancel button is clicked', () => {
    render(
      <ConfirmModal
        {...defaultProps()}
        isOpen={true}
        detection={DETECTION_HDFC}
      />,
    )

    fireEvent.click(screen.getByTestId('cancel-button'))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('calls onConfirm when Analyse Statement button is clicked', () => {
    render(
      <ConfirmModal
        {...defaultProps()}
        isOpen={true}
        detection={DETECTION_HDFC}
      />,
    )

    fireEvent.click(screen.getByTestId('confirm-button'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('shows "Analysing…" text and disables buttons when isAnalysing is true', () => {
    render(
      <ConfirmModal
        {...defaultProps()}
        isOpen={true}
        detection={DETECTION_HDFC}
        isAnalysing={true}
      />,
    )

    const confirmButton = screen.getByTestId('confirm-button')
    const cancelButton = screen.getByTestId('cancel-button')

    expect(confirmButton).toHaveTextContent('Analysing…')
    expect(confirmButton).toBeDisabled()
    expect(cancelButton).toBeDisabled()
  })
})
