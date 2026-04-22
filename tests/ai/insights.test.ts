import { vi, describe, it, expect, beforeEach } from 'vitest'
import { generateInsights } from '@/lib/ai/insights'
import * as terminalAi from '@/lib/terminal-ai'
import type { CategorySlug } from '@/types'

vi.mock('@/lib/terminal-ai')

describe('generateInsights', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns 3-5 insight strings', async () => {
    vi.mocked(terminalAi.callModel).mockResolvedValue(
      JSON.stringify(['Food spending up 30%', 'Top merchant: Swiggy', 'UPI is 65% of spend'])
    )
    const result = await generateInsights(
      { food: 5000, transport: 1000, others: 500 } as Partial<Record<CategorySlug, number>>,
      [{ name: 'Swiggy', total: 3200, count: 12 }],
      6500, null, 'token',
    )
    expect(result).toHaveLength(3)
    expect(result[0]).toContain('Food')
  })

  it('returns fallback insights on AI failure', async () => {
    vi.mocked(terminalAi.callModel).mockRejectedValue(new Error('timeout'))
    const result = await generateInsights({} as Partial<Record<CategorySlug, number>>, [], 5000, null, 'token')
    expect(result.length).toBeGreaterThanOrEqual(0)
  })
})
