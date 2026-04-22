import { stripPii } from '@/lib/pii-stripper'

describe('stripPii', () => {
  it('replaces account numbers', () => {
    expect(stripPii('Account: 1234567890123456')).toBe('Account: XXXX')
  })

  it('normalises UPI handle oksbi to sbi', () => {
    const result = stripPii('payment to merchant@oksbi for order')
    expect(result).toContain('@sbi')
  })

  it('normalises UPI handle okicici to icici', () => {
    expect(stripPii('shop@okicici')).toContain('@icici')
  })

  it('normalises UPI handle okhdfcbank to hdfc', () => {
    expect(stripPii('vendor@okhdfcbank')).toContain('@hdfc')
  })

  it('normalises UPI handle okaxis to axis', () => {
    expect(stripPii('merchant@okaxis')).toContain('@axis')
  })

  it('strips 10-digit phone numbers', () => {
    expect(stripPii('Call 9876543210 for help')).toBe('Call [PHONE] for help')
  })

  it('strips email addresses', () => {
    expect(stripPii('john.doe@gmail.com made payment')).toBe('[EMAIL] made payment')
  })

  it('keeps amounts and dates intact', () => {
    const result = stripPii('On 01/03/2024 paid Rs.1500')
    expect(result).toContain('01/03/2024')
    expect(result).toContain('1500')
  })

  it('keeps IFSC codes', () => {
    const result = stripPii('IFSC: HDFC0001234')
    expect(result).toContain('HDFC0001234')
  })
})
