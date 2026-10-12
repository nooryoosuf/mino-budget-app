/**
 * Mino's finance tools — the ONLY place answers come from.
 * Pure functions over the local store. No guessing, no invented figures:
 * every number is computed from recorded transactions, budgets, goals,
 * recurring bills and preferences.
 */
import { CATEGORIES, allCategories, categoryLabel } from '../categories';
import { calcSafeToSpend, daysUntilPayday } from '../safeToSpend';
import type { StoreShape } from '../store';
import type { Txn } from '../types';
import type { Proposal } from './types';

export const isOut = (t: Txn) => t.type === 'expense' || t.type === 'external_transfer' || t.type === 'cash_withdrawal';
export const isIn = (t: Txn) => t.type === 'income' || t.type === 'refund';

export function monthKey(offset = 0, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function outflowOf(list: Txn[]): number {
  let out = 0;
  for (const t of list) {
    if (isOut(t)) out += t.amountLaari;
    else if (t.type === 'refund') out -= t.amountLaari;
  }
  return Math.max(0, out);
}

export function incomeOf(list: Txn[]): number {
  return list.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountLaari, 0);
}

export interface Summary {
  income: number; expense: number; net: number; n: number;
  label: string; from: string; to: string;
}

export function summarizeRange(s: StoreShape, from: string, to: string, label: string): Summary {
  const list = s.txns.filter((t) => t.date >= from && t.date <= to);
  const income = incomeOf(list);
  const expense = outflowOf(list);
  return { income, expense, net: income - expense, n: list.length, label, from, to };
}

export function summarizeMonth(s: StoreShape, offset = 0): Summary {
  const mk = monthKey(offset);
  const now = new Date();
  const label = offset === 0
    ? now.toLocaleString('en', { month: 'long' })
    : new Date(now.getFullYear(), now.getMonth() + offset, 1).toLocaleString('en', { month: 'long', year: 'numeric' });
  const list = s.txns.filter((t) => t.date.slice(0, 7) === mk);
  return { income: incomeOf(list), expense: outflowOf(list), net: incomeOf(list) - outflowOf(list), n: list.length, label, from: `${mk}-01`, to: `${mk}-31` };
}

export function summarizeWeek(s: StoreShape): Summary {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const d0 = new Date(now); d0.setDate(now.getDate() - 6);
  return summarizeRange(s, d0.toISOString().slice(0, 10), to, 'the last 7 days');
}

export interface CatSlice { key: string; label: string; value: number; pct: number }

export function spendingByCategory(s: StoreShape, from: string, to: string, limit = 5): { slices: CatSlice[]; total: number } {
  const m = new Map<string, number>();
  for (const t of s.txns.filter((x) => x.date >= from && x.date <= to)) {
    if (t.type !== 'expense' && t.type !== 'cash_withdrawal') continue;
    m.set(t.category, (m.get(t.category) ?? 0) + t.amountLaari);
  }
  const total = [...m.values()].reduce((a, b) => a + b, 0);
  const slices = [...m.entries()]
    .map(([key, value]) => ({ key, label: categoryLabel(key, s.customCats), value, pct: total ? (value / total) * 100 : 0 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
  return { slices, total };
}

export function searchMerchant(s: StoreShape, needle: string, limit = 8): { txns: Txn[]; total: number; n: number } {
  const q = needle.trim().toLowerCase();
  const txns = s.txns
    .filter((t) => t.merchant.toLowerCase().includes(q) || (t.notes ?? '').toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit);
  return { txns, total: txns.filter(isOut).reduce((a, t) => a + t.amountLaari, 0), n: s.txns.filter((t) => t.merchant.toLowerCase().includes(q)).length };
}

export function biggestExpenses(s: StoreShape, monthOffset = 0, n = 5): Txn[] {
  const mk = monthKey(monthOffset);
  return s.txns
    .filter((t) => t.date.slice(0, 7) === mk && isOut(t))
    .sort((a, b) => b.amountLaari - a.amountLaari)
    .slice(0, n);
}

export function compareMonths(s: StoreShape): { cur: Summary; prev: Summary; deltaPct: number | null } {
  const cur = summarizeMonth(s, 0);
  const prev = summarizeMonth(s, -1);
  const deltaPct = prev.expense > 0 ? Math.round(((cur.expense - prev.expense) / prev.expense) * 100) : null;
  return { cur, prev, deltaPct };
}

export interface BudgetLine { name: string; category: string; spent: number; limit: number; pct: number; status: 'ok' | 'watch' | 'over' }

export function budgetStatus(s: StoreShape, mk = monthKey(0)): BudgetLine[] {
  return s.budgets.map((b) => {
    const spent = s.txns
      .filter((t) => t.date.slice(0, 7) === mk && (t.type === 'expense' || t.type === 'cash_withdrawal') && (b.category === 'all' || t.category === b.category))
      .reduce((a, t) => a + t.amountLaari, 0);
    const pct = b.limitLaari ? (spent / b.limitLaari) * 100 : 0;
    return { name: b.name, category: b.category, spent, limit: b.limitLaari, pct, status: pct > 100 ? 'over' : pct > 80 ? 'watch' : 'ok' };
  });
}

export function safePosition(s: StoreShape) {
  const payday = daysUntilPayday(s.prefs.paydayDay);
  const start = new Date(); start.setDate(1);
  const cycle = s.txns.filter((t) => t.date >= start.toISOString().slice(0, 10));
  const upcoming = s.recurring.filter((r) => r.nextDate <= payday.date.toISOString().slice(0, 10));
  const savings = s.goals.reduce((a, g) => a + (g.monthlyLaari ?? 0), 0);
  const calc = calcSafeToSpend({
    openingBalanceLaari: s.prefs.openingBalanceLaari,
    txns: cycle, upcoming, savingsCommitLaari: savings, expectedIncomeLaari: 0, daysLeft: payday.days,
  });
  const available = s.prefs.openingBalanceLaari + incomeOf(cycle) - outflowOf(cycle);
  return { payday, upcoming, savings, calc, available, cycle };
}

export interface PurchaseVerdict {
  amountLaari: number; available: number; obligations: number; savings: number;
  remaining: number; verdict: 'comfortable' | 'tight' | 'unwise';
  lines: { label: string; laari: number }[];
  caveats: string[];
}

export function evaluatePurchase(s: StoreShape, amountLaari: number): PurchaseVerdict {
  const { upcoming, savings, calc, available } = safePosition(s);
  const obligations = upcoming.reduce((a, r) => a + r.amountLaari, 0);
  const remaining = calc.safeLaari - amountLaari;
  const lines = [
    { label: 'Recorded available', laari: available },
    { label: 'Bills before payday', laari: -obligations },
    { label: 'Savings set aside', laari: -savings },
    { label: 'This purchase', laari: -amountLaari },
  ];
  const caveats: string[] = [];
  if (s.txns.length < 5) caveats.push('Your history is thin, so this leans on your opening balance.');
  caveats.push(...calc.warnings);
  const verdict = remaining < 0 ? 'unwise' : remaining < Math.max(100000, calc.safeLaari * 0.2) ? 'tight' : 'comfortable';
  return { amountLaari, available, obligations, savings, remaining, verdict, lines, caveats: [...new Set(caveats)] };
}

export interface SavingsPlan {
  targetLaari: number; savedLaari: number; remaining: number;
  months: number; monthlyLaari: number; lastMonthNet: number; feasible: boolean;
}

export function savingsPlan(s: StoreShape, targetLaari: number, months: number, alreadySaved = 0): SavingsPlan {
  const remaining = Math.max(0, targetLaari - alreadySaved);
  const monthlyLaari = months > 0 ? Math.ceil(remaining / months) : remaining;
  const last = summarizeMonth(s, -1);
  const lastMonthNet = last.income - last.expense;
  return { targetLaari, savedLaari: alreadySaved, remaining, months, monthlyLaari, lastMonthNet, feasible: lastMonthNet <= 0 ? monthlyLaari <= 0 : monthlyLaari <= lastMonthNet * 0.5 };
}

/** Resolve a user phrase to a category key (built-ins + customs). */
export function resolveCategory(s: StoreShape, phrase: string): string | null {
  const p = phrase.trim().toLowerCase();
  const all = allCategories(s.customCats);
  const exact = all.find((c) => c.label.toLowerCase() === p || c.key === p.replace(/\s+/g, ''));
  if (exact) return exact.key;
  const hit = all.find((c) => c.label.toLowerCase().includes(p) || p.includes(c.label.toLowerCase()));
  if (hit && p.length >= 3) return hit.key;
  const hinted = CATEGORIES.find((c) => c.hint.some((h) => p.includes(h)));
  return hinted ? hinted.key : null;
}

export function proposeBudgetUpdate(s: StoreShape, category: string, amountLaari: number): Proposal | { error: string } {
  if (amountLaari <= 0) return { error: 'That amount needs to be above zero — tell me a monthly figure like MVR 2,000.' };
  const existing = s.budgets.find((b) => b.category === category);
  const label = categoryLabel(category, s.customCats);
  if (existing) {
    const dir = amountLaari > existing.limitLaari ? 'raising' : 'lowering';
    return {
      kind: 'budget-update', title: `Update ${existing.name}?`,
      summary: `Change the limit from ${fmt(existing.limitLaari)} to ${fmt(amountLaari)} per month.`,
      effect: `${cap(dir)} this envelope by ${fmt(Math.abs(amountLaari - existing.limitLaari))}.`,
      payload: { id: existing.id, limitLaari: amountLaari },
    };
  }
  return {
    kind: 'budget-create', title: `Create a ${label} budget?`,
    summary: `New monthly envelope: ${label} · ${fmt(amountLaari)}.`,
    effect: `Mino will track ${label} spending against ${fmt(amountLaari)} each month.`,
    payload: { category, limitLaari: amountLaari, name: `${label} budget` },
  };
}

export function proposeGoal(s: StoreShape, name: string, targetLaari: number, months?: number): Proposal | { error: string } {
  if (!name.trim()) return { error: 'Give the goal a name first — like "Trip to Colombo".' };
  if (targetLaari <= 0) return { error: 'The target needs to be above zero — how much in MVR?' };
  const monthly = months && months > 0 ? Math.ceil(targetLaari / months) : 0;
  return {
    kind: 'goal-create', title: `Start saving for ${name.trim()}?`,
    summary: `Target ${fmt(targetLaari)}${months ? ` · ≈${fmt(monthly)} a month for ${months} months` : ''}.`,
    effect: monthly ? `Mino will count ${fmt(monthly)} a month toward it in your safe-to-spend.` : 'Mino will track contributions toward it.',
    payload: { name: name.trim(), targetLaari, months: months ?? 0 },
  };
}

export function fmt(laari: number): string {
  return `MVR ${(Math.abs(laari) / 100).toLocaleString('en-MV', { maximumFractionDigits: 0 })}`;
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);
