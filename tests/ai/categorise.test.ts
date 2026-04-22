import { vi, describe, it, expect, beforeEach } from 'vitest'
import { categoriseTransactions } from '@/lib/ai/categorise'
import * as terminalAi from '@/lib/terminal-ai'

vi.mock('@/lib/terminal-ai')

describe('categoriseTransactions', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns categorised transactions', async () => {
    vi.mocked(terminalAi.callModel).mockResolvedValue(
      JSON.stringify([
        { id: '1', merchant: 'Swiggy', category: 'food' },
        { id: '2', merchant: 'Uber', category: 'transport' },
      ])
    )

    const raw = [
      { id: '1', date: '2024-01-01', amount: 200, type: 'debit' as const, description: 'SWIGGY ORDER', upi_ref: null },
      { id: '2', date: '2024-01-01', amount: 150, type: 'debit' as const, description: 'UBER TRIP', upi_ref: null },
    ]

    const result = await categoriseTransactions(raw, 'token')
    expect(result[0].category).toBe('food')
    expect(result[0].merchant).toBe('Swiggy')
    expect(result[1].category).toBe('transport')
  })
})
