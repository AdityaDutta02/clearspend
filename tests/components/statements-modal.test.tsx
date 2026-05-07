import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { StatementsModal } from '@/components/dashboard/statements-modal'
import type { DashboardData } from '@/types'

const makeData = (): DashboardData => ({
  statements: [
    {
      id: 'stmt-1',
      month: '2025-01',
      bank: 'hdfc',
      user_id: 'u1',
      account_type: 'credit',
      transaction_count: 2,
      total_debit: 500,
      total_credit: 0,
      currency: 'INR',
      uploaded_at: '2025-01-31T00:00:00Z',
    },
    {
      id: 'stmt-2',
      month: '2025-02',
      bank: 'icici',
      user_id: 'u1',
      account_type: 'credit',
      transaction_count: 1,
      total_debit: 400,
      total_credit: 0,
      currency: 'INR',
      uploaded_at: '2025-02-28T00:00:00Z',
    },
  ] as unknown as DashboardData['statements'],
  analyses: [
    {
      id: 'a1',
      statement_id: 'stmt-1',
      month: '2025-01',
      monthly_total: 5000,
      category_breakdown: {},
      top_merchants: [],
      insights: [],
      generated_at: '2025-01-31T00:00:00Z',
      upi_summary: {
        card_name: 'Millennia',
        last_four: '1234',
        total_spent: 0,
        merchant_breakdown: [],
      },
    },
    {
      id: 'a2',
      statement_id: 'stmt-2',
      month: '2025-02',
      monthly_total: 3000,
      category_breakdown: {},
      top_merchants: [],
      insights: [],
      generated_at: '2025-02-28T00:00:00Z',
      upi_summary: {
        card_name: null,
        last_four: null,
        total_spent: 0,
        merchant_breakdown: [],
      },
    },
  ],
  transactions: [
    { id: 't1', statement_id: 'stmt-1', amount: 200, type: 'debit', merchant: 'A', raw_description: 'A', category: 'food', date: '2025-01-01', upi_ref: null, upi_merchant: null },
    { id: 't2', statement_id: 'stmt-1', amount: 300, type: 'debit', merchant: 'B', raw_description: 'B', category: 'food', date: '2025-01-02', upi_ref: null, upi_merchant: null },
    { id: 't4', statement_id: 'stmt-1', amount: 100, type: 'credit', merchant: 'Refund', raw_description: 'Refund', category: 'others', date: '2025-01-03', upi_ref: null, upi_merchant: null },
    { id: 't3', statement_id: 'stmt-2', amount: 400, type: 'debit', merchant: 'C', raw_description: 'C', category: 'food', date: '2025-02-01', upi_ref: null, upi_merchant: null },
  ],
})

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
})

describe('StatementsModal', () => {
  it('renders statement rows with month, bank, and transaction count', () => {
    render(
      <StatementsModal
        data={makeData()}
        token="test-token"
        onClose={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )

    expect(screen.getByTestId('statements-modal')).toBeDefined()
    expect(screen.getByTestId('statement-row-stmt-1')).toBeDefined()
    expect(screen.getByTestId('statement-row-stmt-2')).toBeDefined()

    // Month formatting: "Jan '25" and "Feb '25"
    expect(screen.getByText(/Jan '25/)).toBeDefined()
    expect(screen.getByText(/Feb '25/)).toBeDefined()

    // Bank names uppercase
    expect(screen.getByText('HDFC')).toBeDefined()
    expect(screen.getByText('ICICI')).toBeDefined()

    // Transaction count for stmt-1 must be debit-only: 2 debits (t1, t2), not 3 (ignores credit t4)
    expect(screen.getByText('2 txns')).toBeDefined()
  })

  it('optimistically removes the row immediately on delete click', async () => {
    // Delay the fetch so we can verify optimistic removal before it resolves
    mockFetch.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ success: true }),
              }),
            200,
          ),
        ),
    )

    render(
      <StatementsModal
        data={makeData()}
        token="test-token"
        onClose={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )

    expect(screen.getByTestId('statement-row-stmt-1')).toBeDefined()

    fireEvent.click(screen.getByTestId('delete-btn-stmt-1'))

    // Row should be gone immediately (optimistic)
    expect(screen.queryByTestId('statement-row-stmt-1')).toBeNull()
    // Other row should still be present
    expect(screen.getByTestId('statement-row-stmt-2')).toBeDefined()
  })

  it('calls onDeleted after successful delete API response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    })

    const onDeleted = vi.fn()

    render(
      <StatementsModal
        data={makeData()}
        token="test-token"
        onClose={vi.fn()}
        onDeleted={onDeleted}
      />,
    )

    fireEvent.click(screen.getByTestId('delete-btn-stmt-1'))

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledTimes(1)
    })

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/statements/stmt-1',
      expect.objectContaining({
        method: 'DELETE',
        headers: expect.objectContaining({ Authorization: 'Bearer test-token' }),
      }),
    )
  })

  it('restores the row and shows an error message when the API call fails', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: async () => ({ error: 'Server error' }),
    })

    render(
      <StatementsModal
        data={makeData()}
        token="test-token"
        onClose={vi.fn()}
        onDeleted={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByTestId('delete-btn-stmt-1'))

    // Optimistically removed
    expect(screen.queryByTestId('statement-row-stmt-1')).toBeNull()

    // After failure: row is restored and error is shown
    await waitFor(() => {
      expect(screen.getByTestId('statement-row-stmt-1')).toBeDefined()
    })

    expect(screen.getByTestId('error-msg-stmt-1')).toBeDefined()
  })

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn()

    render(
      <StatementsModal
        data={makeData()}
        token="test-token"
        onClose={onClose}
        onDeleted={vi.fn()}
      />,
    )

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
