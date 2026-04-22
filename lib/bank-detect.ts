import type { BankSlug, AccountType } from '@/types'

interface DetectionResult {
  bank: BankSlug | null
  month: string | null
  account_type: AccountType
}

const BANK_PATTERNS: Array<{ pattern: RegExp; slug: BankSlug }> = [
  { pattern: /hdfc/i, slug: 'hdfc' },
  { pattern: /state bank of india|sbi/i, slug: 'sbi' },
  { pattern: /icici/i, slug: 'icici' },
  { pattern: /axis bank/i, slug: 'axis' },
  { pattern: /kotak/i, slug: 'kotak' },
  { pattern: /yes bank/i, slug: 'yes' },
  { pattern: /punjab national|pnb/i, slug: 'pnb' },
  { pattern: /bank of baroda|bob/i, slug: 'bob' },
  { pattern: /canara/i, slug: 'canara' },
  { pattern: /indusind/i, slug: 'indusind' },
]

const MONTH_NAMES: Record<string, string> = {
  january: '01', february: '02', march: '03', april: '04',
  may: '05', june: '06', july: '07', august: '08',
  september: '09', october: '10', november: '11', december: '12',
  jan: '01', feb: '02', mar: '03', apr: '04',
  jun: '06', jul: '07', aug: '08', sep: '09',
  oct: '10', nov: '11', dec: '12',
}

export function detectBankAndMonth(headerText: string): DetectionResult {
  const bank = BANK_PATTERNS.find(({ pattern }) => pattern.test(headerText))?.slug ?? null

  let month: string | null = null

  const namedMonthMatch = headerText.match(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec)\s+(\d{4})\b/i,
  )
  if (namedMonthMatch) {
    const m = MONTH_NAMES[namedMonthMatch[1].toLowerCase()]
    month = `${namedMonthMatch[2]}-${m}`
  }

  if (!month) {
    const numericMonthMatch = headerText.match(/\b(\d{4})-(\d{2})\b/)
    if (numericMonthMatch) {
      month = `${numericMonthMatch[1]}-${numericMonthMatch[2]}`
    }
  }

  const account_type: AccountType = /credit card/i.test(headerText) ? 'credit' : 'debit'

  return { bank, month, account_type }
}
