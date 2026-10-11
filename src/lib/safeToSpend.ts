/** Deterministic safe-to-spend: recorded values separated from estimates. Integer laari math. */
import type { Txn, Recurring } from './types';

export interface SafeToSpendInput {
  openingBalanceLaari: number;
  txns: Txn[]; // in current pay cycle
  upcoming: Recurring[]; // obligations before payday
  savingsCommitLaari: number;
  expectedIncomeLaari: number; // only explicitly configured
  daysLeft: number;
}

export interface SafeToSpendResult {
  safeLaari: number;
  perDayLaari: number;
  breakdown: { label: string; laari: number; kind: 'actual' | 'estimate' }[];
  warnings: string[];
}

/**
 * safe = opening + recordedIncome − recordedOutflow − upcoming − savings + expectedIncome
 * Recorded outflow excludes internal transfers (not spend) and nets refunds against expenses.
 * Cash withdrawals ARE outflow (cash in hand), to avoid double counting the later cash purchases
 * the UI warns when both a withdrawal and manual cash txns exist in the same cycle.
 */
export function calcSafeToSpend(inp: SafeToSpendInput): SafeToSpendResult {
  const warnings: string[] = [];
  let income = 0;
  let outflow = 0;
  let refundContra = 0;
  let hasWithdrawal = false;
  let hasManualCash = false;

  for (const t of inp.txns) {
    if (t.type === 'internal_transfer') continue; // not income/expense
    if (t.type === 'income') income += t.amountLaari;
    else if (t.type === 'refund') refundContra += t.amountLaari;
    else if (t.type === 'expense' || t.type === 'external_transfer' || t.type === 'cash_withdrawal' || t.type === 'adjustment') {
      if (t.type === 'adjustment' && t.amountLaari === 0) continue;
      outflow += t.amountLaari;
      if (t.type === 'cash_withdrawal') hasWithdrawal = true;
      if (t.type === 'expense' && t.category === 'cash' && t.source === 'manual') hasManualCash = true;
    }
    // cash_deposit: money moved into hand — treat as neutral reclassification, warn
  }
  const netOutflow = Math.max(0, outflow - refundContra);
  const upcomingTotal = inp.upcoming.reduce((s, r) => s + r.amountLaari, 0);

  if (hasWithdrawal && hasManualCash) {
    warnings.push('You recorded an ATM withdrawal and manual cash spending in the same cycle — cash purchases may be double-counted. Review cash txns.');
  }
  if (inp.daysLeft < 0) warnings.push('Payday has passed — update your payday to refresh this estimate.');
  if (inp.txns.length === 0) warnings.push('No transactions in this cycle yet — this figure leans on your opening balance.');

  const safe = inp.openingBalanceLaari + income - netOutflow - upcomingTotal - inp.savingsCommitLaari + inp.expectedIncomeLaari;
  return {
    safeLaari: safe,
    perDayLaari: inp.daysLeft > 0 ? Math.floor(safe / inp.daysLeft) : safe,
    breakdown: [
      { label: 'Recorded balance base', laari: inp.openingBalanceLaari, kind: 'actual' },
      { label: 'Recorded income', laari: income, kind: 'actual' },
      { label: 'Recorded spending & transfers out', laari: -netOutflow, kind: 'actual' },
      { label: 'Upcoming bills before payday', laari: -upcomingTotal, kind: 'estimate' },
      { label: 'Savings commitment', laari: -inp.savingsCommitLaari, kind: 'estimate' },
      ...(inp.expectedIncomeLaari > 0 ? [{ label: 'Expected income (configured)', laari: inp.expectedIncomeLaari, kind: 'estimate' as const }] : []),
    ],
    warnings,
  };
}

export function daysUntilPayday(paydayDay: number, now = new Date()): { days: number; date: Date } {
  const d = new Date(now);
  let target = new Date(d.getFullYear(), d.getMonth(), Math.min(Math.max(paydayDay, 1), 28));
  if (target <= d) target = new Date(d.getFullYear(), d.getMonth() + 1, Math.min(Math.max(paydayDay, 1), 28));
  const days = Math.ceil((target.getTime() - d.getTime()) / 86400000);
  return { days, date: target };
}
