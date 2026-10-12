import { describe, expect, it } from 'vitest';
import { SAMPLE_SMS } from './bmlParser';
import { handleIncomingSms } from './smsAuto';
import type { Store } from './store';
import type { Txn } from './types';

function fakeStore(txns: Txn[] = []): Store {
  const state = {
    txns,
    budgets: [], goals: [], recurring: [],
    rules: [{ id: 'r', match: 'STO', category: 'groceries' }],
    learned: {}, customCats: [],
    prefs: { openingBalanceLaari: 0, paydayDay: 28, salaryAmountLaari: 0, salaryFreq: 'monthly' as const, displayName: '' },
    demoMode: false, onboardingDone: true,
  };
  return {
    state,
    addTxn: (t) => {
      state.txns = [{ ...t, id: `t${state.txns.length}`, createdAt: '', updatedAt: '' }, ...state.txns];
    },
  } as unknown as Store;
}

describe('455 auto-import pipeline', () => {
  it('imports a sample alert, then flags the repeat as duplicate', () => {
    const store = fakeStore();
    const first = handleIncomingSms(SAMPLE_SMS[0], store);
    expect(first.status).toBe('imported');
    expect(store.state.txns.length).toBe(1);
    expect(store.state.txns[0].source).toBe('sms');
    const second = handleIncomingSms(SAMPLE_SMS[0], store);
    expect(second.status).toBe('duplicate');
    expect(store.state.txns.length).toBe(1);
  });
  it('refuses garbage instead of inventing', () => {
    const store = fakeStore();
    const r = handleIncomingSms('Hello, your OTP is 482910', store);
    expect(r.status).toBe('needs-review');
    expect(store.state.txns.length).toBe(0);
  });
});
