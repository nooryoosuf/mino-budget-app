/** Money helpers. All math in integer laari; never float for ledger values. Rounding = half away from zero. */

export const LAARI_PER_MVR = 100;

/** Parse user-entered decimal string -> laari int. Returns null when invalid. */
export function parseMvrToLaari(input: string): number | null {
  if (typeof input !== 'string') return null;
  const s = input.trim().replace(/,/g, '').replace(/Rf\.?|MVR/i, '').trim();
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const sign = whole.startsWith('-') ? -1 : 1;
  const w = Math.abs(parseInt(whole, 10));
  const f = parseInt((frac + '00').slice(0, 2), 10);
  if (Number.isNaN(w) || Number.isNaN(f)) return null;
  return sign * (w * 100 + f);
}

export function laariToMvr(laari: number): number {
  return Math.trunc(laari) / 100;
}

export function formatMVR(laari: number, opts: { decimals?: number; sign?: boolean } = {}): string {
  const { decimals = 2, sign = false } = opts;
  const v = laari / 100;
  const body = new Intl.NumberFormat('en-MV', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(v));
  const neg = v < 0;
  const prefix = neg ? '−' : sign && v > 0 ? '+' : '';
  return `${prefix}Rf ${body}`;
}

export function formatCompactMVR(laari: number): string {
  const v = laari / 100;
  const abs = Math.abs(v);
  const sign = v < 0 ? '−' : '';
  if (abs >= 1000000) return `${sign}Rf ${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}Rf ${(abs / 1000).toFixed(1)}k`;
  return formatMVR(laari, { decimals: 0 });
}

/** Escape a CSV cell to prevent formula injection on export (=,+,-,@,tab). */
export function csvSafe(cell: string): string {
  if (/^[=+\-@\t\r]/.test(cell)) return `'${cell}`;
  if (/[",\n]/.test(cell)) return `"${cell.replace(/"/g, '""')}"`;
  return cell;
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
