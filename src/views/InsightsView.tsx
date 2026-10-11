import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Lightbulb, Store as StoreIcon } from 'lucide-react';
import { categoryColor } from '../lib/categories';
import { buildInsights } from '../lib/insights';
import { formatMVR } from '../lib/money';
import type { Store } from '../lib/store';
import { Badge, Card, Empty, SectionTitle } from '../components/ui';

export default function Insights({ store, goTxns }: { store: Store; goTxns: (filterCategory?: string) => void }) {
  const { state } = store;
  const months = useMemo(() => {
    const keys = [...new Set(state.txns.map((t) => t.date.slice(0, 7)))].sort().slice(-6);
    return keys.map((m) => {
      const inM = state.txns.filter((t) => t.date.slice(0, 7) === m);
      const income = inM.filter((t) => t.type === 'income').reduce((s, t) => s + t.amountLaari, 0);
      const expense = inM.filter((t) => t.type === 'expense' || t.type === 'cash_withdrawal' || t.type === 'external_transfer').reduce((s, t) => s + t.amountLaari, 0);
      const refunds = inM.filter((t) => t.type === 'refund').reduce((s, t) => s + t.amountLaari, 0);
      return { m: m.slice(5), income: Math.round(income / 100), expense: Math.round((expense - refunds) / 100) };
    });
  }, [state.txns]);

  const merchants = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of state.txns) {
      if (t.type !== 'expense' && t.type !== 'cash_withdrawal') continue;
      map.set(t.merchant, (map.get(t.merchant) ?? 0) + t.amountLaari);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, v]) => ({ name: name.length > 16 ? name.slice(0, 16) + '…' : name, full: name, v: Math.round(v / 100) }));
  }, [state.txns]);

  const cashShare = useMemo(() => {
    const cash = state.txns.filter((t) => t.type === 'cash_withdrawal').reduce((s, t) => s + t.amountLaari, 0);
    const out = state.txns.filter((t) => t.type === 'expense' || t.type === 'cash_withdrawal' || t.type === 'external_transfer').reduce((s, t) => s + t.amountLaari, 0);
    return out ? Math.round((cash / out) * 100) : 0;
  }, [state.txns]);

  const insights = buildInsights(state.txns, state.budgets.map((b) => ({ category: b.category, limitLaari: b.limitLaari })));

  if (state.txns.length < 5) {
    return <Empty icon={<Lightbulb size={20} />} title="Not enough history yet" body="Insights are calculated, never invented. Add at least a handful of transactions — or load demo data in Settings to preview." />;
  }

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle kicker="Trends" title="Income vs spending" />
        <div className="h-56" role="img" aria-label="Monthly income versus expense bar chart">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} margin={{ top: 4, right: 4, left: -12, bottom: 0 }} barGap={3}>
              <CartesianGrid strokeDasharray="3 6" stroke="var(--line)" vertical={false} />
              <XAxis dataKey="m" tick={{ fontSize: 11 }} stroke="var(--muted)" tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} stroke="var(--muted)" tickLine={false} axisLine={false} tickFormatter={(v: number) => `${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
              <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v, n) => [`Rf ${Number(v).toLocaleString()}`, n]} />
              <Bar dataKey="income" name="Income" fill="#E8930C" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" name="Spending" fill="#B44322" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle kicker="Where it concentrates" title="Top merchants" />
          <div className="h-56" role="img" aria-label="Top merchants bar chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={merchants} layout="vertical" margin={{ left: 8, right: 24 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} stroke="var(--muted)" tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v) => [`Rf ${Number(v).toLocaleString()}`, 'Spent']} />
                <Bar dataKey="v" radius={[0, 8, 8, 0]}>
                  {merchants.map((m, i) => <Cell key={i} fill={categoryColor('groceries')} opacity={1 - i * 0.08} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card className="space-y-3 p-5">
          <SectionTitle kicker="Calculated" title="What stands out" />
          {insights.length === 0 && <p className="text-sm text-[var(--muted)]">Nothing remarkable — steady months don't trigger alerts. That's good news.</p>}
          {insights.map((ins) => (
            <button key={ins.id} onClick={() => goTxns(ins.txnFilter?.category)} className="press block w-full rounded-[20px] bg-black/[0.03] p-3.5 text-left dark:bg-white/[0.05]">
              <Badge tone={ins.severity === 'good' ? 'good' : ins.severity === 'bad' ? 'bad' : ins.severity === 'warn' ? 'warn' : 'neutral'}>{ins.severity}</Badge>
              <p className="mt-1 font-semibold">{ins.title}</p>
              <p className="text-sm text-[var(--muted)]">{ins.detail}</p>
              <p className="mt-1 text-xs font-bold text-[var(--accent)] underline">Inspect transactions</p>
            </button>
          ))}
          <div className="flex items-center gap-2 rounded-2xl bg-black/5 p-3 text-sm dark:bg-white/5">
            <StoreIcon size={16} className="shrink-0 text-[var(--muted)]" />
            <span><b>{cashShare}%</b> of recorded outflow is ATM cash. {cashShare > 50 ? 'Log cash purchases so they don\'t vanish.' : 'Healthy mix of traceable spending.'}</span>
          </div>
          <p className="text-[11px] text-[var(--muted)]">Every insight shows its period and numbers. No data, no claim — e.g. {formatMVR(0)} insights when history is thin.</p>
        </Card>
      </div>
    </div>
  );
}
