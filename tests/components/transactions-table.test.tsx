import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TransactionsTable } from '@/components/dashboard/transactions-table'
import type { Transaction } from '@/types'

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
      render(<TransactionsTable transactions={[]} isLoading={true} />)

      const shimmer = screen.getByTestId('shimmer-block')
      expect(shimmer).toBeInTheDocument()
    })

    it('shimmer block has aria-hidden attribute', () => {
      render(<TransactionsTable transactions={[]} isLoading={true} />)

      const shimmer = screen.getByTestId('shimmer-block')
      expect(shimmer).toHaveAttribute('aria-hidden', 'true')
    })

    it('does not show shimmer when isLoading is false', () => {
      render(<TransactionsTable transactions={[]} isLoading={false} />)

      expect(screen.queryByTestId('shimmer-block')).not.toBeInTheDocument()
    })
  })

  describe('empty state', () => {
    it('shows "No transactions found" when no debit transactions', () => {
      const transactions = [
        createTransaction({ type: 'credit', id: 'tx-1' }),
        createTransaction({ type: 'credit', id: 'tx-2' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('No transactions found')).toBeInTheDocument()
    })

    it('shows empty state when transactions array is empty', () => {
      render(<TransactionsTable transactions={[]} isLoading={false} />)

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
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

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
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('No transactions found')).toBeInTheDocument()
    })
  })

  describe('20-item limit', () => {
    it('renders only first 20 debit transactions when given more', () => {
      const transactions = Array.from({ length: 25 }, (_, i) =>
        createTransaction({
          id: `tx-${i + 1}`,
          merchant: `Merchant ${i + 1}`,
        })
      )
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      for (let i = 1; i <= 20; i++) {
        expect(screen.getByTestId(`transaction-row-tx-${i}`)).toBeInTheDocument()
      }

      expect(screen.queryByTestId('transaction-row-tx-21')).not.toBeInTheDocument()
      expect(screen.queryByTestId('transaction-row-tx-25')).not.toBeInTheDocument()
    })

    it('shows exactly 20 when given 25 debits', () => {
      const transactions = Array.from({ length: 25 }, (_, i) =>
        createTransaction({ id: `tx-${i + 1}` })
      )
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('20 shown')).toBeInTheDocument()
    })
  })

  describe('row rendering', () => {
    it('renders each row with correct data-testid', () => {
      const transactions = [
        createTransaction({ id: 'tx-abc', merchant: 'McDonald\'s' }),
        createTransaction({ id: 'tx-def', merchant: 'Starbucks' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByTestId('transaction-row-tx-abc')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-row-tx-def')).toBeInTheDocument()
    })

    it('shows merchant name in transaction row', () => {
      const transactions = [
        createTransaction({ merchant: 'McDonald\'s' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('McDonald\'s')).toBeInTheDocument()
    })

    it('shows formatted amount in transaction row', () => {
      const transactions = [
        createTransaction({ amount: 5000 }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('₹5,000')).toBeInTheDocument()
    })

    it('shows date in transaction row', () => {
      const transactions = [
        createTransaction({ date: '2025-01-15' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('15 Jan')).toBeInTheDocument()
    })

    it('formats amounts with thousands separator', () => {
      const transactions = [
        createTransaction({ amount: 123456 }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('₹1,23,456')).toBeInTheDocument()
    })

    it('formats amounts without decimal places', () => {
      const transactions = [
        createTransaction({ amount: 99.99 }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('₹100')).toBeInTheDocument()
    })
  })

  describe('merchant fallback', () => {
    it('shows raw_description when merchant is empty string', () => {
      const transactions = [
        createTransaction({ merchant: '', raw_description: 'UPI-TRANSFER-XYZ' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('UPI-TRANSFER-XYZ')).toBeInTheDocument()
    })

    it('shows raw_description when merchant is not provided', () => {
      const transactions = [
        createTransaction({ merchant: '', raw_description: 'Fuel Station ABC' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('Fuel Station ABC')).toBeInTheDocument()
    })

    it('prefers merchant name over raw_description when merchant exists', () => {
      const transactions = [
        createTransaction({
          merchant: 'Amazon',
          raw_description: 'AMZN-XYZ-123',
        }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

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
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('3 shown')).toBeInTheDocument()
    })

    it('does not show count when no debits exist', () => {
      const transactions = [
        createTransaction({ type: 'credit' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.queryByText(/shown/)).not.toBeInTheDocument()
    })

    it('shows count as 1 when only one debit exists', () => {
      const transactions = [
        createTransaction({ id: 'tx-1' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('1 shown')).toBeInTheDocument()
    })

    it('shows correct count when at limit (20)', () => {
      const transactions = Array.from({ length: 20 }, (_, i) =>
        createTransaction({ id: `tx-${i + 1}` })
      )
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('20 shown')).toBeInTheDocument()
    })
  })

  describe('category chip', () => {
    it('renders category display name in each row', () => {
      const transactions = [
        createTransaction({ category: 'food' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('Food')).toBeInTheDocument()
    })

    it('shows correct display names for different categories', () => {
      const transactions = [
        createTransaction({ id: 'tx-1', category: 'food' }),
        createTransaction({ id: 'tx-2', category: 'groceries' }),
        createTransaction({ id: 'tx-3', category: 'transport' }),
        createTransaction({ id: 'tx-4', category: 'shopping' }),
        createTransaction({ id: 'tx-5', category: 'emi_loans' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('Food')).toBeInTheDocument()
      expect(screen.getByText('Groceries')).toBeInTheDocument()
      expect(screen.getByText('Transport')).toBeInTheDocument()
      expect(screen.getByText('Shopping')).toBeInTheDocument()
      expect(screen.getByText('EMI')).toBeInTheDocument()
    })

    it('shows emi_loans as "EMI"', () => {
      const transactions = [
        createTransaction({ category: 'emi_loans' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('EMI')).toBeInTheDocument()
    })

    it('shows utilities as "Bills"', () => {
      const transactions = [
        createTransaction({ category: 'utilities' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('Bills')).toBeInTheDocument()
    })

    it('shows entertainment category', () => {
      const transactions = [
        createTransaction({ category: 'entertainment' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('Entertainment')).toBeInTheDocument()
    })

    it('shows health category', () => {
      const transactions = [
        createTransaction({ category: 'health' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('Health')).toBeInTheDocument()
    })

    it('shows travel category', () => {
      const transactions = [
        createTransaction({ category: 'travel' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('Travel')).toBeInTheDocument()
    })

    it('shows others category', () => {
      const transactions = [
        createTransaction({ category: 'others' }),
      ]
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('Others')).toBeInTheDocument()
    })
  })

  describe('main container', () => {
    it('renders main container with data-testid="transactions-table"', () => {
      render(<TransactionsTable transactions={[]} isLoading={false} />)

      expect(screen.getByTestId('transactions-table')).toBeInTheDocument()
    })

    it('shows "Transactions" title', () => {
      render(<TransactionsTable transactions={[]} isLoading={false} />)

      expect(screen.getByText('Transactions')).toBeInTheDocument()
    })

    it('shows "Recent" label', () => {
      render(<TransactionsTable transactions={[]} isLoading={false} />)

      expect(screen.getByText('Recent')).toBeInTheDocument()
    })
  })

  describe('integration scenarios', () => {
    it('handles mix of credits and debits, showing only debits up to 20', () => {
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
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      expect(screen.getByText('20 shown')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-row-debit-1')).toBeInTheDocument()
      expect(screen.getByTestId('transaction-row-debit-extra-20')).toBeInTheDocument()
      expect(screen.queryByTestId('transaction-row-debit-extra-21')).not.toBeInTheDocument()
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
      render(<TransactionsTable transactions={transactions} isLoading={false} />)

      const row = screen.getByTestId('transaction-row-tx-full')
      expect(row).toBeInTheDocument()
      expect(screen.getByText('28 Feb')).toBeInTheDocument()
      expect(screen.getByText('Amazon.in')).toBeInTheDocument()
      expect(screen.getByText('Shopping')).toBeInTheDocument()
      expect(screen.getByText('₹15,000')).toBeInTheDocument()
    })
  })
})
