'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export interface ChatPanelProps {
  token: string
}

interface Message {
  role: 'user' | 'assistant'
  content: string
  isError?: boolean
}

export function ChatPanel({ token }: ChatPanelProps): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading])

  const handleSend = useCallback(async (): Promise<void> => {
    const trimmed = question.trim()
    if (!trimmed || isLoading) return

    setMessages((prev) => [...prev, { role: 'user', content: trimmed }])
    setQuestion('')
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

      let body: { answer?: string; error?: string } | null = null
      try {
        body = (await res.json()) as { answer?: string; error?: string }
      } catch {
        // non-JSON body
      }

      if (!res.ok) {
        const errMsg = body?.error ?? 'An unexpected error occurred.'
        const displayMsg =
          errMsg.includes('INSUFFICIENT_CREDITS') || errMsg === 'INSUFFICIENT_CREDITS'
            ? 'You need at least 1 credit to send a message.'
            : errMsg
        setMessages((prev) => [...prev, { role: 'assistant', content: displayMsg, isError: true }])
      } else {
        setMessages((prev) => [...prev, { role: 'assistant', content: body?.answer ?? '' }])
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'An unexpected error occurred. Please try again.', isError: true },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [question, token, isLoading])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        void handleSend()
      }
    },
    [handleSend],
  )

  const isEmpty = messages.length === 0 && !isLoading

  return (
    <div
      data-testid="chat-panel"
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--surface, #f8fafc)',
        border: '1px solid var(--border, #e2e8f0)',
        borderRadius: '1.5rem',
        overflow: 'hidden',
        height: '420px',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '1rem 1.25rem 0.875rem',
          borderBottom: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'var(--primary, #2563eb)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ffffff"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <div>
          <p
            style={{
              fontSize: '0.875rem',
              fontWeight: 700,
              color: 'var(--text, #1e293b)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2,
            }}
          >
            Ask ClearSpend
          </p>
          <p style={{ fontSize: '0.7rem', color: 'var(--muted, #64748b)', marginTop: 1 }}>
            Your personal financial advisor
          </p>
        </div>
      </div>

      {/* Message area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1rem 1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
        }}
      >
        {isEmpty && (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              opacity: 0.5,
            }}
          >
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--muted, #64748b)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted, #64748b)', textAlign: 'center' }}>
              Ask anything about your spending, budgets, or trends
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}
          >
            <div
              data-testid={msg.role === 'user' ? 'chat-user-msg' : 'chat-assistant-msg'}
              style={{
                maxWidth: '82%',
                padding: '0.6rem 0.875rem',
                borderRadius: msg.role === 'user' ? '1rem 1rem 0.25rem 1rem' : '1rem 1rem 1rem 0.25rem',
                fontSize: '0.82rem',
                lineHeight: 1.55,
                whiteSpace: 'pre-wrap',
                ...(msg.role === 'user'
                  ? {
                      background: 'var(--primary, #2563eb)',
                      color: '#ffffff',
                    }
                  : msg.isError
                  ? {
                      background: 'var(--accent-negative-subtle, #fff1f2)',
                      color: 'var(--accent-negative, #be123c)',
                      border: '1px solid rgba(190, 18, 60, 0.15)',
                    }
                  : {
                      background: 'var(--bg, #ffffff)',
                      color: 'var(--text, #1e293b)',
                      border: '1px solid var(--border, #e2e8f0)',
                    }),
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              data-testid="chat-loading"
              aria-label="Loading response"
              style={{
                padding: '0.6rem 0.875rem',
                borderRadius: '1rem 1rem 1rem 0.25rem',
                background: 'var(--bg, #ffffff)',
                border: '1px solid var(--border, #e2e8f0)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
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
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input area */}
      <div
        style={{
          padding: '0.75rem 1rem',
          borderTop: '1px solid var(--border, #e2e8f0)',
          display: 'flex',
          gap: '0.5rem',
          alignItems: 'flex-end',
          flexShrink: 0,
          background: 'var(--bg, #ffffff)',
        }}
      >
        <textarea
          ref={textareaRef}
          data-testid="chat-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask anything… (Enter to send, Shift+Enter for newline)"
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            borderRadius: '0.875rem',
            border: '1px solid var(--border, #e2e8f0)',
            padding: '0.5rem 0.75rem',
            fontSize: '0.82rem',
            fontFamily: 'inherit',
            color: 'var(--text, #1e293b)',
            background: 'var(--surface, #f8fafc)',
            outline: 'none',
            lineHeight: 1.5,
            maxHeight: '120px',
            overflowY: 'auto',
          }}
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          data-testid="chat-send-btn"
          disabled={isLoading || !question.trim()}
          aria-label="Send message"
          style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: isLoading || !question.trim() ? 'var(--border, #e2e8f0)' : 'var(--primary, #2563eb)',
            color: isLoading || !question.trim() ? 'var(--muted, #94a3b8)' : '#ffffff',
            border: 'none',
            cursor: isLoading || !question.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s ease, color 0.15s ease',
          }}
        >
          <svg
            width="14"
            height="14"
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
