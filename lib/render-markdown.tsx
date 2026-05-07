import type { ReactNode } from 'react'

function renderInline(text: string): ReactNode {
  // Split on **bold** and `code`
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={i} style={{ fontWeight: 700, color: 'var(--text, #1a1a1a)' }}>{part.slice(2, -2)}</strong>
        }
        if (part.startsWith('`') && part.endsWith('`')) {
          return <code key={i} style={{ background: 'rgba(15,23,42,0.07)', borderRadius: '3px', padding: '1px 4px', fontSize: '0.78rem', fontFamily: 'monospace' }}>{part.slice(1, -1)}</code>
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

// Lightweight markdown renderer — handles ### headings, **bold**, - bullets, `code`
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

    // Bullet list item
    if (/^[-*]\s+/.test(line)) {
      listItems.push(line.replace(/^[-*]\s+/, ''))
      continue
    }

    flushList()

    // ### heading
    if (line.startsWith('### ')) {
      nodes.push(
        <div key={i} style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--primary, #2563eb)', marginTop: '10px', marginBottom: '2px', letterSpacing: '-0.01em' }}>
          {line.slice(4)}
        </div>
      )
      continue
    }

    // ## heading
    if (line.startsWith('## ')) {
      nodes.push(
        <div key={i} style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text, #1a1a1a)', marginTop: '10px', marginBottom: '2px', letterSpacing: '-0.015em' }}>
          {line.slice(3)}
        </div>
      )
      continue
    }

    // Empty line → small gap
    if (line.trim() === '') {
      nodes.push(<div key={i} style={{ height: '4px' }} />)
      continue
    }

    // Normal paragraph
    nodes.push(
      <div key={i} style={{ fontSize: '0.82rem', lineHeight: 1.6, color: 'var(--text, #1a1a1a)' }}>
        {renderInline(line)}
      </div>
    )
  }

  flushList()
  return <>{nodes}</>
}
