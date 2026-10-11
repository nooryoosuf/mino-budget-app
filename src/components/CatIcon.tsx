import type { ComponentType } from 'react';
import { icons, type LucideProps } from 'lucide-react';
import { categoryColor, categoryIcon, type CustomCat } from '../lib/categories';
import { cx } from './ui';

/** Category glyph in a soft tinted squircle — the visual language for money-out/in lists. */
export function CatIcon({ cat, customs = [], size = 40, iconSize }: {
  cat: string; customs?: CustomCat[]; size?: number; iconSize?: number;
}) {
  const name = categoryIcon(cat, customs);
  const color = categoryColor(cat, customs);
  const Cmp = (icons as unknown as Record<string, ComponentType<LucideProps>>)[name]
    ?? (icons as unknown as Record<string, ComponentType<LucideProps>>).Shapes;
  return (
    <span
      aria-hidden
      className={cx('flex shrink-0 items-center justify-center rounded-full')}
      style={{ width: size, height: size, backgroundColor: `${color}1f`, color }}
    >
      <Cmp size={iconSize ?? Math.round(size * 0.48)} strokeWidth={2} />
    </span>
  );
}
