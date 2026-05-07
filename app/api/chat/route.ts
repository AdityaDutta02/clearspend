import { NextRequest, NextResponse } from 'next/server'
import { callGateway } from '@/lib/terminal-ai'
import { buildFinancialContext } from '@/lib/ai/build-context'

export async function POST(req: NextRequest): Promise<NextResponse> {
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const token = authHeader.slice(7)

  const body = (await req.json()) as { question?: string }
  const question = body.question?.trim()
  if (!question) {
    return NextResponse.json({ error: 'Question is required' }, { status: 400 })
  }

  try {
    const context = await buildFinancialContext(token)

    const messages = [
      {
        role: 'system',
        content: `You are ClearSpend, a personal financial advisor. You have access to the user's real spending data below. Answer questions concisely and actionably. Use INR amounts. If the data doesn't support a specific answer, say so honestly.\n\n${context}`,
      },
      { role: 'user', content: question },
    ]

    const result = await callGateway(messages, token, { model: 'deepseek/deepseek-v3.2' })
    return NextResponse.json({ answer: result.content })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    if (msg.includes('402') || msg.includes('credits') || msg.includes('INSUFFICIENT')) {
      return NextResponse.json({ error: 'INSUFFICIENT_CREDITS' }, { status: 402 })
    }
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
