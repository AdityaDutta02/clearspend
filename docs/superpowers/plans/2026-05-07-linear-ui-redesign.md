# Linear-tier UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign ClearSpend to a Linear-tier light-mode aesthetic with a persistent right-rail AI chat panel, behind a `NEXT_PUBLIC_DESIGN_VARIANT` env-var feature flag (`v2` = new, `v1` = legacy).

**Architecture:** Six new/modified files. Existing components (`DashboardShell`, `ChatPanel`, all KPI/chart/table components) are completely untouched. The feature flag is read once in `home-client.tsx` and routes to either the existing `DashboardShell` (v1) or new `DashboardShellV2` (v2). CSS token overrides live under `[data-design="v2"]` in `globals.css`. `renderMarkdown` is extracted to a shared util so both `ChatPanel` (v1) and `ChatRail` (v2) use the same logic.

**Tech Stack:** Next.js 14 App Router, React 18, Framer Motion, Tailwind CSS, Plus Jakarta Sans, Vitest + Testing Library.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/render-markdown.tsx` | **Create** | Shared markdown renderer (extracted from chat-panel) |
| `app/globals.css` | **Modify** | `[data-design="v2"]` token overrides + card flattening |
| `components/chat/chat-panel.tsx` | **Modify** | Import renderMarkdown from shared util instead of defining locally |
| `components/chat/chat-rail.tsx` | **Create** | Right-rail chat (full-height sticky, bubble UI, SSE logic) |
| `components/chat/mobile-ask-sheet.tsx` | **Create** | Floating "Ask" button + bottom-sheet wrapping ChatRail |
| `components/dashboard/dashboard-shell-v2.tsx` | **Create** | Two-column layout: 48px toolbar + content left + rail right |
| `app/home-client.tsx` | **Modify** | Read env var, render DashboardShell (v1) or DashboardShellV2 (v2) |
| `tests/lib/render-markdown.test.tsx` | **Create** | Unit tests for renderMarkdown |
| `tests/components/chat-rail.test.tsx` | **Create** | SSE + error + multi-turn tests for ChatRail |
| `tests/components/mobile-ask-sheet.test.tsx` | **Create** | Open/close bottom sheet tests |
| `tests/components/dashboard-shell-v2.test.tsx` | **Create** | Renders with data-design="v2", renders ChatRail |

---

## Task 1: Extract renderMarkdown to shared util

**Files:**
- Create: `lib/render-markdown.tsx`
- Modify: `components/chat/chat-panel.tsx` (lines 26–110 — remove local functions, add import)
- Test: `tests/lib/render-markdown.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// tests/lib/render-markdown.test.tsx
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { renderMarkdown } from '@/lib/render-markdown'

describe('renderMarkdown', () => {
  it('renders plain text', () => {
    const { container } = render(<>{renderMarkdown('Hello world')}</>)
    expect(container.textContent).toBe('Hello world')
  })

  it('renders **bold** as <strong>', () => {
    const { container } = render(<>{renderMarkdown('You spent **₹5,000**')}</>)
    expect(container.querySelector('strong')).toBeTruthy()
    expect(container.querySelector('strong')?.textContent).toBe('₹5,000')
  })

  it('renders - bullet list', () => {
    const { container } = render(<>{renderMarkdown('- Food\n- Travel')}</>)
    expect(container.querySelector('ul')).toBeTruthy()
    expect(container.querySelectorAll('li')).toHaveLength(2)
  })

  it('renders ### heading', () => {
    const { container } = render(<>{renderMarkdown('### Summary')}</>)
    expect(container.textContent).toContain('Summary')
  })

  it('renders `code` as <code>', () => {
    const { container } = render(<>{renderMarkdown('Use `filter` to narrow')}</>)
    expect(container.querySelector('code')).toBeTruthy()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/lib/render-markdown.test.tsx
```
Expected: FAIL — "Cannot find module '@/lib/render-markdown'"

- [ ] **Step 3: Create `lib/render-markdown.tsx`**

```tsx
import type { ReactNode } from 'react'

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} style={{ fontWeight: 700, color: 'var(--text, #1a1a1a)' }}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} style={{ background: 'rgba(0,0,0,0.06)', borderRadius: '3px', padding: '1px 4px', fontSize: '0.78rem', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export function renderMarkdown(text: string): ReactNode {
  const lines = text.split('\n')
  const nodes: ReactNode[] = []
  let listItems: string[] = []

  function flushList() {
    if (listItems.length === 0) return
    nodes.push(
      <ul key={`ul-${nodes.length}`} style={{ margin: '6px 0', paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {listItems.map((item, i) => (
          <li key={i} style={{ fontSize: '0.82rem', lineHeight: 1.55, color: 'var(--text, #1a1a1a)' }}>
            {renderInline(item)}
          </li>
        ))}
      </ul>
    )
    listItems = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    if (/^[-*]\s+/.test(line)) {
      listItems.push(line.replace(/^[-*]\s+/, ''))
      continue
    }

    flushList()

    if (line.startsWith('### ')) {
      nodes.push(
        <div key={i} style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary, #5e6ad2)', marginTop: '10px', marginBottom: '2px', letterSpacing: '-0.01em' }}>
          {line.slice(4)}
        </div>
      )
      continue
    }

    if (line.startsWith('## ')) {
      nodes.push(
        <div key={i} style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text, #1a1a1a)', marginTop: '10px', marginBottom: '2px', letterSpacing: '-0.015em' }}>
          {line.slice(3)}
        </div>
      )
      continue
    }

    if (line.trim() === '') {
      nodes.push(<div key={i} style={{ height: '4px' }} />)
      continue
    }

    nodes.push(
      <div key={i} style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text, #1a1a1a)' }}>
        {renderInline(line)}
      </div>
    )
  }

  flushList()
  return <>{nodes}</>
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npx vitest run tests/lib/render-markdown.test.tsx
```
Expected: 5 tests PASS

- [ ] **Step 5: Update `components/chat/chat-panel.tsx` to use shared util**

Remove lines 4 (`import type { ReactNode }`) and 26–110 (the local `renderMarkdown` and `renderInline` functions). Add import at top:

```tsx
import { renderMarkdown } from '@/lib/render-markdown'
```

The `renderMarkdown(msg.content)` call at line 513 stays exactly as-is.

- [ ] **Step 6: Run full test suite — confirm no regressions**

```bash
npx vitest run tests/components/chat-panel.test.tsx
```
Expected: all existing tests PASS

- [ ] **Step 7: Commit**

```bash
git add lib/render-markdown.tsx components/chat/chat-panel.tsx tests/lib/render-markdown.test.tsx
git commit -m "refactor(chat): extract renderMarkdown to shared lib/render-markdown"
```

---

## Task 2: Add v2 CSS token overrides

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add token overrides at end of `app/globals.css`**

Append exactly this block to the bottom of `app/globals.css` (after the `prefers-reduced-motion` block):

```css
/* ─── Design v2 (Linear-tier) token overrides ───────── */
[data-design="v2"] {
  --bg:              #F7F7F7;
  --surface:         #FFFFFF;
  --surface-raised:  #F2F2F2;
  --surface-hover:   #EFEFEF;
  --border:          rgba(0, 0, 0, 0.08);
  --border-medium:   rgba(0, 0, 0, 0.13);
  --text:            #1A1A1A;
  --text-secondary:  #3A3A3A;
  --muted:           #8A8A8A;
  --primary:         #5E6AD2;
  --primary-light:   #7B84DC;
  --primary-subtle:  rgba(94, 106, 210, 0.07);
  --primary-border:  rgba(94, 106, 210, 0.2);
  --accent-positive: #059669;
  --accent-negative: #DC2626;
  --accent-negative-subtle: rgba(220, 38, 38, 0.07);
  --shadow-card:     none;
  --shadow-card-hover: none;
  --shadow-elevated: none;
  --shadow-modal:
    0 0 0 1px rgba(0, 0, 0, 0.08),
    0 8px 24px rgba(0, 0, 0, 0.09),
    0 40px 100px rgba(0, 0, 0, 0.12);
}

[data-design="v2"] .card {
  border-radius: 8px;
  box-shadow: none;
  border: 1px solid var(--border);
}
[data-design="v2"] .card::after { display: none; }

[data-design="v2"] .kpi-card {
  border-radius: 8px;
  box-shadow: none;
  border: 1px solid var(--border);
}
[data-design="v2"] .kpi-card::after { display: none; }
[data-design="v2"] .kpi-card:hover { box-shadow: none; transform: none; }

[data-design="v2"] .kpi-card-hero {
  background: none;
  border-left: none;
  border: 1px solid var(--border);
}
[data-design="v2"] .kpi-card-hero:hover { box-shadow: none; transform: none; }

[data-design="v2"] body::before { opacity: 0; }
```

- [ ] **Step 2: Verify no syntax errors**

```bash
node_modules/.bin/next build 2>&1 | grep -E "error|Error|✓"
```
Expected: `✓ Compiled successfully` (no CSS errors)

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(design-v2): add Linear-tier CSS token overrides under [data-design=v2]"
```

---

## Task 3: Build ChatRail component

**Files:**
- Create: `components/chat/chat-rail.tsx`
- Test: `tests/components/chat-rail.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/components/chat-rail.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatRail } from '@/components/chat/chat-rail'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeSseResponse(events: string[]): Partial<Response> {
  const chunks = events.map((e) => new TextEncoder().encode(`data: ${e}\n\n`))
  let index = 0
  const stream = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) controller.enqueue(chunks[index++])
      else controller.close()
    },
  })
  return { ok: true, status: 200, body: stream }
}

function makeOkSse(answer: string): Partial<Response> {
  const words = answer.split(' ')
  const events = [
    ...words.map((w, i) => JSON.stringify({ delta: (i > 0 ? ' ' : '') + w })),
    '[DONE]',
  ]
  return makeSseResponse(events)
}

function makeErrorSse(error: string): Partial<Response> {
  return makeSseResponse([JSON.stringify({ error }), '[DONE]'])
}

describe('ChatRail', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('renders rail with input and send button', () => {
    render(<ChatRail token="test-token" />)
    expect(screen.getByTestId('chat-rail')).toBeInTheDocument()
    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    expect(screen.getByTestId('chat-send-btn')).toBeDisabled()
  })

  it('send button enabled when input has text', () => {
    render(<ChatRail token="test-token" />)
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Hello' } })
    expect(screen.getByTestId('chat-send-btn')).not.toBeDisabled()
  })

  it('shows loading state while fetching', async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined))
    render(<ChatRail token="test-token" />)
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Hi' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))
    await waitFor(() => expect(screen.getByTestId('chat-loading')).toBeInTheDocument())
  })

  it('shows assistant bubble on SSE success', async () => {
    mockFetch.mockResolvedValue(makeOkSse('You spent ₹5,000') as unknown as Response)
    render(<ChatRail token="test-token" />)
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'How much?' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))
    await waitFor(() =>
      expect(screen.getByTestId('chat-assistant-msg')).toHaveTextContent('You spent ₹5,000')
    )
  })

  it('shows INSUFFICIENT_CREDITS message via SSE error', async () => {
    mockFetch.mockResolvedValue(makeErrorSse('INSUFFICIENT_CREDITS') as unknown as Response)
    render(<ChatRail token="test-token" />)
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Hi' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))
    await waitFor(() =>
      expect(screen.getByTestId('chat-assistant-msg')).toHaveTextContent(
        'You need at least 1 credit to send a message.'
      )
    )
  })

  it('shows generic SSE error', async () => {
    mockFetch.mockResolvedValue(makeErrorSse('Server down') as unknown as Response)
    render(<ChatRail token="test-token" />)
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'Hi' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))
    await waitFor(() =>
      expect(screen.getByTestId('chat-assistant-msg')).toHaveTextContent('Server down')
    )
  })

  it('shows user message bubble', async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined))
    render(<ChatRail token="test-token" />)
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'My question' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))
    await waitFor(() =>
      expect(screen.getByTestId('chat-user-msg')).toHaveTextContent('My question')
    )
  })

  it('clears input after send', async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined))
    render(<ChatRail token="test-token" />)
    const input = screen.getByTestId('chat-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Hello' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))
    await waitFor(() => expect(input.value).toBe(''))
  })

  it('Enter key sends the message', async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined))
    render(<ChatRail token="test-token" />)
    fireEvent.change(screen.getByTestId('chat-input'), { target: { value: 'test' } })
    fireEvent.keyDown(screen.getByTestId('chat-input'), { key: 'Enter', shiftKey: false })
    await waitFor(() =>
      expect(screen.getByTestId('chat-user-msg')).toHaveTextContent('test')
    )
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/components/chat-rail.test.tsx
```
Expected: FAIL — "Cannot find module '@/components/chat/chat-rail'"

- [ ] **Step 3: Create `components/chat/chat-rail.tsx`**

```tsx
'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { renderMarkdown } from '@/lib/render-markdown'

export interface ChatRailProps {
  token: string
  className?: string
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

export function ChatRail({ token, className }: ChatRailProps): JSX.Element {
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
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
            const json = await res.json() as { error?: string }
            errMsg = json.error ?? errMsg
          } catch { /* non-JSON */ }
          const displayMsg =
            errMsg === 'INSUFFICIENT_CREDITS' || errMsg.includes('INSUFFICIENT_CREDITS')
              ? 'You need at least 1 credit to send a message.'
              : errMsg
          setMessages((prev) => [...prev, { role: 'assistant', content: displayMsg, isError: true }])
          return
        }

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
                  parsed.error === 'INSUFFICIENT_CREDITS' || parsed.error.includes('INSUFFICIENT_CREDITS')
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
            } catch { /* ignore malformed */ }
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
    },
    [question, submit],
  )

  const isEmpty = messages.length === 0 && !isLoading

  return (
    <div
      data-testid="chat-rail"
      className={className}
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--surface, #fff)',
      }}
    >
      {/* Rail header */}
      <div style={{
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        borderBottom: '1px solid var(--border, rgba(0,0,0,0.08))',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text, #1a1a1a)', letterSpacing: '-0.01em' }}>
          Ask ClearSpend
        </span>
        <span style={{
          fontSize: '0.6rem',
          fontWeight: 600,
          color: 'var(--primary, #5e6ad2)',
          background: 'var(--primary-subtle, rgba(94,106,210,0.07))',
          padding: '2px 7px',
          borderRadius: '999px',
          letterSpacing: '0.02em',
        }}>
          AI
        </span>
      </div>

      {/* Conversation area */}
      <div
        ref={scrollRef}
        style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}
      >
        {isEmpty && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: '8px' }}>
            <p style={{ fontSize: '0.72rem', color: 'var(--muted, #8a8a8a)', fontWeight: 500, marginBottom: '4px' }}>
              Suggested
            </p>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => void submit(s)}
                style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border, rgba(0,0,0,0.08))',
                  background: 'var(--surface-raised, #f2f2f2)',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary, #3a3a3a)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--surface-hover, #efefef)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--surface-raised, #f2f2f2)' }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
          >
            {msg.role === 'user' ? (
              <div
                data-testid="chat-user-msg"
                style={{
                  background: 'var(--primary, #5e6ad2)',
                  color: '#ffffff',
                  borderRadius: '12px 12px 2px 12px',
                  padding: '8px 12px',
                  maxWidth: '85%',
                  fontSize: '0.82rem',
                  lineHeight: 1.5,
                  fontWeight: 500,
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
                  color: msg.isError ? 'var(--accent-negative, #dc2626)' : 'var(--text, #1a1a1a)',
                }}
              >
                {msg.isError
                  ? <span style={{ fontSize: '0.82rem' }}>{msg.content}</span>
                  : renderMarkdown(msg.content)
                }
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div
              data-testid="chat-loading"
              aria-label="Loading response"
              style={{
                background: 'var(--surface-raised, #f2f2f2)',
                border: '1px solid var(--border, rgba(0,0,0,0.08))',
                borderRadius: '12px 12px 12px 2px',
                padding: '10px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              {[0, 1, 2].map((n) => (
                <span
                  key={n}
                  style={{
                    width: 6, height: 6, borderRadius: '50%',
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

      {/* Input area */}
      <div style={{
        borderTop: '1px solid var(--border, rgba(0,0,0,0.08))',
        padding: '12px',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        background: 'var(--surface, #fff)',
      }}>
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
            border: '1px solid var(--border-medium, rgba(0,0,0,0.13))',
            borderRadius: '8px',
            padding: '8px 12px',
            fontSize: '0.82rem',
            fontFamily: 'inherit',
            color: 'var(--text, #1a1a1a)',
            background: 'var(--surface-raised, #f2f2f2)',
            outline: 'none',
            transition: 'border-color 0.12s ease',
          }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--primary, #5e6ad2)' }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'var(--border-medium, rgba(0,0,0,0.13))' }}
        />
        <button
          type="button"
          onClick={() => void submit(question)}
          data-testid="chat-send-btn"
          disabled={isLoading || !question.trim()}
          aria-label="Send question"
          style={{
            width: 32, height: 32,
            borderRadius: '8px',
            background: isLoading || !question.trim() ? 'var(--surface-raised, #f2f2f2)' : 'var(--primary, #5e6ad2)',
            color: isLoading || !question.trim() ? 'var(--muted, #8a8a8a)' : '#ffffff',
            border: '1px solid var(--border, rgba(0,0,0,0.08))',
            cursor: isLoading || !question.trim() ? 'default' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.12s ease',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npx vitest run tests/components/chat-rail.test.tsx
```
Expected: 8 tests PASS

- [ ] **Step 5: Commit**

```bash
git add components/chat/chat-rail.tsx tests/components/chat-rail.test.tsx
git commit -m "feat(chat-rail): add right-rail chat component with SSE streaming"
```

---

## Task 4: Build MobileAskSheet component

**Files:**
- Create: `components/chat/mobile-ask-sheet.tsx`
- Test: `tests/components/mobile-ask-sheet.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/components/mobile-ask-sheet.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileAskSheet } from '@/components/chat/mobile-ask-sheet'

vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)))

describe('MobileAskSheet', () => {
  it('renders floating Ask button', () => {
    render(<MobileAskSheet token="test-token" />)
    expect(screen.getByTestId('mobile-ask-btn')).toBeInTheDocument()
  })

  it('sheet is hidden initially', () => {
    render(<MobileAskSheet token="test-token" />)
    expect(screen.queryByTestId('mobile-ask-sheet')).not.toBeInTheDocument()
  })

  it('clicking Ask button opens sheet', () => {
    render(<MobileAskSheet token="test-token" />)
    fireEvent.click(screen.getByTestId('mobile-ask-btn'))
    expect(screen.getByTestId('mobile-ask-sheet')).toBeInTheDocument()
  })

  it('clicking close button closes sheet', () => {
    render(<MobileAskSheet token="test-token" />)
    fireEvent.click(screen.getByTestId('mobile-ask-btn'))
    expect(screen.getByTestId('mobile-ask-sheet')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('mobile-sheet-close'))
    expect(screen.queryByTestId('mobile-ask-sheet')).not.toBeInTheDocument()
  })

  it('clicking backdrop closes sheet', () => {
    render(<MobileAskSheet token="test-token" />)
    fireEvent.click(screen.getByTestId('mobile-ask-btn'))
    fireEvent.click(screen.getByTestId('mobile-sheet-backdrop'))
    expect(screen.queryByTestId('mobile-ask-sheet')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/components/mobile-ask-sheet.test.tsx
```
Expected: FAIL — "Cannot find module '@/components/chat/mobile-ask-sheet'"

- [ ] **Step 3: Create `components/chat/mobile-ask-sheet.tsx`**

```tsx
'use client'

import { useState } from 'react'
import { ChatRail } from '@/components/chat/chat-rail'

export interface MobileAskSheetProps {
  token: string
}

export function MobileAskSheet({ token }: MobileAskSheetProps): JSX.Element {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        data-testid="mobile-ask-btn"
        onClick={() => setOpen(true)}
        aria-label="Ask ClearSpend AI"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '0 16px',
          height: '44px',
          borderRadius: '999px',
          background: 'var(--primary, #5e6ad2)',
          color: '#ffffff',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontWeight: 700,
          fontFamily: 'inherit',
          letterSpacing: '-0.01em',
          boxShadow: '0 4px 16px rgba(94,106,210,0.35)',
          transition: 'opacity 0.15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
      >
        ✦ Ask
      </button>

      {/* Backdrop */}
      {open && (
        <div
          data-testid="mobile-sheet-backdrop"
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.3)',
            zIndex: 49,
          }}
        />
      )}

      {/* Bottom sheet */}
      {open && (
        <div
          data-testid="mobile-ask-sheet"
          style={{
            position: 'fixed',
            insetInline: 0,
            bottom: 0,
            height: '70dvh',
            zIndex: 50,
            borderRadius: '16px 16px 0 0',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-modal)',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Close button */}
          <button
            type="button"
            data-testid="mobile-sheet-close"
            onClick={() => setOpen(false)}
            aria-label="Close AI chat"
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              zIndex: 51,
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--surface-raised, #f2f2f2)',
              border: '1px solid var(--border, rgba(0,0,0,0.08))',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--muted, #8a8a8a)',
              fontSize: '0.9rem',
              fontWeight: 700,
              fontFamily: 'inherit',
            }}
          >
            ×
          </button>

          <ChatRail token={token} style={{ height: '100%' }} />
        </div>
      )}
    </>
  )
}
```

Note: `ChatRail` accepts `className` but not `style` — update its prop type to also accept `style` OR just pass `className` and add a CSS class. Simplest fix: add `style?: React.CSSProperties` to `ChatRailProps` in `chat-rail.tsx` and spread it on the outer div. Add this to `chat-rail.tsx`:

```tsx
// In ChatRailProps interface, add:
style?: React.CSSProperties

// On the outer div, change to:
<div
  data-testid="chat-rail"
  className={className}
  style={{
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: 'var(--surface, #fff)',
    ...style,
  }}
>
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npx vitest run tests/components/mobile-ask-sheet.test.tsx
```
Expected: 5 tests PASS

- [ ] **Step 5: Run chat-rail tests to confirm no regressions**

```bash
npx vitest run tests/components/chat-rail.test.tsx
```
Expected: 8 tests PASS

- [ ] **Step 6: Commit**

```bash
git add components/chat/mobile-ask-sheet.tsx components/chat/chat-rail.tsx tests/components/mobile-ask-sheet.test.tsx
git commit -m "feat(chat): add MobileAskSheet floating button and bottom sheet"
```

---

## Task 5: Build DashboardShellV2

**Files:**
- Create: `components/dashboard/dashboard-shell-v2.tsx`
- Test: `tests/components/dashboard-shell-v2.test.tsx`

- [ ] **Step 1: Write the failing tests**

```tsx
// tests/components/dashboard-shell-v2.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DashboardShellV2 } from '@/components/dashboard/dashboard-shell-v2'
import type { DashboardData } from '@/types'
import type { FilterState } from '@/lib/dashboard-data'

vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)))

const emptyData: DashboardData = {
  analyses: [],
  transactions: [],
  statements: [],
}

const emptyFilter: FilterState = { month: null, bank: null, statement_id: null, category: null }

describe('DashboardShellV2', () => {
  it('renders with data-design="v2" on main', () => {
    render(
      <DashboardShellV2
        data={emptyData}
        filter={emptyFilter}
        onFilterChange={vi.fn()}
        onUploadClick={vi.fn()}
        isLoading={false}
        token="test-token"
        refresh={vi.fn()}
      />
    )
    expect(screen.getByTestId('dashboard-shell-v2')).toHaveAttribute('data-design', 'v2')
  })

  it('renders toolbar with ClearSpend label', () => {
    render(
      <DashboardShellV2
        data={emptyData}
        filter={emptyFilter}
        onFilterChange={vi.fn()}
        onUploadClick={vi.fn()}
        isLoading={false}
        token="test-token"
        refresh={vi.fn()}
      />
    )
    expect(screen.getByTestId('toolbar')).toBeInTheDocument()
    expect(screen.getByTestId('toolbar')).toHaveTextContent('ClearSpend')
  })

  it('renders Add Statement button in toolbar', () => {
    render(
      <DashboardShellV2
        data={emptyData}
        filter={emptyFilter}
        onFilterChange={vi.fn()}
        onUploadClick={vi.fn()}
        isLoading={false}
        token="test-token"
        refresh={vi.fn()}
      />
    )
    expect(screen.getByTestId('add-statement-btn')).toBeInTheDocument()
  })

  it('renders chat-rail in right column', () => {
    render(
      <DashboardShellV2
        data={emptyData}
        filter={emptyFilter}
        onFilterChange={vi.fn()}
        onUploadClick={vi.fn()}
        isLoading={false}
        token="test-token"
        refresh={vi.fn()}
      />
    )
    expect(screen.getByTestId('chat-rail')).toBeInTheDocument()
  })

  it('calls onUploadClick when Add Statement is clicked', () => {
    const onUploadClick = vi.fn()
    render(
      <DashboardShellV2
        data={emptyData}
        filter={emptyFilter}
        onFilterChange={vi.fn()}
        onUploadClick={onUploadClick}
        isLoading={false}
        token="test-token"
        refresh={vi.fn()}
      />
    )
    screen.getByTestId('add-statement-btn').click()
    expect(onUploadClick).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run tests/components/dashboard-shell-v2.test.tsx
```
Expected: FAIL — "Cannot find module '@/components/dashboard/dashboard-shell-v2'"

- [ ] **Step 3: Create `components/dashboard/dashboard-shell-v2.tsx`**

```tsx
'use client'

import { useMemo, useState } from 'react'
import type { DashboardData, CategorySlug } from '@/types'
import type { FilterState } from '@/lib/dashboard-data'
import {
  filterAnalyses,
  computeKpis,
  getSpendTrendData,
  getAvailableMonths,
  getAvailableBanks,
  getAvailableCards,
  getFilteredTransactions,
} from '@/lib/dashboard-data'
import { FilterBar } from '@/components/dashboard/filter-bar'
import { KpiCards } from '@/components/dashboard/kpi-cards'
import { SpendTrendChart } from '@/components/dashboard/spend-trend-chart'
import { CategoryChart } from '@/components/dashboard/category-chart'
import { TransactionsTable } from '@/components/dashboard/transactions-table'
import { InsightsStrip } from '@/components/dashboard/insights-strip'
import { StatementsModal } from '@/components/dashboard/statements-modal'
import { ChatRail } from '@/components/chat/chat-rail'
import { MobileAskSheet } from '@/components/chat/mobile-ask-sheet'

export interface DashboardShellV2Props {
  data: DashboardData
  filter: FilterState
  onFilterChange: (filter: FilterState) => void
  onUploadClick: () => void
  isLoading: boolean
  token: string
  refresh: () => void
}

export function DashboardShellV2({
  data,
  filter,
  onFilterChange,
  onUploadClick,
  isLoading,
  token,
  refresh,
}: DashboardShellV2Props): JSX.Element {
  const [showManageStatements, setShowManageStatements] = useState(false)
  const filteredAnalyses = useMemo(() => filterAnalyses(data, filter), [data, filter])
  const kpiMetrics = useMemo(() => computeKpis(data.analyses, filter), [data.analyses, filter])
  const availableMonths = useMemo(() => getAvailableMonths(data), [data])
  const availableBanks = useMemo(() => getAvailableBanks(data), [data])
  const availableCards = useMemo(() => getAvailableCards(data), [data])
  const trendData = useMemo(() => getSpendTrendData(filteredAnalyses), [filteredAnalyses])
  const filteredTransactions = useMemo(() => getFilteredTransactions(data, filter), [data, filter])
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const availableCategories = useMemo(
    () =>
      Array.from(
        new Set(
          getFilteredTransactions(data, { ...filter, category: null })
            .filter((t) => t.type === 'debit')
            .map((t) => t.category),
        ),
      ).sort() as CategorySlug[],
    [data, filter.month, filter.bank, filter.statement_id],
  )

  return (
    <div
      data-testid="dashboard-shell-v2"
      data-design="v2"
      style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg, #f7f7f7)' }}
    >
      {/* ── 48px Toolbar ── */}
      <header
        data-testid="toolbar"
        style={{
          height: '48px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          padding: '0 20px',
          borderBottom: '1px solid var(--border, rgba(0,0,0,0.08))',
          background: 'var(--surface, #fff)',
          position: 'sticky',
          top: 0,
          zIndex: 30,
          flexShrink: 0,
        }}
      >
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--primary, #5e6ad2)' }} />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text, #1a1a1a)', letterSpacing: '-0.02em' }}>
            ClearSpend
          </span>
        </div>

        {/* Filter pills — center, scrollable */}
        <div style={{ flex: 1, overflowX: 'auto', display: 'flex', alignItems: 'center' }} className="filter-bar-scroll">
          <FilterBar
            availableMonths={availableMonths}
            availableBanks={availableBanks}
            availableCards={availableCards}
            filter={filter}
            onChange={onFilterChange}
          />
        </div>

        {/* Actions — right */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <button
            type="button"
            onClick={onUploadClick}
            data-testid="add-statement-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '5px 12px',
              borderRadius: '6px',
              background: 'var(--primary, #5e6ad2)',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 700,
              fontFamily: 'inherit',
              letterSpacing: '-0.01em',
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            Add
          </button>
          <button
            type="button"
            onClick={() => setShowManageStatements(true)}
            data-testid="manage-statements-btn"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '0.75rem',
              fontWeight: 500,
              fontFamily: 'inherit',
              color: 'var(--muted, #8a8a8a)',
              padding: '2px 4px',
              transition: 'color 0.12s ease',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text, #1a1a1a)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--muted, #8a8a8a)' }}
          >
            ···
          </button>
        </div>
      </header>

      {showManageStatements && (
        <StatementsModal
          data={data}
          token={token}
          onClose={() => setShowManageStatements(false)}
          onDeleted={refresh}
        />
      )}

      {/* ── Two-column body ── */}
      <div
        style={{
          flex: 1,
          display: 'grid',
          gridTemplateColumns: '1fr',
        }}
        className="dashboard-v2-body"
      >
        {/* Content column */}
        <main
          style={{
            overflowY: 'auto',
            padding: '24px 24px 40px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            minWidth: 0,
          }}
        >
          <KpiCards metrics={kpiMetrics} isLoading={isLoading} />

          <div className="bento-main">
            <SpendTrendChart data={trendData} isLoading={isLoading} />
            <CategoryChart analyses={filteredAnalyses} isLoading={isLoading} />
          </div>

          <TransactionsTable
            transactions={filteredTransactions}
            isLoading={isLoading}
            filter={filter}
            availableCategories={availableCategories}
            selectedCategory={filter.category}
            onCategoryChange={(cat) => onFilterChange({ ...filter, category: cat })}
          />

          <InsightsStrip analyses={filteredAnalyses} isLoading={isLoading} />
        </main>

        {/* AI Rail — desktop only (hidden on mobile via CSS) */}
        <aside
          className="dashboard-v2-rail"
          style={{
            borderLeft: '1px solid var(--border, rgba(0,0,0,0.08))',
            position: 'sticky',
            top: '48px',
            height: 'calc(100dvh - 48px)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <ChatRail token={token} style={{ height: '100%' }} />
        </aside>
      </div>

      {/* Mobile floating Ask button */}
      <div className="dashboard-v2-mobile-ask">
        <MobileAskSheet token={token} />
      </div>

      <style>{`
        @media (min-width: 1024px) {
          .dashboard-v2-body {
            grid-template-columns: 65fr 35fr;
          }
          .dashboard-v2-mobile-ask {
            display: none;
          }
        }
        @media (max-width: 1023px) {
          .dashboard-v2-rail {
            display: none;
          }
        }
      `}</style>
    </div>
  )
}
```

- [ ] **Step 4: Run tests — confirm pass**

```bash
npx vitest run tests/components/dashboard-shell-v2.test.tsx
```
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/dashboard-shell-v2.tsx tests/components/dashboard-shell-v2.test.tsx
git commit -m "feat(dashboard-v2): add DashboardShellV2 with two-column layout and sticky AI rail"
```

---

## Task 6: Wire feature flag in home-client.tsx

**Files:**
- Modify: `app/home-client.tsx` (lines 9–10 imports, line 249 render)
- Test: `tests/app/page.test.tsx` (verify both variants render the right shell)

- [ ] **Step 1: Read current home-client.tsx imports and render section**

The file currently imports `DashboardShell` (line 9) and renders it at line 250. We add `DashboardShellV2` import and a conditional render.

- [ ] **Step 2: Add import and conditional render**

At the top of `app/home-client.tsx`, after the existing `DashboardShell` import, add:

```tsx
import { DashboardShellV2 } from '@/components/dashboard/dashboard-shell-v2'

const DESIGN_VARIANT = process.env.NEXT_PUBLIC_DESIGN_VARIANT === 'v1' ? 'v1' : 'v2'
```

Replace the render section (currently line ~249–258):

```tsx
// Data loaded — render the full dashboard
return (
  <div data-testid="main-page">
    {DESIGN_VARIANT === 'v2' ? (
      <DashboardShellV2
        data={data}
        filter={filter}
        onFilterChange={handleFilterChange}
        onUploadClick={handleUploadClick}
        isLoading={dataLoading}
        token={token}
        refresh={refresh}
      />
    ) : (
      <DashboardShell
        data={data}
        filter={filter}
        onFilterChange={handleFilterChange}
        onUploadClick={handleUploadClick}
        isLoading={dataLoading}
        token={token}
        refresh={refresh}
      />
    )}

    {analyseError !== null && (
      /* ... existing analyseError block unchanged ... */
    )}

    {showUploadModal && (
      /* ... existing showUploadModal block unchanged ... */
    )}

    <ConfirmModal
      /* ... unchanged ... */
    />
  </div>
)
```

Full replacement for the return block at the bottom of `home-client.tsx` (from `// Data loaded` to end of file):

```tsx
  // Data loaded — render the full dashboard
  return (
    <div data-testid="main-page">
      {DESIGN_VARIANT === 'v2' ? (
        <DashboardShellV2
          data={data}
          filter={filter}
          onFilterChange={handleFilterChange}
          onUploadClick={handleUploadClick}
          isLoading={dataLoading}
          token={token}
          refresh={refresh}
        />
      ) : (
        <DashboardShell
          data={data}
          filter={filter}
          onFilterChange={handleFilterChange}
          onUploadClick={handleUploadClick}
          isLoading={dataLoading}
          token={token}
          refresh={refresh}
        />
      )}

      {analyseError !== null && (
        <div
          className="max-w-5xl mx-auto px-4 mt-3 flex items-start justify-between gap-2 p-3 rounded-xl text-sm"
          style={{
            background: 'var(--accent-negative-subtle)',
            border: '1px solid rgba(190, 18, 60, 0.2)',
            color: 'var(--accent-negative)',
          }}
          role="alert"
          data-testid="analyse-error-alert"
        >
          <span style={{ fontWeight: 500, fontSize: '0.82rem' }}>{analyseError}</span>
          <button
            type="button"
            onClick={handleDismissAnalyseError}
            aria-label="Dismiss error"
            className="shrink-0 font-bold"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-negative)', fontSize: '1rem', lineHeight: 1 }}
            data-testid="dismiss-analyse-error"
          >
            ×
          </button>
        </div>
      )}

      {showUploadModal && (
        <div
          data-testid="upload-modal"
          role="dialog"
          aria-modal={true}
          aria-label="Upload statement"
          onClick={handleCloseUploadModal}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            onClick={(e) => { e.stopPropagation() }}
            style={{
              background: 'var(--bg)',
              borderRadius: '1.5rem',
              padding: '2rem',
              width: 'min(480px, 90vw)',
              position: 'relative',
            }}
          >
            <button
              type="button"
              onClick={handleCloseUploadModal}
              aria-label="Close upload modal"
              data-testid="close-upload-modal"
              style={{
                position: 'absolute',
                top: '1rem',
                right: '1rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--muted)',
                fontSize: '1.25rem',
                lineHeight: 1,
                fontWeight: 700,
              }}
            >
              ×
            </button>

            <UploadZone
              onParsed={handleParsed}
              onError={handleUploadError}
              disabled={isUploadDisabled}
            />

            {uploadError !== null && (
              <div
                className="mt-3 flex items-start justify-between gap-2 p-3 rounded-xl text-sm"
                style={{
                  background: 'var(--accent-negative-subtle)',
                  border: '1px solid rgba(190, 18, 60, 0.2)',
                  color: 'var(--accent-negative)',
                }}
                role="alert"
                data-testid="upload-error-alert"
              >
                <span style={{ fontWeight: 500, fontSize: '0.82rem' }}>{uploadError}</span>
                <button
                  type="button"
                  onClick={handleDismissUploadError}
                  aria-label="Dismiss error"
                  className="shrink-0 font-bold"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent-negative)', fontSize: '1rem', lineHeight: 1 }}
                  data-testid="dismiss-upload-error"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={pageState === 'confirming' || pageState === 'analysing'}
        detection={pendingUpload?.detection ?? null}
        fileName={pendingUpload?.file.name ?? ''}
        creditCost={20}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        isAnalysing={pageState === 'analysing'}
      />
    </div>
  )
}
```

- [ ] **Step 3: Run full test suite — confirm no regressions**

```bash
npx vitest run tests/app/page.test.tsx tests/components/dashboard-shell.test.tsx
```
Expected: all existing tests PASS (v1 shell still renders when DESIGN_VARIANT defaults to v2 — the test for dashboard-shell.test.tsx tests the v1 shell directly, not via home-client, so it still passes)

- [ ] **Step 4: TypeScript check**

```bash
node_modules/.bin/next build 2>&1 | grep -E "error TS|✓ Compiled"
```
Expected: `✓ Compiled successfully`

- [ ] **Step 5: Commit**

```bash
git add app/home-client.tsx
git commit -m "feat(flag): wire NEXT_PUBLIC_DESIGN_VARIANT feature flag in home-client"
```

---

## Task 7: Build, deploy, verify

- [ ] **Step 1: Run full test suite**

```bash
npx vitest run
```
Expected: all tests PASS. If any fail, fix before proceeding.

- [ ] **Step 2: Production build**

```bash
node_modules/.bin/next build
```
Expected: `✓ Compiled successfully`, no TypeScript errors.

- [ ] **Step 3: Stage and commit build artifacts**

```bash
git add -f .next/standalone/ .next/static/
git commit -m "build: production build for Linear-tier UI redesign (v2)"
```

- [ ] **Step 4: Push to deploy branch**

```bash
git push origin deploy
```

- [ ] **Step 5: Set env var on Terminal AI**

Using Terminal AI MCP: set `NEXT_PUBLIC_DESIGN_VARIANT` = `v2` on app `c1b53feb-f9cb-4cbc-88a5-daa8cb3e5ea5`.

- [ ] **Step 6: Redeploy**

Using Terminal AI MCP: call `redeploy_app` with `app_id: c1b53feb-f9cb-4cbc-88a5-daa8cb3e5ea5`.

- [ ] **Step 7: Poll until live**

Call `get_deployment_status` every 30s until `status: "live"`.

- [ ] **Step 8: Smoke test in browser**

Visit the deployed URL. Verify:
- 48px toolbar with ClearSpend logo, filter pills, Add button
- Two-column layout on desktop (content left, AI rail right)
- AI rail is sticky, fills full height
- Mobile: rail hidden, floating "✦ Ask" button visible bottom-right
- Clicking "✦ Ask" opens bottom sheet with chat
- Sending a question streams response into rail bubbles
- Cards have 8px radius, no shadows, just thin borders
- Primary color is `#5E6AD2` (purple-blue, not royal blue)

---

## Self-Review

**Spec coverage check:**
- ✅ Feature flag (`NEXT_PUBLIC_DESIGN_VARIANT`) — Task 6
- ✅ `[data-design="v2"]` CSS token overrides — Task 2
- ✅ 48px toolbar with FilterBar + actions — Task 5
- ✅ Two-column layout (65/35) — Task 5
- ✅ Sticky AI rail, full viewport height — Task 5
- ✅ ChatRail with bubble UI and SSE streaming — Task 3
- ✅ Mobile floating button + bottom sheet — Task 4
- ✅ `renderMarkdown` extracted to shared util — Task 1
- ✅ v1 shell untouched — existing DashboardShell not modified

**Type consistency:**
- `ChatRailProps` defines `style?: React.CSSProperties` — used correctly in Task 4 and Task 5
- `DashboardShellV2Props` matches `DashboardShellProps` shape — both shells accept same props
- `renderMarkdown` export used identically in `chat-panel.tsx` and `chat-rail.tsx`
