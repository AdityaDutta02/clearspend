import { NextRequest } from 'next/server'
import { buildFinancialContext } from '@/lib/ai/build-context'

const GATEWAY_URL = process.env.TERMINAL_AI_GATEWAY_URL!

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

      const messages = [
        {
          role: 'system',
          content: `You are ClearSpend, a personal financial advisor. Answer using the user's real spending data below. Be concise (under 200 words). Use markdown: **bold** for key numbers, - bullet lists, ### for section headers.\n\n${context}`,
        },
        { role: 'user', content: question },
      ]

      const gatewayRes = await fetch(`${GATEWAY_URL}/v1/generate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'qwen/qwen3.5-flash-02-23',
          messages,
          stream: true,
        }),
      })

      if (!gatewayRes.ok) {
        const err = await gatewayRes.json().catch(() => ({ error: gatewayRes.statusText })) as Record<string, string>
        const msg = err.error ?? gatewayRes.statusText
        if (msg.includes('402') || msg.includes('credits') || msg.includes('INSUFFICIENT')) {
          await writer.write(sseError('INSUFFICIENT_CREDITS'))
        } else {
          await writer.write(sseError(msg))
        }
        return
      }

      const contentType = gatewayRes.headers.get('content-type') ?? ''

      if (contentType.includes('text/event-stream') && gatewayRes.body) {
        // True SSE from gateway — parse and re-emit
        const reader = gatewayRes.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const raw = line.slice(6).trim()
            if (raw === '[DONE]') continue
            try {
              const parsed = JSON.parse(raw) as Record<string, unknown>
              const choices = parsed.choices as Array<{ delta?: { content?: string } }> | undefined
              const delta =
                choices?.[0]?.delta?.content ??
                (parsed.delta as string | undefined) ??
                ''
              if (delta) await writer.write(sseChunk(delta))
            } catch { /* ignore malformed chunk */ }
          }
        }
      } else {
        // Non-streaming gateway: read full JSON then trickle word-by-word
        // Yield every few words so the HTTP layer can flush chunks to the client
        const json = await gatewayRes.json() as { content?: string; error?: string }

        if (json.error) {
          await writer.write(sseError(json.error))
        } else {
          const words = (json.content ?? '').split(/(\s+)/).filter(Boolean)
          for (let i = 0; i < words.length; i++) {
            await writer.write(sseChunk(words[i]))
            // Yield every 4 words — gives the HTTP layer a chance to flush
            if (i % 4 === 3) await yield_()
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error'
      await writer.write(sseError(msg))
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
