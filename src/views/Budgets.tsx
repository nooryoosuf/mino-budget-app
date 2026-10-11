import { useState } from 'react';
import { BellRing, Plus, Trash2 } from 'lucide-react';
import { allCategories, categoryLabel } from '../lib/categories';
import { CatIcon } from '../components/CatIcon';
import Dropdown from '../components/Dropdown';
import { daysUntilPayday } from '../lib/safeToSpend';
import type { Store } from '../lib/store';
import type { Budget } from '../lib/types';
import { parseMvrToLaari, uid, formatMVR } from '../lib/money';
import { Amount, Bar, Btn, Card, Empty, SectionTitle, inputCls } from '../components/ui';

export default function Budgets({ store }: { store: Store }) {
  const { state } = store;
  const [name, setName] = useState('');
  const [category, setCategory] = useState('groceries');
  const [limit, setLimit] = useState('');
  const [period, setPeriod] = useState<Budget['period']>('monthly');
  const month = new Date().toISOString().slice(0, 7);
  const customs = state.customCats;
  const cats = allCategories(customs);

  const spentFor = (b: Budget) =>
    state.txns
      .filter((t) => t.date.slice(0, 7) === month && (t.type === 'expense' || t.type === 'cash_withdrawal') && (b.category === 'all' || t.category === b.category))
      .reduce((s, t) => s + t.amountLaari, 0);

  const add = () => {
    const laari = parseMvrToLaari(limit);
    if (!name.trim() || laari === null || laari <= 0) return;
    store.setBudgets([...state.budgets, {
      id: uid(), name: name.trim(), category, period, limitLaari: laari,
      startDate: new Date().toISOString().slice(0, 10), rollover: false, alertAtPct: 80,
    }]);
    setName(''); setLimit('');
  };

  const payday = daysUntilPayday(state.prefs.paydayDay);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle kicker="Salary cycle" title={`Payday in ${payday.days} days`} />
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Payday (day of month)
            <input type="number" min={1} max={28} value={state.prefs.paydayDay} onChange={(e) => store.setPrefs({ paydayDay: Math.min(28, Math.max(1, Number(e.target.value))) })} className={`${inputCls} mt-1`} />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Expected salary (MVR)
            <input value={(state.prefs.salaryAmountLaari / 100).toString()} onChange={(e) => { const v = parseMvrToLaari(e.target.value); if (v !== null) store.setPrefs({ salaryAmountLaari: v }); }} className={`${inputCls} mt-1`} inputMode="decimal" />
          </label>
          <label className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Pay frequency
            <select value={state.prefs.salaryFreq} onChange={(e) => store.setPrefs({ salaryFreq: e.target.value as 'monthly' | 'biweekly' | 'weekly' | 'irregular' })} className={`${inputCls} mt-1`}>
              <option value="monthly">Monthly</option>
              <option value="biweekly">Every 2 weeks</option>
              <option value="weekly">Weekly</option>
              <option value="irregular">Irregular</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-xs text-[var(--muted)]">No judgment here — budgets are envelopes, not grades. Rollover is opt-in per budget.</p>
      </Card>

      <Card className="p-5">
        <SectionTitle kicker="New envelope" title="Create a budget" />
        <div className="grid gap-2 sm:grid-cols-[1fr_180px_140px_120px_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. October groceries" className={inputCls} aria-label="Budget name" />
          <Dropdown label="Budget category" value={category} onChange={setCategory}
            options={[{ value: 'all', label: 'Whole month' }, ...cats.filter((c) => !['salary', 'transfer', 'savings'].includes(c.key)).map((c) => ({ value: c.key, label: c.label, icon: <CatIcon cat={c.key} customs={customs} size={28} /> }))]} />
          <input value={limit} onChange={(e) => setLimit(e.target.value)} placeholder="Limit MVR" inputMode="decimal" className={inputCls} aria-label="Budget limit" />
          <Dropdown label="Budget period" value={period} onChange={(v) => setPeriod(v as Budget['period'])}
            options={[{ value: 'monthly', label: 'Monthly' }, { value: 'weekly', label: 'Weekly' }, { value: 'custom', label: 'Custom' }]} />
          <Btn onClick={add}><Plus size={15} /> Add</Btn>
        </div>
      </Card>

      {state.budgets.length === 0 ? (
        <Empty icon={<BellRing size={20} />} title="No budgets yet" body="Start with groceries or eating out — a small, visible envelope beats a perfect plan." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {state.budgets.map((b) => {
            const spent = spentFor(b);
            const pct = b.limitLaari ? (spent / b.limitLaari) * 100 : 0;
            const over = pct > 100;
            const paceRisk = !over && pct > (new Date().getDate() / 30) * 100 + 25;
            return (
              <Card key={b.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{b.name}</p>
                    <p className="text-xs text-[var(--muted)]">{b.category === 'all' ? 'Whole month' : categoryLabel(b.category, customs)} · {b.period}{b.rollover ? ' · rollover on' : ''}</p>
                  </div>
                  <button onClick={() => store.setBudgets(state.budgets.filter((x) => x.id !== b.id))} className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-red-500/10 hover:text-red-600" aria-label={`Delete ${b.name}`}><Trash2 size={15} /></button>
                </div>
                <div className="mt-3 flex items-baseline justify-between">
                  <Amount laari={b.limitLaari - spent} size="lg" tone={over ? 'neg' : 'plain'} />
                  <span className="tnum text-xs text-[var(--muted)]">{formatMVR(spent, { decimals: 0 })} of {formatMVR(b.limitLaari, { decimals: 0 })} · {Math.round(pct)}%</span>
                </div>
                <div className="mt-2"><Bar pct={pct} tone={over ? 'bad' : paceRisk ? 'warn' : 'accent'} /></div>
                {(over || paceRisk) && (
                  <p className={`mt-2 flex items-center gap-1.5 text-xs font-medium ${over ? 'text-red-600 dark:text-red-300' : 'text-amber-700 dark:text-amber-300'}`}>
                    <BellRing size={13} />{over ? 'Over budget — consider a smaller envelope next cycle, no shame.' : 'Running ahead of pace — likely to exceed at this rate.'}
                  </p>
                )}
                <label className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                  <input type="checkbox" checked={b.rollover} onChange={(e) => store.setBudgets(state.budgets.map((x) => x.id === b.id ? { ...x, rollover: e.target.checked } : x))} className="h-4 w-4 accent-[var(--accent)]" />
                  Let unused amount roll over next {b.period === 'weekly' ? 'week' : 'month'}
                </label>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="p-5">
        <SectionTitle kicker="Obligations" title="Recurring bills" />
        <ul className="space-y-2">
          {state.recurring.map((r) => (
              <li key={r.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1"><b>{r.name}</b> <span className="text-xs text-[var(--muted)]">· {categoryLabel(r.category, customs)} · {r.frequency}</span></span>
              <span className="tnum text-sm font-semibold">{formatMVR(r.amountLaari, { decimals: 0 })}</span>
              <span className="text-xs text-[var(--muted)]">{r.nextDate}</span>
              <button onClick={() => store.setRecurring(state.recurring.filter((x) => x.id !== r.id))} className="rounded-lg p-1 text-[var(--muted)] hover:text-red-600" aria-label={`Remove ${r.name}`}><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
        <AddBill store={store} />
      </Card>
    </div>
  );
}

function AddBill({ store }: { store: Store }) {
  const [n, setN] = useState('');
  const [a, setA] = useState('');
  const [d, setD] = useState(new Date().toISOString().slice(0, 10));
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_140px_150px_auto]">
      <input value={n} onChange={(e) => setN(e.target.value)} placeholder="Bill name, e.g. MWSC" className={inputCls} aria-label="Bill name" />
      <input value={a} onChange={(e) => setA(e.target.value)} placeholder="MVR" inputMode="decimal" className={inputCls} aria-label="Bill amount" />
      <input type="date" value={d} onChange={(e) => setD(e.target.value)} className={inputCls} aria-label="Next date" />
      <Btn variant="soft" onClick={() => {
        const laari = parseMvrToLaari(a);
        if (!n.trim() || laari === null || laari <= 0) return;
        store.setRecurring([...store.state.recurring, { id: uid(), name: n.trim(), amountLaari: laari, category: 'utilities', frequency: 'monthly', nextDate: d }]);
        setN(''); setA('');
      }}>Add bill</Btn>
    </div>
  );
}
