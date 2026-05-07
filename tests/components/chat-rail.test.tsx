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
