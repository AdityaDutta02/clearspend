import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatPanel } from '@/components/chat/chat-panel'

const mockFetch = vi.fn()

vi.stubGlobal('fetch', mockFetch)

function makeOkResponse(body: object): Partial<Response> {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  }
}

function makeErrorResponse(body: object, status: number): Partial<Response> {
  return {
    ok: false,
    status,
    json: async () => body,
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

  it('shows empty state placeholder initially', () => {
    render(<ChatPanel token="test-token" />)
    expect(screen.getByText(/Ask anything about your spending/i)).toBeInTheDocument()
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

  it('shows loading state while fetching', async () => {
    mockFetch.mockReturnValue(new Promise(() => undefined))

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
    const input = screen.getByTestId('chat-input') as HTMLTextAreaElement
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

  it('shows answer as assistant bubble on success', async () => {
    mockFetch.mockResolvedValue(makeOkResponse({ answer: 'You spent ₹5,000' }) as unknown as Response)

    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'How much did I spend?' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-assistant-msg')).toHaveTextContent('You spent ₹5,000')
    })
  })

  it('shows INSUFFICIENT_CREDITS message', async () => {
    mockFetch.mockResolvedValue(makeErrorResponse({ error: 'INSUFFICIENT_CREDITS' }, 402) as unknown as Response)

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

  it('shows generic error as assistant bubble', async () => {
    mockFetch.mockResolvedValue(makeErrorResponse({ error: 'Server down' }, 500) as unknown as Response)

    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'Analyse my spending' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-assistant-msg')).toHaveTextContent('Server down')
    })
  })

  it('supports multi-turn: second message appears after first answer', async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse({ answer: 'You spent ₹5,000' }) as unknown as Response)
      .mockResolvedValueOnce(makeOkResponse({ answer: 'Your top category is Food' }) as unknown as Response)

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

  it('Shift+Enter does not send the message', async () => {
    render(<ChatPanel token="test-token" />)
    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'test question' } })
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: true })

    expect(mockFetch).not.toHaveBeenCalled()
    expect(screen.queryByTestId('chat-user-msg')).not.toBeInTheDocument()
  })
})
