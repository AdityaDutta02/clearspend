import { validateConfig } from '@/lib/validate-config'
import { NextResponse } from 'next/server'

export function GET(): NextResponse {
  validateConfig()
  return NextResponse.json({ ok: true })
}
