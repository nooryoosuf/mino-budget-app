/** Shared domain types — local-first prototype. Amounts stored as integer laari (1 MVR = 100 laari). */

export type TxnType =
  | 'income'
  | 'expense'
  | 'internal_transfer'
  | 'external_transfer'
  | 'refund'
  | 'cash_withdrawal'
  | 'cash_deposit'
  | 'adjustment';

export type TxnSource = 'manual' | 'csv' | 'sms' | 'demo';

export interface Txn {
  id: string;
  /** integer minor units (laari). Always positive; direction derived from type. */
  amountLaari: number;
  currency: 'MVR' | 'USD';
  type: TxnType;
  merchant: string;
  category: string;
  subcategory?: string;
  /** ISO date yyyy-mm-dd */
  date: string;
  time?: string;
  account?: string;
  notes?: string;
  source: TxnSource;
  reviewed: boolean;
  tags?: string[];
  recurringId?: string;
  /** import provenance, kept separate from normalized fields */
  importMeta?: {
    sessionId?: string;
    parserId?: string;
    parserVersion?: string;
    confidence?: number;
    rawRef?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Budget {
  id: string;
  name: string;
  category: string; // 'all' for whole-month envelope or a category key
  period: 'weekly' | 'monthly' | 'custom';
  limitLaari: number;
  startDate: string; // ISO
  endDate?: string;
  rollover: boolean;
  alertAtPct: number; // e.g. 80
}

export interface Goal {
  id: string;
  name: string;
  island: string; // archipelago identity label
  targetLaari: number;
  savedLaari: number;
  targetDate?: string;
  monthlyLaari?: number;
  priority: 'high' | 'medium' | 'low';
  color: string;
}

export interface Recurring {
  id: string;
  name: string;
  amountLaari: number;
  category: string;
  frequency: 'monthly' | 'weekly';
  nextDate: string;
  account?: string;
}

export interface Rule {
  id: string;
  match: string; // substring, case-insensitive
  category: string;
  note?: string;
}

export interface CustomCat {
  key: string;
  label: string;
  color: string;
  icon: string; // lucide icon name from ICON_CHOICES
}

export interface Prefs {
  openingBalanceLaari: number;
  paydayDay: number; // 1-28
  salaryAmountLaari: number;
  salaryFreq: 'monthly' | 'biweekly' | 'weekly' | 'irregular';
  displayName: string;
}

export type RangeKey = 'week' | 'month' | 'prevMonth' | 'custom';
