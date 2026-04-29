export type BankSlug =
  | 'hdfc' | 'sbi' | 'icici' | 'axis' | 'kotak'
  | 'yes' | 'pnb' | 'bob' | 'canara' | 'indusind'

export type AccountType = 'credit' | 'debit'

export type CategorySlug =
  | 'food' | 'transport' | 'shopping' | 'emi_loans' | 'upi'
  | 'utilities' | 'entertainment' | 'health' | 'travel' | 'others'

export interface Statement {
  id: string
  month: string           // "YYYY-MM"
  bank: BankSlug
  account_type: AccountType
  transaction_count: number
  total_debit: number
  total_credit: number
  currency: 'INR'
  uploaded_at: string
  card_name: string | null
  last_four: string | null
}

export interface Transaction {
  id: string
  statement_id: string
  date: string            // "YYYY-MM-DD"
  amount: number
  type: 'debit' | 'credit'
  merchant: string
  category: CategorySlug
  upi_ref: string | null
  upi_merchant: string | null
  raw_description: string
}

export interface Analysis {
  id: string
  statement_id: string
  month: string
  category_breakdown: Partial<Record<CategorySlug, number>>
  top_merchants: Array<{ name: string; total: number; count: number }>
  upi_summary: {
    total_spent: number
    merchant_breakdown: Array<{ name: string; total: number; count: number }>
  }
  monthly_total: number
  insights: string[]
  generated_at: string
}

export interface ParsedStatement {
  bank: BankSlug | null
  month: string | null    // "YYYY-MM"
  account_type: AccountType
  transactions: RawTransaction[]
  raw_header: string
  raw_text: string
  card_name: string | null
  last_four: string | null
}

export interface RawTransaction {
  date: string
  amount: number
  type: 'debit' | 'credit'
  description: string
  upi_ref: string | null
}

export interface DashboardData {
  statements: Statement[]
  analyses: Analysis[]
}
