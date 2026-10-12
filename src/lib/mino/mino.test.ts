import { describe, expect, it } from 'vitest';
import { minoProvider } from './provider';
import { parseIntent, extractMvr, cleanGoalName } from './parse';
import { detectAnomalies } from './radar';
import { evaluatePurchase, outflowOf, proposeBudgetUpdate, savingsPlan, searchMerchant } from './tools';
import type { StoreShape } from '../store';
import type { Txn } from '../types';

const mk = (over: Partial<Txn> & { date: string; type: Txn['type']; amountLaari: number }): Txn => ({
  id: Math.random().toString(), merchant: 'TEST', category: 'food', currency: 'MVR',
  source: 'manual', reviewed: true, createdAt: '', updatedAt: '', ...over,
});

function state(): StoreShape {
  return {
    txns: [
      mk({ date: '2026-10-01', type: 'income', amountLaari: 1850000, merchant: 'MINISTRY SALARY', category: 'salary' }),
      mk({ date: '2026-10-02', type: 'expense', amountLaari: 125000, merchant: 'STO MALE', category: 'groceries' }),
      mk({ date: '2026-10-03', type: 'expense', amountLaari: 3500, merchant: 'MTCC FERRY', category: 'transport' }),
      mk({ date: '2026-09-05', type: 'expense', amountLaari: 200000, merchant: 'STO MALE', category: 'groceries' }),
    ],
    budgets: [{ id: 'b1', name: 'Food budget', category: 'food', period: 'monthly', limitLaari: 200000, startDate: '2026-10-01', rollover: false, alertAtPct: 80 }],
    goals: [],
    recurring: [{ id: 'r1', name: 'STELCO', amountLaari: 95000, category: 'utilities', frequency: 'monthly', nextDate: '2026-10-20' }],
    rules: [], learned: {}, customCats: [],
    prefs: { openingBalanceLaari: 850000, paydayDay: 28, salaryAmountLaari: 1850000, salaryFreq: 'monthly', displayName: 'Aisha' },
    demoMode: false, onboardingDone: true,
  };
}

describe('mino amounts', () => {
  it('extracts MVR figures for affordability', () => {
    expect(extractMvr('Can I afford MVR 8,000?')).toBe(800000);
    expect(extractMvr('phone for Rf 12500')).toBe(1250000);
    expect(extractMvr('hello there')).toBeNull();
  });
});

describe('mino intents', () => {
  const s = state();
  it('routes common questions', () => {
    expect(parseIntent('Where did my money go?', s).kind).toBe('spend-month');
    expect(parseIntent('Can I afford MVR 8,000 phone?', s)).toMatchObject({ kind: 'afford', amountLaari: 800000 });
    expect(parseIntent('Plan my money until payday', s).kind).toBe('plan');
    expect(parseIntent('How much at STO?', s)).toMatchObject({ kind: 'spend-merchant' });
    expect(parseIntent('Set my food budget to MVR 2,000', s)).toMatchObject({ kind: 'budget-set', amountLaari: 200000 });
    expect(parseIntent('Which budgets are over?', s).kind).toBe('budgets');
    expect(parseIntent('Help me save MVR 15000 for a trip in 6 months', s)).toMatchObject({ kind: 'goal-plan', months: 6 });
    expect(parseIntent('Create a savings goal: MVR 15000 for trip', s).kind).toBe('goal-create');
    expect(parseIntent('Create a saving for Vacation', s)).toMatchObject({ kind: 'goal-create', targetLaari: null });
    expect(parseIntent('What is my most common expense?', s).kind).toBe('frequent');
    expect(parseIntent('blargh wibble', s).kind).toBe('unknown');
  });
});

describe('mino tools never invent', () => {
  const s = state();
  it('totals come from records', () => {
    const oct = s.txns.filter((t) => t.date.slice(0, 7) === '2026-10');
    expect(outflowOf(oct)).toBe(128500);
  });
  it('unknown merchants return zero matches', () => {
    expect(searchMerchant(s, 'NONEXISTENT SHOP XYZ').n).toBe(0);
  });
  it('affordability is arithmetic, not vibes', async () => {
    const a = await minoProvider.answer('Can I afford MVR 8,000?', s);
    expect(a.text).toMatch(/MVR/);
    expect(a.mood).toBe('happy');
    const v = evaluatePurchase(s, 5000000);
    expect(v.verdict).toBe('unwise');
    expect(v.remaining).toBeLessThan(0);
  });
  it('budget proposals validate', () => {
    expect(proposeBudgetUpdate(s, 'food', 0)).toMatchObject({ error: expect.any(String) });
    const p = proposeBudgetUpdate(s, 'food', 300000);
    expect(p).toMatchObject({ kind: 'budget-update' });
  });
  it('savings plans divide honestly', () => {
    const p = savingsPlan(s, 1500000, 6);
    expect(p.monthlyLaari).toBe(250000);
  });
  it('empty history gets honesty, not numbers', async () => {
    const empty = { ...s, txns: [] };
    const a = await minoProvider.answer('Where did my money go?', empty);
    expect(a.text).not.toMatch(/MVR [\d,]+/);
    expect(a.text).toMatch(/don't have anything/i);
  });
  it('goal without amount asks a follow-up, then proposes', async () => {
    expect(cleanGoalName('create a saving for vacation')).toBe('Vacation');
    const a = await minoProvider.answer('Create a saving for Vacation', s);
    expect(a.clarify?.draft.name).toBe('Vacation');
    expect(a.text).toMatch(/how much/i);
  });
  it('most-common expense uses counts from records', async () => {
    const a = await minoProvider.answer('What is my most common expense?', s);
    expect(a.text).toMatch(/STO MALE|shows up/i);
    expect(a.text).toMatch(/2 times|shows up/);
  });
  it('flags possible duplicates close together', () => {
    const dup = {
      ...s,
      txns: [
        ...s.txns,
        mk({ date: '2026-10-02', type: 'expense', amountLaari: 125000, merchant: 'STO MALE', category: 'groceries' }),
      ],
    };
    const flags = detectAnomalies(dup, new Date('2026-10-12T00:00:00'));
    expect(flags.some((f) => f.id.startsWith('dup-'))).toBe(true);
  });
  it('flags a spike against the category median', () => {
    const many = [5, 6, 7, 8, 9, 10].map((d) =>
      mk({ date: `2026-09-${d}`, type: 'expense', amountLaari: 20000, merchant: 'CORNER SHOP', category: 'groceries' }),
    );
    const spiky = {
      ...s,
      txns: [...s.txns, ...many, mk({ date: '2026-10-10', type: 'expense', amountLaari: 500000, merchant: 'BULK BUY', category: 'groceries' })],
    };
    const flags = detectAnomalies(spiky, new Date('2026-10-12T00:00:00'));
    expect(flags.some((f) => f.id.startsWith('spike-'))).toBe(true);
  });
  it('stays quiet with thin history', () => {
    expect(detectAnomalies({ ...s, txns: [] })).toEqual([]);
  });
  it('answers the watchdog question', async () => {
    const a = await minoProvider.answer('Anything unusual lately?', s);
    expect(a.text.length).toBeGreaterThan(20);
  });
});
