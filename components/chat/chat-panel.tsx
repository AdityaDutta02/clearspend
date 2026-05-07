'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export interface ChatPanelProps {
  token: string
}

type ChatState = 'idle' | 'loading' | 'answered' | 'error'

interface ChatApiSuccess {
  answer: string
}

interface ChatApiError {
  error: string
}

type ChatApiResponse = ChatApiSuccess | ChatApiError

export function ChatPanel({ token }: ChatPanelProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [chatState, setChatState] = useState<ChatState>('idle')
  const [responseText, setResponseText] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const handleClose = useCallback((): void => {
    setIsOpen(false)
  }, [])

  const handleOpen = useCallback((): void => {
    setIsOpen(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isOpen, handleClose])

  const handleSend = useCallback(async (): Promise<void> => {
    const trimmed = question.trim()
    if (!trimmed) return

    abortRef.current?.abort()
    abortRef.current = new AbortController()
    const { signal } = abortRef.current

    setChatState('loading')
    setResponseText('')

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

      // Read response body safely — proxy errors may return non-JSON (e.g. 502 HTML)
      let body: { answer?: string; error?: string } | null = null
      try {
        body = (await res.json()) as { answer?: string; error?: string }
      } catch {
        // non-JSON body; leave body as null
      }

      if (!res.ok) {
        const errMsg = body?.error ?? 'An unexpected error occurred.'
        if (errMsg.includes('INSUFFICIENT_CREDITS') || errMsg === 'INSUFFICIENT_CREDITS') {
          setChatState('error')
          setResponseText('You need at least 1 credit to send a message.')
        } else {
          setChatState('error')
          setResponseText(errMsg)
        }
        return
      }

      setChatState('answered')
      setResponseText(body?.answer ?? '')
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      setResponseText('An unexpected error occurred. Please try again.')
      setChatState('error')
    }
  }, [question, token])

  return (
    <>
      {isOpen && (
        <div
          data-testid="chat-panel"
          style={{
            position: 'fixed',
            bottom: '88px',
            right: '24px',
            zIndex: 40,
            width: 'min(400px, 90vw)',
            background: 'var(--bg, #ffffff)',
            border: '1px solid var(--border, #e2e8f0)',
            borderRadius: '1.25rem',
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2
              style={{
                fontSize: '0.9rem',
                fontWeight: 700,
                color: 'var(--text, #1e293b)',
                letterSpacing: '-0.02em',
                margin: 0,
              }}
            >
              Ask anything about your finances
            </h2>
            <button
              type="button"
              onClick={handleClose}
              aria-label="Close chat panel"
              data-testid="chat-close-btn"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted, #64748b)',
                fontSize: '1.25rem',
                lineHeight: 1,
                fontWeight: 700,
                padding: '2px 6px',
              }}
            >
              ×
            </button>
          </div>

          <textarea
            data-testid="chat-input"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g. How much did I spend on food last month?"
            rows={3}
            style={{
              width: '100%',
              resize: 'none',
              borderRadius: '0.75rem',
              border: '1px solid var(--border, #e2e8f0)',
              padding: '0.625rem 0.75rem',
              fontSize: '0.82rem',
              fontFamily: 'inherit',
              color: 'var(--text, #1e293b)',
              background: 'var(--bg, #ffffff)',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />

          <button
            type="button"
            onClick={handleSend}
            data-testid="chat-send-btn"
            disabled={chatState === 'loading'}
            style={{
              alignSelf: 'flex-end',
              padding: '7px 18px',
              borderRadius: '999px',
              background: 'var(--primary, #2563eb)',
              color: '#ffffff',
              border: 'none',
              cursor: chatState === 'loading' ? 'not-allowed' : 'pointer',
              fontSize: '0.8rem',
              fontWeight: 700,
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              opacity: chatState === 'loading' ? 0.7 : 1,
            }}
          >
            Send
          </button>

          {chatState === 'loading' && (
            <div
              data-testid="chat-loading"
              aria-label="Loading response"
              style={{
                borderRadius: '0.75rem',
                overflow: 'hidden',
                height: '56px',
                background: 'var(--border, #e2e8f0)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          )}

          {(chatState === 'answered' || chatState === 'error') && (
            <div
              data-testid="chat-response"
              style={{
                fontSize: '0.82rem',
                color: chatState === 'error' ? 'var(--accent-negative, #be123c)' : 'var(--text, #1e293b)',
                background:
                  chatState === 'error'
                    ? 'var(--accent-negative-subtle, #fff1f2)'
                    : 'var(--primary-subtle, #eff6ff)',
                borderRadius: '0.75rem',
                padding: '0.625rem 0.75rem',
                whiteSpace: 'pre-wrap',
                lineHeight: 1.55,
              }}
            >
              {responseText}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleOpen}
        data-testid="chat-toggle-btn"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '10px 18px',
          borderRadius: '999px',
          background: 'var(--primary, #2563eb)',
          color: '#ffffff',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.82rem',
          fontWeight: 700,
          fontFamily: 'inherit',
          letterSpacing: '-0.01em',
          boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
        }}
        aria-label="Open chat assistant"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        Ask ClearSpend
      </button>
    </>
  )
}
