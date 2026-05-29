import { NextRequest } from 'next/server'
import { buildFinancialContext } from '@/lib/ai/build-context'
import { callGateway } from '@/lib/terminal-ai'

// In-memory context cache: avoid rebuilding DB context on every follow-up
const ctxCache = new Map<string, { ctx: string; exp: number }>()
async function getContext(token: string): Promise<string> {
  const hit = ctxCache.get(token)
  if (hit && hit.exp > Date.now()) return hit.ctx
  const ctx = await buildFinancialContext(token)
  ctxCache.set(token, { ctx, exp: Date.now() + 120_000 })
  return ctx
}

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}
function sseChunk(delta: string): Uint8Array {
  return enc(`data: ${JSON.stringify({ delta })}\n\n`)
}
function sseError(message: string): Uint8Array {
  return enc(`data: ${JSON.stringify({ error: message })}\n\n`)
}
function sseDone(): Uint8Array {
  return enc('data: [DONE]\n\n')
}

// Yield to the event loop so the HTTP layer can flush buffered chunks
function yield_(): Promise<void> {
  return new Promise<void>((r) => setTimeout(r, 0))
}

export async function POST(req: NextRequest): Promise<Response> {
  const authHeader = req.headers.get('authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  const token = authHeader.slice(7)

  const body = (await req.json()) as { question?: string }
  const question = body.question?.trim()
  if (!question) {
    return new Response(JSON.stringify({ error: 'Question is required' }), { status: 400 })
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()

  void (async () => {
    try {
      const context = await getContext(token)

      const systemPrompt = `You are ClearSpend, a personal financial assistant embedded in a credit report and spending analysis app. Your sole purpose is to answer questions about the user's financial data — their transactions, spending categories, merchants, monthly trends, subscriptions, EMIs, and credit report statements.\n\nIf the user's question is not about their personal financial data, spending, transactions, bills, or credit reports, respond with exactly: "I can only answer questions about your financial reports and spending data."\n\nDo not answer general knowledge questions, jokes, coding questions, or anything unrelated to the user's finances — even if asked politely.\n\nAnswer using the user's real spending data below. Be concise (under 200 words). Use markdown: **bold** for key numbers, - bullet lists, ### for section headers.\n\n${context}`

      const result = await callGateway(
        [{ role: 'user', content: question }],
        token,
        { model: 'qwen/qwen-plus', system: systemPrompt },
      )

      // Trickle the response word-by-word for a streaming feel
      const words = result.content.split(/(\s+)/).filter(Boolean)
      for (let i = 0; i < words.length; i++) {
        await writer.write(sseChunk(words[i]))
        if (i % 4 === 3) await yield_()
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      if (msg.includes('402') || msg.includes('credits') || msg.includes('INSUFFICIENT')) {
        await writer.write(sseError('INSUFFICIENT_CREDITS'))
      } else {
        await writer.write(sseError(msg))
      }
    } finally {
      await writer.write(sseDone())
      await writer.close()
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
      'Transfer-Encoding': 'chunked',
    },
  })
}
