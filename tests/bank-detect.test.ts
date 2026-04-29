import { detectBankAndMonth } from '@/lib/bank-detect'

describe('detectBankAndMonth — existing header detection', () => {
  it('detects HDFC from header', () => {
    const result = detectBankAndMonth('HDFC Bank Credit Card Statement\nStatement Period: March 2024')
    expect(result.bank).toBe('hdfc')
    expect(result.month).toBe('2024-03')
  })

  it('detects SBI from header', () => {
    const result = detectBankAndMonth('State Bank of India\nAccount Statement February 2024')
    expect(result.bank).toBe('sbi')
    expect(result.month).toBe('2024-02')
  })

  it('detects ICICI from header', () => {
    const result = detectBankAndMonth('ICICI Bank Limited\nJan 2024')
    expect(result.bank).toBe('icici')
    expect(result.month).toBe('2024-01')
  })

  it('returns null for unrecognised bank', () => {
    const result = detectBankAndMonth('Some random text without bank name')
    expect(result.bank).toBeNull()
    expect(result.month).toBeNull()
  })

  it('detects credit account type', () => {
    const result = detectBankAndMonth('HDFC Bank Credit Card Statement')
    expect(result.account_type).toBe('credit')
  })

  it('defaults to debit when no credit card mention', () => {
    const result = detectBankAndMonth('HDFC Bank Account Statement')
    expect(result.account_type).toBe('debit')
  })
})

describe('detectBankAndMonth — filename detection', () => {
  it('detects bank from filename when header has none', () => {
    const result = detectBankAndMonth('random text', 'HDFC_CC_Statement_Dec2024.pdf')
    expect(result.bank).toBe('hdfc')
  })

  it('detects month from filename pattern dec2024', () => {
    const result = detectBankAndMonth('', 'HDFC_CC_Dec2024.pdf')
    expect(result.month).toBe('2024-12')
  })

  it('detects month from filename pattern 12-2024', () => {
    const result = detectBankAndMonth('', 'statement_12-2024.pdf')
    expect(result.month).toBe('2024-12')
  })

  it('detects month from filename pattern december_2024', () => {
    const result = detectBankAndMonth('', 'ICICI_december_2024.pdf')
    expect(result.month).toBe('2024-12')
  })

  it('header detection takes priority over filename for bank', () => {
    const result = detectBankAndMonth('ICICI Bank Credit Card', 'HDFC_statement.pdf')
    expect(result.bank).toBe('icici')
  })

  it('header detection takes priority over filename for month', () => {
    const result = detectBankAndMonth('Statement Period: January 2024', 'statement_feb2024.pdf')
    expect(result.month).toBe('2024-01')
  })
})

describe('detectBankAndMonth — last_four extraction', () => {
  it('extracts last four from header near "card"', () => {
    const result = detectBankAndMonth('HDFC Bank Credit Card\nCard Number ending 4321')
    expect(result.last_four).toBe('4321')
  })

  it('extracts last four from header near "ending"', () => {
    const result = detectBankAndMonth('HDFC Bank\nAccount ending in 9876')
    expect(result.last_four).toBe('9876')
  })

  it('extracts last four from filename when header has none', () => {
    const result = detectBankAndMonth('HDFC Bank Credit Card', 'HDFC_CC_1234.pdf')
    expect(result.last_four).toBe('1234')
  })

  it('returns null last_four when not found', () => {
    const result = detectBankAndMonth('HDFC Bank Credit Card Statement March 2024')
    expect(result.last_four).toBeNull()
  })
})

describe('detectBankAndMonth — card_name extraction', () => {
  it('extracts HDFC Regalia from header', () => {
    const result = detectBankAndMonth('HDFC Bank Regalia Credit Card Statement')
    expect(result.card_name).toBe('Regalia')
  })

  it('extracts HDFC Millennia from header', () => {
    const result = detectBankAndMonth('HDFC Bank Millennia Credit Card')
    expect(result.card_name).toBe('Millennia')
  })

  it('extracts ICICI Amazon Pay from header', () => {
    const result = detectBankAndMonth('ICICI Bank Amazon Pay Credit Card Statement')
    expect(result.card_name).toBe('Amazon Pay')
  })

  it('extracts Axis Flipkart from filename', () => {
    const result = detectBankAndMonth('Axis Bank Credit Card', 'Axis_Flipkart_statement.pdf')
    expect(result.card_name).toBe('Flipkart')
  })

  it('extracts Kotak White Reserve card name (not misidentified as Reserve)', () => {
    const result = detectBankAndMonth('Kotak White Reserve Credit Card Statement')
    expect(result.card_name).toBe('White Reserve')
  })

  it('returns null card_name when not found', () => {
    const result = detectBankAndMonth('HDFC Bank Credit Card Statement March 2024')
    expect(result.card_name).toBeNull()
  })
})
