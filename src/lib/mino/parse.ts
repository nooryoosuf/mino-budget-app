/**
 * Mino NLU — small, deterministic, English-first.
 * Regex intents over lowercased input; amounts in MVR; categories resolved
 * against built-ins + the user's customs. Anything unmatched → 'unknown'
 * (the composer answers honestly instead of guessing).
 */
import type { StoreShape } from '../store';
import { parseMvrToLaari } from '../money';
import { resolveCategory } from './tools';

export type Intent =
  | { kind: 'afford'; amountLaari: number; item: string }
  | { kind: 'plan' }
  | { kind: 'spend-week' }
  | { kind: 'spend-month'; offset: 0 | -1 }
  | { kind: 'spend-category'; category: string; raw: string; offset: 0 | -1 }
  | { kind: 'spend-merchant'; merchant: string }
  | { kind: 'income'; offset: 0 | -1 }
  | { kind: 'saved' }
  | { kind: 'compare' }
  | { kind: 'biggest' }
  | { kind: 'budgets' }
  | { kind: 'balance' }
  | { kind: 'payday' }
  | { kind: 'upcoming' }
  | { kind: 'ontrack' }
  | { kind: 'goal-plan'; targetLaari: number; months: number | null }
  | { kind: 'goal-create'; name: string; targetLaari: number | null; months: number | null }
  | { kind: 'frequent' }
  | { kind: 'budget-set'; category: string; raw: string; amountLaari: number }
  | { kind: 'budget-change'; category: string; raw: string; deltaLaari: number }
  | { kind: 'bulk-file'; category: string; raw: string }
  | { kind: 'greet' }
  | { kind: 'help' }
  | { kind: 'unknown' };

export function extractMvr(text: string): number | null {
  const m = text.match(/(?:mvr|rf\.?)\s*([\d,]+(?:\.\d{1,2})?)|([\d,]+(?:\.\d{1,2})?)\s*(?:mvr|rf\.?|rufiyaa)/i);
  const raw = m?.[1] ?? m?.[2];
  if (!raw) return null;
  return parseMvrToLaari(raw);
}

export function rangeOffset(t: string): 0 | -1 {
  return /last month|previous month/.test(t) ? -1 : 0;
}

export function extractMonths(t: string): number | null {
  const m = t.match(/in\s+(\d{1,2})\s*months?|(\d{1,2})\s*months?/);
  const n = m ? Number(m[1] ?? m[2]) : NaN;
  return Number.isFinite(n) && n > 0 && n <= 120 ? n : null;
}

/** "create a saving for Vacation" → "Vacation". */
export function cleanGoalName(t: string): string {
  return t
    .replace(/^(please\s+|hey mino,?\s*|mino,?\s*)/, '')
    .replace(/^(create|start|make|add|open|set up|set)\s+(a|an|new|my)?\s*/, '')
    .replace(/\s*(savings?|saving|goal)(\s+for)?\s*/, ' ')
    .replace(/\s+for\s+/, ' ')
    .replace(/(mvr|rf\.?|rufiyaa)\s*[\d,.]+/gi, ' ')
    .replace(/in\s+\d{1,2}\s*months?/g, ' ')
    .replace(/\b(a|an|the|my|me|to|please)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[a-z]/, (c) => c.toUpperCase())
    .slice(0, 40);
}

export function parseIntent(raw: string, s: StoreShape): Intent {
  const t = raw.trim().toLowerCase();
  if (!t) return { kind: 'unknown' };

  if (/^(hi|hey|hello|yo|assalam)/.test(t) && t.length < 30) return { kind: 'greet' };

  // affordability — needs an amount
  if (/afford|can i buy|should i buy|worth (it|buying)/.test(t)) {
    const amountLaari = extractMvr(t);
    if (amountLaari === null || amountLaari <= 0) {
      return { kind: 'unknown' };
    }
    const item = t.replace(/.*?(afford|buy|worth( it| buying)?)/, '').replace(/(mvr|rf\.?).*/i, '').trim().replace(/^a |^an |^the /, '') || 'this';
    return { kind: 'afford', amountLaari, item };
  }

  // payday plan
  if (/payday|until (pay|salary)|survive|make it to|plan (my|this|the) (money|month|spending)|stretch/.test(t)) {
    return { kind: 'plan' };
  }

  // budget set / change — "set my food budget to 2000", "reduce shopping by 300"
  {
    const m = t.match(/(?:set|make|change)(?: my)? ([a-z &'-]+?) budget (?:to|at|=)\s*(.+)/);
    if (m) {
      const cat = resolveCategory(s, m[1]);
      const amt = extractMvr(m[2]);
      if (cat && amt !== null && amt > 0) return { kind: 'budget-set', category: cat, raw: m[1].trim(), amountLaari: amt };
    }
    const m2 = t.match(/(reduce|lower|cut|increase|raise|add to)(?: my)? ([a-z &'-]+?) budget by\s*(.+)/);
    if (m2) {
      const cat = resolveCategory(s, m2[2]);
      const amt = extractMvr(m2[3]);
      if (cat && amt !== null && amt > 0) {
        const dir = /reduce|lower|cut/.test(m2[1]) ? -1 : 1;
        return { kind: 'budget-change', category: cat, raw: m2[2].trim(), deltaLaari: dir * amt };
      }
    }
  }

  // savings goals — create-first ("create a saving for Vacation"), then planning
  if (/sav(e|ing|ings)|goal|trip|set aside|put aside/.test(t)) {
    const amt = extractMvr(t);
    const months = extractMonths(t);
    const wantsCreate = /creat|start|new|add|open|make me/.test(t);
    if (wantsCreate) {
      const name = cleanGoalName(t);
      return { kind: 'goal-create', name: name || 'savings goal', targetLaari: amt && amt > 0 ? amt : null, months };
    }
    if (amt !== null && amt > 0) {
      return { kind: 'goal-plan', targetLaari: amt, months };
    }
    if (/on track|am i (doing )?(ok|good|fine)|progress/.test(t)) return { kind: 'ontrack' };
  }
  if (/on track|how am i doing/.test(t)) return { kind: 'ontrack' };

  if (/^(help|what can you|how do you work|abilities)|help me understand|show me what you can/.test(t)) return { kind: 'help' };

  // bulk filing — "file (all) unreviewed as groceries"
  {
    const m = t.match(/(?:file|mark|categorize)(?: all)?(?: my)? unreviewed (?:as|to) ([a-z &'-]+)/);
    if (m) {
      const cat = resolveCategory(s, m[1]);
      if (cat) return { kind: 'bulk-file', category: cat, raw: m[1].trim() };
    }
  }

  // most common / frequent spending
  if (/most (common|frequent)|most often|repeat|regularly|keeps? showing up|where.*most/.test(t)) return { kind: 'frequent' };

  // comparisons
  if (/compar|versus|\bvs\b|last month|previous month/.test(t) && /spend|month/.test(t)) return { kind: 'compare' };
  // biggest
  if (/biggest|largest|top spend|most expensive/.test(t)) return { kind: 'biggest' };
  // over budget
  if (/over ?budget|exceed|overspend|which budget/.test(t)) return { kind: 'budgets' };
  if (/budget/.test(t) && /(status|left|remain|how)/.test(t)) return { kind: 'budgets' };
  if (/budget/.test(t) && t.length < 40 && !/set|reduce|increase/.test(t)) return { kind: 'budgets' };
  // payday countdown
  if (/days.*(left|payday|salary)|when.*(payday|salary|paid)|payday|salary date/.test(t) && !/plan|spend|save/.test(t)) return { kind: 'payday' };
  // upcoming
  if (/upcoming|bills|due|recurring|obligations|what.*(pay|come)/.test(t)) return { kind: 'upcoming' };
  // balance
  if (/balance|how much (do i have|money|have i got)|available|net worth|total.*(have|got)/.test(t)) return { kind: 'balance' };
  // saved this month
  if (/sav(e|ed|ings)|keep|kept|left over/.test(t) && /month|this/.test(t)) return { kind: 'saved' };
  // income
  if (/salary|earn|income|paid|paycheck|allowance/.test(t)) return { kind: 'income', offset: rangeOffset(t) };
  // week
  if (/this week|past (7|seven) days|last 7 days/.test(t)) return { kind: 'spend-week' };
  // merchant — "spent at STO", "at Redwave", "merchant X"
  {
    const m = t.match(/(?:spen[dt].*?at|at|from|merchant)\s+([a-z0-9 .&'*-]{2,30}?)(\?|$| last| this)/);
    if (m && /spend|spent|at |merchant|from /.test(t)) {
      const merch = m[1].trim();
      if (merch.length >= 2 && !/^(the|my|this|last|month|week)$/.test(merch)) return { kind: 'spend-merchant', merchant: merch };
    }
  }
  // category + period — "food last month", "how much on transport"
  {
    const m = t.match(/(?:spen[dt].*?on|on|for)\s+([a-z &'-]{3,24}?)(?:\s+(last|this)\s+(week|month))?(\?|$)/);
    if (m && /spend|spent|cost|much/.test(t)) {
      const cat = resolveCategory(s, m[1]);
      if (cat) {
        const off: 0 | -1 = m[2] === 'last' ? -1 : 0;
        return { kind: 'spend-category', category: cat, raw: m[1].trim(), offset: off };
      }
    }
    // bare "where did my money go"
    if (/where.*(money|salary|go|spent)|breakdown|summary/.test(t)) {
      return rangeOffset(t) === -1 ? { kind: 'spend-month', offset: -1 } : { kind: 'spend-month', offset: 0 };
    }
  }
  // month totals
  if (/this month|month.*spend|spend.*month/.test(t)) return { kind: 'spend-month', offset: rangeOffset(t) };

  return { kind: 'unknown' };
}
