import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MobileAskSheet } from '@/components/chat/mobile-ask-sheet'

// ChatRail makes fetch calls — stub fetch
vi.stubGlobal('fetch', vi.fn())

describe('MobileAskSheet', () => {
  it('renders floating button', () => {
    render(<MobileAskSheet token="test" />)
    expect(screen.getByTestId('mobile-ask-btn')).toBeInTheDocument()
  })

  it('sheet is not visible initially', () => {
    render(<MobileAskSheet token="test" />)
    expect(screen.queryByTestId('mobile-ask-sheet')).not.toBeInTheDocument()
  })

  it('clicking button opens sheet', () => {
    render(<MobileAskSheet token="test" />)
    fireEvent.click(screen.getByTestId('mobile-ask-btn'))
    expect(screen.getByTestId('mobile-ask-sheet')).toBeInTheDocument()
  })

  it('clicking close button closes sheet', () => {
    render(<MobileAskSheet token="test" />)
    fireEvent.click(screen.getByTestId('mobile-ask-btn'))
    expect(screen.getByTestId('mobile-ask-sheet')).toBeInTheDocument()
    fireEvent.click(screen.getByTestId('mobile-ask-close'))
    expect(screen.queryByTestId('mobile-ask-sheet')).not.toBeInTheDocument()
  })

  it('clicking backdrop closes sheet', () => {
    render(<MobileAskSheet token="test" />)
    fireEvent.click(screen.getByTestId('mobile-ask-btn'))
    fireEvent.click(screen.getByTestId('mobile-ask-backdrop'))
    expect(screen.queryByTestId('mobile-ask-sheet')).not.toBeInTheDocument()
  })

  it('sheet contains chat rail', () => {
    render(<MobileAskSheet token="test" />)
    fireEvent.click(screen.getByTestId('mobile-ask-btn'))
    expect(screen.getByTestId('chat-rail')).toBeInTheDocument()
  })
})
