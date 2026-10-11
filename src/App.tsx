import { Suspense, lazy, useEffect, useState } from 'react';
import { MotionConfig } from 'framer-motion';
import { ArrowRight, PiggyBank, Plus } from 'lucide-react';
import Shell, { type Tab } from './components/Shell';
import { GlassDefs } from './components/glass/LiquidGlass';
import { Btn, inputCls } from './components/ui';
import { parseMvrToLaari } from './lib/money';
import { useStore } from './lib/store';

const Overview = lazy(() => import('./views/Overview'));
const Transactions = lazy(() => import('./views/Transactions'));
const Budgets = lazy(() => import('./views/Budgets'));
const InsightsView = lazy(() => import('./views/InsightsView'));
const Goals = lazy(() => import('./views/Goals'));
const Settings = lazy(() => import('./views/Settings'));

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [dark, setDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#08181c' : '#FAF7F1');
  }, [dark]);

  if (!store.state.onboardingDone) return <Onboarding store={store} />;

  return (
    <MotionConfig reducedMotion="user">
    <GlassDefs />
    <Shell store={store} tab={tab} setTab={setTab} dark={dark} setDark={setDark}>
      {(quick) => (
      <Suspense fallback={<div className="space-y-3" aria-busy="true" aria-label="Loading section"><div className="h-40 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" /><div className="h-24 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" /></div>}>
      {tab === 'overview' && <Overview store={store} go={setTab} onQuick={quick} />}
      {tab === 'txns' && <Transactions store={store} />}
      {tab === 'budgets' && <Budgets store={store} />}
      {tab === 'insights' && <InsightsView store={store} goTxns={() => setTab('txns')} />}
      {tab === 'goals' && <Goals store={store} />}
      {tab === 'settings' && <Settings store={store} />}
      </Suspense>
      )}
    </Shell>
    </MotionConfig>
  );
}

function Onboarding({ store }: { store: ReturnType<typeof useStore> }) {
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('8500');
  const [payday, setPayday] = useState('28');

  const done = (demo: boolean) => {
    const b = parseMvrToLaari(balance) ?? 850000;
    store.setPrefs({ displayName: name.trim(), openingBalanceLaari: b, paydayDay: Math.min(28, Math.max(1, Number(payday) || 28)) });
    if (demo) store.enableDemo();
    store.finishOnboarding();
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-5 py-10">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1c1500] text-[#FFD60A]">
        <svg viewBox="0 0 32 32" className="h-6 w-6" fill="none"><path d="M5 20c2.5-1.2 3.5-5 6-5s2.5 3.5 5 3.5S18 14 20 12.5s4-1.5 4-1.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /><circle cx="23" cy="21" r="2.6" fill="#f59e0b" /></svg>
      </div>
      <h1 className="track-tighter mt-4 text-[38px] font-bold leading-[1.05]">Know your money, <span className="text-[var(--accent)]">until payday.</span></h1>
      <p className="mt-2 text-[15px] text-[var(--muted)]">Ruh is a Maldives-first money companion — MVR budgets, salary-cycle safe-to-spend, Favara & family transfers, cash spending, and BML alert imports. Private by design: everything stays on this device.</p>
      <div className="mt-6 space-y-3 rounded-[26px] bg-[var(--surface)] p-5">
        <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">What should we call you?
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Aisha" className={`${inputCls} mt-1`} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Last trusted balance (MVR)
            <input value={balance} onChange={(e) => setBalance(e.target.value)} inputMode="decimal" className={`${inputCls} mt-1`} />
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Payday (day)
            <input value={payday} onChange={(e) => setPayday(e.target.value)} inputMode="numeric" className={`${inputCls} mt-1`} />
          </label>
        </div>
        <p className="text-[11px] text-[var(--muted)]">We label calculated figures as <b>recorded</b> — never as your live bank balance.</p>
        <div className="flex flex-col gap-2 pt-1">
          <Btn onClick={() => done(false)}><Plus size={15} /> Start fresh <ArrowRight size={15} /></Btn>
          <Btn variant="soft" onClick={() => done(true)}><PiggyBank size={15} /> Explore with demo data</Btn>
        </div>
      </div>
      <p className="mt-4 text-center text-[11px] text-[var(--muted)]">No account · no tracking · delete any time in Settings</p>
    </div>
  );
}
