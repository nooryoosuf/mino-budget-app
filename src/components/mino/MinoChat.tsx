import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowUp, Search, X } from 'lucide-react';
import { minoProvider } from '../../lib/mino/provider';
import { extractMonths, extractMvr, parseIntent } from '../../lib/mino/parse';
import { fmt, proposeGoal } from '../../lib/mino/tools';
import type { InspectRef, MinoAnswer, Proposal } from '../../lib/mino/types';
import { uid } from '../../lib/money';
import type { Store } from '../../lib/store';
import { cx } from '../ui';

interface Msg {
  id: string;
  role: 'user' | 'mino';
  text: string;
  mood?: MinoAnswer['mood'];
  proposal?: Proposal;
  decided?: boolean;
  inspect?: InspectRef;
  followUps?: string[];
}

const ISLANDS = ['🏝️ Kuramathi', '🏝️ Maafushi', '🏝️ Thulusdhoo', '🏝️ Addu', '🏝️ Fuvahmulah', '🏝️ Hanifaru'];
const GOAL_COLORS = ['#E8930C', '#C2452D', '#96511F', '#E07B00', '#B45309', '#C99A00'];
const base = import.meta.env.BASE_URL;

export default function MinoChat({ store, prefill, prefillKey, onClose, onInspect }: {
  store: Store;
  prefill: string;
  prefillKey: number;
  onClose: () => void;
  onInspect: (ref: InspectRef) => void;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [mood, setMood] = useState<MinoAnswer['mood']>('idle');
  const [pending, setPending] = useState<{ name: string; months: number | null } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const greeted = useRef(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [msgs, thinking]);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || thinking) return;
    setMsgs((m) => [...m, { id: uid(), role: 'user', text: q }]);
    setInput('');

    // slot filling — Mino asked a follow-up (e.g. goal target)
    if (pending) {
      const low = q.toLowerCase();
      if (/cancel|never ?mind|forget|stop|drop it/.test(low)) {
        setPending(null);
        setMsgs((m) => [...m, { id: uid(), role: 'mino', text: `Dropped it — nothing saved.`, mood: 'idle' }]);
        return;
      }
      const amt = extractMvr(q);
      if ((amt === null || amt <= 0) && parseIntent(q, store.state).kind !== 'unknown') {
        setPending(null); // changed topic — fall through to normal answering
      } else if (amt !== null && amt > 0) {
        const months = extractMonths(q) ?? pending.months;
        const r = proposeGoal(store.state, pending.name, amt, months ?? undefined);
        setPending(null);
        if ('error' in r) {
          setMsgs((m) => [...m, { id: uid(), role: 'mino', text: r.error, mood: 'idle' }]);
        } else {
          setMood('happy');
          setMsgs((m) => [...m, { id: uid(), role: 'mino', text: `Got it — ${fmt(amt)} for ${pending.name}. Confirm and I'll create it.`, mood: 'happy', proposal: r }]);
        }
        return;
      } else {
        setMsgs((m) => [...m, { id: uid(), role: 'mino', text: `I need a number for that — like MVR 10,000 (or say "cancel").`, mood: 'idle' }]);
        return;
      }
    }

    setThinking(true);
    setMood('thinking');
    try {
      const a = await minoProvider.answer(q, store.state);
      setMood(a.mood);
      if (a.clarify) setPending({ name: a.clarify.draft.name, months: a.clarify.draft.months });
      setMsgs((m) => [...m, { id: uid(), role: 'mino', text: a.text, mood: a.mood, proposal: a.proposal, inspect: a.inspect, followUps: a.followUps }]);
    } catch {
      setMood('idle');
      setMsgs((m) => [...m, { id: uid(), role: 'mino', text: `Something hiccuped on my side — your data is untouched. Try asking again?`, mood: 'idle' }]);
    } finally {
      setThinking(false);
    }
  };

  // greeting on first open
  useEffect(() => {
    if (greeted.current) return;
    greeted.current = true;
    const name = store.state.prefs.displayName.trim().split(' ')[0];
    setMsgs([{
      id: uid(), role: 'mino', mood: 'happy',
      text: `Hey${name ? ` ${name}` : ''}! I'm Mino — I read your actual records and do the maths myself, never guess. What should we look at?`,
      followUps: minoProvider.suggestions(store.state).slice(0, 3),
    }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // contextual prefill (e.g. "Ask Mino about this")
  useEffect(() => {
    if (prefillKey > 0 && prefill.trim()) send(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillKey]);

  const decide = (msg: Msg, ok: boolean) => {
    if (!msg.proposal || msg.decided) return;
    const p = msg.proposal;
    if (!ok) {
      setMsgs((m) => m.map((x) => x.id === msg.id ? { ...x, decided: true } : x)
        .concat({ id: uid(), role: 'mino', text: `No problem — nothing changed.`, mood: 'idle' }));
      return;
    }
    let result = '';
    if (p.kind === 'budget-create') {
      store.setBudgets([...store.state.budgets, {
        id: uid(), name: String(p.payload.name), category: String(p.payload.category),
        period: 'monthly', limitLaari: Number(p.payload.limitLaari),
        startDate: new Date().toISOString().slice(0, 10), rollover: false, alertAtPct: 80,
      }]);
      result = `Done — ${p.payload.name} (${fmt(Number(p.payload.limitLaari))}/mo) is live in Budgets.`;
    } else if (p.kind === 'budget-update') {
      store.setBudgets(store.state.budgets.map((b) => b.id === p.payload.id ? { ...b, limitLaari: Number(p.payload.limitLaari) } : b));
      result = `Updated — the new limit is ${fmt(Number(p.payload.limitLaari))} a month.`;
    } else if (p.kind === 'goal-create') {
      const i = store.state.goals.length;
      const months = Number(p.payload.months ?? 0);
      store.setGoals([...store.state.goals, {
        id: uid(), name: String(p.payload.name), island: ISLANDS[i % ISLANDS.length],
        targetLaari: Number(p.payload.targetLaari), savedLaari: 0,
        monthlyLaari: months > 0 ? Math.ceil(Number(p.payload.targetLaari) / months) : undefined,
        priority: 'medium', color: GOAL_COLORS[i % GOAL_COLORS.length],
      }]);
      result = `Goal started — I'll track it in Goals and count it in your safe-to-spend.`;
    } else if (p.kind === 'bulk-file') {
      const targets = store.state.txns.filter((t) => !t.reviewed);
      const cat = String(p.payload.category);
      targets.forEach((t) => store.updateTxn(t.id, { category: cat, reviewed: true }));
      targets.forEach((t) => store.learn(t.merchant, cat));
      result = `Filed ${targets.length} transaction${targets.length === 1 ? '' : 's'} — and I'll remember those merchants.`;
    }
    setMood('happy');
    setMsgs((m) => m.map((x) => x.id === msg.id ? { ...x, decided: true } : x)
      .concat({ id: uid(), role: 'mino', text: result, mood: 'happy', followUps: ['Am I on track?', 'Plan my money until payday'] }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className="fixed inset-0 z-[60] flex flex-col bg-[var(--bg)]"
      role="dialog" aria-modal="true" aria-label="Ask Mino"
    >
      {/* header */}
      <div className="flex items-center gap-3 px-4 pb-3 pt-[max(0.9rem,env(safe-area-inset-top))]">
        <Mascot mood={thinking ? 'thinking' : mood} size={46} />
        <div className="min-w-0 flex-1">
          <p className="track-tight text-[17px] font-bold leading-tight">Mino</p>
          <p className="text-[12px] font-medium text-[var(--muted)]">
            {thinking ? 'Looking at your records…' : 'Personal treasurer · works offline'}
          </p>
        </div>
        <button onClick={onClose} aria-label="Close chat" className="press flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface)]">
          <X size={18} />
        </button>
      </div>

      {/* messages */}
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 pb-3" aria-live="polite">
        <AnimatePresence initial={false}>
          {msgs.map((m) => m.role === 'user' ? (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
              <p className="max-w-[85%] rounded-[20px] rounded-br-lg bg-[var(--accent)] px-4 py-2.5 text-[14.5px] font-medium leading-snug text-[#1c1500]">{m.text}</p>
            </motion.div>
          ) : (
            <motion.div key={m.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-2">
              <Mascot mood={m.mood ?? 'idle'} size={32} />
              <div className="min-w-0 max-w-[88%]">
                <div className="rounded-[20px] rounded-bl-lg bg-[var(--surface)] px-4 py-3">
                  <p className="text-[14.5px] leading-relaxed">{m.text}</p>
                  {m.proposal && !m.decided && (
                    <div className="mt-3 rounded-2xl bg-black/[0.04] p-3 dark:bg-white/[0.06]">
                      <p className="text-[13.5px] font-bold">{m.proposal.title}</p>
                      <p className="mt-0.5 text-[13px]">{m.proposal.summary}</p>
                      <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">{m.proposal.effect}</p>
                      <div className="mt-2.5 flex gap-2">
                        <button onClick={() => decide(m, true)} className="press h-9 flex-1 rounded-full bg-[var(--accent)] text-[13.5px] font-bold text-[#1c1500]">Confirm</button>
                        <button onClick={() => decide(m, false)} className="press h-9 flex-1 rounded-full bg-black/5 text-[13.5px] font-bold dark:bg-white/10">Cancel</button>
                      </div>
                    </div>
                  )}
                  {m.inspect && (
                    <button onClick={() => onInspect(m.inspect!)} className="press mt-2.5 flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3.5 py-2 text-[13px] font-bold">
                      <Search size={14} /> {m.inspect.label}
                    </button>
                  )}
                </div>
                {m.followUps && m.followUps.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {m.followUps.map((f) => (
                      <button key={f} onClick={() => send(f)} className="press rounded-full border border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-[12.5px] font-semibold">
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {thinking && (
          <div className="flex items-center gap-2 px-1 text-[13px] font-medium text-[var(--muted)]" role="status">
            <span className="flex gap-1" aria-hidden>
              {[0, 1, 2].map((i) => (
                <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
                  animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
              ))}
            </span>
            crunching your numbers…
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* input */}
      <form
        onSubmit={(e) => { e.preventDefault(); send(input); }}
        className="flex items-center gap-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2"
      >
        <input
          value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your money…"
          aria-label="Ask Mino"
          className="h-12 min-w-0 flex-1 rounded-full bg-[var(--surface)] px-4 text-[15px] outline-none placeholder:text-[var(--muted)]/70 focus:ring-2 focus:ring-[var(--accent)]"
        />
        <button type="submit" disabled={!input.trim() || thinking} aria-label="Send"
          className="press flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[#1c1500] disabled:opacity-40">
          <ArrowUp size={20} strokeWidth={2.4} />
        </button>
      </form>
    </motion.div>
  );
}

export function Mascot({ mood, size = 46 }: { mood: MinoAnswer['mood']; size?: number }) {
  const anim = mood === 'thinking'
    ? { animate: { rotate: [-7, 7, -7] }, transition: { duration: 1.1, repeat: Infinity, ease: 'easeInOut' as const } }
    : mood === 'happy'
      ? { initial: { scale: 0.7 }, animate: { scale: 1 }, transition: { type: 'spring' as const, stiffness: 400, damping: 12 } }
      : {};
  return (
    <motion.span
      {...anim}
      className={cx('flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F5B800]', mood === 'warning' && 'ring-2 ring-amber-500 ring-offset-2 ring-offset-[var(--bg)]')}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <img src={`${base}mino-circle.png`} alt="" className="h-full w-full object-cover" draggable={false} />
    </motion.span>
  );
}
