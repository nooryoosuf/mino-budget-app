import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown } from 'lucide-react';
import { cx } from './ui';
import { SheetHandle } from './ui';

export interface DropOption {
  value: string;
  label: string;
  icon?: ReactNode;
}

/**
 * Custom dropdown — native <select> replaced app-wide.
 * Opens a bottom sheet (thumb-friendly, no clipping, no positioning math),
 * fully keyboard-operable, with visible focus and reduced-motion support.
 */
export default function Dropdown({ value, onChange, options, label }: {
  value: string;
  onChange: (v: string) => void;
  options: DropOption[];
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    // focus the selected option when opened
    const sel = listRef.current?.querySelector<HTMLElement>('[data-selected="true"]')
      ?? listRef.current?.querySelector<HTMLElement>('button');
    sel?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open ]);

  const move = (dir: 1 | -1) => {
    const btns = [...(listRef.current?.querySelectorAll<HTMLElement>('button') ?? [])];
    const i = btns.indexOf(document.activeElement as HTMLElement);
    btns[(i + dir + btns.length) % btns.length]?.focus();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={label}
        className="press flex h-11 w-full items-center gap-2 rounded-2xl bg-black/5 px-3.5 text-left text-[15px] font-semibold dark:bg-white/8"
      >
        <span className="min-w-0 flex-1 truncate">{current?.label ?? 'Choose…'}</span>
        <ChevronDown size={17} className="shrink-0 text-[var(--muted)]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[70] flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          >
            <motion.div
              role="listbox"
              aria-label={label}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
                if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
              }}
              initial={{ y: 60 }} animate={{ y: 0 }} exit={{ y: 60 }}
              transition={{ type: 'spring', stiffness: 420, damping: 40 }}
              className="max-h-[70dvh] w-full max-w-sm overflow-y-auto rounded-t-[26px] bg-[var(--surface)] p-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[26px]"
            >
              <SheetHandle />
              <div ref={listRef} className="space-y-0.5">
                {options.map((o) => {
                  const on = o.value === value;
                  return (
                    <button
                      key={o.value}
                      role="option"
                      aria-selected={on}
                      data-selected={on || undefined}
                      onClick={() => { onChange(o.value); setOpen(false); triggerRef.current?.focus(); }}
                      className={cx(
                        'press flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-[15px]',
                        on ? 'bg-[var(--accent-soft)] font-bold' : 'font-medium hover:bg-black/5 dark:hover:bg-white/8',
                      )}
                    >
                      {o.icon}
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {on && <Check size={18} strokeWidth={2.4} className="shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
