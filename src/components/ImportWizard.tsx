import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import { SAMPLE_SMS, fingerprint, parseSmsMessage } from '../lib/bmlParser';
import { categorize } from '../lib/categorize';
import { csvToDrafts } from '../lib/csv';
import { formatMVR, uid } from '../lib/money';
import type { Store } from '../lib/store';
import type { Txn } from '../lib/types';
import { Badge, Btn, inputCls } from './ui';

type Step = 'choose' | 'preview' | 'done';

export default function ImportWizard({ store, onDone, initialText = '' }: { store: Store; onDone: () => void; initialText?: string }) {
  const [step, setStep] = useState<Step>('choose');
  const [tab, setTab] = useState<'sms' | 'csv'>('sms');
  const [text, setText] = useState(initialText);
  const [report, setReport] = useState<{ imported: number; skipped: number; notes: string[] }>({ imported: 0, skipped: 0, notes: [] });

  const smsDrafts = useMemo(() => {
    if (tab !== 'sms' || !text.trim()) return [];
    return text.split(/\n{2,}|\n(?=BML:)/g).map((s) => s.trim()).filter(Boolean).map((raw, i) => {
      const r = parseSmsMessage(raw);
      const cat = r.parsed ? categorize(r.parsed.merchant, store.state.rules, store.state.learned, r.parsed.type).category : 'other';
      return { key: `sms-${i}`, raw, result: r, cat, checked: r.ok };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, tab]);

  const csvDrafts = useMemo(() => (tab === 'csv' && text.trim() ? csvToDrafts(text) : []), [text, tab]);

  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const isChecked = (k: string, fallback: boolean) => (k in checks ? checks[k] : fallback);

  const confirm = () => {
    const existing = new Set(store.state.txns.map((t) => fingerprint(t.type, t.amountLaari, t.merchant, t.date)));
    const sessionId = uid();
    const toAdd: Omit<Txn, 'id' | 'createdAt' | 'updatedAt'>[] = [];
    const notes: string[] = [];
    let skipped = 0;

    if (tab === 'sms') {
      for (const d of smsDrafts) {
        if (!isChecked(d.key, d.checked)) { skipped++; continue; }
        if (!d.result.ok || !d.result.parsed) { skipped++; notes.push(`Skipped: “${d.raw.slice(0, 48)}…” — ${d.result.errors[0] ?? 'uncertain'}`); continue; }
        const p = d.result.parsed;
        const fp = fingerprint(p.type, p.amountLaari, p.merchant, p.date ?? new Date().toISOString().slice(0, 10));
        if (existing.has(fp)) { skipped++; notes.push(`Duplicate skipped: ${p.merchant} ${formatMVR(p.amountLaari)}`); continue; }
        existing.add(fp);
        toAdd.push({
          amountLaari: p.amountLaari, currency: p.currency, type: p.type, merchant: p.merchant,
          category: d.cat, date: p.date ?? new Date().toISOString().slice(0, 10), source: 'sms',
          reviewed: d.result.confidence >= 0.8,
          importMeta: { sessionId, parserId: d.result.parserId, parserVersion: d.result.parserVersion, confidence: d.result.confidence, rawRef: d.raw.slice(0, 120) },
        });
      }
    } else {
      for (const d of csvDrafts) {
        const k = `csv-${d.line}`;
        if (!isChecked(k, d.errors.length === 0)) { skipped++; continue; }
        if (d.errors.length > 0) { skipped++; notes.push(`Line ${d.line}: ${d.errors.join(' ')}`); continue; }
        const cat = categorize(d.merchant, store.state.rules, store.state.learned, d.typeGuess === 'income' ? 'income' : 'expense').category;
        const type = d.typeGuess === 'income' ? 'income' : 'expense';
        const fp = fingerprint(type, d.amountLaari, d.merchant, d.date);
        if (existing.has(fp)) { skipped++; notes.push(`Line ${d.line}: duplicate skipped.`); continue; }
        existing.add(fp);
        toAdd.push({ amountLaari: d.amountLaari, currency: 'MVR', type, merchant: d.merchant.toUpperCase(), category: cat, date: d.date, source: 'csv', reviewed: false, importMeta: { sessionId } });
      }
    }
    store.addMany(toAdd);
    setReport({ imported: toAdd.length, skipped, notes });
    setStep('done');
  };

  if (step === 'done') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-800 dark:text-amber-200">
          <CheckCircle2 size={18} /> Imported {report.imported} · skipped {report.skipped}. Nothing was uploaded anywhere.
        </div>
        {report.notes.length > 0 && (
          <ul className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-[var(--line)] p-3 text-xs text-[var(--muted)]">
            {report.notes.map((n, i) => <li key={i}>• {n}</li>)}
          </ul>
        )}
        <Btn onClick={onDone}>Done</Btn>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-black/5 p-1.5 dark:bg-white/5">
        {(['sms', 'csv'] as const).map((t) => (
          <button key={t} onClick={() => { setTab(t); setText(''); }} className={`rounded-xl px-3 py-2 text-sm font-semibold ${tab === t ? 'bg-[var(--surface)] shadow' : 'text-[var(--muted)]'}`}>
            {t === 'sms' ? 'Pasted SMS' : 'CSV file / paste'}
          </button>
        ))}
      </div>
      {tab === 'sms' ? (
        <>
          <p className="text-xs text-[var(--muted)]">Paste the BML alert (sender <b>455</b>) exactly as it arrived — or Share it straight from your SMS app to Mino. Parsed on-device; uncertain messages stay unchecked. <br />Websites can't read your inbox automatically, so paste-or-share is the honest path for now.</p>
          <div className="flex flex-wrap gap-1.5">
            {SAMPLE_SMS.slice(0, 3).map((s, i) => (
              <button key={i} onClick={() => setText((t) => (t ? t + '\n' + s : s))} className="rounded-full border border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted)] hover:bg-black/5">
                + sample {i + 1}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="text-xs text-[var(--muted)]">Headers like <code>date,merchant,amount</code> or <code>date,description,debit,credit</code>. Handles quotes, commas, DD/MM/YYYY. <button className="font-bold underline" onClick={() => setText('date,merchant,amount,type\n2026-10-05,STO MALE,1250.00,debit\n2026-10-06,MTCC FERRY,35.00,debit\n2026-10-01,MINISTRY SALARY,18500.00,credit')}>Insert example</button></p>
          <label className="block rounded-xl border border-dashed border-[var(--line)] p-3 text-center text-xs font-semibold text-[var(--muted)]">
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.size > 2_000_000) { setText(''); alert('File too large (2 MB cap for safety).'); return; }
              setText(await f.text());
            }} />
            <span className="inline-flex cursor-pointer items-center gap-1.5"><Copy size={13} /> Choose a .csv file (stays on this device)</span>
          </label>
        </>
      )}
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={5} placeholder={tab === 'sms' ? 'BML: MVR 1,250.00 debited at STO MALE on 05/10/2026…' : 'date,merchant,amount,…'} className={inputCls} aria-label="Import input" />

      {(smsDrafts.length > 0 || csvDrafts.length > 0) && (
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">Preview — check only what is correct</p>
          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {tab === 'sms' ? smsDrafts.map((d) => (
              <label key={d.key} className={`flex items-start gap-2.5 rounded-2xl p-3 text-sm ${d.result.ok ? 'bg-black/[0.04] dark:bg-white/[0.06]' : 'bg-red-500/8'}`}>
                <input type="checkbox" checked={isChecked(d.key, d.checked)} onChange={(e) => setChecks((c) => ({ ...c, [d.key]: e.target.checked }))} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                <span className="min-w-0">
                  {d.result.ok && d.result.parsed ? (
                    <>
                      <span className="font-semibold">{d.result.parsed.merchant}</span>{' '}
                      <span className="tnum">{formatMVR(d.result.parsed.amountLaari)}</span>{' '}
                      <Badge tone={d.result.confidence >= 0.8 ? 'good' : 'warn'}>{d.result.parserId} · {Math.round(d.result.confidence * 100)}%</Badge>
                      {d.result.warnings.map((w, i) => <span key={i} className="mt-0.5 flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300"><AlertTriangle size={11} />{w}</span>)}
                    </>
                  ) : (
                    <span className="text-red-700 dark:text-red-300 text-xs font-medium">{d.result.errors[0]} <span className="text-[var(--muted)]">“{d.raw.slice(0, 60)}…”</span></span>
                  )}
                </span>
              </label>
            )) : csvDrafts.map((d) => (
              <label key={d.line} className={`flex items-start gap-2.5 rounded-2xl p-3 text-sm ${d.errors.length ? 'bg-red-500/8' : 'bg-black/[0.04] dark:bg-white/[0.06]'}`}>
                <input type="checkbox" checked={isChecked(`csv-${d.line}`, d.errors.length === 0)} onChange={(e) => setChecks((c) => ({ ...c, [`csv-${d.line}`]: e.target.checked }))} className="mt-1 h-4 w-4 accent-[var(--accent)]" />
                <span>
                  <span className="font-semibold">{d.merchant}</span> <span className="tnum">{formatMVR(d.amountLaari)}</span> <span className="text-xs text-[var(--muted)]">{d.date} · line {d.line}</span>
                  {d.errors.map((e, i) => <span key={i} className="block text-[11px] text-red-600">{e}</span>)}
                </span>
              </label>
            ))}
          </div>
          <div className="flex gap-2">
            <Btn onClick={confirm}>Confirm import</Btn>
            <Btn variant="ghost" onClick={() => { setText(''); setChecks({}); }}>Clear</Btn>
          </div>
        </div>
      )}
    </div>
  );
}
