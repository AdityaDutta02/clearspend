import { getUserId } from '@/lib/token'

it('decodes user id from embed token', () => {
  const payload = { sub: 'user_123', iat: 1000 }
  const encoded = btoa(JSON.stringify(payload))
  const fakeJwt = `header.${encoded}.sig`
  expect(getUserId(fakeJwt)).toBe('user_123')
})

it('returns null for invalid token', () => {
  expect(getUserId('bad')).toBeNull()
})

it('returns null when sub is missing', () => {
  const payload = { iat: 1000 }
  const encoded = btoa(JSON.stringify(payload))
  const fakeJwt = `header.${encoded}.sig`
  expect(getUserId(fakeJwt)).toBeNull()
})
