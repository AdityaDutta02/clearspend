'use client'

import { useState } from 'react'
import { ChatRail } from '@/components/chat/chat-rail'

export interface MobileAskSheetProps {
  token: string
}

export function MobileAskSheet({ token }: MobileAskSheetProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Floating button */}
      <button
        type="button"
        data-testid="mobile-ask-btn"
        onClick={() => setIsOpen(true)}
        aria-label="Open AI chat"
        style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 40,
          width: 44,
          height: 44,
          borderRadius: 999,
          background: 'var(--primary, #5E6AD2)',
          boxShadow: '0 4px 16px rgba(94,106,210,0.35)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: '0.75rem',
          fontFamily: 'inherit',
          fontWeight: 500,
          gap: 2,
        }}
      >
        ✦ Ask
      </button>

      {/* Sheet + backdrop */}
      {isOpen && (
        <>
          <div
            data-testid="mobile-ask-backdrop"
            onClick={() => setIsOpen(false)}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.3)',
              zIndex: 49,
            }}
          />
          <div
            data-testid="mobile-ask-sheet"
            style={{
              position: 'fixed',
              insetInline: 0,
              bottom: 0,
              height: '70dvh',
              borderRadius: '16px 16px 0 0',
              zIndex: 50,
              background: 'var(--surface, #FFFFFF)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            {/* Sheet header */}
            <div
              style={{
                height: 44,
                minHeight: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 16px',
                borderBottom: '1px solid var(--border, rgba(0,0,0,0.08))',
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  color: 'var(--text, #1A1A1A)',
                }}
              >
                Ask ClearSpend
              </span>
              <button
                type="button"
                data-testid="mobile-ask-close"
                onClick={() => setIsOpen(false)}
                aria-label="Close chat"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  color: 'var(--muted, #8A8A8A)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 28,
                  height: 28,
                  borderRadius: 4,
                  fontFamily: 'inherit',
                }}
              >
                ✕
              </button>
            </div>

            {/* Chat content */}
            <div
              style={{
                flex: 1,
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              <ChatRail token={token} style={{ height: '100%' }} />
            </div>
          </div>
        </>
      )}
    </>
  )
}
