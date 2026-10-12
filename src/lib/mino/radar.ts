/**
 * Unusual-spending radar — deterministic anomaly flags over recorded data.
 * Conservative by design: every detector needs minimum history, and every
 * flag links to the underlying transactions. Never accuses, only surfaces.
 */
import { fingerprint } from '../bmlParser';
import { categoryLabel } from '../categories';
import { fmt, incomeOf, isOut, monthKey } from './tools';
import type { StoreShape } from '../store';
import type { Txn } from '../types';

export interface Flag {
  id: string;
  severity: 'bad' | 'warn' | 'info';
  title: string;
  detail: string;
  merchant?: string;
}

const DAY = 86400000;

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

export function detectAnomalies(s: StoreShape, now = new Date()): Flag[] {
  const flags: Flag[] = [];
  const since = new Date(now.getTime() - 60 * DAY).toISOString().slice(0, 10);
  const window = s.txns.filter((t) => t.date >= since && isOut(t));
  if (window.length < 4) return [];

  // 1 — possible duplicates: same merchant + amount within 3 days
  const seen = new Map<string, Txn[]>();
  for (const t of window) {
    const k = `${t.type}|${t.amountLaari}|${t.merchant.trim().toUpperCase()}`;
    seen.set(k, [...(seen.get(k) ?? []), t]);
  }
  for (const [k, list] of seen) {
    if (list.length < 2) continue;
    const dates = list.map((t) => new Date(t.date).getTime()).sort((a, b) => a - b);
    const close = dates.some((d, i) => i > 0 && d - dates[i - 1] <= 3 * DAY);
    // exact same-day fingerprint dupes count even without the window check
    const exact = new Set(list.map((t) => fingerprint(t.type, t.amountLaari, t.merchant, t.date))).size < list.length;
    if (close || exact) {
      const [type, amt, merch] = k.split('|');
      void type;
      flags.push({
        id: `dup-${k}`, severity: 'warn', title: 'Possible duplicate',
        detail: `${merch} · ${fmt(Number(amt))} appears ${list.length} times close together — tap to check whether both are real.`,
        merchant: merch,
      });
      break; // one duplicate flag is enough noise
    }
  }

  // 2 — category spike: recent txn > 3× the category median (needs history)
  const recent = window.filter((t) => new Date(t.date).getTime() > now.getTime() - 14 * DAY);
  for (const t of recent) {
    const peers = window.filter((x) => x.category === t.category && x.id !== t.id).map((x) => x.amountLaari);
    if (peers.length < 5) continue;
    const med = median(peers);
    if (med > 0 && t.amountLaari > med * 3) {
      flags.push({
        id: `spike-${t.id}`, severity: 'warn', title: 'Unusually large',
        detail: `${t.merchant} · ${fmt(t.amountLaari)} is about ${Math.round(t.amountLaari / med)}× your usual ${categoryLabel(t.category, s.customCats).toLowerCase()} spend (${fmt(med)} median).`,
        merchant: t.merchant,
      });
      break;
    }
  }

  // 3 — pricier than usual at a familiar merchant (≥3 visits)
  const byMerch = new Map<string, Txn[]>();
  for (const t of window) {
    const k = t.merchant.trim().toUpperCase();
    byMerch.set(k, [...(byMerch.get(k) ?? []), t]);
  }
  for (const [merch, list] of byMerch) {
    if (list.length < 4) continue;
    const sorted = [...list].sort((a, b) => b.date.localeCompare(a.date));
    const [latest, ...rest] = sorted;
    const avg = rest.reduce((a, t) => a + t.amountLaari, 0) / rest.length;
    if (avg > 0 && latest.amountLaari > avg * 1.6) {
      flags.push({
        id: `price-${merch}`, severity: 'info', title: 'Pricier than usual',
        detail: `${merch} · ${fmt(latest.amountLaari)} vs your usual ${fmt(Math.round(avg))} there. Prices change — just making sure you noticed.`,
        merchant: merch,
      });
      break;
    }
  }

  // 4 — single outflow dwarfing the month's income
  const mk = monthKey(0, now);
  const monthIncome = incomeOf(s.txns.filter((t) => t.date.slice(0, 7) === mk));
  if (monthIncome > 0) {
    const big = s.txns
      .filter((t) => t.date.slice(0, 7) === mk && isOut(t) && t.amountLaari > monthIncome * 0.4)
      .sort((a, b) => b.amountLaari - a.amountLaari)[0];
    if (big) {
      flags.push({
        id: `big-${big.id}`, severity: 'bad', title: 'Major outflow',
        detail: `${big.merchant} · ${fmt(big.amountLaari)} is over 40% of this month's recorded income. Worth a second look.`,
        merchant: big.merchant,
      });
    }
  }

  const order = { bad: 0, warn: 1, info: 2 } as const;
  return flags.sort((a, b) => order[a.severity] - order[b.severity]).slice(0, 4);
}
