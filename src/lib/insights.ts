/** Deterministic insights — each backed by a calculation; silent when data is insufficient. */
import type { Txn } from './types';

export interface Insight {
  id: string;
  title: string;
  detail: string;
  severity: 'good' | 'warn' | 'bad' | 'info';
  txnFilter?: { category?: string; month?: string };
}

const monthKey = (d: string) => d.slice(0, 7);

export function buildInsights(txns: Txn[], budgets: { category: string; limitLaari: number }[]): Insight[] {
  const out: Insight[] = [];
  const real = txns.filter((t) => t.source !== 'demo');
  const pool = real.length > 0 ? real : txns;
  if (pool.length < 5) return [];

  const months = [...new Set(pool.map((t) => monthKey(t.date)))].sort();
  const spend = (m: string, cat?: string) =>
    pool
      .filter((t) => monthKey(t.date) === m && (t.type === 'expense' || t.type === 'cash_withdrawal') && (!cat || t.category === cat))
      .reduce((s, t) => s + t.amountLaari, 0);
  const income = (m: string) =>
    pool.filter((t) => monthKey(t.date) === m && t.type === 'income').reduce((s, t) => s + t.amountLaari, 0);

  if (months.length >= 2) {
    const [prev, cur] = months.slice(-2);
    const pc = spend(cur), pp = spend(prev);
    if (pp > 0) {
      const pct = Math.round(((pc - pp) / pp) * 100);
      if (pct >= 20) out.push({ id: 'spike', title: `Spending up ${pct}% vs last month`, detail: `Recorded spending moved from Rf ${(pp / 100).toLocaleString()} to Rf ${(pc / 100).toLocaleString()}. Tap to inspect the underlying transactions.`, severity: 'warn', txnFilter: { month: cur } });
      else if (pct <= -20) out.push({ id: 'dip', title: `Spending down ${Math.abs(pct)}% — well held`, detail: `From Rf ${(pp / 100).toLocaleString()} to Rf ${(pc / 100).toLocaleString()}. Consider moving the difference to a goal.`, severity: 'good' });
    }
    // category movers
    const cats = [...new Set(pool.map((t) => t.category))];
    for (const c of cats) {
      const a = spend(cur, c), b = spend(prev, c);
      if (b > 5000 && a - b > 5000) {
        out.push({ id: `cat-${c}`, title: `${c} rose sharply`, detail: `Rf ${(b / 100).toLocaleString()} → Rf ${(a / 100).toLocaleString()} month over month.`, severity: 'warn', txnFilter: { category: c, month: cur } });
        break;
      }
    }
    // savings rate
    const inc = income(cur);
    if (inc > 0) {
      const rate = Math.round(((inc - pc) / inc) * 100);
      if (rate >= 10) out.push({ id: 'save-ok', title: `Savings rate ${rate}%`, detail: `You kept Rf ${((inc - pc) / 100).toLocaleString()} of Rf ${(inc / 100).toLocaleString()} recorded income.`, severity: 'good' });
      else if (rate < 0) out.push({ id: 'save-neg', title: 'Spending exceeded income', detail: `Recorded outflow beat income by Rf ${((pc - inc) / 100).toLocaleString()} this month.`, severity: 'bad' });
    }
  }

  // budget pace
  const thisMonth = months[months.length - 1];
  const dayOfMonth = new Date().getDate();
  const pace = dayOfMonth / 30;
  for (const b of budgets) {
    const s = b.category === 'all'
      ? spend(thisMonth)
      : spend(thisMonth, b.category);
    if (s > b.limitLaari) out.push({ id: `over-${b.category}`, title: `Over budget: ${b.category}`, detail: `Rf ${(s / 100).toLocaleString()} against Rf ${(b.limitLaari / 100).toLocaleString()}.`, severity: 'bad', txnFilter: { category: b.category } });
    else if (pace > 0.15 && s / b.limitLaari > pace + 0.25) out.push({ id: `pace-${b.category}`, title: `Likely to exceed: ${b.category}`, detail: `${Math.round((s / b.limitLaari) * 100)}% used with ~${30 - dayOfMonth} days left in a typical month.`, severity: 'warn', txnFilter: { category: b.category } });
  }

  // cash vs bank
  const cash = pool.filter((t) => t.type === 'cash_withdrawal').reduce((s, t) => s + t.amountLaari, 0);
  const total = spend(months[months.length - 1]);
  if (total > 0 && cash / total > 0.5) out.push({ id: 'cash-heavy', title: 'Cash-heavy month', detail: `${Math.round((cash / total) * 100)}% of recorded outflow came from ATM withdrawals — easy to lose track. Log cash purchases to stay clear.`, severity: 'info' });

  return out.slice(0, 5);
}
