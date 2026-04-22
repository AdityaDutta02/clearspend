import { vi, describe, it, expect, beforeEach } from 'vitest'
import { resolveUpiMerchants } from '@/lib/ai/upi-resolve'
import * as terminalAi from '@/lib/terminal-ai'

vi.mock('@/lib/terminal-ai')

describe('resolveUpiMerchants', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('resolves UPI merchant names', async () => {
    vi.mocked(terminalAi.callModel).mockResolvedValue(
      JSON.stringify([{ id: '1', upi_merchant: 'Swiggy' }])
    )
    const txs = [{ id: '1', upi_ref: 'swiggy@sbi', merchant: 'UPI', description: 'UPI swiggy@sbi' }]
    const result = await resolveUpiMerchants(txs, 'token')
    expect(result[0].upi_merchant).toBe('Swiggy')
  })

  it('skips non-UPI transactions', async () => {
    const txs = [{ id: '1', upi_ref: null, merchant: 'ATM', description: 'ATM withdrawal' }]
    const result = await resolveUpiMerchants(txs, 'token')
    expect(result[0].upi_merchant).toBeNull()
    expect(terminalAi.callModel).not.toHaveBeenCalled()
  })
})
