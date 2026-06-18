import { describe, it, expect } from 'vitest'
import { scoreStatementText } from '@/lib/is-statement'

const STATEMENT = `HDFC Bank Account Statement
Account Number XXXX  IFSC HDFC0001234
Date Narration Debit Credit Balance
01/01/2024 UPI/SWIGGY 200.00 Dr  closing balance 5000.00`

describe('scoreStatementText', () => {
  it('rates a real statement high', () => {
    const r = scoreStatementText(STATEMENT, 5)
    expect(r.confidence).toBe('high')
    expect(r.score).toBeGreaterThanOrEqual(60)
  })

  it('rates obvious junk low with no signals', () => {
    const r = scoreStatementText('Lorem ipsum dolor sit amet, my résumé and cover letter.', 0)
    expect(r.confidence).toBe('low')
    expect(r.signals).toHaveLength(0)
  })

  it('rates an invoice-like doc medium (dates+amounts but no bank vocab)', () => {
    const r = scoreStatementText('Invoice 2024 Total 1,234.00 due 12/2024', 1)
    expect(r.confidence).toBe('medium')
  })

  it('reports which signals fired', () => {
    const r = scoreStatementText(STATEMENT, 5)
    expect(r.signals).toContain('bank')
    expect(r.signals).toContain('vocab')
  })
})
