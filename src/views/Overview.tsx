import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowDownRight, ArrowLeftRight, ArrowUpRight, CalendarClock, ChevronRight,
  PiggyBank, Sparkles, TriangleAlert, Upload,
} from 'lucide-react';
import { CatIcon } from '../components/CatIcon';
import { GlassButton } from '../components/glass/LiquidGlass';
import { categoryLabel } from '../lib/categories';
import { buildInsights } from '../lib/insights';
import { formatCompactMVR, formatMVR } from '../lib/money';
import { calcSafeToSpend, daysUntilPayday } from '../lib/safeToSpend';
import type { Store } from '../lib/store';
import type { QuickKind } from '../components/Shell';
import { Amount, Badge, Bar, Card, LinkBtn, SectionTitle } from '../components/ui';

export default function Overview({ store, go, onQuick }: {
  store: Store; go: (t: 'txns' | 'budgets' | 'goals' | 'insights') => void; onQuick: (k: QuickKind) => void;
}) {
  const { state } = store;
  const customs = state.customCats;
  const [showBreakdown, setShowBreakdown] = useState(false);
  const month = new Date().toISOString().slice(0, 7);
  const monthLabel = new Date().toLocaleString('en', { month: 'long' });

  const monthTxns = useMemo(
    () => state.txns.filter((t) => t.date.slice(0, 7) === month),
    [state.txns, month],
  );

  const sums = useMemo(() => {
    let income = 0, expense = 0;
    for (const t of monthTxns) {
      if (t.type === 'income') income += t.amountLaari;
      else if (t.type === 'refund') expense -= t.amountLaari;
      else if (t.type === 'expense' || t.type === 'external_transfer' || t.type === 'cash_withdrawal') expense += t.amountLaari;
    }
    expense = Math.max(0, expense);
    return { income, expense, net: income - expense };
  }, [monthTxns]);

  const payday = daysUntilPayday(state.prefs.paydayDay);
  const cycleTxns = useMemo(() => {
    const start = new Date(); start.setDate(1);
    return state.txns.filter((t) => t.date >= start.toISOString().slice(0, 10));
  }, [state.txns]);
  const safe = calcSafeToSpend({
    openingBalanceLaari: state.prefs.openingBalanceLaari,
    txns: cycleTxns,
    upcoming: state.recurring.filter((r) => r.nextDate <= payday.date.toISOString().slice(0, 10)),
    savingsCommitLaari: state.goals.reduce((s, g) => s + (g.monthlyLaari ?? 0), 0),
    expectedIncomeLaari: 0,
    daysLeft: payday.days,
  });

  // month pace — spent vs where we should be by today
  const pace = useMemo(() => {
    const outflow = (list: typeof monthTxns) => {
      let out = 0;
      for (const t of list) {
        if (t.type === 'expense' || t.type === 'external_transfer' || t.type === 'cash_withdrawal') out += t.amountLaari;
        else if (t.type === 'refund') out -= t.amountLaari;
      }
      return Math.max(0, out);
    };
    const spent = outflow(monthTxns);
    const now = new Date();
    const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const elapsed = Math.min(1, now.getDate() / dim);
    const whole = state.budgets.find((b) => b.category === 'all');
    let baseline = whole?.limitLaari ?? 0;
    let baselineLabel = whole ? 'monthly envelope' : '';
    if (!baseline) {
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);
      baseline = outflow(state.txns.filter((t) => t.date.slice(0, 7) === prev));
      baselineLabel = 'last month';
    }
    const expected = baseline * elapsed;
    const status = baseline === 0 ? 'none' : spent > baseline ? 'over' : spent > expected * 1.15 && elapsed > 0.1 ? 'hot' : 'ok';
    return { spent, baseline, baselineLabel, elapsed, expected, status, left: Math.max(0, baseline - spent) };
  }, [monthTxns, state.txns, state.budgets]);

  const topCats = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of monthTxns) {
      if (t.type !== 'expense' && t.type !== 'cash_withdrawal') continue;
      m.set(t.category, (m.get(t.category) ?? 0) + t.amountLaari);
    }
    const total = [...m.values()].reduce((s, v) => s + v, 0) || 1;
    return [...m.entries()].map(([k, v]) => ({ key: k, value: v, pct: (v / total) * 100 })).sort((a, b) => b.value - a.value).slice(0, 4);
  }, [monthTxns]);

  const grouped = useMemo(() => {
    const sorted = [...state.txns].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 4);
    const t = new Date();
    const todayIso = t.toISOString().slice(0, 10);
    const y = new Date(t); y.setDate(t.getDate() - 1);
    const yIso = y.toISOString().slice(0, 10);
    const groups = new Map<string, typeof sorted>();
    for (const txn of sorted) {
      const label = txn.date === todayIso ? 'Today' : txn.date === yIso ? 'Yesterday'
        : new Date(txn.date + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      groups.set(label, [...(groups.get(label) ?? []), txn]);
    }
    return [...groups.entries()];
  }, [state.txns]);

  const insights = buildInsights(state.txns, state.budgets.map((b) => ({ category: b.category, limitLaari: b.limitLaari })));
  const unreviewed = state.txns.filter((t) => !t.reviewed);
  const overBudgets = state.budgets.filter((b) => {
    const spent = state.txns.filter((t) => t.date.slice(0, 7) === month && (t.type === 'expense' || t.type === 'cash_withdrawal') && (b.category === 'all' || t.category === b.category)).reduce((s, t) => s + t.amountLaari, 0);
    return b.limitLaari > 0 && spent > b.limitLaari;
  });

  const ACTIONS: { k: QuickKind; label: string; icon: typeof ArrowUpRight }[] = [
    { k: 'expense', label: 'Pay', icon: ArrowDownRight },
    { k: 'income', label: 'Add', icon: ArrowUpRight },
    { k: 'transfer', label: 'Send', icon: ArrowLeftRight },
    { k: 'import', label: 'Import', icon: Upload },
  ];

  return (
    <div className="space-y-5">
      {/* balance cards — swipeable like account cards */}
      <motion.section initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
        <div className="snapx no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-1" aria-label="Balance cards">
          {/* hero: safe to spend — soft surface in light, deep ink in dark */}
          <div className="relative min-w-[88%] overflow-hidden rounded-[26px] bg-[var(--surface)] p-5 text-[var(--ink)] sm:min-w-[78%] dark:bg-[#151512] dark:text-[#f7f5ec] md:min-w-[calc(50%-6px)]">
            <div className="pointer-events-none absolute -right-14 -top-16 h-48 w-48 rounded-full bg-[#ffd60a]/25 blur-2xl dark:bg-[#ffd60a]/15" aria-hidden />
            <div className="relative">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[var(--muted)]">Safe to spend</p>
                <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[11px] font-bold text-[#1c1500]">
                  {payday.days}d to payday
                </span>
              </div>
              <p className="tnum track-tighter mt-1.5 text-[44px] font-bold leading-none">{formatMVR(safe.safeLaari, { decimals: 0 })}</p>
              <p className="mt-1.5 text-[13px] font-medium text-[var(--muted)]">≈ {formatMVR(safe.perDayLaari, { decimals: 0 })} a day · {payday.date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
              <button onClick={() => setShowBreakdown((v) => !v)} aria-expanded={showBreakdown} className="press mt-3 flex w-full items-center justify-between rounded-2xl bg-black/[0.04] px-3.5 py-2.5 text-[13px] font-semibold dark:bg-white/10">
                How is this calculated?
                <motion.span animate={{ rotate: showBreakdown ? 90 : 0 }}><ChevronRight size={16} /></motion.span>
              </button>
              {showBreakdown && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <ul className="space-y-1.5 px-1 pb-1 pt-3 text-[13px]">
                    {safe.breakdown.map((b) => (
                      <li key={b.label} className="flex justify-between gap-2">
                        <span className="text-[var(--muted)]">{b.label}{b.kind === 'estimate' ? ' ∼' : ''}</span>
                        <span className="tnum font-semibold">{formatMVR(b.laari, { decimals: 0 })}</span>
                      </li>
                    ))}
                  </ul>
                  {safe.warnings.map((w) => (
                    <p key={w} className="mt-2 flex items-start gap-1.5 rounded-xl bg-amber-500/12 px-3 py-2 text-[12px] font-medium leading-snug text-amber-700 dark:text-[#ffd60a]">
                      <TriangleAlert size={14} className="mt-0.5 shrink-0" />{w}
                    </p>
                  ))}
                </motion.div>
              )}
            </div>
          </div>
          {/* month card */}
          <div className="relative min-w-[88%] overflow-hidden rounded-[26px] bg-[var(--accent)] p-5 text-[#1c1500] sm:min-w-[78%] md:min-w-[calc(50%-6px)]">
            <div className="pointer-events-none absolute -bottom-16 -right-10 h-44 w-44 rounded-full bg-white/25 blur-2xl" aria-hidden />
            <div className="relative">
              <p className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-black/55">{monthLabel} · recorded</p>
              <p className="tnum track-tighter mt-1.5 text-[44px] font-bold leading-none">{formatMVR(sums.net, { decimals: 0 })}</p>
              <p className="mt-1.5 text-[13px] font-bold text-black/60">{sums.net >= 0 ? 'kept this month' : 'over this month'}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className="rounded-2xl bg-black/8 px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-black/55">In</p>
                  <p className="tnum text-[16px] font-bold">{formatCompactMVR(sums.income)}</p>
                </div>
                <div className="rounded-2xl bg-black/8 px-3 py-2">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-black/55">Out</p>
                  <p className="tnum text-[16px] font-bold">{formatCompactMVR(sums.expense)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      {/* quick actions */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} aria-label="Quick actions">
        <div className="grid grid-cols-4 gap-2">
          {ACTIONS.map((a, i) => (
            <motion.div
              key={a.k}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.06 + i * 0.05 }}
              className="flex flex-col items-center gap-1.5"
            >
              <GlassButton size="circle" variant="clear" label={a.label} onClick={() => onQuick(a.k)}>
                <a.icon size={22} strokeWidth={2} />
              </GlassButton>
              <span className="text-[12px] font-semibold">{a.label}</span>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* alerts */}
      {(unreviewed.length > 0 || overBudgets.length > 0) && (
        <section className="space-y-2">
          {unreviewed.length > 0 && (
            <button onClick={() => go('txns')} className="press flex w-full items-center gap-2.5 rounded-[20px] bg-[var(--accent-soft)] px-4 py-3 text-left">
              <Sparkles size={17} className="shrink-0 text-[#7a5c00] dark:text-[#ffd60a]" />
              <span className="text-[13.5px] font-bold">{unreviewed.length} to review</span>
              <ChevronRight size={16} className="ml-auto shrink-0 opacity-60" />
            </button>
          )}
          {overBudgets.slice(0, 1).map((b) => (
            <button key={b.id} onClick={() => go('budgets')} className="press flex w-full items-center gap-2.5 rounded-[20px] bg-red-500/10 px-4 py-3 text-left">
              <TriangleAlert size={17} className="shrink-0 text-red-500" />
              <span className="text-[13.5px] font-bold">Over budget: {b.name}</span>
              <ChevronRight size={16} className="ml-auto shrink-0 opacity-60" />
            </button>
          ))}
        </section>
      )}

      {/* month pace — the one viz that answers "am I on track?" */}
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
        <Card className="p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{monthLabel} pace</p>
              {pace.baseline > 0 ? (
                <p className="tnum track-tight text-[26px] font-bold">{Math.round((pace.spent / pace.baseline) * 100)}<span className="text-[15px] font-semibold text-[var(--muted)]">% of {formatMVR(pace.baseline, { decimals: 0 })}</span></p>
              ) : (
                <p className="tnum track-tight text-[26px] font-bold">{formatMVR(pace.spent, { decimals: 0 })}<span className="text-[15px] font-semibold text-[var(--muted)]"> spent</span></p>
              )}
            </div>
            {pace.status === 'ok' && <Badge tone="good">On track</Badge>}
            {pace.status === 'hot' && <Badge tone="warn">Running hot</Badge>}
            {pace.status === 'over' && <Badge tone="bad">Over</Badge>}
            {pace.status === 'none' && <Badge tone="neutral">No baseline</Badge>}
          </div>
          {pace.baseline > 0 ? (
            <>
              <div className="relative mt-4 h-[10px] rounded-full bg-black/8 dark:bg-white/10" role="img" aria-label={`Spent ${formatMVR(pace.spent)} of ${formatMVR(pace.baseline)}, ${Math.round(pace.elapsed * 100)} percent through the month`}>
                <motion.div
                  className={`h-full rounded-full ${pace.status === 'over' ? 'bg-red-500' : pace.status === 'hot' ? 'bg-orange-500' : 'bg-[var(--accent)]'}`}
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, (pace.spent / pace.baseline) * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 90, damping: 22 }}
                />
                <span
                  className="absolute top-[-5px] h-[20px] w-[3px] rounded-full bg-[var(--ink)]"
                  style={{ left: `calc(${Math.min(99, Math.max(1, pace.elapsed * 100))}% - 1px)` }}
                  title="Today"
                />
              </div>
              <div className="mt-2.5 flex justify-between text-[12.5px] font-medium text-[var(--muted)]">
                <span><b className="tnum text-[var(--ink)]">{formatMVR(pace.spent, { decimals: 0 })}</b> spent</span>
                <span>should be ≈ <b className="tnum text-[var(--ink)]">{formatMVR(pace.expected, { decimals: 0 })}</b> by today</span>
                <span><b className="tnum text-[var(--ink)]">{formatMVR(pace.left, { decimals: 0 })}</b> left</span>
              </div>
              <p className="mt-1.5 text-[11.5px] text-[var(--muted)]">Baseline: {pace.baselineLabel} · line marks today</p>
            </>
          ) : (
            <p className="mt-2 text-[13px] leading-snug text-[var(--muted)]">Set a whole-month envelope in Budgets to unlock pace tracking — or keep logging and last month becomes the baseline.</p>
          )}
        </Card>
      </motion.section>

      {insights.length > 0 && (
        <button onClick={() => go('insights')} className="press w-full rounded-[20px] bg-[var(--surface)] p-4 text-left">
          <Badge tone={insights[0].severity === 'good' ? 'good' : insights[0].severity === 'bad' ? 'bad' : insights[0].severity === 'warn' ? 'warn' : 'neutral'}>Worth a look</Badge>
          <p className="mt-1.5 text-[14.5px] font-bold">{insights[0].title}</p>
          <p className="text-[13px] leading-snug text-[var(--muted)]">{insights[0].detail}</p>
        </button>
      )}

      {[...state.recurring].sort((a, b) => a.nextDate.localeCompare(b.nextDate)).slice(0, 3).length > 0 && (
        <section>
          <SectionTitle title="Coming up" right={<LinkBtn onClick={() => go('budgets')}>Bills</LinkBtn>} />
          <Card className="px-4 py-1">
            {[...state.recurring].sort((a, b) => a.nextDate.localeCompare(b.nextDate)).slice(0, 3).map((r) => (
              <div key={r.id} className="flex items-center gap-3 border-b border-[var(--line)] py-2.5 last:border-0">
                <span className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-2xl bg-black/[0.04] leading-none dark:bg-white/[0.07]">
                  <span className="text-[13px] font-bold">{r.nextDate.slice(8)}</span>
                  <span className="text-[9px] font-bold uppercase text-[var(--muted)]">{new Date(r.nextDate + 'T00:00').toLocaleDateString('en', { month: 'short' })}</span>
                </span>
                <span className="min-w-0 flex-1 truncate text-[14px] font-bold">{r.name}</span>
                <span className="tnum shrink-0 text-[14px] font-bold">{formatMVR(r.amountLaari, { decimals: 0 })}</span>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* top categories */}
      {topCats.length > 0 && (
        <section>
          <SectionTitle title="Top spending" right={<LinkBtn onClick={() => go('insights')}>Stats</LinkBtn>} />
          <Card className="space-y-3.5 p-5">
            {topCats.map((c) => (
              <div key={c.key} className="flex items-center gap-3">
                <CatIcon cat={c.key} customs={customs} size={38} />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span className="truncate font-bold">{categoryLabel(c.key, customs)}</span>
                    <span className="tnum font-bold">{formatCompactMVR(c.value)}</span>
                  </div>
                  <Bar pct={c.pct} />
                </div>
              </div>
            ))}
          </Card>
        </section>
      )}

      {/* recent — demoted, compact */}
      <section>
        <SectionTitle title="Recent" right={<LinkBtn onClick={() => go('txns')}>View all</LinkBtn>} />
        {grouped.length === 0 ? (
          <Card><p className="px-5 py-8 text-center text-sm text-[var(--muted)]">Nothing yet — tap Pay to log spending.</p></Card>
        ) : (
          <Card className="px-4 py-1.5">
            {grouped.map(([label, items]) => (
              <div key={label}>
                <p className="pb-0.5 pt-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
                {items.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 border-b border-[var(--line)] py-2.5 last:border-0">
                    <CatIcon cat={t.category} customs={customs} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14.5px] font-bold">{t.merchant}</span>
                      <span className="text-[12px] font-medium text-[var(--muted)]">{categoryLabel(t.category, customs)}</span>
                    </span>
                    <Amount laari={t.type === 'income' || t.type === 'refund' ? t.amountLaari : -t.amountLaari} size="sm" sign />
                  </div>
                ))}
              </div>
            ))}
          </Card>
        )}
      </section>

      {/* budgets + goals */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle title="Budgets" right={<LinkBtn onClick={() => go('budgets')}>Manage</LinkBtn>} />
          {state.budgets.length === 0 ? <p className="text-sm text-[var(--muted)]">No envelopes yet.</p> : (
            <div className="space-y-3.5">
              {state.budgets.slice(0, 2).map((b) => {
                const spent = state.txns.filter((t) => t.date.slice(0, 7) === month && (t.type === 'expense' || t.type === 'cash_withdrawal') && (b.category === 'all' || t.category === b.category)).reduce((s, t) => s + t.amountLaari, 0);
                const pct = b.limitLaari ? (spent / b.limitLaari) * 100 : 0;
                return (
                  <div key={b.id}>
                    <div className="mb-1.5 flex justify-between text-[13px]"><span className="font-bold">{b.name}</span><span className="tnum font-semibold text-[var(--muted)]">{Math.round(pct)}%</span></div>
                    <Bar pct={pct} tone={pct > 100 ? 'bad' : pct > 80 ? 'warn' : 'accent'} />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card className="p-5">
          <SectionTitle title="Islands" right={<LinkBtn onClick={() => go('goals')}>View</LinkBtn>} />
          {state.goals.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-[var(--muted)]"><PiggyBank size={15} /> Name your first island.</p>
          ) : (
            <div className="space-y-3.5">
              {state.goals.slice(0, 2).map((g) => (
                <div key={g.id}>
                  <div className="mb-1.5 flex justify-between text-[13px]"><span className="font-bold">{g.island} {g.name}</span><span className="tnum font-semibold text-[var(--muted)]">{Math.round((g.savedLaari / Math.max(1, g.targetLaari)) * 100)}%</span></div>
                  <Bar pct={(g.savedLaari / Math.max(1, g.targetLaari)) * 100} tone="good" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
