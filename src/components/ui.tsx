import { motion } from 'framer-motion';
import { useId, type ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatMVR } from '../lib/money';

export const cx = (...c: Parameters<typeof clsx>) => twMerge(clsx(...c));

/* ---------- Button (shadcn-style variants) ---------- */
const buttonVariants = cva(
  'press inline-flex select-none items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition focus-visible:outline-none disabled:pointer-events-none disabled:opacity-45 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-[var(--accent)] text-[var(--accent-ink)] shadow-[0_8px_20px_-10px_var(--accent)]',
        dark: 'bg-[#101514] text-white dark:bg-[#eef5f2] dark:text-[#0a0e0d]',
        secondary: 'bg-[var(--surface-2)] text-[var(--ink)]',
        outline: 'border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)]',
        ghost: 'text-[var(--ink)] hover:bg-black/5 dark:hover:bg-white/8',
        danger: 'bg-red-600 text-white',
      },
      size: {
        sm: 'h-8 rounded-full px-3.5 text-[13px] [&_svg]:size-3.5',
        md: 'h-10 rounded-full px-5 text-sm [&_svg]:size-4',
        lg: 'h-12 rounded-full px-6 text-[15px] [&_svg]:size-[18px]',
        icon: 'h-10 w-10 rounded-full [&_svg]:size-[18px]',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export function Button({ children, onClick, variant, size, type = 'button', disabled, className, label }: {
  children: ReactNode; onClick?: () => void; type?: 'button' | 'submit'; disabled?: boolean;
  className?: string; label?: string;
} & VariantProps<typeof buttonVariants>) {
  return (
    <button type={type} disabled={disabled} onClick={onClick} aria-label={label} className={cx(buttonVariants({ variant, size }), className)}>
      {children}
    </button>
  );
}

/** Back-compat alias used across views. */
export function Btn({ children, onClick, variant = 'primary', type = 'button', disabled }: {
  children: ReactNode; onClick?: () => void; variant?: 'primary' | 'ghost' | 'soft' | 'danger'; type?: 'button' | 'submit'; disabled?: boolean;
}) {
  const map = { primary: 'primary', ghost: 'outline', soft: 'secondary', danger: 'danger' } as const;
  return <Button variant={map[variant]} size="md" type={type} disabled={disabled} onClick={onClick} className="w-full sm:w-auto">{children}</Button>;
}

/* ---------- Card: clean soft surface, no outline, no shadow ---------- */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-[22px] bg-[var(--surface)]', className)}>
      {children}
    </div>
  );
}

/* ---------- Section heading ---------- */
export function SectionTitle({ kicker, title, right }: { kicker?: string; title: string; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div>
        {kicker && <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--muted)]">{kicker}</p>}
        <h2 className="track-tight text-[19px] font-bold leading-snug">{title}</h2>
      </div>
      {right}
    </div>
  );
}

export function LinkBtn({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} className="press text-[13px] font-bold text-[var(--link)] opacity-60">
      {children}
    </button>
  );
}

/* ---------- Money: warm-positive, ink-neutral; red only when explicitly negative ---------- */
export function Amount({ laari, size = 'md', tone = 'auto', sign = false }: {
  laari: number; size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'; tone?: 'auto' | 'pos' | 'neg' | 'plain'; sign?: boolean;
}) {
  const cls =
    tone === 'pos' ? 'text-[#B45309] dark:text-[#FBBF24]'
    : tone === 'neg' ? 'text-[#dc2626] dark:text-red-400'
    : tone === 'plain' ? ''
    : laari > 0 ? 'text-[#B45309] dark:text-[#FBBF24]' : '';
  const sizes = { xs: 'text-xs', sm: 'text-sm', md: 'text-[15px]', lg: 'text-[22px] tracking-tight', xl: 'text-[38px] leading-none tracking-tighter' };
  return <span className={cx('tnum font-bold', sizes[size], cls)}>{formatMVR(laari, { sign })}</span>;
}

/* ---------- Badge ---------- */
const badgeVariants = cva('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold leading-none', {
  variants: {
    tone: {
      neutral: 'bg-black/6 text-[var(--muted)] dark:bg-white/10',
      good: 'bg-[#F5B800]/15 text-[#7A5C00] dark:text-[#FFD60A]',
      warn: 'bg-orange-500/12 text-[#C2410C] dark:text-orange-300',
      bad: 'bg-red-500/10 text-[#dc2626] dark:text-red-300',
      accent: 'bg-[var(--accent-soft)] text-[#7a5c00] dark:text-[#ffd60a]',
    },
  },
  defaultVariants: { tone: 'neutral' },
});

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: VariantProps<typeof badgeVariants>['tone'] }) {
  return <span className={badgeVariants({ tone })}>{children}</span>;
}

/* ---------- Progress ---------- */
export function Bar({ pct, tone = 'accent' }: { pct: number; tone?: 'accent' | 'good' | 'warn' | 'bad' }) {
  const c = tone === 'good' ? 'bg-amber-400' : tone === 'warn' ? 'bg-orange-500' : tone === 'bad' ? 'bg-red-500' : 'bg-[var(--accent)]';
  return (
    <div className="h-[7px] overflow-hidden rounded-full bg-black/8 dark:bg-white/10" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div className={cx('h-full rounded-full', c)} initial={{ width: 0 }} animate={{ width: `${Math.min(100, Math.max(0, pct))}%` }} transition={{ type: 'spring', stiffness: 110, damping: 22 }} />
    </div>
  );
}

/* ---------- Segmented control (iOS-style) ---------- */
export function Segmented<T extends string>({ options, value, onChange, label }: {
  options: { v: T; label: string }[]; value: T; onChange: (v: T) => void; label?: string;
}) {
  const id = useId();
  return (
    <div role="tablist" aria-label={label} className="flex gap-0.5 rounded-full bg-black/6 p-1 dark:bg-white/8">
      {options.map((o) => (
        <button
          key={o.v} role="tab" aria-selected={value === o.v} onClick={() => onChange(o.v)}
          className={cx('press relative flex-1 whitespace-nowrap rounded-full px-3 py-[7px] text-[13px] font-semibold transition-colors', value === o.v ? 'text-[var(--ink)]' : 'text-[var(--muted)]')}
        >
          {value === o.v && <motion.span layoutId={`seg-${id}`} className="absolute inset-0 rounded-full bg-[var(--surface)] shadow-sm" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
          <span className="relative">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Avatar ---------- */
export function Avatar({ name }: { name: string }) {
  const initial = (name.trim()[0] ?? 'R').toUpperCase();
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--hero)] text-[15px] font-bold text-[#FFD60A]" aria-hidden>
      {initial}
    </span>
  );
}

/* ---------- Separator ---------- */
export function Separator({ className }: { className?: string }) {
  return <div role="separator" className={cx('h-px bg-[var(--line)]', className)} />;
}

/* ---------- Sheet handle ---------- */
export function SheetHandle() {
  return <div className="mx-auto mb-3 h-[5px] w-10 rounded-full bg-black/15 dark:bg-white/20" aria-hidden />;
}

/* ---------- Empty state ---------- */
export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-[18px] bg-[var(--accent)]/10 text-[var(--accent)]">{icon}</div>
      <p className="track-tight text-[17px] font-bold">{title}</p>
      <p className="mt-1 max-w-xs text-sm leading-relaxed text-[var(--muted)]">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------- Form ---------- */
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] font-bold text-[var(--muted)]">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'h-11 w-full rounded-2xl border-0 bg-black/5 px-3.5 text-[15px] font-medium outline-none transition placeholder:font-normal placeholder:text-[var(--muted)]/70 focus:ring-2 focus:ring-[var(--accent)] dark:bg-white/8';

/* ---------- Skeleton ---------- */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cx('animate-pulse rounded-2xl bg-black/6 dark:bg-white/8', className)} />;
}
