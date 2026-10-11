import { useEffect, useMemo, useState } from 'react';
import type { Budget, CustomCat, Goal, Prefs, Recurring, Rule, Txn } from './types';
import { uid } from './money';

const KEY = 'ruh-mv-v1';

export interface StoreShape {
  txns: Txn[];
  budgets: Budget[];
  goals: Goal[];
  recurring: Recurring[];
  rules: Rule[];
  learned: Record<string, string>;
  customCats: CustomCat[];
  prefs: Prefs;
  demoMode: boolean;
  onboardingDone: boolean;
}

const defaults: StoreShape = {
  txns: [],
  budgets: [],
  goals: [],
  recurring: [
    { id: 'r-stelco', name: 'STELCO electricity', amountLaari: 95000, category: 'utilities', frequency: 'monthly', nextDate: isoPlus(6) },
    { id: 'r-ooredoo', name: 'Ooredoo postpaid', amountLaari: 54900, category: 'utilities', frequency: 'monthly', nextDate: isoPlus(9) },
  ],
  rules: [
    { id: 'rule-sto', match: 'STO', category: 'groceries', note: 'Supermarket' },
    { id: 'rule-ferry', match: 'FERRY', category: 'transport' },
    { id: 'rule-stelco', match: 'STELCO', category: 'utilities' },
  ],
  learned: {},
  customCats: [],
  prefs: { openingBalanceLaari: 850000, paydayDay: 28, salaryAmountLaari: 1850000, salaryFreq: 'monthly', displayName: '' },
  demoMode: false,
  onboardingDone: false,
};

function isoPlus(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function load(): StoreShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

/** Demo ledger: synthetic October 2026 Malé life — NEVER mixed silently with real data. */
export function demoTxns(): Txn[] {
  const now = new Date().toISOString();
  const t = (id: string, date: string, merchant: string, category: string, amountLaari: number, type: Txn['type']): Txn => ({
    id, date, merchant, category, amountLaari, type, currency: 'MVR', source: 'demo', reviewed: true, createdAt: now, updatedAt: now,
  });
  return [
    t('d1', '2026-10-01', 'MINISTRY SALARY', 'salary', 1850000, 'income'),
    t('d2', '2026-10-02', 'STO MALE', 'groceries', 125000, 'expense'),
    t('d3', '2026-10-03', 'AISHATH L. (FAVARA)', 'family', 500000, 'external_transfer'),
    t('d4', '2026-10-04', 'REDWAVE', 'groceries', 84200, 'expense'),
    t('d5', '2026-10-05', 'MTCC FERRY', 'transport', 3500, 'expense'),
    t('d6', '2026-10-05', 'KOFFEE HULHUMALE', 'food', 18500, 'expense'),
    t('d7', '2026-10-06', 'BML ATM WITHDRAWAL', 'cash', 200000, 'cash_withdrawal'),
    t('d8', '2026-10-06', 'STELCO', 'utilities', 91200, 'expense'),
    t('d9', '2026-10-07', 'ADK PHARMACY', 'health', 34000, 'expense'),
    t('d10', '2026-10-07', 'REDWAVE REFUND', 'groceries', 12000, 'refund'),
    t('d11', '2026-09-01', 'MINISTRY SALARY', 'salary', 1850000, 'income'),
    t('d12', '2026-09-12', 'STO MALE', 'groceries', 210000, 'expense'),
    t('d13', '2026-09-15', 'MAAFANNU MARKET', 'groceries', 96000, 'expense'),
    t('d14', '2026-09-20', 'OOREDOO', 'utilities', 54900, 'expense'),
    t('d15', '2026-09-25', 'RENT — HULHUMALE', 'housing', 750000, 'expense'),
  ];
}

export function useStore() {
  const [state, setState] = useState<StoreShape>(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch { /* quota — keep in memory */ }
  }, [state]);

  const api = useMemo(() => ({
    state,
    addTxn: (t: Omit<Txn, 'id' | 'createdAt' | 'updatedAt'>) =>
      setState((s) => ({ ...s, txns: [{ ...t, id: uid(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }, ...s.txns] })),
    updateTxn: (id: string, patch: Partial<Txn>) =>
      setState((s) => ({ ...s, txns: s.txns.map((t) => (t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t)) })),
    removeTxn: (id: string) => setState((s) => ({ ...s, txns: s.txns.filter((t) => t.id !== id) })),
    addMany: (list: Omit<Txn, 'id' | 'createdAt' | 'updatedAt'>[]) =>
      setState((s) => {
        const now = new Date().toISOString();
        const withIds = list.map((t) => ({ ...t, id: uid(), createdAt: now, updatedAt: now }));
        return { ...s, txns: [...withIds, ...s.txns] };
      }),
    clearTxns: () => setState((s) => ({ ...s, txns: [] })),
    setBudgets: (b: Budget[]) => setState((s) => ({ ...s, budgets: b })),
    setGoals: (g: Goal[]) => setState((s) => ({ ...s, goals: g })),
    setRecurring: (r: Recurring[]) => setState((s) => ({ ...s, recurring: r })),
    setRules: (r: Rule[]) => setState((s) => ({ ...s, rules: r })),
    addCustomCat: (c: CustomCat) => setState((s) => ({ ...s, customCats: [...s.customCats, c] })),
    removeCustomCat: (key: string) => setState((s) => ({
      ...s,
      customCats: s.customCats.filter((c) => c.key !== key),
      txns: s.txns.map((t) => (t.category === key ? { ...t, category: 'other' as const } : t)),
    })),
    learn: (merchant: string, category: string) =>
      setState((s) => ({ ...s, learned: { ...s.learned, [merchant.trim().toUpperCase()]: category } })),
    forgetLearned: (merchant: string) =>
      setState((s) => {
        const next = { ...s.learned };
        delete next[merchant];
        return { ...s, learned: next };
      }),
    setPrefs: (p: Partial<Prefs>) => setState((s) => ({ ...s, prefs: { ...s.prefs, ...p } })),
    enableDemo: () => setState((s) => ({ ...s, demoMode: true, txns: demoTxns() })),
    disableDemo: () => setState((s) => ({ ...s, demoMode: false, txns: [] })),
    finishOnboarding: () => setState((s) => ({ ...s, onboardingDone: true })),
    resetAll: () => { localStorage.removeItem(KEY); setState({ ...defaults, onboardingDone: true }); },
    exportJson: () => JSON.stringify(state, null, 2),
  }), [state]);

  return api;
}

export type Store = ReturnType<typeof useStore>;
