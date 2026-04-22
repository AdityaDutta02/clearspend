import type { Statement } from '@/types'

it('types compile', () => {
  const s: Statement = {
    id: 'x', month: '2024-01', bank: 'hdfc', account_type: 'credit',
    transaction_count: 1, total_debit: 100, total_credit: 0,
    currency: 'INR', uploaded_at: new Date().toISOString(),
  }
  expect(s.bank).toBe('hdfc')
})
