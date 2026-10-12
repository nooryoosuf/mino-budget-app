/**
 * Mino AI brain — optional Gemini free-tier intent router.
 *
 * The model NEVER answers money questions itself and NEVER sees raw
 * transactions. It receives one question + monthly aggregates, and must
 * reply with exactly one `finance_intent` function call. Trusted local
 * code (src/lib/mino/tools.ts + answer.ts) then does the maths and the
 * talking. Any failure → silent fallback to the offline engine.
 *
 * Key storage: user-provided, on-device localStorage only, sent straight
 * to Google from the browser. No backend, no proxy — disclosed in Settings.
 */
import { allCategories } from '../categories';
import type { StoreShape } from '../store';
import { monthKey, summarizeMonth } from './tools';
import { parseIntent } from './parse';
import { respond, suggestionsFor } from './answer';
import type { MinoProvider } from './provider';
import { minoProvider } from './provider';
import type { Intent } from './parse';
import type { MinoAnswer } from './types';

export const BRAIN_MODEL = 'gemini-2.0-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${BRAIN_MODEL}:generateContent`;
const KEY_LS = 'mino-brain-key';
const ON_LS = 'mino-brain-on';

export function getBrainKey(): string | null {
  try {
    return localStorage.getItem(KEY_LS);
  } catch {
    return null;
  }
}

export function setBrainKey(key: string | null): void {
  try {
    if (key) {
      localStorage.setItem(KEY_LS, key);
      localStorage.setItem(ON_LS, '1');
    } else {
      localStorage.removeItem(KEY_LS);
      localStorage.removeItem(ON_LS);
    }
  } catch { /* private mode */ }
}

export function setBrainOn(on: boolean): void {
  try {
    localStorage.setItem(ON_LS, on ? '1' : '0');
  } catch { /* private mode */ }
}

export function brainActive(): boolean {
  try {
    return !!localStorage.getItem(KEY_LS) && localStorage.getItem(ON_LS) !== '0';
  } catch {
    return false;
  }
}

/** Validate a key with one tiny call — true only on a real model reply. */
export async function pingBrain(key: string): Promise<boolean> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15000);
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: ok' }] }] }),
    });
    clearTimeout(timer);
    if (!res.ok) return false;
    const json = await res.json();
    return Array.isArray(json?.candidates) && json.candidates.length > 0;
  } catch {
    return false;
  }
}
/** Minimal aggregates only — counts and monthly totals, never raw history. */
export function buildBrainContext(s: StoreShape): Record<string, unknown> {
  const cur = summarizeMonth(s, 0);
  const cats = allCategories(s.customCats).map((c) => c.key);
  return {
    monthLabel: cur.label,
    monthIncomeMvr: Math.round(cur.income / 100),
    monthExpenseMvr: Math.round(cur.expense / 100),
    transactionsThisMonth: cur.n,
    totalTransactions: s.txns.length,
    paydayDay: s.prefs.paydayDay,
    openingBalanceMvr: Math.round(s.prefs.openingBalanceLaari / 100),
    categoryKeys: cats,
    budgets: s.budgets.map((b) => ({ category: b.category, limitMvr: Math.round(b.limitLaari / 100) })),
    goals: s.goals.map((g) => ({ name: g.name, targetMvr: Math.round(g.targetLaari / 100) })),
    upcomingBills: s.recurring.slice(0, 6).map((r) => ({ name: r.name, mvr: Math.round(r.amountLaari / 100), date: r.nextDate })),
    unreviewedCount: s.txns.filter((t) => !t.reviewed).length,
    lastMonthKey: monthKey(-1),
  };
}

const SYSTEM = `You route one user question to exactly one finance_intent call for the Mino budgeting app (Maldives, MVR currency).
Rules: amounts are plain MVR numbers. category must be a key from the context's categoryKeys. Offsets: 0 = this month, -1 = last month. If the question is a greeting, small talk, or you truly cannot map it, use kind "unknown". Output ONLY the function call, no text.`;

function declaration(s: StoreShape): Record<string, unknown> {
  return {
    name: 'finance_intent',
    description: 'Route the user question to one finance intent',
    parameters: {
      type: 'OBJECT',
      properties: {
        kind: {
          type: 'STRING',
          enum: ['afford', 'plan', 'spend-week', 'spend-month', 'spend-category', 'spend-merchant', 'income', 'saved', 'compare', 'biggest', 'budgets', 'balance', 'payday', 'upcoming', 'ontrack', 'goal-plan', 'goal-create', 'budget-set', 'budget-change', 'bulk-file', 'frequent', 'radar', 'greet', 'help', 'unknown'],
        },
        amountMvr: { type: 'NUMBER' },
        item: { type: 'STRING' },
        category: { type: 'STRING', enum: allCategories(s.customCats).map((c) => c.key) },
        merchant: { type: 'STRING' },
        offset: { type: 'NUMBER', enum: [0, -1] },
        name: { type: 'STRING' },
        targetMvr: { type: 'NUMBER' },
        months: { type: 'NUMBER' },
        deltaMvr: { type: 'NUMBER' },
      },
      required: ['kind'],
    },
  };
}

interface FnCall { name: string; args: Record<string, unknown> }

async function classify(key: string, question: string, s: StoreShape): Promise<FnCall | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${ENDPOINT}?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM }] },
        tools: [{ function_declarations: [declaration(s)] }],
        tool_config: { function_calling_config: { mode: 'ANY', allowed_function_names: ['finance_intent'] } },
        contents: [{
          role: 'user',
          parts: [{ text: `Context:\n${JSON.stringify(buildBrainContext(s))}\n\nQuestion: ${question.slice(0, 500)}` }],
        }],
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const parts = json?.candidates?.[0]?.content?.parts ?? [];
    for (const p of parts) {
      if (p?.functionCall?.name === 'finance_intent') return p.functionCall as FnCall;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

/** Map a validated function call onto our local Intent union. */
export function mapFnCall(fc: FnCall, s: StoreShape): Intent {
  const a = fc.args ?? {};
  const validCat = (c: string) => (allCategories(s.customCats).some((x) => x.key === c) ? c : null);
  switch (fc.name === 'finance_intent' ? String(a.kind) : '') {
    case 'afford': {
      const amt = num(a.amountMvr);
      if (amt === null || amt <= 0) return { kind: 'unknown' };
      return { kind: 'afford', amountLaari: Math.round(amt * 100), item: str(a.item).slice(0, 40) || 'this' };
    }
    case 'spend-month': return { kind: 'spend-month', offset: num(a.offset) === -1 ? -1 : 0 };
    case 'spend-category': {
      const c = validCat(str(a.category));
      return c ? { kind: 'spend-category', category: c, raw: c, offset: num(a.offset) === -1 ? -1 : 0 } : { kind: 'unknown' };
    }
    case 'spend-merchant':
      return str(a.merchant).trim().length >= 2 ? { kind: 'spend-merchant', merchant: str(a.merchant).trim().slice(0, 30) } : { kind: 'unknown' };
    case 'income': return { kind: 'income', offset: num(a.offset) === -1 ? -1 : 0 };
    case 'goal-plan': {
      const t = num(a.targetMvr);
      return t !== null && t > 0 ? { kind: 'goal-plan', targetLaari: Math.round(t * 100), months: num(a.months) } : { kind: 'unknown' };
    }
    case 'goal-create': {
      const t = num(a.targetMvr);
      return { kind: 'goal-create', name: str(a.name).slice(0, 40) || 'savings goal', targetLaari: t !== null && t > 0 ? Math.round(t * 100) : null, months: num(a.months) };
    }
    case 'budget-set': {
      const c = validCat(str(a.category));
      const t = num(a.amountMvr);
      return c && t !== null && t > 0 ? { kind: 'budget-set', category: c, raw: c, amountLaari: Math.round(t * 100) } : { kind: 'unknown' };
    }
    case 'budget-change': {
      const c = validCat(str(a.category));
      const d = num(a.deltaMvr);
      return c && d !== null && d !== 0 ? { kind: 'budget-change', category: c, raw: c, deltaLaari: Math.round(d * 100) } : { kind: 'unknown' };
    }
    case 'bulk-file': {
      const c = validCat(str(a.category));
      return c ? { kind: 'bulk-file', category: c, raw: c } : { kind: 'unknown' };
    }
    case 'plan': case 'spend-week': case 'saved': case 'compare': case 'biggest':
    case 'budgets': case 'balance': case 'payday': case 'upcoming': case 'ontrack':
    case 'frequent': case 'radar': case 'greet': case 'help':
      return { kind: String(a.kind) } as Intent;
    default:
      return { kind: 'unknown' };
  }
}

export class GeminiProvider implements MinoProvider {
  readonly id = `gemini:${BRAIN_MODEL}`;
  constructor(private key: string) {}
  async answer(input: string, state: StoreShape): Promise<MinoAnswer> {
    const fc = await classify(this.key, input, state);
    if (!fc) return respond(input, parseIntent(input, state), state);
    try {
      return respond(input, mapFnCall(fc, state), state);
    } catch {
      return respond(input, parseIntent(input, state), state);
    }
  }
  suggestions(state: StoreShape): string[] {
    return suggestionsFor(state);
  }
}

/** Active brain: Gemini when a key is saved & enabled, otherwise offline. */
export function getProvider(): MinoProvider {
  const key = getBrainKey();
  if (key && brainActive()) return new GeminiProvider(key);
  return minoProvider;
}
