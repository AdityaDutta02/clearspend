'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { renderMarkdown } from '@/lib/render-markdown'

export interface ChatRailProps {
  token: string
  className?: string
  style?: React.CSSProperties
}

interface Message {
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

export function ChatRail({ token, className, style }: ChatRailProps): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const el = scrollRef.current
    if (el && typeof el.scrollTo === 'function') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, isLoading])

  const submit = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      setQuestion('')
      setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
      setIsLoading(true)

      abortRef.current?.abort()
      abortRef.current = new AbortController()
      const { signal } = abortRef.current

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
            { role: 'assistant', content: displayMsg, isError: true },
          ])
          return
        }

        // Read SSE stream
        const reader = res.body.getReader()
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
                  { role: 'assistant', content: displayMsg, isError: true },
                ])
                msgAdded = true
                continue
              }

              if (parsed.delta) {
                assistantContent += parsed.delta
                if (!msgAdded) {
                  setMessages((prev) => [
                    ...prev,
                    { role: 'assistant', content: assistantContent },
                  ])
                  msgAdded = true
                } else {
                  setMessages((prev) => {
                    const next = [...prev]
                    next[next.length - 1] = { role: 'assistant', content: assistantContent }
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
            role: 'assistant',
            content: 'An unexpected error occurred. Please try again.',
            isError: true,
          },
        ])
      } finally {
        setIsLoading(false)
        inputRef.current?.focus()
      }
    },
    [token, isLoading],
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
        {/* Suggestions when empty */}
        {showSuggestions && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginTop: '8px',
            }}
          >
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void submit(s)}
                style={{
                  textAlign: 'left',
                  background: 'var(--surface-raised, #f2f2f2)',
                  border: '1px solid var(--border, rgba(0,0,0,0.08))',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary, #334155)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            {msg.role === 'user' ? (
              <div
                data-testid="chat-user-msg"
                style={{
                  background: 'var(--primary, #5e6ad2)',
                  color: '#fff',
                  borderRadius: '12px 12px 2px 12px',
                  padding: '8px 12px',
                  maxWidth: '85%',
                  alignSelf: 'flex-end',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                }}
              >
                {msg.content}
              </div>
            ) : (
              <div
                data-testid="chat-assistant-msg"
                style={{
                  background: msg.isError
                    ? 'var(--accent-negative-subtle, rgba(220,38,38,0.07))'
                    : 'var(--surface-raised, #f2f2f2)',
                  border: msg.isError
                    ? '1px solid rgba(220,38,38,0.15)'
                    : '1px solid var(--border, rgba(0,0,0,0.08))',
                  borderRadius: '12px 12px 12px 2px',
                  padding: '8px 12px',
                  maxWidth: '85%',
                  color: msg.isError ? 'var(--accent-negative, #dc2626)' : 'var(--text, #0f172a)',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
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
          <div
            data-testid="chat-loading"
            aria-label="Loading response"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '8px 4px',
            }}
          >
            {[0, 1, 2].map((n) => (
              <span
                key={n}
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--muted, #94a3b8)',
                  display: 'inline-block',
                  animation: 'chat-dot-bounce 1.2s ease-in-out infinite',
                  animationDelay: `${n * 0.2}s`,
                }}
              />
            ))}
          </div>
        )}
      </div>

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

      <style>{`
        @keyframes chat-dot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
