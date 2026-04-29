import type { BankSlug, AccountType } from '@/types'

export interface DetectionResult {
  bank: BankSlug | null
  month: string | null
  account_type: AccountType
  card_name: string | null
  last_four: string | null
}

const BANK_PATTERNS: Array<{ pattern: RegExp; slug: BankSlug }> = [
  { pattern: /hdfc/i, slug: 'hdfc' },
  { pattern: /state bank of india|sbi/i, slug: 'sbi' },
  { pattern: /icici/i, slug: 'icici' },
  { pattern: /axis/i, slug: 'axis' },
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

// Known card product names per bank (order matters — longer names first to avoid partial match)
const CARD_NAMES: string[] = [
  // Multi-word first
  'Amazon Pay', 'MakeMyTrip', 'Tata Neu', 'Yes First', 'Flipkart Axis', 'White Reserve',
  // HDFC
  'Regalia Gold', 'Regalia', 'Millennia', 'MoneyBack', 'Diners Club', 'Infinia', 'Freedom', 'Pixel', 'Tata',
  // ICICI
  'Coral', 'Sapphiro', 'Rubyx', 'Emeralde',
  // Axis
  'Flipkart', 'Magnus', 'Vistara', 'Reserve', 'Select', 'Neo',
  // SBI
  'SimplyCLICK', 'SimplySAVE', 'Elite', 'Prime', 'Cashback',
  // Kotak
  'League', 'Royale', 'Mojo',
]

// Shared alternation string for month names (long forms first to avoid short-form shadow)
const MONTH_ALT =
  'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|oct|nov|dec'

function detectBank(text: string): BankSlug | null {
  return BANK_PATTERNS.find(({ pattern }) => pattern.test(text))?.slug ?? null
}

function detectMonth(text: string): string | null {
  // "March 2024" — require non-alpha before month name (or start-of-string) so
  // substrings inside longer words are not matched.
  const namedSpaced = text.match(
    new RegExp(
      `(?:^|[^a-zA-Z])(${MONTH_ALT})\\s+(\\d{4})(?!\\d)`,
      'i',
    ),
  )
  if (namedSpaced) {
    const m = MONTH_NAMES[namedSpaced[1].toLowerCase()]
    return `${namedSpaced[2]}-${m}`
  }

  // "12-2024" or "12/2024"
  // Use negative lookbehind for digit to avoid matching in longer numbers.
  const mmyyyy = text.match(/(?:^|[^0-9])(0?[1-9]|1[0-2])[\/\-](\d{4})(?!\d)/)
  if (mmyyyy) return `${mmyyyy[2]}-${mmyyyy[1].padStart(2, '0')}`

  // "dec2024" / "december2024" / "december_2024" (filename compact form)
  // Allow underscore or hyphen as optional separator; use non-alpha guard instead of \b
  // because underscores are word characters and defeat \b before alpha.
  const compact = text.match(
    new RegExp(
      `(?:^|[^a-zA-Z])(${MONTH_ALT})[_\\-]?(\\d{4})(?!\\d)`,
      'i',
    ),
  )
  if (compact) {
    const m = MONTH_NAMES[compact[1].toLowerCase()]
    return `${compact[2]}-${m}`
  }

  const numeric = text.match(/\b(\d{4})-(\d{2})\b/)
  if (numeric) return `${numeric[1]}-${numeric[2]}`

  return null
}

/** Returns true if the 4-digit string looks like a calendar year (1900–2099). */
function isCalendarYear(digits: string): boolean {
  const n = parseInt(digits, 10)
  return n >= 1900 && n <= 2099
}

function detectLastFour(headerText: string, fileName: string): string | null {
  // Look for 4-digit sequence near card/account/ending/number keywords in header.
  // Reject year-like values (1900–2099) so statement dates don't false-positive.
  const contextPattern = /(?:card|account|ending|no\.?|number)[^\d]{0,20}(\d{4})\b/gi
  let hit: RegExpExecArray | null
  // eslint-disable-next-line no-cond-assign
  while ((hit = contextPattern.exec(headerText)) !== null) {
    if (!isCalendarYear(hit[1])) return hit[1]
  }

  // Fallback: any standalone 4-digit sequence in filename.
  // Normalise separators so that digits flanked by underscores are properly isolated.
  const fileNorm = fileName.replace(/[_\-]/g, ' ')
  const filePattern = /\b(\d{4})\b/g
  // eslint-disable-next-line no-cond-assign
  while ((hit = filePattern.exec(fileNorm)) !== null) {
    if (!isCalendarYear(hit[1])) return hit[1]
  }

  return null
}

function detectCardName(text: string): string | null {
  for (const name of CARD_NAMES) {
    if (new RegExp(`\\b${name}\\b`, 'i').test(text)) return name
  }
  return null
}

export function detectBankAndMonth(headerText: string, fileName = ''): DetectionResult {
  const fileNameNoExt = fileName.replace(/\.pdf$/i, '')
  // Normalise underscore/hyphen separators so word boundaries work for bank and card matching.
  // Keep the raw form (fileNameNoExt) for month detection because patterns like "12-2024" need the hyphen.
  const fileNameNorm = fileNameNoExt.replace(/[_\-]/g, ' ')

  const bank = detectBank(headerText) ?? detectBank(fileNameNorm)
  const month = detectMonth(headerText) ?? detectMonth(fileNameNoExt)
  const account_type: AccountType = /credit card/i.test(headerText) ? 'credit' : 'debit'
  const last_four = detectLastFour(headerText, fileNameNoExt)
  const card_name = detectCardName(headerText) ?? detectCardName(fileNameNorm)

  return { bank, month, account_type, card_name, last_four }
}
