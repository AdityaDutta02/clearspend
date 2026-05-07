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
