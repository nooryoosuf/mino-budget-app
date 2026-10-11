/** Explainable categorization: rules -> learned merchant memory -> keyword hints. Never silently certain. */
import { CATEGORIES } from './categories';
import type { Rule } from './types';

export interface CatDecision {
  category: string;
  confidence: number; // 0..1
  reason: string;
}

export function categorize(
  merchant: string,
  rules: Rule[],
  learned: Record<string, string>,
  fallbackType?: string,
): CatDecision {
  const m = merchant.trim().toLowerCase();
  const rule = rules.find((r) => r.match && m.includes(r.match.toLowerCase()));
  if (rule) return { category: rule.category, confidence: 0.95, reason: `Matched your rule “${rule.match}”.` };
  const learnedHit = Object.entries(learned).find(([k]) => m.includes(k.toLowerCase()));
  if (learnedHit) return { category: learnedHit[1], confidence: 0.8, reason: `You filed “${learnedHit[0]}” here before.` };
  for (const c of CATEGORIES) {
    if (c.hint.some((h) => m.includes(h))) {
      if (fallbackType === 'income' && c.key !== 'salary') continue;
      return { category: c.key, confidence: 0.6, reason: `Keyword hint for ${c.label}. Please confirm.` };
    }
  }
  if (fallbackType === 'income') return { category: 'salary', confidence: 0.4, reason: 'Incoming — assumed income, confirm.' };
  if (fallbackType === 'cash_withdrawal') return { category: 'cash', confidence: 0.7, reason: 'ATM/cash pattern.' };
  return { category: 'other', confidence: 0.3, reason: 'No match — needs review.' };
}
