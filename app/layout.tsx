import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'ClearSpend — Your money, finally legible.',
  description: 'Upload your bank statements and get calm, actionable financial insights.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ position: 'relative' }}>{children}</body>
    </html>
  )
}
