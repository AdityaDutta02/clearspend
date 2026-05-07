import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatPanel } from '@/components/chat/chat-panel'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

function makeSseResponse(events: string[]): Partial<Response> {
  const chunks = events.map((e) => new TextEncoder().encode(`data: ${e}\n\n`))
  let index = 0
  const stream = new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++])
      } else {
        controller.close()
      }
    },
  })
  return {
    ok: true,
    status: 200,
    body: stream,
  }
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

function makeHttpError(status: number): Partial<Response> {
  return {
    ok: false,
    status,
    body: null,
    json: async () => ({ error: 'Server error' }),
  }
}

describe('ChatPanel', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('renders inline panel (always visible, no toggle)', () => {
    render(<ChatPanel token="test-token" />)
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    expect(screen.queryByTestId('chat-toggle-btn')).not.toBeInTheDocument()
  })

  it('renders search input with placeholder', () => {
    render(<ChatPanel token="test-token" />)
    expect(screen.getByTestId('chat-input')).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Ask anything about your finances/i)).toBeInTheDocument()
  })

  it('send button disabled when input is empty', () => {
    render(<ChatPanel token="test-token" />)
    expect(screen.getByTestId('chat-send-btn')).toBeDisabled()
  })

  it('send button enabled when input has text', () => {
    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'How much did I spend?' } })
    expect(screen.getByTestId('chat-send-btn')).not.toBeDisabled()
  })

  it('shows suggestions dropdown on focus', () => {
    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')
    fireEvent.focus(input)
    expect(screen.getByTestId('chat-suggestions')).toBeInTheDocument()
  })

  it('filters suggestions as user types', () => {
    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'subscription' } })
    const suggestions = screen.getAllByTestId('chat-suggestion')
    expect(suggestions.length).toBeGreaterThan(0)
    suggestions.forEach((s) => {
      expect(s.textContent?.toLowerCase()).toContain('subscription')
    })
  })

  it('shows loading state while fetching', async () => {
    mockFetch.mockReturnValue(
      new Promise(() => undefined) // never resolves
    )

    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'How much did I spend?' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-loading')).toBeInTheDocument()
    })
  })

  it('clears input after send', async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined))

    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'How much did I spend?' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(input.value).toBe('')
    })
  })

  it('shows user message in conversation', async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined))

    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'How much did I spend?' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-user-msg')).toHaveTextContent('How much did I spend?')
    })
  })

  it('shows answer as assistant bubble on success (SSE)', async () => {
    mockFetch.mockResolvedValue(makeOkSse('You spent ₹5,000') as unknown as Response)

    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'How much did I spend?' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-assistant-msg')).toHaveTextContent('You spent ₹5,000')
    })
  })

  it('shows INSUFFICIENT_CREDITS message via SSE error', async () => {
    mockFetch.mockResolvedValue(makeErrorSse('INSUFFICIENT_CREDITS') as unknown as Response)

    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'What are my top expenses?' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-assistant-msg')).toHaveTextContent(
        'You need at least 1 credit to send a message.',
      )
    })
  })

  it('shows generic error via SSE error field', async () => {
    mockFetch.mockResolvedValue(makeErrorSse('Server down') as unknown as Response)

    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'Analyse my spending' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-assistant-msg')).toHaveTextContent('Server down')
    })
  })

  it('shows error when response is not ok', async () => {
    mockFetch.mockResolvedValue(makeHttpError(500) as unknown as Response)

    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'test' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-assistant-msg')).toBeInTheDocument()
    })
  })

  it('supports multi-turn: second message appears after first answer', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkSse('You spent ₹5,000') as unknown as Response)
      .mockResolvedValueOnce(makeOkSse('Your top category is Food') as unknown as Response)

    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')

    fireEvent.change(input, { target: { value: 'How much did I spend?' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(screen.getAllByTestId('chat-assistant-msg')).toHaveLength(1)
    })

    fireEvent.change(input, { target: { value: 'What is my top category?' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(screen.getAllByTestId('chat-user-msg')).toHaveLength(2)
      expect(screen.getAllByTestId('chat-assistant-msg')).toHaveLength(2)
      expect(screen.getAllByTestId('chat-assistant-msg')[1]).toHaveTextContent('Your top category is Food')
    })
  })

  it('Enter key sends the message', async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined))

    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'test question' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false })

    await waitFor(() => {
      expect(screen.getByTestId('chat-user-msg')).toHaveTextContent('test question')
    })
  })

  it('Escape key hides suggestions', () => {
    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')
    fireEvent.focus(input)
    expect(screen.getByTestId('chat-suggestions')).toBeInTheDocument()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByTestId('chat-suggestions')).not.toBeInTheDocument()
  })
})
