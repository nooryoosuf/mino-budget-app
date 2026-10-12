import { useState, type ComponentType } from 'react';
import { AnimatePresence } from 'framer-motion';
import { Download, KeyRound, Plus, ShieldCheck, Sparkles, Trash2 } from 'lucide-react';
import { CatIcon } from '../components/CatIcon';
import Dropdown from '../components/Dropdown';
import { COLOR_CHOICES, ICON_CHOICES, allCategories } from '../lib/categories';
import { icons } from 'lucide-react';
import GlassDemo from '../components/glass/GlassDemo';
import { brainActive, getBrainKey, pingBrain, setBrainKey, setBrainOn } from '../lib/mino/brain';
import { parseMvrToLaari, uid } from '../lib/money';
import type { Store } from '../lib/store';
import { Btn, Card, Field, SectionTitle, cx, inputCls } from '../components/ui';

export default function Settings({ store }: { store: Store }) {
  const { state } = store;
  const [ruleMatch, setRuleMatch] = useState('');
  const [ruleCat, setRuleCat] = useState('groceries');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showLab, setShowLab] = useState(false);

  const exportCsv = () => {
    const rows = [['date', 'merchant', 'type', 'category', 'amount_mvr', 'account', 'notes', 'source', 'reviewed']];
    for (const t of state.txns) {
      const esc = (s: string) => (/^[=+\-@]/.test(s) ? `'${s}` : /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
      rows.push([t.date, esc(t.merchant), t.type, t.category, (t.amountLaari / 100).toFixed(2), esc(t.account ?? ''), esc(t.notes ?? ''), t.source, String(t.reviewed)]);
    }
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mino-export.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle kicker="Profile" title="Your setup" />
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Name (on-device only)">
            <input value={state.prefs.displayName} onChange={(e) => store.setPrefs({ displayName: e.target.value })} placeholder="Aisha" className={inputCls} />
          </Field>
          <Field label="Opening balance (MVR)" hint="Last verified balance you trust. Recorded — not live.">
            <input value={(state.prefs.openingBalanceLaari / 100).toString()} inputMode="decimal" onChange={(e) => { const v = parseMvrToLaari(e.target.value); if (v !== null && v >= 0) store.setPrefs({ openingBalanceLaari: v }); }} className={inputCls} />
          </Field>
          <Field label="Demo data" hint="Synthetic Malé ledger for exploring. Never mixes silently.">
            <div className="flex gap-2">
              {!state.demoMode
                ? <Btn variant="soft" onClick={() => store.enableDemo()}>Load demo</Btn>
                : <Btn variant="ghost" onClick={() => store.disableDemo()}>Exit demo</Btn>}
            </div>
          </Field>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle kicker="Optional · free" title="Mino's AI brain" />
        <BrainSetup />
      </Card>

      <Card className="p-5">
        <SectionTitle kicker="Personalize" title="Your categories" />
        <AddCategory store={store} />
        {state.customCats.length > 0 && (
          <ul className="mt-3 space-y-2">
            {state.customCats.map((c) => (
              <li key={c.key} className="flex items-center gap-3 rounded-2xl bg-black/[0.03] px-3 py-2 text-sm font-semibold dark:bg-white/[0.05]">
                <CatIcon cat={c.key} customs={state.customCats} size={34} />
                {c.label}
                <button onClick={() => store.removeCustomCat(c.key)} className="ml-auto rounded-lg p-1.5 text-[var(--muted)] hover:bg-red-500/10 hover:text-red-600" aria-label={`Delete ${c.label}`}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle kicker="Automation" title="Your categorization rules" />
        <p className="mb-3 text-xs text-[var(--muted)]">Rules run on-device. Merchant memory is learned when you correct a category — delete either any time.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_200px_auto]">
          <input value={ruleMatch} onChange={(e) => setRuleMatch(e.target.value)} placeholder="e.g. REDWAVE" className={inputCls} aria-label="Rule keyword" />
          <Dropdown label="Rule category" value={ruleCat} onChange={setRuleCat}
            options={allCategories(state.customCats).map((c) => ({ value: c.key, label: c.label }))} />
          <Btn variant="soft" onClick={() => {
            if (!ruleMatch.trim()) return;
            store.setRules([...state.rules, { id: `r-${Date.now()}`, match: ruleMatch.trim().toUpperCase(), category: ruleCat }]);
            setRuleMatch('');
          }}>Add rule</Btn>
        </div>
        <ul className="mt-3 space-y-1.5">
          {state.rules.map((r) => (
            <li key={r.id} className="flex items-center gap-2 rounded-2xl bg-black/[0.03] px-3 py-1.5 text-sm dark:bg-white/[0.05]">
              <KeyRound size={13} className="text-[var(--muted)]" />
              <span>“<b>{r.match}</b>” → {r.category}</span>
              <button onClick={() => store.setRules(state.rules.filter((x) => x.id !== r.id))} className="ml-auto text-xs font-bold text-red-600 underline">remove</button>
            </li>
          ))}
          {Object.entries(state.learned).map(([m, c]) => (
            <li key={m} className="flex items-center gap-2 rounded-xl bg-black/5 px-3 py-1.5 text-sm dark:bg-white/5">
              <span>Learned: <b>{m}</b> → {c}</span>
              <button onClick={() => store.forgetLearned(m)} className="ml-auto text-xs font-bold underline">forget</button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="p-5">
        <SectionTitle kicker="Privacy" title="Your data stays here" />
        <ul className="space-y-1.5 text-sm text-[var(--muted)]">
          <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-amber-600" /> Local-first: records live in this browser's storage. No account, no tracking, no analytics beacons.</li>
          <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-amber-600" /> We never ask for bank logins, PINs, OTPs or card codes — and never will.</li>
          <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-amber-600" /> Imports are parsed on-device. Raw SMS text is kept only as a short reference on the transaction, never uploaded.</li>
          <li className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0 text-amber-600" /> Browser storage is convenient, not encrypted vault storage — export regularly if these records matter.</li>
        </ul>
        <div className="mt-4 flex flex-wrap gap-2">
          <Btn variant="soft" onClick={exportCsv}><Download size={15} /> Export CSV</Btn>
          <Btn variant="soft" onClick={() => {
            const blob = new Blob([store.exportJson()], { type: 'application/json' });
            const a = document.createElement('a');
            a.href = URL.createObjectURL(blob); a.download = 'mino-backup.json'; a.click();
            URL.revokeObjectURL(a.href);
          }}><Download size={15} /> Backup JSON</Btn>
          <Btn variant="soft" onClick={() => setShowLab(true)}><Sparkles size={15} /> Liquid Glass lab</Btn>
          {!confirmDelete ? (
            <Btn variant="danger" onClick={() => setConfirmDelete(true)}><Trash2 size={15} /> Delete all data</Btn>
          ) : (
            <span className="flex items-center gap-2 text-sm">
              <b>Really erase everything on this device?</b>
              <Btn variant="danger" onClick={() => { store.resetAll(); setConfirmDelete(false); }}>Yes, erase</Btn>
              <Btn variant="ghost" onClick={() => setConfirmDelete(false)}>Keep</Btn>
            </span>
          )}
        </div>
      </Card>

      <Card className="p-5 text-xs text-[var(--muted)]">
        <SectionTitle kicker="Honest boundaries" title="What this version does not do" />
        <ul className="list-disc space-y-1 pl-5">
          <li>No automatic SMS reading — browsers can't watch your inbox. Paste alerts instead; the parser is ready for a future Android companion.</li>
          <li>No live BML balance — figures are <b>recorded</b>, derived from your opening balance plus entries.</li>
          <li>No cloud sync in this build — the schema (accounts, txns, budgets, goals, imports, merchants, rules) is documented in README for a future Supabase layer with RLS.</li>
          <li>No Dhivehi UI yet — typography reserves RTL-safe alignment, but localization is unverified.</li>
        </ul>
      </Card>
      <AnimatePresence>
        {showLab && <GlassDemo onClose={() => setShowLab(false)} />}
      </AnimatePresence>
    </div>
  );
}

function BrainSetup() {
  const [key, setKey] = useState(getBrainKey() ?? '');
  const [on, setOn] = useState(brainActive());
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const saved = !!getBrainKey();

  const save = () => {
    const k = key.trim();
    if (!k) return;
    setBrainKey(k);
    setBrainOn(true);
    setOn(true);
    setMsg('Key saved on this device. Test the connection below.');
  };
  const test = async () => {
    const k = key.trim() || getBrainKey() || '';
    if (!k) return;
    setTesting(true);
    setMsg(null);
    const ok = await pingBrain(k);
    setTesting(false);
    setMsg(ok ? 'Connected — Mino can use the AI brain now.' : 'That key didn\'t work — check it in Google AI Studio and try again.');
  };

  return (
    <div className="space-y-3">
      <p className="text-xs leading-relaxed text-[var(--muted)]">
        Mino works fully offline. Add a <b>free Google AI Studio key</b> and he'll also
        understand trickier phrasing. What's sent per question: your words plus monthly
        totals and counts — <b>never</b> raw transactions, SMS text, or your full history.
        The key stays on this device; remove it anytime to go offline-only.
      </p>
      <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer"
        className="press inline-flex h-10 items-center rounded-full bg-[var(--surface-2)] px-4 text-sm font-bold">
        Get a free key ↗
      </a>
      <div className="flex gap-2">
        <input
          type="password" value={key} onChange={(e) => setKey(e.target.value)}
          placeholder="Paste AI Studio key" aria-label="Gemini API key"
          className={`${inputCls} font-mono`} autoComplete="off" spellCheck={false}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Btn variant="soft" onClick={save}>Save key</Btn>
        <Btn variant="ghost" onClick={test}> {testing ? 'Testing…' : 'Test connection'}</Btn>
        {saved && (
          <Btn variant="ghost" onClick={() => { setBrainKey(null); setKey(''); setOn(false); setMsg('Key removed — Mino is offline-only again.'); }}>
            Remove
          </Btn>
        )}
      </div>
      {saved && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={on} onChange={(e) => { setBrainOn(e.target.checked); setOn(e.target.checked); }} className="h-4 w-4 accent-[var(--accent)]" />
          AI brain {on ? 'on' : 'paused'}
        </label>
      )}
      {msg && <p className="text-[13px] font-medium" role="status">{msg}</p>}
    </div>
  );
}

function AddCategory({ store }: { store: Store }) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('Plane');
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const done = name.trim().length >= 2;

  return (
    <div className="rounded-[20px] bg-black/[0.03] p-3.5 dark:bg-white/[0.04]">
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Island trips" className={inputCls} aria-label="New category name" maxLength={24} />
      <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Icon</p>
      <div className="grid grid-cols-11 gap-1" role="radiogroup" aria-label="Category icon">
        {ICON_CHOICES.map((n) => {
          const Cmp = (icons as unknown as Record<string, ComponentType<{ size?: number; strokeWidth?: number }>>)[n];
          const on = icon === n;
          return (
            <button key={n} role="radio" aria-checked={on} aria-label={n} onClick={() => setIcon(n)}
              className={cx('press flex aspect-square items-center justify-center rounded-xl transition', on ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-black/5 text-[var(--muted)] dark:bg-white/8')}>
              {Cmp ? <Cmp size={16} strokeWidth={2.2} /> : null}
            </button>
          );
        })}
      </div>
      <p className="mb-1.5 mt-3 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--muted)]">Color</p>
      <div className="flex gap-1.5" role="radiogroup" aria-label="Category color">
        {COLOR_CHOICES.map((c) => (
          <button key={c} role="radio" aria-checked={color === c} aria-label={c} onClick={() => setColor(c)}
            className={cx('press h-8 w-8 rounded-full transition', color === c && 'ring-2 ring-[var(--ink)] ring-offset-2 ring-offset-[var(--surface)]')}
            style={{ background: c }} />
        ))}
      </div>
      <Btn variant="soft" onClick={() => {
        if (!done) return;
        const key = `custom-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}-${Date.now().toString(36)}`;
        store.addCustomCat({ key, label: name.trim(), icon, color });
        setName('');
      }}>
        <Plus size={15} /> Add category
      </Btn>
    </div>
  );
}
