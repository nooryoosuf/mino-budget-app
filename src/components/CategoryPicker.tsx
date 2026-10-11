import { CatIcon } from './CatIcon';
import { allCategories } from '../lib/categories';
import type { CustomCat } from '../lib/types';
import { cx } from './ui';

/**
 * Visual category picker — icon tiles in a two-row snap-scroll strip.
 * Used wherever the user *chooses* a category (quick-add, editing).
 * Filtering surfaces keep the compact Dropdown.
 */
export default function CategoryPicker({ value, onChange, customs = [] }: {
  value: string;
  onChange: (v: string) => void;
  customs?: CustomCat[];
}) {
  const cats = allCategories(customs);
  return (
    <div
      role="radiogroup"
      aria-label="Category"
      className="snapx no-scrollbar -mx-1 grid auto-cols-[76px] grid-flow-col grid-rows-2 gap-2 overflow-x-auto px-1 py-0.5"
    >
      {cats.map((c) => {
        const on = value === c.key;
        return (
          <button
            key={c.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(c.key)}
            className={cx(
              'press flex min-h-[86px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-2',
              on ? 'bg-[var(--accent-soft)]' : 'bg-black/[0.04] dark:bg-white/[0.06]',
            )}
          >
            <CatIcon cat={c.key} customs={customs} size={32} />
            <span className={cx(
              'line-clamp-2 w-full text-center text-[10.5px] leading-tight',
              on ? 'font-bold' : 'font-medium text-[var(--muted)]',
            )}>
              {c.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
