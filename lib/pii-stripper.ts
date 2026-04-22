/**
 * PII Stripper — runs entirely client-side, no network calls.
 * Removes or normalises personally identifiable information from
 * bank statement text before it is forwarded to any AI service.
 */

/** Maps raw UPI bank handles to normalised short names. */
const UPI_HANDLE_MAP: Record<string, string> = {
  oksbi: 'sbi',
  okicici: 'icici',
  okhdfcbank: 'hdfc',
  okaxis: 'axis',
  ybl: 'ybl',
  ibl: 'ibl',
  paytm: 'paytm',
  upi: 'upi',
}

function normaliseUpiHandle(handle: string): string {
  return UPI_HANDLE_MAP[handle.toLowerCase()] ?? handle.toLowerCase()
}

/**
 * Strip PII from a single line or block of bank statement text.
 *
 * Transformations applied (in order):
 * 1. 12-19 consecutive digits (account / card numbers) → XXXX
 * 2. UPI handles with known bank prefixes (e.g. @oksbi) → normalised form (@sbi)
 * 3. Remaining email addresses → [EMAIL]
 * 4. Standalone 10-digit Indian mobile numbers (starting 6-9) → [PHONE]
 *
 * Amounts, dates, and IFSC codes are intentionally preserved.
 */
export function stripPii(text: string): string {
  return (
    text
      // 1. Account / card numbers: 12-19 consecutive digits
      .replace(/\b\d{12,19}\b/g, 'XXXX')
      // 2. Normalise UPI handles before email stripping: merchant@oksbi → merchant@sbi
      .replace(
        /([a-zA-Z0-9._-]+)@(oksbi|okicici|okhdfcbank|okaxis|ybl|ibl|paytm)\b/gi,
        (_match, merchant: string, handle: string) =>
          `${merchant}@${normaliseUpiHandle(handle)}`,
      )
      // 3. Email addresses (UPI handles are already normalised above)
      .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]')
      // 4. 10-digit Indian phone numbers (standalone, first digit 6-9)
      .replace(/\b[6-9]\d{9}\b/g, '[PHONE]')
  )
}
