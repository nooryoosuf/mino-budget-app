/**
 * BML transaction SMS parsing foundation.
 * Modular, versioned adapters producing a normalized result. Deterministic only —
 * AI is never authoritative for amounts. Amount/balance distinction preserved.
 */
import type { TxnType } from './types';

export interface ParsedTxn {
  type: TxnType;
  /** laari minor units */
  amountLaari: number;
  merchant: string;
  /** laari balance when present in message */
  balanceLaari: number | null;
  date: string | null; // ISO yyyy-mm-dd when determinable
  currency: 'MVR' | 'USD';
  ref?: string;
}

export interface ParseResult {
  ok: boolean;
  parserId: string;
  parserVersion: string;
  confidence: number; // 0..1
  parsed: ParsedTxn | null;
  errors: string[];
  warnings: string[];
}

export interface ParserAdapter {
  id: string;
  version: string;
  /** quick check whether this adapter claims the message */
  matches: (msg: string) => boolean;
  parse: (msg: string) => ParseResult;
}

function toLaari(num: string): number {
  const clean = num.replace(/,/g, '');
  const [w, f = ''] = clean.split('.');
  return parseInt(w, 10) * 100 + parseInt((f + '00').slice(0, 2), 10);
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Adapter v1: "BML: MVR 1,250.00 debited ... at STO MALE ... Bal: MVR 8,400.00 ..." style (synthetic). */
const debitAdapter: ParserAdapter = {
  id: 'bml-debit-v1',
  version: '1.0.0',
  matches: (m) => /debited|debit|paid|purchase/i.test(m) && /(MVR|Rf)/i.test(m),
  parse: (msg) => {
    const errors: string[] = [];
    const warnings: string[] = [];
    const amt = msg.match(/(?:MVR|Rf\.?|MRf)\s*([\d,]+\.\d{2})/i);
    if (!amt) return { ok: false, parserId: 'bml-debit-v1', parserVersion: '1.0.0', confidence: 0, parsed: null, errors: ['No MVR amount found; refusing to guess.'], warnings };
    const bal = msg.match(/bal(?:ance)?\s*:?\s*(?:MVR|Rf\.?)?\s*([\d,]+\.\d{2})/i);
    const merch =
      msg.match(/(?:at|to|@)\s+([A-Za-z0-9 .&'*-]{2,40})(?=\s*(?:on|Bal|\.|$|\d{2}\/))/i)?.[1]?.trim() ??
      'Unknown merchant';
    if (/unknown merchant/i.test(merch)) warnings.push('Merchant not confidently identified — needs review.');
    const dateM = msg.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
    let date: string | null = null;
    if (dateM) {
      const [, d, mo, y] = dateM;
      const yyyy = y.length === 2 ? `20${y}` : y;
      date = `${yyyy}-${mo}-${d}`;
    } else {
      date = todayISO();
      warnings.push('No date in message; using today — verify.');
    }
    return {
      ok: true,
      parserId: 'bml-debit-v1',
      parserVersion: '1.0.0',
      confidence: /unknown merchant/i.test(merch) ? 0.55 : 0.85,
      parsed: {
        type: /atm|cash/i.test(msg) ? 'cash_withdrawal' : 'expense',
        amountLaari: toLaari(amt[1]),
        merchant: merch.toUpperCase(),
        balanceLaari: bal ? toLaari(bal[1]) : null,
        date,
        currency: 'MVR',
      },
      errors,
      warnings,
    };
  },
};

/** Adapter v2: credit "credited ... from ..." style (synthetic). */
const creditAdapter: ParserAdapter = {
  id: 'bml-credit-v1',
  version: '1.0.0',
  matches: (m) => /credited|credit|received|salary/i.test(m) && /(MVR|Rf)/i.test(m),
  parse: (msg) => {
    const warnings: string[] = [];
    const amt = msg.match(/(?:MVR|Rf\.?)\s*([\d,]+\.\d{2})/i);
    if (!amt) return { ok: false, parserId: 'bml-credit-v1', parserVersion: '1.0.0', confidence: 0, parsed: null, errors: ['No MVR amount found; refusing to guess.'], warnings };
    const from = msg.match(/(?:from|by)\s+([A-Za-z0-9 .&'*-]{2,40})/i)?.[1]?.trim() ?? 'Unknown sender';
    if (/unknown sender/i.test(from)) warnings.push('Sender not confidently identified — needs review.');
    const isSalary = /salary|payroll/i.test(msg);
    const dateM = msg.match(/(\d{2})\/(\d{2})\/(\d{2,4})/);
    return {
      ok: true,
      parserId: 'bml-credit-v1',
      parserVersion: '1.0.0',
      confidence: isSalary ? 0.9 : 0.75,
      parsed: {
        type: isSalary ? 'income' : /refund|reversal/i.test(msg) ? 'refund' : 'income',
        amountLaari: toLaari(amt[1]),
        merchant: from.toUpperCase(),
        balanceLaari: (() => {
          const b = msg.match(/bal(?:ance)?\s*:?\s*(?:MVR|Rf\.?)?\s*([\d,]+\.\d{2})/i);
          return b ? toLaari(b[1]) : null;
        })(),
        date: dateM ? `${dateM[3].length === 2 ? '20' + dateM[3] : dateM[3]}-${dateM[2]}-${dateM[1]}` : todayISO(),
        currency: 'MVR',
      },
      errors: [],
      warnings,
    };
  },
};

/** Adapter v3: transfer "Transferred MVR X to Y ... Ref: ..." style (synthetic). */
const transferAdapter: ParserAdapter = {
  id: 'bml-transfer-v1',
  version: '1.0.0',
  matches: (m) => /transfer/i.test(m),
  parse: (msg) => {
    const amt = msg.match(/(?:MVR|Rf\.?)\s*([\d,]+\.\d{2})/i);
    if (!amt) return { ok: false, parserId: 'bml-transfer-v1', parserVersion: '1.0.0', confidence: 0, parsed: null, errors: ['Transfer amount not found; refusing to guess.'], warnings: [] };
    const to = msg.match(/to\s+([A-Za-z0-9 .&'*-]{2,40})/i)?.[1]?.trim() ?? 'Unknown recipient';
    const ref = msg.match(/ref\s*:?\s*([A-Za-z0-9-]+)/i)?.[1];
    return {
      ok: true, parserId: 'bml-transfer-v1', parserVersion: '1.0.0', confidence: 0.8,
      parsed: { type: 'external_transfer', amountLaari: toLaari(amt[1]), merchant: to.toUpperCase(), balanceLaari: null, date: todayISO(), currency: 'MVR', ref },
      errors: [], warnings: ['Verify direction: outbound transfer assumed — confirm if this was incoming.'],
    };
  },
};

export const ADAPTERS: ParserAdapter[] = [transferAdapter, creditAdapter, debitAdapter];

/** Route a raw message through adapters; unknown formats return ok:false (never invent a txn). */
export function parseSmsMessage(raw: string): ParseResult {
  const msg = (raw ?? '').trim();
  if (!msg) return { ok: false, parserId: 'none', parserVersion: '1.0.0', confidence: 0, parsed: null, errors: ['Empty message.'], warnings: [] };
  for (const a of ADAPTERS) {
    if (a.matches(msg)) return a.parse(msg);
  }
  return { ok: false, parserId: 'unknown', parserVersion: '1.0.0', confidence: 0, parsed: null, errors: ['Unknown message format — needs manual entry or review.'], warnings: [] };
}

/** Duplicate fingerprint: type + amount + merchant-normalized + date. */
export function fingerprint(type: string, amountLaari: number, merchant: string, date: string): string {
  const m = merchant.trim().toUpperCase().replace(/\s+/g, ' ');
  return `${type}|${amountLaari}|${m}|${date}`;
}

export const SAMPLE_SMS = [
  'BML: MVR 1,250.00 debited at STO MALE on 05/10/2026. Bal: MVR 8,400.00.',
  'BML: MVR 18,500.00 credited from MINISTRY SALARY on 01/10/2026. Bal: MVR 21,300.00.',
  'BML: Transferred MVR 5,000.00 to AISHATH L. Ref: FAV-88213 on 03/10/2026.',
  'BML: MVR 800.00 debited at MTCC FERRY on 06/10/2026. Bal: MVR 7,600.00.',
  'BML: MVR 450.00 refund from REDWAVE credited on 07/10/2026. Bal: MVR 8,050.00.',
];
