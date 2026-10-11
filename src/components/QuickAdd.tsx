import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from 'lucide-react';
import CategoryPicker from './CategoryPicker';
import { categorize } from '../lib/categorize';
import { parseMvrToLaari } from '../lib/money';
import type { Store } from '../lib/store';
import type { TxnType } from '../lib/types';
import { Button, Field, cx, inputCls } from './ui';

const schema = z.object({
  merchant: z.string().min(2, 'Merchant needs at least 2 characters').max(60),
  amount: z.string().min(1, 'Amount is required').refine((v) => {
    const n = parseMvrToLaari(v);
    return n !== null && n > 0;
  }, 'Enter a valid amount above zero, e.g. 250.00'),
  type: z.enum(['income', 'expense', 'internal_transfer', 'external_transfer', 'refund', 'cash_withdrawal', 'cash_deposit', 'adjustment']),
  date: z.string().min(1, 'Date is required'),
  account: z.string().optional(),
  notes: z.string().max(200).optional(),
});

type Form = z.infer<typeof schema>;

const TYPES: { v: TxnType; label: string }[] = [
  { v: 'expense', label: 'Expense' },
  { v: 'income', label: 'Income' },
  { v: 'cash_withdrawal', label: 'ATM cash' },
  { v: 'external_transfer', label: 'Favara' },
  { v: 'internal_transfer', label: 'Own move' },
  { v: 'refund', label: 'Refund' },
  { v: 'cash_deposit', label: 'Cash in' },
  { v: 'adjustment', label: 'Adjust' },
];

export default function QuickAdd({ store, onDone, initialType = 'expense' }: { store: Store; onDone: () => void; initialType?: TxnType }) {
  const [pickedCat, setPickedCat] = useState<string | null>(null);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { type: initialType, date: new Date().toISOString().slice(0, 10), merchant: '', amount: '' },
  });
  const merchant = watch('merchant');
  const type = watch('type');
  const suggestion = merchant.length >= 2 ? categorize(merchant, store.state.rules, store.state.learned, type) : null;

  const submit = (f: Form) => {
    const laari = parseMvrToLaari(f.amount)!;
    const cat = pickedCat ?? suggestion?.category ?? (f.type === 'income' ? 'salary' : 'other');
    store.addTxn({
      amountLaari: laari, currency: 'MVR', type: f.type, merchant: f.merchant.trim().toUpperCase(),
      category: cat, date: f.date, account: f.account || undefined, notes: f.notes || undefined,
      source: 'manual', reviewed: (suggestion?.confidence ?? 0) >= 0.8 || !!pickedCat,
    });
    if (!pickedCat && merchant) store.learn(merchant, cat);
    onDone();
  };

  return (
    <form onSubmit={handleSubmit(submit)} className="space-y-4">
      {/* amount hero */}
      <div className="rounded-[22px] bg-[var(--surface-2)] px-4 py-4 dark:bg-white/6">
        <p className="text-[12px] font-bold text-[var(--muted)]">Amount · MVR</p>
        <div className="flex items-baseline gap-1">
          <span className="track-tighter text-[30px] font-bold text-[var(--muted)]">Rf</span>
          <input {...register('amount')} inputMode="decimal" placeholder="0.00" aria-label="Amount in MVR"
            className="tnum track-tighter w-full bg-transparent text-[44px] font-extrabold leading-none outline-none placeholder:text-[var(--muted)]/40" />
        </div>
        {errors.amount && <span className="text-[13px] font-medium text-red-600">{errors.amount.message}</span>}
      </div>

      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 pb-0.5" role="radiogroup" aria-label="Transaction type">
        {TYPES.map((t) => (
          <label key={t.v} className={cx(
            'press shrink-0 cursor-pointer rounded-full px-4 py-2.5 text-[13.5px] font-bold transition',
            type === t.v ? 'bg-[var(--ink)] text-[var(--bg)]' : 'bg-black/5 text-[var(--muted)] dark:bg-white/8',
          )}>
            <input type="radio" value={t.v} {...register('type')} className="sr-only" />
            {t.label}
          </label>
        ))}
      </div>

      <Field label="Merchant or person">
        <input {...register('merchant')} placeholder="STO, ferry, STELCO…" className={inputCls} />
        {errors.merchant && <span className="text-[13px] font-medium text-red-600">{errors.merchant.message}</span>}
      </Field>

      {suggestion && (
        <p className="rounded-2xl bg-[var(--accent)]/8 px-3.5 py-2.5 text-[13px] font-medium leading-snug" role="status">
          Filing under <b>{suggestion.category}</b> · {suggestion.reason}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Date">
          <input type="date" {...register('date')} className={inputCls} max={new Date().toISOString().slice(0, 10)} />
        </Field>
      <Field label="Category">
        <CategoryPicker value={pickedCat ?? suggestion?.category ?? 'other'} onChange={setPickedCat} customs={store.state.customCats} />
      </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Account">
          <input {...register('account')} placeholder="BML · Main" className={inputCls} />
        </Field>
        <Field label="Note">
          <input {...register('notes')} placeholder="Optional" className={inputCls} />
        </Field>
      </div>

      <Button type="submit" size="lg" className="w-full"><Check size={18} strokeWidth={2.2} /> Save transaction</Button>
    </form>
  );
}
