import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeftRight, Bell, ChartColumn, House, Moon, Plus, Settings as Cog, Sun, Target, Upload, Wallet, X,
} from 'lucide-react';
import { cx } from './ui';
import type { Store } from '../lib/store';
import type { TxnType } from '../lib/types';
import QuickAdd from './QuickAdd';
import ImportWizard from './ImportWizard';
import { Avatar, SheetHandle } from './ui';

export type Tab = 'overview' | 'txns' | 'budgets' | 'insights' | 'goals' | 'settings';
export type QuickKind = 'expense' | 'income' | 'transfer' | 'import';

const LEFT: { key: Tab; label: string; icon: typeof House }[] = [
  { key: 'txns', label: 'Activity', icon: ArrowLeftRight },
  { key: 'budgets', label: 'Budgets', icon: Wallet },
];
const RIGHT: { key: Tab; label: string; icon: typeof House }[] = [
  { key: 'insights', label: 'Stats', icon: ChartColumn },
  { key: 'goals', label: 'Goals', icon: Target },
];
const RAIL: { key: Tab; label: string; icon: typeof House }[] = [
  { key: 'overview', label: 'Home', icon: House },
  ...LEFT,
  ...RIGHT,
  { key: 'settings', label: 'Settings', icon: Cog },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function Shell({ store, tab, setTab, dark, setDark, children }: {
  store: Store; tab: Tab; setTab: (t: Tab) => void; dark: boolean; setDark: (v: boolean) => void; children: (quick: (k: QuickKind) => void) => React.ReactNode;
}) {
  const [sheet, setSheet] = useState<null | 'add' | 'import'>(null);
  const [preset, setPreset] = useState<TxnType>('expense');
  const unreviewed = store.state.txns.filter((t) => !t.reviewed).length;
  const name = store.state.prefs.displayName.trim();
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

  const quick = (k: QuickKind) => {
    if (k === 'import') setSheet('import');
    else {
      setPreset(k === 'transfer' ? 'external_transfer' : k);
      setSheet('add');
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl md:flex md:gap-8 md:px-6 md:py-6">
        {/* desktop rail */}
        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-56 shrink-0 flex-col md:flex">
          <Brand />
          <nav className="mt-8 space-y-0.5" aria-label="Primary">
            {RAIL.map((n) => (
              <button
                key={n.key}
                onClick={() => setTab(n.key)}
                aria-current={tab === n.key ? 'page' : undefined}
                className={cx(
                  'press flex w-full items-center gap-3 rounded-2xl px-3.5 py-2.5 text-[15px]',
                  tab === n.key ? 'bg-[var(--accent-soft)] font-bold' : 'font-medium text-[var(--muted)]',
                )}
              >
                <n.icon size={19} strokeWidth={tab === n.key ? 2.2 : 1.9} />
                {n.label}
                {n.key === 'txns' && unreviewed > 0 && (
                  <span className="ml-auto rounded-full bg-[var(--accent)] px-2 py-0.5 text-[11px] font-bold text-[#1c1500]">{unreviewed}</span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-auto space-y-2">
            <button onClick={() => quick('expense')} className="press flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--accent)] text-sm font-bold text-[var(--accent-ink)]">
              <Plus size={17} strokeWidth={2.2} /> Quick add
            </button>
            <button onClick={() => quick('import')} className="press flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--surface-2)] text-sm font-bold">
              <Upload size={16} /> Import
            </button>
          </div>
        </aside>

        <main className="mx-auto min-w-0 w-full max-w-[480px] flex-1 px-4 pb-44 pt-[max(0.9rem,env(safe-area-inset-top))] md:max-w-none md:px-0 md:pt-0">
          {/* app header */}
          <header className="mb-4 flex items-center gap-3 md:hidden">
            <Avatar name={name || 'R'} />
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-[var(--muted)]">{today}</p>
              <h1 className="track-tight truncate text-[19px] font-bold leading-tight">
                {greeting()}{name ? `, ${name.split(' ')[0]}` : ''}
              </h1>
            </div>
            <button onClick={() => setDark(!dark)} aria-label="Toggle theme" className="press glass flex h-10 w-10 items-center justify-center rounded-full">
              {dark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button onClick={() => setTab('txns')} aria-label="Notifications — review transactions" className="press glass relative flex h-10 w-10 items-center justify-center rounded-full">
              <Bell size={17} />
              {unreviewed > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-[var(--bg)]" />}
            </button>
            <button onClick={() => setTab('settings')} aria-label="Settings" className={cx('press flex h-10 w-10 items-center justify-center rounded-full', tab === 'settings' ? 'bg-[var(--ink)] text-[var(--bg)]' : 'glass')}>
              <Cog size={17} />
            </button>
          </header>

          {store.state.demoMode && (
            <button onClick={() => store.disableDemo()} className="mb-3 flex w-full items-center gap-2 rounded-2xl bg-[var(--accent-soft)] px-3.5 py-2.5 text-left text-[13px] font-bold text-[#7a5c00] dark:text-[#ffd60a]">
              <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--accent)]" />
              Demo data — tap to exit & start fresh
            </button>
          )}

          <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: 'easeOut' }}>
            {children(quick)}
          </motion.div>
        </main>
      </div>

      {/* floating dock — Home sits in its own podium above the bar, never clipped */}
      <div className="fixed inset-x-0 bottom-0 z-40 px-5 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden">
        <div className="relative mx-auto max-w-[400px]">
          <div role="toolbar" aria-label="Primary mobile" className="flex h-[66px] items-center rounded-full bg-[var(--surface)] px-3">
            <div className="flex min-w-0 flex-1 items-center">
              {LEFT.map((t) => <TabBtn key={t.key} t={t} active={tab === t.key} badge={t.key === 'txns' ? unreviewed : 0} onGo={() => setTab(t.key)} />)}
            </div>
            <div className="w-[96px] shrink-0" aria-hidden />
            <div className="flex min-w-0 flex-1 items-center">
              {RIGHT.map((t) => <TabBtn key={t.key} t={t} active={tab === t.key} badge={0} onGo={() => setTab(t.key)} />)}
            </div>
          </div>
          <div className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-[26px]">
            <span className={`flex h-[72px] w-[72px] items-center justify-center rounded-full transition-colors ${tab === 'overview' ? 'bg-[var(--accent-soft)]' : 'bg-[var(--surface)]'}`}>
              <button
                onClick={() => setTab('overview')}
                aria-label="Home" aria-current={tab === 'overview' ? 'page' : undefined}
                className="press flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[var(--accent)] text-[var(--accent-ink)]"
              >
                <House size={24} strokeWidth={2} />
              </button>
            </span>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {sheet && (
          <motion.div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSheet(null)}>
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: 90 }} animate={{ y: 0 }} exit={{ y: 90 }}
              transition={{ type: 'spring', stiffness: 380, damping: 40 }}
              className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[28px] bg-[var(--surface)] px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-2.5 sm:rounded-[28px] sm:p-6"
              role="dialog" aria-modal="true" aria-label={sheet === 'add' ? 'Add transaction' : 'Import transactions'}
            >
              <SheetHandle />
              <div className="mb-4 flex items-center justify-between">
                <h3 className="track-tight text-[20px] font-bold">{sheet === 'add' ? 'New transaction' : 'Import'}</h3>
                <button onClick={() => setSheet(null)} className="press flex h-9 w-9 items-center justify-center rounded-full bg-black/5 dark:bg-white/10" aria-label="Close"><X size={17} /></button>
              </div>
              {sheet === 'add' ? <QuickAdd key={preset} store={store} initialType={preset} onDone={() => setSheet(null)} /> : <ImportWizard store={store} onDone={() => setSheet(null)} />}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TabBtn({ t, active, badge, onGo }: { t: { key: Tab; label: string; icon: typeof House }; active: boolean; badge: number; onGo: () => void }) {
  return (
    <button onClick={onGo} aria-current={active ? 'page' : undefined} className="press relative flex min-w-0 flex-1 flex-col items-center gap-1 py-1">
      <motion.span animate={active ? { scale: [1, 1.14, 1] } : { scale: 1 }} transition={{ duration: 0.28 }} className={cx('relative flex h-9 items-center rounded-full px-4 transition-colors', active ? 'text-[#1c1500]' : 'text-[var(--muted)]')} style={active ? { background: 'var(--accent)' } : undefined}>
        <t.icon size={20} strokeWidth={active ? 2.2 : 1.9} />
        {badge > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white ring-2 ring-[var(--surface)]">{badge}</span>}
      </motion.span>
      <span className={cx('text-[10.5px] font-semibold leading-none', active ? 'text-[var(--ink)]' : 'text-[var(--muted)]')}>{t.label}</span>
    </button>
  );
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-1">
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--accent)] text-[#1c1500]">
        <svg viewBox="0 0 32 32" className="h-5 w-5" fill="none"><path d="M5 20c2.5-1.2 3.5-5 6-5s2.5 3.5 5 3.5S18 14 20 12.5s4-1.5 4-1.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /><circle cx="23" cy="21" r="2.6" fill="#141412" /></svg>
      </div>
      <div>
        <p className="track-tight text-[19px] font-bold leading-none">Ruh</p>
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Maldives money</p>
      </div>
    </div>
  );
}
