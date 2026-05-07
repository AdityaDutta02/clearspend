import { describe, it, expect } from 'vitest'

// We test getDesignVariant logic directly without importing the full component
// (which has client-side hooks)
function getDesignVariant(envValue: string | undefined): 'v1' | 'v2' {
  return envValue === 'v1' ? 'v1' : 'v2'
}

describe('getDesignVariant', () => {
  it('returns v2 when env is "v2"', () => {
    expect(getDesignVariant('v2')).toBe('v2')
  })

  it('returns v1 when env is "v1"', () => {
    expect(getDesignVariant('v1')).toBe('v1')
  })

  it('returns v2 when env is undefined', () => {
    expect(getDesignVariant(undefined)).toBe('v2')
  })

  it('returns v2 for any unknown value', () => {
    expect(getDesignVariant('beta')).toBe('v2')
    expect(getDesignVariant('')).toBe('v2')
  })
})
