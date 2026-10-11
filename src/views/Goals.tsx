import { useState } from 'react';
import { Flag, Plus, Trash2 } from 'lucide-react';
import { parseMvrToLaari, uid } from '../lib/money';
import type { Store } from '../lib/store';
import { Amount, Bar, Btn, Card, Empty, SectionTitle, inputCls } from '../components/ui';

const ISLANDS = ['🏝️ Kuramathi', '🏝️ Maafushi', '🏝️ Thulusdhoo', '🏝️ Addu', '🏝️ Fuvahmulah', '🏝️ Hanifaru'];
const COLORS = ['#E8930C', '#C2452D', '#96511F', '#E07B00', '#B45309', '#C99A00'];

export default function Goals({ store }: { store: Store }) {
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [monthly, setMonthly] = useState('');

  const add = () => {
    const t = parseMvrToLaari(target);
    if (!name.trim() || t === null || t <= 0) return;
    const m = monthly ? parseMvrToLaari(monthly) : null;
    const i = store.state.goals.length;
    store.setGoals([...store.state.goals, {
      id: uid(), name: name.trim(), island: ISLANDS[i % ISLANDS.length],
      targetLaari: t, savedLaari: 0, monthlyLaari: m && m > 0 ? m : undefined,
      priority: 'medium', color: COLORS[i % COLORS.length],
    }]);
    setName(''); setTarget(''); setMonthly('');
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle kicker="New island" title="Name a savings goal" />
        <p className="mb-3 text-xs text-[var(--muted)]">A goal is a budgeting allocation — money hasn't moved to a separate account unless your bank says so.</p>
        <div className="grid gap-2 sm:grid-cols-[1fr_150px_150px_auto]">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Emergency fund, laptop, Umrah…" className={inputCls} aria-label="Goal name" />
          <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="Target MVR" inputMode="decimal" className={inputCls} aria-label="Target amount" />
          <input value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="Monthly MVR" inputMode="decimal" className={inputCls} aria-label="Monthly contribution" />
          <Btn onClick={add}><Plus size={15} /> Add</Btn>
        </div>
      </Card>

      {store.state.goals.length === 0 ? (
        <Empty icon={<Flag size={20} />} title="No islands yet" body="Emergency fund first, gadgets second. Even Rf 500 a month builds the habit." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {store.state.goals.map((g) => {
            const pct = Math.min(100, Math.round((g.savedLaari / Math.max(1, g.targetLaari)) * 100));
            const monthsLeft = g.monthlyLaari && g.monthlyLaari > 0 ? Math.max(0, Math.ceil((g.targetLaari - g.savedLaari) / g.monthlyLaari)) : null;
            return (
              <Card key={g.id} className="overflow-hidden">
                <div className="h-1.5" style={{ background: g.color }} />
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{g.island}</p>
                      <p className="track-tight text-lg font-bold">{g.name}</p>
                    </div>
                    <button onClick={() => store.setGoals(store.state.goals.filter((x) => x.id !== g.id))} className="rounded-lg p-1.5 text-[var(--muted)] hover:text-red-600" aria-label={`Delete ${g.name}`}><Trash2 size={15} /></button>
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <Amount laari={g.savedLaari} size="lg" tone="plain" />
                    <span className="tnum text-xs text-[var(--muted)]">of {(g.targetLaari / 100).toLocaleString()} · {pct}%</span>
                  </div>
                  <div className="mt-2"><Bar pct={pct} tone="good" /></div>
                  {monthsLeft !== null && <p className="mt-1.5 text-xs text-[var(--muted)]">≈ {monthsLeft} month{monthsLeft === 1 ? '' : 's'} at current pace{monthsLeft === 0 ? ' — reached!' : ''}</p>}
                  <AddFunds store={store} goalId={g.id} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddFunds({ store, goalId }: { store: Store; goalId: string }) {
  const [v, setV] = useState('');
  return (
    <div className="mt-3 flex gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Add MVR…" inputMode="decimal" className={`${inputCls} py-1.5`} aria-label="Amount to add" />
      <Btn variant="soft" onClick={() => {
        const laari = parseMvrToLaari(v);
        if (laari === null || laari <= 0) return;
        store.setGoals(store.state.goals.map((g) => g.id === goalId ? { ...g, savedLaari: Math.min(g.targetLaari, g.savedLaari + laari) } : g));
        setV('');
      }}>Add</Btn>
    </div>
  );
}
