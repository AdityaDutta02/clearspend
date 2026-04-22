'use client'

import { useState, useEffect } from 'react'

export function useEmbedToken(): string | null {
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'TERMINAL_AI_TOKEN' && typeof e.data.token === 'string') {
        setToken(e.data.token)
      }
    }
    window.addEventListener('message', handler)
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'TERMINAL_AI_READY' }, '*')
    }
    return () => window.removeEventListener('message', handler)
  }, [])

  return token
}
