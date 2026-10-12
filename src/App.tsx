import { Component, Suspense, lazy, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence, MotionConfig } from 'framer-motion';
import { ArrowRight, PiggyBank, Plus } from 'lucide-react';
import Shell, { type Tab } from './components/Shell';
import MinoChat from './components/mino/MinoChat';
import { GlassDefs } from './components/glass/LiquidGlass';
import { clearSharedParams, getSharedPayload } from './lib/share';
import { useSmsAuto } from './lib/smsAuto';
import { Btn, inputCls } from './components/ui';
import { parseMvrToLaari } from './lib/money';
import { useStore } from './lib/store';

const Overview = lazy(() => import('./views/Overview'));
const Transactions = lazy(() => import('./views/Transactions'));
const Budgets = lazy(() => import('./views/Budgets'));
const InsightsView = lazy(() => import('./views/InsightsView'));
const Goals = lazy(() => import('./views/Goals'));
const Settings = lazy(() => import('./views/Settings'));

/** A failed lazy chunk must never hang on the skeleton — offer a reload. */
class SectionError extends Component<{ onTab: Tab; children: ReactNode }, { err: unknown }> {
  state = { err: null as unknown };
  static getDerivedStateFromError(err: unknown) {
    return { err };
  }
  render() {
    if (this.state.err) {
      return (
        <div className="rounded-[22px] bg-[var(--surface)] p-6 text-center">
          <p className="track-tight text-[17px] font-bold">This section didn't load</p>
          <p className="mx-auto mt-1 max-w-xs text-sm text-[var(--muted)]">
            Usually a stale update on the installed app — reloading fetches the fresh version.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="press mx-auto mt-4 flex h-11 items-center rounded-full bg-[var(--accent)] px-6 text-sm font-bold text-[#1c1500]"
          >
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState<Tab>('overview');
  const [dark, setDark] = useState(() => {
    try {
      const saved = localStorage.getItem('mino-theme');
      if (saved) return saved === 'dark';
    } catch { /* private mode */ }
    return false; // default: light mode
  });
  const [mino, setMino] = useState({ open: false, prefill: '', key: 0 });
  const [activityNav, setActivityNav] = useState({ q: '', cat: 'all', key: 0 });
  const sms = useSmsAuto(store);
  // SMS shared from the inbox via Android share sheet (?text=...) → import preview
  const [importSeed] = useState(() => {
    const p = getSharedPayload(window.location.search);
    if (!p) return { text: '', key: 0 };
    clearSharedParams();
    return { text: p.text, key: Date.now() };
  });

  const askMino = (prefill = '') => setMino((m) => ({ open: true, prefill, key: m.key + 1 }));
  const goTxns = (q = '', cat = 'all') => {
    setActivityNav((a) => ({ q, cat, key: a.key + 1 }));
    setTab('txns');
  };

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#080807' : '#F5F4F0');
    try {
      localStorage.setItem('mino-theme', dark ? 'dark' : 'light');
    } catch { /* private mode */ }
  }, [dark]);

  if (!store.state.onboardingDone) return <Onboarding store={store} />;

  return (
    <MotionConfig reducedMotion="user">
    <GlassDefs />
    <Shell store={store} tab={tab} setTab={setTab} dark={dark} setDark={setDark} onMino={askMino} importSeed={importSeed}>
      {(quick, ask) => (
      <SectionError key={tab} onTab={tab}>
      <Suspense fallback={<div className="space-y-3" aria-busy="true" aria-label="Loading section"><div className="h-40 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" /><div className="h-24 animate-pulse rounded-2xl bg-black/5 dark:bg-white/5" /></div>}>
      {tab === 'overview' && <Overview store={store} go={setTab} onQuick={quick} onAsk={ask} />}
      {tab === 'txns' && <Transactions store={store} onAsk={ask} query={activityNav.q} catPreset={activityNav.cat} navKey={activityNav.key} />}
      {tab === 'budgets' && <Budgets store={store} onAsk={ask} />}
      {tab === 'insights' && <InsightsView store={store} onAsk={ask} goTxns={(c) => goTxns('', c ?? '')} />}
      {tab === 'goals' && <Goals store={store} onAsk={ask} />}
      {tab === 'settings' && <Settings store={store} sms={sms} />}
      </Suspense>
      </SectionError>
      )}
    </Shell>
    <AnimatePresence>
      {mino.open && (
        <MinoChat
          store={store}
          prefill={mino.prefill}
          prefillKey={mino.key}
          onClose={() => setMino((m) => ({ ...m, open: false, prefill: '' }))}
          onInspect={(ref) => {
            setMino((m) => ({ ...m, open: false, prefill: '' }));
            goTxns(ref.q ?? '', ref.category ?? 'all');
          }}
        />
      )}
    </AnimatePresence>
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
      <img src={`${import.meta.env.BASE_URL}mino-icon.png`} alt="Mino" className="h-14 w-14 rounded-[18px]" />
      <h1 className="track-tighter mt-4 text-[38px] font-bold leading-[1.05]">Know your money, <span className="text-[var(--accent)]">until payday.</span></h1>
      <p className="mt-2 text-[15px] text-[var(--muted)]">Mino is a Maldives-first money companion — MVR budgets, salary-cycle safe-to-spend, Favara & family transfers, cash spending, and BML alert imports. Private by design: everything stays on this device.</p>
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
