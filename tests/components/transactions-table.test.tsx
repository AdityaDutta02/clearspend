import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { TransactionsTable } from '@/components/dashboard/transactions-table'
import type { Transaction } from '@/types'
import type { FilterState } from '@/lib/dashboard-data'

const defaultFilter: FilterState = { month: null, bank: null, statement_id: null, category: null }

const createTransaction = (overrides: Partial<Transaction> = {}): Transaction => ({
  id: 'tx-1',
  statement_id: 'stmt-1',
  date: '2025-01-15',
  amount: 500,
  type: 'debit',
  merchant: 'McDonald\'s',
  category: 'food',
  upi_ref: null,
  upi_merchant: null,
  raw_description: 'UPI-McDonald\'s-12345',
  ...overrides,
})

describe('TransactionsTable', () => {
  describe('loading state', () => {
    it('renders shimmer block when isLoading is true', () => {
      render(<TransactionsTable transactions={[]} isLoading={true} filter={defaultFilter} />)

      const shimmer = screen.getByTestId('shimmer-block')
      expect(shimmer).toBeInTheDocument()
    })

    it('shimmer block has aria-hidden attribute', () => {
      render(<TransactionsTable transactions={[]} isLoading={true} filter={defaultFilter} />)

      const shimmer = screen.getByTestId('shimmer-block')
      expect(shimmer).toHaveAttribute('aria-hidden', 'true')
    })

    it('does not show shimmer when isLoading is false', () => {
      render(<TransactionsTable transactions={[]} isLoading={false} filter={defaultFilter} />)

      expect(screen.queryByTestId('shimmer-block')).not.toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows "No transactions found" when no debit transactions', () => {
      const transactions = [
        createTransaction({ type: 'credit', id: 'tx-1' }),
        createTransaction({ type: 'credit', id: 'tx-2' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('No transactions found')).toBeInTheDocument()
    })

    it('shows empty state when transactions array is empty', () => {
      render(<TransactionsTable transactions={[]} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('No transactions found')).toBeInTheDocument()
    })
  })

  describe('debit filtering', () => {
    it('only renders debit transactions', () => {
      const transactions = [
        createTransaction({ type: 'debit', id: 'tx-1', merchant: 'McDonald\'s' }),
        createTransaction({ type: 'credit', id: 'tx-2', merchant: 'Salary' }),
        createTransaction({ type: 'debit', id: 'tx-3', merchant: 'Amazon' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByTestId('transaction-row-tx-1')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-row-tx-3')).toBeInTheDocument()
      expect(screen.queryByTestId('transaction-row-tx-2')).not.toBeInTheDocument()
    })

    it('filters out all credit transactions', () => {
      const transactions = [
        createTransaction({ type: 'credit', id: 'tx-1' }),
        createTransaction({ type: 'credit', id: 'tx-2' }),
        createTransaction({ type: 'credit', id: 'tx-3' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('No transactions found')).toBeInTheDocument()
    })
  })

  describe('pagination', () => {
    it('shows all debits when count is <= 25 (no pagination controls)', () => {
      const transactions = Array.from({ length: 25 }, (_, i) =>
        createTransaction({ id: `tx-${i + 1}`, merchant: `Merchant ${i + 1}` }),
      )
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)
      for (let i = 1; i <= 25; i++) {
        expect(screen.getByTestId(`transaction-row-tx-${i}`)).toBeInTheDocument()
      }
      expect(screen.queryByTestId('pagination-controls')).not.toBeInTheDocument()
    })

    it('shows only first 25 debits on page 1 when given 30', () => {
      const transactions = Array.from({ length: 30 }, (_, i) =>
        createTransaction({ id: `tx-${i + 1}`, merchant: `Merchant ${i + 1}` }),
      )
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)
      expect(screen.getByTestId('transaction-row-tx-1')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-row-tx-25')).toBeInTheDocument()
      expect(screen.queryByTestId('transaction-row-tx-26')).not.toBeInTheDocument()
      expect(screen.getByTestId('pagination-controls')).toBeInTheDocument()
    })

    it('shows next page after clicking Next', () => {
      const transactions = Array.from({ length: 30 }, (_, i) =>
        createTransaction({ id: `tx-${i + 1}`, merchant: `Merchant ${i + 1}` }),
      )
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)
      fireEvent.click(screen.getByTestId('pagination-next'))
      expect(screen.queryByTestId('transaction-row-tx-1')).not.toBeInTheDocument()
      expect(screen.getByTestId('transaction-row-tx-26')).toBeInTheDocument()
    })

    it('Prev button is disabled on first page', () => {
      const transactions = Array.from({ length: 30 }, (_, i) =>
        createTransaction({ id: `tx-${i + 1}` }),
      )
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)
      expect(screen.getByTestId('pagination-prev')).toBeDisabled()
    })

    it('Next button is disabled on last page', () => {
      const transactions = Array.from({ length: 30 }, (_, i) =>
        createTransaction({ id: `tx-${i + 1}` }),
      )
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)
      fireEvent.click(screen.getByTestId('pagination-next'))
      expect(screen.getByTestId('pagination-next')).toBeDisabled()
    })

    it('resets page to 0 when filter.category changes', async () => {
      const manyTxns = Array.from({ length: 30 }, (_, i) =>
        createTransaction({ id: `t${i}`, amount: 100 + i, category: i % 2 === 0 ? 'food' : 'transport' })
      )
      const foodTxns = manyTxns.filter((t) => t.category === 'food')
      const { rerender } = render(
        <TransactionsTable transactions={manyTxns} isLoading={false} filter={defaultFilter} />,
      )
      // navigate to page 2
      fireEvent.click(screen.getByTestId('pagination-next'))
      expect(screen.getByTestId('pagination-controls')).toHaveTextContent('Page 2 of 2')
      // change filter.category — parent also narrows transactions to only food
      rerender(
        <TransactionsTable
          transactions={foodTxns}
          isLoading={false}
          filter={{ ...defaultFilter, category: 'food' }}
        />,
      )
      // should be back on page 1 (the 15 food txns fit on 1 page)
      expect(screen.queryByTestId('pagination-controls')).not.toBeInTheDocument()
    })
  })

  describe('row rendering', () => {
    it('renders each row with correct data-testid', () => {
      const transactions = [
        createTransaction({ id: 'tx-abc', merchant: 'McDonald\'s' }),
        createTransaction({ id: 'tx-def', merchant: 'Starbucks' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByTestId('transaction-row-tx-abc')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-row-tx-def')).toBeInTheDocument()
    })

    it('shows merchant name in transaction row', () => {
      const transactions = [
        createTransaction({ merchant: 'McDonald\'s' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('McDonald\'s')).toBeInTheDocument()
    })

    it('shows formatted amount in transaction row', () => {
      const transactions = [
        createTransaction({ amount: 5000 }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('₹5,000')).toBeInTheDocument()
    })

    it('shows date in transaction row', () => {
      const transactions = [
        createTransaction({ date: '2025-01-15' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('15 Jan')).toBeInTheDocument()
    })

    it('formats amounts with thousands separator', () => {
      const transactions = [
        createTransaction({ amount: 123456 }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('₹1,23,456')).toBeInTheDocument()
    })

    it('formats amounts without decimal places', () => {
      const transactions = [
        createTransaction({ amount: 99.99 }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('₹100')).toBeInTheDocument()
    })
  })

  describe('merchant fallback', () => {
    it('shows raw_description when merchant is empty string', () => {
      const transactions = [
        createTransaction({ merchant: '', raw_description: 'UPI-TRANSFER-XYZ' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('UPI-TRANSFER-XYZ')).toBeInTheDocument()
    })

    it('shows raw_description when merchant is not provided', () => {
      const transactions = [
        createTransaction({ merchant: '', raw_description: 'Fuel Station ABC' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('Fuel Station ABC')).toBeInTheDocument()
    })

    it('prefers merchant name over raw_description when merchant exists', () => {
      const transactions = [
        createTransaction({
          merchant: 'Amazon',
          raw_description: 'AMZN-XYZ-123',
        }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('Amazon')).toBeInTheDocument()
      expect(screen.queryByText('AMZN-XYZ-123')).not.toBeInTheDocument()
    })
  })

  describe('header count', () => {
    it('shows "{n} shown" when debits exist', () => {
      const transactions = [
        createTransaction({ id: 'tx-1' }),
        createTransaction({ id: 'tx-2' }),
        createTransaction({ id: 'tx-3' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('3 shown')).toBeInTheDocument()
    })

    it('does not show count when no debits exist', () => {
      const transactions = [
        createTransaction({ type: 'credit' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.queryByText(/shown/)).not.toBeInTheDocument()
    })

    it('shows count as 1 when only one debit exists', () => {
      const transactions = [
        createTransaction({ id: 'tx-1' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('1 shown')).toBeInTheDocument()
    })

    it('shows 25 shown when given 25 debits', () => {
      const transactions = Array.from({ length: 25 }, (_, i) =>
        createTransaction({ id: `tx-${i + 1}` })
      )
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('25 shown')).toBeInTheDocument()
    })

    it('shows correct count when at limit (20)', () => {
      const transactions = Array.from({ length: 20 }, (_, i) =>
        createTransaction({ id: `tx-${i + 1}` })
      )
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('20 shown')).toBeInTheDocument()
    })
  })

  describe('category chip', () => {
    it.each([
      ['food', 'Food'],
      ['groceries', 'Groceries'],
      ['transport', 'Transport'],
      ['shopping', 'Shopping'],
      ['emi_loans', 'EMI'],
      ['utilities', 'Bills'],
      ['entertainment', 'Entertainment'],
      ['health', 'Health'],
      ['travel', 'Travel'],
      ['others', 'Others'],
    ] as const)('shows display name "%s" → "%s"', (category, label) => {
      render(
        <TransactionsTable
          transactions={[createTransaction({ id: 't1', category })]}
          isLoading={false}
          filter={defaultFilter}
        />,
      )
      expect(screen.getByText(label)).toBeInTheDocument()
    })
  })

  describe('main container', () => {
    it('renders main container with data-testid="transactions-table"', () => {
      render(<TransactionsTable transactions={[]} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByTestId('transactions-table')).toBeInTheDocument()
    })

    it('shows "Transactions" title', () => {
      render(<TransactionsTable transactions={[]} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('Transactions')).toBeInTheDocument()
    })

    it('shows "Recent" label', () => {
      render(<TransactionsTable transactions={[]} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('Recent')).toBeInTheDocument()
    })
  })

  describe('integration scenarios', () => {
    it('handles mix of credits and debits, showing all debits up to page size', () => {
      const transactions = [
        ...Array.from({ length: 15 }, (_, i) =>
          createTransaction({ id: `debit-${i + 1}`, type: 'debit' })
        ),
        ...Array.from({ length: 10 }, (_, i) =>
          createTransaction({ id: `credit-${i + 1}`, type: 'credit' })
        ),
        ...Array.from({ length: 10 }, (_, i) =>
          createTransaction({ id: `debit-extra-${i + 16}`, type: 'debit' })
        ),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      expect(screen.getByText('25 shown')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-row-debit-1')).toBeInTheDocument()
      expect(screen.queryByTestId('transaction-row-credit-1')).not.toBeInTheDocument()
    })

    it('displays all transaction details correctly', () => {
      const transactions = [
        createTransaction({
          id: 'tx-full',
          date: '2025-02-28',
          amount: 15000,
          merchant: 'Amazon.in',
          category: 'shopping',
          raw_description: 'AMZN-PURCHASE',
        }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)

      const row = screen.getByTestId('transaction-row-tx-full')
      expect(row).toBeInTheDocument()
      expect(screen.getByText('28 Feb')).toBeInTheDocument()
      expect(screen.getByText('Amazon.in')).toBeInTheDocument()
      expect(screen.getByText('Shopping')).toBeInTheDocument()
      expect(screen.getByText('₹15,000')).toBeInTheDocument()
    })
  })

  describe('search', () => {
    it('renders search input', () => {
      render(<TransactionsTable transactions={[createTransaction()]} isLoading={false} filter={defaultFilter} />)
      expect(screen.getByTestId('transaction-search')).toBeInTheDocument()
    })

    it('filters transactions by merchant name', () => {
      const transactions = [
        createTransaction({ id: 'tx-1', merchant: 'Swiggy' }),
        createTransaction({ id: 'tx-2', merchant: 'Uber' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)
      fireEvent.change(screen.getByTestId('transaction-search'), { target: { value: 'swiggy' } })
      expect(screen.getByTestId('transaction-row-tx-1')).toBeInTheDocument()
      expect(screen.queryByTestId('transaction-row-tx-2')).not.toBeInTheDocument()
    })

    it('filters transactions by raw_description', () => {
      const transactions = [
        createTransaction({ id: 'tx-1', merchant: '', raw_description: 'UPI-ZOMATO-123' }),
        createTransaction({ id: 'tx-2', merchant: 'Uber', raw_description: 'UPI-UBER-456' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} filter={defaultFilter} />)
      fireEvent.change(screen.getByTestId('transaction-search'), { target: { value: 'zomato' } })
      expect(screen.getByTestId('transaction-row-tx-1')).toBeInTheDocument()
      expect(screen.queryByTestId('transaction-row-tx-2')).not.toBeInTheDocument()
    })

    it('shows empty state when search matches nothing', () => {
      render(<TransactionsTable transactions={[createTransaction({ merchant: 'Swiggy' })]} isLoading={false} filter={defaultFilter} />)
      fireEvent.change(screen.getByTestId('transaction-search'), { target: { value: 'zzz' } })
      expect(screen.getByText('No transactions found')).toBeInTheDocument()
    })

    it('resets page to 0 when search query changes', async () => {
      const manyTxns = Array.from({ length: 30 }, (_, i) =>
        createTransaction({ id: `t${i}`, amount: 100 + i, merchant: i < 5 ? 'Zomato' : `Merchant ${i}` })
      )
      render(
        <TransactionsTable transactions={manyTxns} isLoading={false} filter={defaultFilter} />,
      )
      // navigate to page 2
      fireEvent.click(screen.getByTestId('pagination-next'))
      expect(screen.getByTestId('pagination-controls')).toHaveTextContent('Page 2 of 2')
      // search narrows results
      fireEvent.change(screen.getByTestId('transaction-search'), { target: { value: 'Zomato' } })
      // pagination controls should disappear (only 5 results fit on 1 page)
      expect(screen.queryByTestId('pagination-controls')).not.toBeInTheDocument()
    })
  })

  describe('CSV export', () => {
    it('renders export button when transactions exist', () => {
      render(
        <TransactionsTable
          transactions={[createTransaction({ id: 't1', amount: 500 })]}
          isLoading={false}
          filter={defaultFilter}
        />,
      )
      expect(screen.getByTestId('export-csv-btn')).toBeInTheDocument()
    })

    it('hides export button when no transactions', () => {
      render(<TransactionsTable transactions={[]} isLoading={false} filter={defaultFilter} />)
      expect(screen.queryByTestId('export-csv-btn')).not.toBeInTheDocument()
    })

    it('exports CSV with correct headers and merchant escaping', () => {
      const mockClick = vi.fn()
      const origCreate = document.createElement.bind(document)
      vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
        if (tag === 'a') {
          const el = origCreate('a') as HTMLAnchorElement
          el.click = mockClick
          return el
        }
        return origCreate(tag)
      })
      const mockCreateObjectURL = vi.fn().mockReturnValue('blob:fake')
      const mockRevokeObjectURL = vi.fn()
      URL.createObjectURL = mockCreateObjectURL
      URL.revokeObjectURL = mockRevokeObjectURL

      const txn = createTransaction({
        id: 't1',
        amount: 999,
        merchant: 'Say "hello"',
        category: 'food',
        type: 'debit',
        date: '2025-01-15',
      })
      render(
        <TransactionsTable transactions={[txn]} isLoading={false} filter={defaultFilter} />,
      )
      fireEvent.click(screen.getByTestId('export-csv-btn'))

      expect(mockCreateObjectURL).toHaveBeenCalledOnce()
      const blobArg = mockCreateObjectURL.mock.calls[0][0] as Blob
      expect(blobArg.type).toBe('text/csv')

      // Verify content via FileReader
      return new Promise<void>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const text = e.target?.result as string
          const lines = text.split('\n')
          expect(lines[0]).toBe('Date,Merchant,Category,Amount,Type')
          expect(lines[1]).toBe('2025-01-15,"Say ""hello""",food,999,debit')
          resolve()
        }
        reader.readAsText(blobArg)
      })
    })
  })
})
