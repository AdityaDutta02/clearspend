import { detectBankAndMonth } from '@/lib/bank-detect'

describe('detectBankAndMonth', () => {
  it('detects HDFC from header', () => {
    const result = detectBankAndMonth('HDFC Bank Credit Card Statement\nStatement Period: March 2024')
    expect(result.bank).toBe('hdfc')
    expect(result.month).toBe('2024-03')
  })

  it('detects SBI from header', () => {
    const result = detectBankAndMonth('State Bank of India\nAccount Statement February 2024')
    expect(result.bank).toBe('sbi')
    expect(result.month).toBe('2024-02')
  })

  it('detects ICICI from header', () => {
    const result = detectBankAndMonth('ICICI Bank Limited\nJan 2024')
    expect(result.bank).toBe('icici')
    expect(result.month).toBe('2024-01')
  })

  it('returns null for unrecognised bank', () => {
    const result = detectBankAndMonth('Some random text without bank name')
    expect(result.bank).toBeNull()
    expect(result.month).toBeNull()
  })

  it('detects credit account type', () => {
    const result = detectBankAndMonth('HDFC Bank Credit Card Statement')
    expect(result.account_type).toBe('credit')
  })

  it('defaults to debit when no credit card mention', () => {
    const result = detectBankAndMonth('HDFC Bank Account Statement')
    expect(result.account_type).toBe('debit')
  })
})
