/** Robust CSV parsing: quoted fields, commas in merchants, date/decimal variants, per-row validation. */
import { parseMvrToLaari } from './money';

export interface CsvRow { data: Record<string, string>; line: number; }
export interface CsvTxnDraft {
  line: number;
  date: string;
  merchant: string;
  amountLaari: number;
  typeGuess: 'income' | 'expense';
  errors: string[];
}

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { out.push(cur); cur = ''; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsv(text: string): { headers: string[]; rows: CsvRow[]; error?: string } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { headers: [], rows: [], error: 'CSV needs a header row plus at least one data row.' };
  const headers = splitCsvLine(lines[0]).map((h) => h.toLowerCase());
  const rows = lines.slice(1).map((line, i) => {
    const cells = splitCsvLine(line);
    const data: Record<string, string> = {};
    headers.forEach((h, j) => { data[h] = cells[j] ?? ''; });
    return { data, line: i + 2 };
  });
  return { headers, rows };
}

function normDate(raw: string): string | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const dd = m[1].padStart(2, '0'), mm = m[2].padStart(2, '0');
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    // assume dd/mm/yyyy (Maldives convention)
    return `${yyyy}-${mm}-${dd}`;
  }
  m = s.match(/^(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  if (m) {
    const dd = m[1].padStart(2, '0'), mm = m[2].padStart(2, '0');
    const yyyy = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

const findCol = (data: Record<string, string>, names: string[]) =>
  names.map((n) => data[n]).find((v) => v !== undefined && v !== '') ?? '';

export function csvToDrafts(text: string): CsvTxnDraft[] {
  const { rows, error } = parseCsv(text);
  if (error) return [{ line: 1, date: '', merchant: '', amountLaari: 0, typeGuess: 'expense', errors: [error] }];
  return rows.map(({ data, line }) => {
    const errors: string[] = [];
    const dateRaw = findCol(data, ['date', 'txn date', 'transaction date', 'value date']);
    const merchRaw = findCol(data, ['merchant', 'description', 'narrative', 'counterparty', 'details', 'payee']);
    const amtRaw = findCol(data, ['amount', 'amount (mvr)', 'mvr', 'debit', 'credit', 'value']);
    const typeRaw = findCol(data, ['type', 'direction', 'dr/cr', 'drcr']).toLowerCase();
    const date = normDate(dateRaw);
    if (!date) errors.push(`Line ${line}: unrecognized date “${dateRaw || '—'}”. Use YYYY-MM-DD or DD/MM/YYYY.`);
    if (!merchRaw) errors.push(`Line ${line}: merchant/description is empty.`);
    // handle separate debit/credit columns
    let laari: number | null = null;
    let guess: 'income' | 'expense' = 'expense';
    if (data['debit'] !== undefined || data['credit'] !== undefined) {
      const d = (data['debit'] ?? '').trim();
      const c = (data['credit'] ?? '').trim();
      if (d && !c) { laari = parseMvrToLaari(d); guess = 'expense'; }
      else if (c && !d) { laari = parseMvrToLaari(c); guess = 'income'; }
      else if (d || c) errors.push(`Line ${line}: ambiguous debit/credit pair.`);
      else errors.push(`Line ${line}: both debit and credit are empty.`);
    } else {
      laari = parseMvrToLaari(amtRaw);
      if (typeRaw.includes('credit') || typeRaw.includes('cr') || typeRaw.includes('in')) guess = 'income';
      else if ((amtRaw.trim().startsWith('-') || typeRaw.includes('debit') || typeRaw.includes('dr'))) guess = 'expense';
      if (laari !== null) laari = Math.abs(laari);
    }
    if (laari === null || laari === 0) {
      if (laari === 0) errors.push(`Line ${line}: zero amount — confirm this is a real transaction.`);
      else errors.push(`Line ${line}: amount “${amtRaw || '—'}” is not a valid number.`);
      laari = 0;
    }
    return { line, date: date ?? '', merchant: merchRaw || `Row ${line}`, amountLaari: laari, typeGuess: guess, errors };
  });
}
