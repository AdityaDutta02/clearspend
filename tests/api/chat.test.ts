import { vi, describe, it, expect, beforeEach } from 'vitest'
import { POST } from '@/app/api/chat/route'
import * as terminalAi from '@/lib/terminal-ai'
import * as buildContext from '@/lib/ai/build-context'

vi.mock('@/lib/terminal-ai')
vi.mock('@/lib/ai/build-context')

describe('POST /api/chat', () => {
  beforeEach(() => { vi.resetAllMocks() })

  it('returns 401 when Authorization header is missing', async () => {
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'How much did I spend?' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 401 when Authorization header has no Bearer prefix', async () => {
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { Authorization: 'Token abc123', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'How much did I spend?' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
    const data = await res.json()
    expect(data.error).toBe('Unauthorized')
  })

  it('returns 400 when question is missing', async () => {
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer mytoken', 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Question is required')
  })

  it('returns 400 when question is only whitespace', async () => {
    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer mytoken', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: '   ' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const data = await res.json()
    expect(data.error).toBe('Question is required')
  })

  it('returns answer on success with correct callGateway args', async () => {
    const mockContext = 'FINANCIAL DATA SUMMARY\nMonthly spend: 2024-01: ₹10,000 (HDFC)'
    vi.mocked(buildContext.buildFinancialContext).mockResolvedValue(mockContext)
    vi.mocked(terminalAi.callGateway).mockResolvedValue({
      id: 'gen-1',
      content: 'AI response text',
      model_used: 'deepseek/deepseek-v3.2',
      usage: { input_tokens: 100, output_tokens: 50 },
      credits_charged: 0.01,
    })

    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer mytoken', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'How much did I spend?' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.answer).toBe('AI response text')

    expect(terminalAi.callGateway).toHaveBeenCalledOnce()
    const [messages, token, options] = vi.mocked(terminalAi.callGateway).mock.calls[0]
    expect(token).toBe('mytoken')
    expect(options).toEqual({ model: 'deepseek/deepseek-v3.2' })
    expect(messages).toHaveLength(2)
    expect(messages[0].role).toBe('system')
    expect(messages[0].content).toContain(mockContext)
    expect(messages[1].role).toBe('user')
    expect(messages[1].content).toBe('How much did I spend?')
  })

  it('returns 402 INSUFFICIENT_CREDITS when callGateway throws error containing 402', async () => {
    vi.mocked(buildContext.buildFinancialContext).mockResolvedValue('some context')
    vi.mocked(terminalAi.callGateway).mockRejectedValue(new Error('Gateway error (402): insufficient credits'))

    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer mytoken', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'What is my balance?' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(402)
    const data = await res.json()
    expect(data.error).toBe('INSUFFICIENT_CREDITS')
  })

  it('returns 500 with error message when buildFinancialContext throws', async () => {
    vi.mocked(buildContext.buildFinancialContext).mockRejectedValue(new Error('DB unavailable'))

    const { NextRequest } = await import('next/server')
    const req = new NextRequest('http://localhost/api/chat', {
      method: 'POST',
      headers: { Authorization: 'Bearer mytoken', 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: 'Show me my top expenses' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(500)
    const data = await res.json()
    expect(data.error).toBe('DB unavailable')
  })
})
