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

  it('renders toggle button', () => {
    render(<ChatPanel token="test-token" />)
    expect(screen.getByTestId('chat-toggle-btn')).toBeInTheDocument()
  })

  it('panel is hidden initially', () => {
    render(<ChatPanel token="test-token" />)
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
  })

  it('opens panel on button click', () => {
    render(<ChatPanel token="test-token" />)
    fireEvent.click(screen.getByTestId('chat-toggle-btn'))
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
  })

  it('closes panel with close button', () => {
    render(<ChatPanel token="test-token" />)
    fireEvent.click(screen.getByTestId('chat-toggle-btn'))
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('chat-close-btn'))
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
  })

  it('closes panel with Escape key', () => {
    render(<ChatPanel token="test-token" />)
    fireEvent.click(screen.getByTestId('chat-toggle-btn'))
    expect(screen.getByTestId('chat-panel')).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId('chat-panel')).not.toBeInTheDocument()
  })

  it('shows loading state while fetching', async () => {
    // Never-resolving promise
    mockFetch.mockReturnValue(new Promise(() => undefined))

    render(<ChatPanel token="test-token" />)
    fireEvent.click(screen.getByTestId('chat-toggle-btn'))

    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'How much did I spend?' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-loading')).toBeInTheDocument()
    })
  })

  it('shows answer on success', async () => {
    // cast needed because vi.fn mock doesn't need full Response interface
    mockFetch.mockResolvedValue(makeOkResponse({ answer: 'You spent ₹5,000' }) as unknown as Response)

    render(<ChatPanel token="test-token" />)
    fireEvent.click(screen.getByTestId('chat-toggle-btn'))

    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'How much did I spend?' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-response')).toHaveTextContent('You spent ₹5,000')
    })
  })

  it('shows INSUFFICIENT_CREDITS message', async () => {
    // cast needed because vi.fn mock doesn't need full Response interface
    mockFetch.mockResolvedValue(makeErrorResponse({ error: 'INSUFFICIENT_CREDITS' }, 402) as unknown as Response)

    render(<ChatPanel token="test-token" />)
    fireEvent.click(screen.getByTestId('chat-toggle-btn'))

    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'What are my top expenses?' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(screen.getByTestId('chat-response')).toHaveTextContent(
        'You need at least 1 credit to send a message.',
      )
    })
  })

  it('shows generic error', async () => {
    // cast needed because vi.fn mock doesn't need full Response interface
    mockFetch.mockResolvedValue(makeErrorResponse({ error: 'Server down' }, 500) as unknown as Response)

    render(<ChatPanel token="test-token" />)
    fireEvent.click(screen.getByTestId('chat-toggle-btn'))

    const input = screen.getByTestId('chat-input')
    fireEvent.change(input, { target: { value: 'Analyse my spending' } })
    fireEvent.click(screen.getByTestId('chat-send-btn'))

    await waitFor(() => {
      expect(screen.getByText('Server down')).toBeInTheDocument()
    })
  })
})
