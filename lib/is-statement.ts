import type { BankSlug } from '@/types'

export type StatementConfidence = 'high' | 'medium' | 'low'

export interface StatementHeuristic {
  confidence: StatementConfidence
  score: number
  signals: string[]
}

const BANK_RE = /hdfc|state bank of india|\bsbi\b|icici|axis|kotak|yes bank|punjab national|\bpnb\b|bank of baroda|canara|indusind/i

// Statement-specific vocabulary. Generic enough to catch all banks,
// specific enough that resumes/invoices/articles miss most of them.
const VOCAB_RE = /\b(account statement|statement of account|account number|ifsc|opening balance|closing balance|available balance|transaction details|narration|debit|credit|withdrawal|deposit|upi)\b/gi

export function scoreStatementText(text: string, regexTxnCount: number): StatementHeuristic {
  const signals: string[] = []
  let score = 0

  if (BANK_RE.test(text)) { score += 30; signals.push('bank') }

  const vocabHits = (text.match(VOCAB_RE) ?? []).length
  if (vocabHits >= 3) { score += 30; signals.push('vocab') }
  else if (vocabHits >= 1) { score += 15; signals.push('vocab-weak') }

  if (regexTxnCount >= 3) { score += 40; signals.push('txns') }
  else if (regexTxnCount >= 1) { score += 15; signals.push('txns-weak') }

  // A money-shaped amount present at all (keeps invoices in the gray zone, not low)
  if (/\d[\d,]*\.\d{2}/.test(text)) { score += 5; signals.push('amount') }

  const confidence: StatementConfidence =
    score >= 60 ? 'high' : score >= 20 ? 'medium' : 'low'

  return { confidence, score, signals }
}

// Re-export for callers that also want the bank list shape.
export type { BankSlug }
