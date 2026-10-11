import { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowDownUp, Search, SlidersHorizontal, Undo2, Wallet, X } from 'lucide-react';
import { CatIcon } from '../components/CatIcon';
import CategoryPicker from '../components/CategoryPicker';
import Dropdown from '../components/Dropdown';
import { allCategories, categoryLabel } from '../lib/categories';
import { formatMVR } from '../lib/money';
import type { Store } from '../lib/store';
import type { Txn, TxnType } from '../lib/types';
import { Amount, Badge, Btn, Card, Empty, inputCls } from '../components/ui';

const TYPE_LABEL: Record<TxnType, string> = {
  income: 'Income', expense: 'Expense', internal_transfer: 'Own move', external_transfer: 'Sent',
  refund: 'Refund', cash_withdrawal: 'ATM cash', cash_deposit: 'Cash in', adjustment: 'Adjust',
};

const isOut = (t: Txn) => t.type === 'expense' || t.type === 'external_transfer' || t.type === 'cash_withdrawal';
const isIn = (t: Txn) => t.type === 'income' || t.type === 'refund';

function dayLabel(iso: string): string {
  const t = new Date();
  const today = t.toISOString().slice(0, 10);
  const y = new Date(t); y.setDate(t.getDate() - 1);
  if (iso === today) return 'Today';
  if (iso === y.toISOString().slice(0, 10)) return 'Yesterday';
  return new Date(iso + 'T00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

export default function Transactions({ store }: { store: Store }) {
  const [q, setQ] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [cat, setCat] = useState('all');
  const [type, setType] = useState('all');
  const [review, setReview] = useState('all');
  const [sort, setSort] = useState<'date' | 'amount'>('date');
  const [editing, setEditing] = useState<Txn | null>(null);
  const [lastDeleted, setLastDeleted] = useState<Txn | null>(null);
  const customs = store.state.customCats;
  const cats = allCategories(customs);
  const filtersOn = cat !== 'all' || type !== 'all' || review !== 'all';

  const list = useMemo(() => {
    let l = [...store.state.txns];
    if (q) l = l.filter((t) => (t.merchant + ' ' + (t.notes ?? '')).toLowerCase().includes(q.toLowerCase()));
    if (cat !== 'all') l = l.filter((t) => t.category === cat);
    if (type !== 'all') l = l.filter((t) => t.type === type);
    if (review === 'unreviewed') l = l.filter((t) => !t.reviewed);
    if (review === 'reviewed') l = l.filter((t) => t.reviewed);
    l.sort((a, b) => sort === 'date' ? b.date.localeCompare(a.date) : b.amountLaari - a.amountLaari);
    return l;
  }, [store.state.txns, q, cat, type, review, sort]);

  const summary = useMemo(() => {
    let inn = 0, out = 0;
    for (const t of list) {
      if (isIn(t)) inn += t.amountLaari;
      else if (isOut(t)) out += t.amountLaari;
    }
    return { n: list.length, inn, out };
  }, [list]);

  const grouped = useMemo(() => {
    const g = new Map<string, Txn[]>();
    for (const t of list.slice(0, 100)) {
      const k = sort === 'date' ? dayLabel(t.date) : 'Top amounts';
      g.set(k, [...(g.get(k) ?? []), t]);
    }
    return [...g.entries()];
  }, [list, sort]);

  const bulkFix = (category: string) => {
    const targets = list.filter((t) => !t.reviewed);
    targets.forEach((t) => store.updateTxn(t.id, { category, reviewed: true }));
    targets.forEach((t) => store.learn(t.merchant, category));
  };

  return (
    <div className="space-y-3">
      {/* search + filter toggle */}
      <div className="flex gap-2">
        <label className="relative flex-1">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" className={`${inputCls} pl-10`} aria-label="Search transactions" />
          {q && <button onClick={() => setQ('')} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full bg-black/10 p-1 dark:bg-white/15"><X size={12} /></button>}
        </label>
        <button
          onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} aria-label="Filters"
          className={`press relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${showFilters || filtersOn ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-[var(--surface)]'}`}
        >
          <SlidersHorizontal size={18} strokeWidth={2} />
          {filtersOn && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[var(--accent)]" />}
        </button>
      </div>

      <AnimatePresence initial={false}>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <Card className="grid grid-cols-2 gap-2 p-3">
              <Dropdown label="Filter category" value={cat} onChange={setCat}
                options={[{ value: 'all', label: 'All categories' }, ...cats.map((c) => ({ value: c.key, label: c.label }))]} />
              <Dropdown label="Filter type" value={type} onChange={setType}
                options={[{ value: 'all', label: 'All types' }, ...Object.entries(TYPE_LABEL).map(([v, l]) => ({ value: v, label: l }))]} />
              <Dropdown label="Filter review state" value={review} onChange={setReview}
                options={[{ value: 'all', label: 'All states' }, { value: 'unreviewed', label: 'Needs review' }, { value: 'reviewed', label: 'Reviewed' }]} />
              <Dropdown label="Sort" value={sort} onChange={(v) => setSort(v as 'date' | 'amount')}
                options={[{ value: 'date', label: 'Newest first' }, { value: 'amount', label: 'Largest first' }]} />
              {filtersOn && (
                <button onClick={() => { setCat('all'); setType('all'); setReview('all'); }} className="col-span-2 py-1 text-[13px] font-semibold text-[var(--muted)] underline">
                  Clear all filters
                </button>
              )}
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* summary strip */}
      {list.length > 0 && (
        <div className="flex items-center gap-2 px-1 text-[13px]">
          <ArrowDownUp size={13} className="text-[var(--muted)]" />
          <span className="font-semibold">{summary.n} transaction{summary.n === 1 ? '' : 's'}</span>
          <span className="tnum ml-auto font-semibold text-[var(--muted)]">
            <span className="text-[#B45309] dark:text-[#FBBF24]">+{formatMVR(summary.inn, { decimals: 0 })}</span>
            {' · '}
            {formatMVR(summary.out, { decimals: 0 })}
          </span>
        </div>
      )}

      {lastDeleted && (
        <div className="flex items-center gap-2 rounded-2xl bg-[var(--surface)] px-4 py-3 text-sm font-medium" role="status">
          Deleted “{lastDeleted.merchant}”.
          <button className="ml-auto flex items-center gap-1 font-bold underline" onClick={() => { store.addTxn({ ...lastDeleted }); setLastDeleted(null); }}>
            <Undo2 size={14} /> Undo
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <Empty icon={<Wallet size={20} />} title="Nothing here" body="Try widening the filters, or tap Pay on Home to log cash spending." />
      ) : (
        <div className="space-y-4">
          {grouped.map(([label, items]) => (
            <section key={label}>
              <p className="px-1 pb-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{label}</p>
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-[20px] bg-[var(--surface)] px-4 py-1"
              >
                {items.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setEditing(t)}
                    className="press flex w-full items-center gap-3 border-b border-[var(--line)] py-3 text-left last:border-0"
                    aria-label={`${t.merchant}, ${formatMVR(t.amountLaari)} — tap to edit`}
                  >
                    <CatIcon cat={t.category} customs={customs} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-bold leading-snug">{t.merchant}</span>
                      <span className="mt-0.5 flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--muted)]">
                        {categoryLabel(t.category, customs)}
                        <span aria-hidden>·</span>
                        {TYPE_LABEL[t.type]}
                        {!t.reviewed && <Badge tone="warn">Review</Badge>}
                      </span>
                    </span>
                    <span className="tnum shrink-0 text-[15px] font-bold">
                      <Amount laari={isIn(t) ? t.amountLaari : -t.amountLaari} size="sm" sign />
                    </span>
                  </button>
                ))}
              </motion.div>
            </section>
          ))}
          {list.length > 100 && <p className="py-2 text-center text-xs font-medium text-[var(--muted)]">Showing first 100 of {list.length} — search or filter to narrow.</p>}
          {list.some((t) => !t.reviewed) && (
            <div className="flex items-center gap-2 rounded-[20px] bg-[var(--accent-soft)] px-4 py-2.5 text-[13px] font-semibold">
              <span>File {list.filter((t) => !t.reviewed).length} unreviewed as</span>
              <div className="ml-auto w-44">
                <Dropdown label="Bulk categorize" value="" onChange={(v) => v && bulkFix(v)}
                  options={cats.map((c) => ({ value: c.key, label: c.label, icon: <CatIcon cat={c.key} customs={customs} size={28} /> }))} />
              </div>
            </div>
          )}
        </div>
      )}

      {editing && (
        <EditDialog
          txn={editing} store={store} onClose={() => setEditing(null)}
          onDelete={() => { setLastDeleted(editing); store.removeTxn(editing.id); setEditing(null); }}
        />
      )}
    </div>
  );
}

function EditDialog({ txn, store, onClose, onDelete }: { txn: Txn; store: Store; onClose: () => void; onDelete: () => void }) {
  const [merchant, setMerchant] = useState(txn.merchant);
  const [category, setCategory] = useState(txn.category);
  const [notes, setNotes] = useState(txn.notes ?? '');
  const cats = allCategories(store.state.customCats);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Edit transaction" className="max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-t-[28px] bg-[var(--surface)] p-5 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:rounded-[28px]">
        <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-black/15 dark:bg-white/20" aria-hidden />
        <div className="flex items-center gap-3">
          <CatIcon cat={category} customs={store.state.customCats} size={48} />
          <div>
            <h3 className="track-tight text-lg font-bold">Edit</h3>
            <p className="tnum text-sm font-semibold text-[var(--muted)]">{formatMVR(txn.amountLaari)} · {txn.date}</p>
          </div>
        </div>
        <div className="mt-4 space-y-3">
          <label className="block text-xs font-bold text-[var(--muted)]">Merchant<input value={merchant} onChange={(e) => setMerchant(e.target.value)} className={`${inputCls} mt-1`} /></label>
          <div className="text-xs font-bold text-[var(--muted)]">Category
            <div className="mt-1.5">
              <CategoryPicker value={category} onChange={setCategory} customs={store.state.customCats} />
            </div>
          </div>
          <label className="block text-xs font-bold text-[var(--muted)]">Notes<input value={notes} onChange={(e) => setNotes(e.target.value)} className={`${inputCls} mt-1`} /></label>
        </div>
        <div className="mt-4 flex gap-2">
          <Btn onClick={() => { store.updateTxn(txn.id, { merchant: merchant.trim().toUpperCase() || txn.merchant, category, notes, reviewed: true }); store.learn(merchant, category); onClose(); }}>Save</Btn>
          <Btn variant="ghost" onClick={onClose}>Cancel</Btn>
        </div>
        <button onClick={onDelete} className="mt-2 w-full py-2 text-center text-[13px] font-semibold text-red-600">Delete transaction</button>
      </div>
    </div>
  );
}
