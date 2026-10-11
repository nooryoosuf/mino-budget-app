import { describe, expect, it } from 'vitest';
import { csvSafe, formatMVR, laariToMvr, parseMvrToLaari } from './money';
import { fingerprint, parseSmsMessage } from './bmlParser';
import { categorize } from './categorize';
import { calcSafeToSpend } from './safeToSpend';
import { csvToDrafts, splitCsvLine } from './csv';
import { buildInsights } from './insights';
import type { Txn } from './types';

describe('money (integer laari)', () => {
  it('parses MVR strings without float error', () => {
    expect(parseMvrToLaari('250.00')).toBe(25000);
    expect(parseMvrToLaari('1,250.50')).toBe(125050);
    expect(parseMvrToLaari('Rf 35')).toBe(3500);
    expect(parseMvrToLaari('abc')).toBeNull();
    expect(parseMvrToLaari('12.345')).toBeNull();
  });
  it('0.1 + 0.2 style sums stay exact in laari', () => {
    const a = parseMvrToLaari('0.10')! + parseMvrToLaari('0.20')!;
    expect(a).toBe(30);
    expect(laariToMvr(a)).toBe(0.3);
  });
  it('formats MVR with sign conventions', () => {
    expect(formatMVR(125000)).toContain('1,250.00');
    expect(formatMVR(-5000)).toContain('−');
  });
  it('neutralises CSV formula injection', () => {
    expect(csvSafe('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvSafe('normal')).toBe('normal');
  });
});

describe('BML SMS parser', () => {
  it('parses debit with balance separated from amount', () => {
    const r = parseSmsMessage('BML: MVR 1,250.00 debited at STO MALE on 05/10/2026. Bal: MVR 8,400.00.');
    expect(r.ok).toBe(true);
    expect(r.parsed?.amountLaari).toBe(125000);
    expect(r.parsed?.balanceLaari).toBe(840000);
    expect(r.parsed?.type).toBe('expense');
  });
  it('classifies salary credit as income, not generic', () => {
    const r = parseSmsMessage('BML: MVR 18,500.00 credited from MINISTRY SALARY on 01/10/2026.');
    expect(r.parsed?.type).toBe('income');
  });
  it('treats refunds distinctly', () => {
    const r = parseSmsMessage('BML: MVR 450.00 refund from REDWAVE credited on 07/10/2026.');
    expect(r.parsed?.type).toBe('refund');
  });
  it('refuses to invent transactions for unknown formats', () => {
    const r = parseSmsMessage('Hello, your OTP is 482910. Do not share.');
    expect(r.ok).toBe(false);
    expect(r.parsed).toBeNull();
  });
  it('fingerprints duplicates deterministically', () => {
    expect(fingerprint('expense', 125000, 'sto male', '2026-10-05')).toBe(
      fingerprint('expense', 125000, 'STO  MALE', '2026-10-05'),
    );
  });
});

describe('categorization', () => {
  it('prefers user rules, then memory, then hints, with reasons', () => {
    const rules = [{ id: '1', match: 'STO', category: 'groceries' }];
    expect(categorize('STO MALE', rules, {}).category).toBe('groceries');
    expect(categorize('MY CAFE', [], { 'MY CAFE': 'food' }).confidence).toBeGreaterThanOrEqual(0.8);
    const unsure = categorize('XYZ UNKNOWN QWERTY', [], {});
    expect(unsure.confidence).toBeLessThan(0.5);
    expect(unsure.reason).toMatch(/review/i);
  });
});

describe('safe-to-spend', () => {
  const base = { openingBalanceLaari: 850000, upcoming: [], savingsCommitLaari: 0, expectedIncomeLaari: 0, daysLeft: 10 };
  it('ignores internal transfers, nets refunds', () => {
    const mk = (type: Txn['type'], amountLaari: number): Txn => ({
      id: type, date: '2026-10-05', merchant: 'X', category: 'other', amountLaari, currency: 'MVR', type, source: 'manual', reviewed: true, createdAt: '', updatedAt: '',
    });
    const r = calcSafeToSpend({
      ...base,
      txns: [mk('income', 100000), mk('expense', 50000), mk('refund', 10000), mk('internal_transfer', 999999)],
    });
    // 8500 + 1000 − (500−100) = 9100
    expect(r.safeLaari).toBe(910000);
    expect(r.perDayLaari).toBe(91000);
  });
  it('warns on withdrawal + manual cash double-count risk', () => {
    const mk = (type: Txn['type'], category: string, source: Txn['source'] = 'manual'): Txn => ({
      id: Math.random().toString(), date: '2026-10-05', merchant: 'X', category, amountLaari: 10000, currency: 'MVR', type, source, reviewed: true, createdAt: '', updatedAt: '',
    });
    const r = calcSafeToSpend({ ...base, txns: [mk('cash_withdrawal', 'cash'), mk('expense', 'cash')] });
    expect(r.warnings.some((w) => /double-count/i.test(w))).toBe(true);
  });
});

describe('CSV import', () => {
  it('handles quoted commas in merchant names', () => {
    expect(splitCsvLine('"2026-10-05","STO, MALE BRANCH","1,250.00"')).toEqual(['2026-10-05', 'STO, MALE BRANCH', '1,250.00']);
  });
  it('accepts DD/MM/YYYY and debit/credit columns', () => {
    const drafts = csvToDrafts('date,description,debit,credit\n05/10/2026,STO MALE,1250.00,\n01/10/2026,SALARY,,18500.00');
    expect(drafts[0].date).toBe('2026-10-05');
    expect(drafts[0].typeGuess).toBe('expense');
    expect(drafts[1].typeGuess).toBe('income');
    expect(drafts.every((d) => d.errors.length === 0)).toBe(true);
  });
  it('flags bad rows instead of silently importing', () => {
    const drafts = csvToDrafts('date,merchant,amount\nnot-a-date,X,abc');
    expect(drafts[0].errors.length).toBeGreaterThan(0);
  });
});

describe('insights', () => {
  const mk = (date: string, type: Txn['type'], amountLaari: number, category = 'groceries'): Txn => ({
    id: `${date}-${type}-${amountLaari}`, date, merchant: 'T', category, amountLaari, currency: 'MVR', type, source: 'manual', reviewed: true, createdAt: '', updatedAt: '',
  });
  it('stays silent with thin data', () => {
    expect(buildInsights([mk('2026-10-01', 'expense', 100)], [])).toEqual([]);
  });
  it('detects a spending spike with numbers', () => {
    const txns = [
      mk('2026-09-05', 'expense', 100000), mk('2026-09-06', 'expense', 100000),
      mk('2026-09-07', 'income', 2000000),
      mk('2026-10-05', 'expense', 500000), mk('2026-10-06', 'expense', 500000),
      mk('2026-10-07', 'income', 2000000), mk('2026-10-08', 'expense', 100000),
    ];
    const ins = buildInsights(txns, []);
    expect(ins.some((i) => /up .*%/i.test(i.title))).toBe(true);
  });
});
