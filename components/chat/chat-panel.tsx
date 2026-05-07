'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { renderMarkdown } from '@/lib/render-markdown'

export interface ChatPanelProps {
  token: string
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
  'How can I reduce my spending?',
  'What are my recurring subscriptions?',
]

// How many past exchanges to show in the thread (each exchange = user + assistant)
const VISIBLE_EXCHANGES = 2

export function ChatPanel({ token }: ChatPanelProps): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const threadRef = useRef<HTMLDivElement | null>(null)

  const filteredSuggestions = useMemo(() => {
    const q = question.trim().toLowerCase()
    if (!q) return SUGGESTIONS
    return SUGGESTIONS.filter((s) => s.toLowerCase().includes(q))
  }, [question])

  useEffect(() => {
    if (threadRef.current && typeof threadRef.current.scrollTo === 'function') {
      threadRef.current.scrollTo({ top: threadRef.current.scrollHeight, behavior: 'smooth' })
    }
  }, [messages, isLoading])

  const submit = useCallback(
    async (text: string): Promise<void> => {
      const trimmed = text.trim()
      if (!trimmed || isLoading) return

      setShowSuggestions(false)
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
            const json = await res.json() as { error?: string }
            errMsg = json.error ?? errMsg
          } catch { /* non-JSON */ }
          const displayMsg =
            errMsg.includes('INSUFFICIENT_CREDITS') || errMsg === 'INSUFFICIENT_CREDITS'
              ? 'You need at least 1 credit to send a message.'
              : errMsg
          setMessages((prev) => [...prev, { role: 'assistant', content: displayMsg, isError: true }])
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
                const displayMsg =
                  parsed.error.includes('INSUFFICIENT_CREDITS')
                    ? 'You need at least 1 credit to send a message.'
                    : parsed.error
                setMessages((prev) => [...prev, { role: 'assistant', content: displayMsg, isError: true }])
                msgAdded = true
                continue
              }

              if (parsed.delta) {
                assistantContent += parsed.delta
                if (!msgAdded) {
                  setMessages((prev) => [...prev, { role: 'assistant', content: assistantContent }])
                  msgAdded = true
                } else {
                  setMessages((prev) => {
                    const next = [...prev]
                    next[next.length - 1] = { role: 'assistant', content: assistantContent }
                    return next
                  })
                }
              }
            } catch { /* ignore malformed chunk */ }
          }
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'An unexpected error occurred. Please try again.', isError: true },
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
      if (e.key === 'Enter') {
        e.preventDefault()
        void submit(question)
      }
      if (e.key === 'Escape') {
        setShowSuggestions(false)
      }
    },
    [question, submit],
  )

  const handleSuggestionClick = useCallback(
    (s: string): void => {
      void submit(s)
    },
    [submit],
  )

  // Only show last VISIBLE_EXCHANGES exchanges to keep the panel compact
  const visibleMessages = useMemo(() => {
    const maxVisible = VISIBLE_EXCHANGES * 2
    return messages.slice(-maxVisible)
  }, [messages])

  const hiddenCount = messages.length - visibleMessages.length
  const hasThread = messages.length > 0 || isLoading

  return (
    <div data-testid="chat-panel">
      {/* Search bar */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            background: 'var(--surface, #ffffff)',
            border: '1.5px solid var(--border-medium, rgba(15,23,42,0.13))',
            borderRadius: showSuggestions && filteredSuggestions.length > 0 ? '1rem 1rem 0 0' : '1rem',
            padding: '0 1rem',
            boxShadow: 'var(--shadow-card)',
            transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
          }}
          onFocus={() => setShowSuggestions(true)}
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              setShowSuggestions(false)
            }
          }}
        >
          {/* Search icon */}
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--muted, #64748b)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            ref={inputRef}
            data-testid="chat-input"
            type="text"
            value={question}
            onChange={(e) => {
              setQuestion(e.target.value)
              setShowSuggestions(true)
            }}
            onFocus={() => setShowSuggestions(true)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your finances…"
            style={{
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: '0.875rem',
              fontFamily: 'inherit',
              color: 'var(--text, #0f172a)',
              padding: '0.875rem 0',
            }}
          />

          {/* Send button */}
          <button
            type="button"
            onClick={() => void submit(question)}
            data-testid="chat-send-btn"
            disabled={isLoading || !question.trim()}
            aria-label="Send question"
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              borderRadius: '0.5rem',
              background:
                isLoading || !question.trim() ? 'transparent' : 'var(--primary, #2563eb)',
              color: isLoading || !question.trim() ? 'var(--muted, #94a3b8)' : '#ffffff',
              border: isLoading || !question.trim() ? '1px solid var(--border, rgba(15,23,42,0.07))' : 'none',
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

        {/* Autocomplete dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div
            data-testid="chat-suggestions"
            role="listbox"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 20,
              background: 'var(--surface, #ffffff)',
              border: '1.5px solid var(--border-medium, rgba(15,23,42,0.13))',
              borderTop: 'none',
              borderRadius: '0 0 1rem 1rem',
              overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
            }}
          >
            {filteredSuggestions.map((s, i) => (
              <button
                key={s}
                role="option"
                aria-selected={false}
                type="button"
                data-testid="chat-suggestion"
                onMouseDown={(e) => {
                  e.preventDefault()
                  handleSuggestionClick(s)
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '0.65rem 1rem',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary, #334155)',
                  background: 'transparent',
                  border: 'none',
                  borderTop: i > 0 ? '1px solid var(--border, rgba(15,23,42,0.07))' : 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontFamily: 'inherit',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'var(--surface-hover, #eff6ff)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <svg
                  width="11"
                  height="11"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--muted, #64748b)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  style={{ flexShrink: 0 }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Conversation thread */}
      {hasThread && (
        <div
          ref={threadRef}
          data-testid="chat-thread"
          style={{
            marginTop: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          {/* Collapsed history pill */}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => {
                // Expand: temporarily show all (not needed for MVP, just reset)
              }}
              style={{
                alignSelf: 'center',
                background: 'rgba(15,23,42,0.05)',
                border: 'none',
                borderRadius: '999px',
                padding: '4px 12px',
                fontSize: '0.72rem',
                color: 'var(--muted, #64748b)',
                cursor: 'default',
                fontFamily: 'inherit',
                fontWeight: 500,
              }}
            >
              {hiddenCount} earlier message{hiddenCount !== 1 ? 's' : ''} not shown
            </button>
          )}

          {visibleMessages.map((msg, i) => (
            <div key={messages.length - visibleMessages.length + i}>
              {msg.role === 'user' ? (
                <p
                  data-testid="chat-user-msg"
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: 'var(--muted, #64748b)',
                    marginBottom: '0.25rem',
                  }}
                >
                  {msg.content}
                </p>
              ) : (
                <div
                  data-testid="chat-assistant-msg"
                  style={{
                    background: msg.isError
                      ? 'var(--accent-negative-subtle, rgba(220,38,38,0.07))'
                      : 'var(--surface, #ffffff)',
                    border: msg.isError
                      ? '1px solid rgba(220,38,38,0.15)'
                      : '1px solid var(--border, rgba(15,23,42,0.07))',
                    borderRadius: '0.875rem',
                    padding: '0.75rem 1rem',
                    color: msg.isError ? 'var(--accent-negative, #dc2626)' : 'var(--text, #0f172a)',
                    boxShadow: 'var(--shadow-card)',
                  }}
                >
                  {msg.isError ? (
                    <span style={{ fontSize: '0.82rem' }}>{msg.content}</span>
                  ) : (
                    renderMarkdown(msg.content)
                  )}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div
              data-testid="chat-loading"
              aria-label="Loading response"
              style={{
                background: 'var(--surface, #ffffff)',
                border: '1px solid var(--border, rgba(15,23,42,0.07))',
                borderRadius: '0.875rem',
                padding: '0.75rem 1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: 'var(--shadow-card)',
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
      )}

      <style>{`
        @keyframes chat-dot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
          30% { transform: translateY(-4px); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
