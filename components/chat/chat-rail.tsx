'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { renderMarkdown } from '@/lib/render-markdown'

export interface ChatRailProps {
  token: string
  className?: string
  style?: React.CSSProperties
  hideHeader?: boolean
}

interface Message {
  id: number
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
}

const SUGGESTIONS = [
  'How much did I spend this month?',
  'What is my biggest expense category?',
  'Which merchants do I spend the most at?',
  'How does this month compare to last month?',
  'What are my recurring subscriptions?',
]

export function ChatRail({ token, className, style, hideHeader }: ChatRailProps): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const isLoadingRef = useRef(false)
  const msgIdRef = useRef(0)

  useEffect(() => {
    const el = scrollRef.current
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, isLoading])

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  const submit = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim()
      if (!trimmed || isLoadingRef.current) return
      isLoadingRef.current = true
      setIsLoading(true)

      setQuestion('')
      setMessages((prev) => [...prev, { id: ++msgIdRef.current, role: 'user', content: trimmed }])

      abortRef.current?.abort()
      abortRef.current = new AbortController()
      const { signal } = abortRef.current

      let reader: ReadableStreamDefaultReader<Uint8Array> | null = null
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ question: trimmed }),
          signal,
        })

        if (!res.ok || !res.body) {
          let errMsg = 'An unexpected error occurred.'
          try {
            const json = (await res.json()) as { error?: string }
            errMsg = json.error ?? errMsg
          } catch {
            /* non-JSON */
          }
          const displayMsg =
            errMsg.includes('INSUFFICIENT_CREDITS') || errMsg === 'INSUFFICIENT_CREDITS'
              ? 'You need at least 1 credit to send a message.'
              : errMsg
          setMessages((prev) => [
            ...prev,
            { id: ++msgIdRef.current, role: 'assistant', content: displayMsg, isError: true },
          ])
          return
        }

        // Read SSE stream
        reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        let assistantContent = ''
        let msgAdded = false

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
              const parsed = JSON.parse(raw) as { delta?: string; error?: string }

              if (parsed.error) {
                const displayMsg = parsed.error.includes('INSUFFICIENT_CREDITS')
                  ? 'You need at least 1 credit to send a message.'
                  : parsed.error
                setMessages((prev) => [
                  ...prev,
                  { id: ++msgIdRef.current, role: 'assistant', content: displayMsg, isError: true },
                ])
                msgAdded = true
                continue
              }

              if (parsed.delta) {
                assistantContent += parsed.delta
                if (!msgAdded) {
                  setMessages((prev) => [
                    ...prev,
                    { id: ++msgIdRef.current, role: 'assistant', content: assistantContent },
                  ])
                  msgAdded = true
                } else {
                  setMessages((prev) => {
                    const next = [...prev]
                    next[next.length - 1] = { ...next[next.length - 1], content: assistantContent }
                    return next
                  })
                }
              }
            } catch {
              /* ignore malformed chunk */
            }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setMessages((prev) => [
          ...prev,
          {
            id: ++msgIdRef.current,
            role: 'assistant',
            content: 'An unexpected error occurred. Please try again.',
            isError: true,
          },
        ])
      } finally {
        if (reader) {
          reader.cancel().catch(() => {})
        }
        isLoadingRef.current = false
        setIsLoading(false)
        inputRef.current?.focus()
      }
    },
    [token],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>): void => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void submit(question)
      }
    },
    [question, submit],
  )

  const hasMessages = messages.length > 0 || isLoading
  const showSuggestions = !hasMessages

  return (
    <div
      data-testid="chat-rail"
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        ...style,
      }}
    >
      {/* Header */}
      {!hideHeader && (
        <header
          style={{
            height: 44,
            minHeight: 44,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 16px',
            borderBottom: '1px solid var(--border, rgba(0,0,0,0.08))',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: '0.875rem',
              fontWeight: 600,
              color: 'var(--text, #0f172a)',
            }}
          >
            Ask ClearSpend
          </span>
          <span
            style={{
              fontSize: '0.65rem',
              fontWeight: 700,
              background: 'var(--primary, #5e6ad2)',
              color: '#fff',
              borderRadius: '4px',
              padding: '1px 5px',
              letterSpacing: '0.04em',
            }}
          >
            AI
          </span>
        </header>
      )}

      {/* Conversation area */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {/* Messages */}
        {messages.map((msg, i) => (
          <div key={msg.id}>
            {i > 0 && (
              <hr style={{ border: 'none', borderTop: '1px solid var(--border, rgba(0,0,0,0.08))', margin: '4px 0' }} />
            )}
            {msg.role === 'user' ? (
              <p
                data-testid="chat-user-msg"
                style={{
                  fontSize: '0.82rem',
                  lineHeight: 1.55,
                  color: 'var(--muted, #8a8a8a)',
                  textAlign: 'right',
                  margin: '6px 0',
                  fontWeight: 500,
                }}
              >
                {msg.content}
              </p>
            ) : (
              <div
                data-testid="chat-assistant-msg"
                style={{
                  fontSize: '0.82rem',
                  lineHeight: 1.55,
                  color: msg.isError ? 'var(--accent-negative, #dc2626)' : 'var(--text, #1a1a1a)',
                  margin: '6px 0',
                }}
              >
                {msg.isError ? (
                  <span>{msg.content}</span>
                ) : (
                  renderMarkdown(msg.content)
                )}
              </div>
            )}
          </div>
        ))}

        {/* Loading dots */}
        {isLoading && (
          <div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--border, rgba(0,0,0,0.08))', margin: '4px 0' }} />
            <div
              data-testid="chat-loading"
              aria-label="Loading response"
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 0' }}
            >
              {[0, 1, 2].map((n) => (
                <span
                  key={n}
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: 'var(--muted, #8a8a8a)',
                    display: 'inline-block',
                    animation: 'chat-dot-bounce 1.2s ease-in-out infinite',
                    animationDelay: `${n * 0.2}s`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Suggestion list above input */}
      {showSuggestions && (
        <div
          style={{
            borderTop: '1px solid var(--border, rgba(0,0,0,0.08))',
            margin: '0 12px 8px',
            border: '1px solid var(--border, rgba(0,0,0,0.08))',
            borderRadius: '10px',
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          {SUGGESTIONS.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => void submit(s)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'none',
                border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--border, rgba(0,0,0,0.08))',
                padding: '10px 14px',
                fontSize: '0.78rem',
                color: 'var(--text, #1a1a1a)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                lineHeight: 1.4,
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-raised, #f2f2f2)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'none' }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Input area */}
      <div
        style={{
          borderTop: '1px solid var(--border, rgba(0,0,0,0.08))',
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <input
          ref={inputRef}
          data-testid="chat-input"
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything about your finances…"
          disabled={isLoading}
          style={{
            flex: 1,
            border: '1px solid var(--border, rgba(0,0,0,0.08))',
            borderRadius: '8px',
            outline: 'none',
            background: 'var(--surface, #ffffff)',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            color: 'var(--text, #0f172a)',
            padding: '8px 10px',
          }}
        />

        <button
          type="button"
          onClick={() => void submit(question)}
          data-testid="chat-send-btn"
          disabled={isLoading || !question.trim()}
          aria-label="Send question"
          style={{
            flexShrink: 0,
            width: 34,
            height: 34,
            borderRadius: '8px',
            background:
              isLoading || !question.trim() ? 'transparent' : 'var(--primary, #5e6ad2)',
            color: isLoading || !question.trim() ? 'var(--muted, #94a3b8)' : '#ffffff',
            border:
              isLoading || !question.trim()
                ? '1px solid var(--border, rgba(0,0,0,0.08))'
                : 'none',
            cursor: isLoading || !question.trim() ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.15s ease',
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>
    </div>
  )
}
