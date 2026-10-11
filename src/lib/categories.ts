/**
 * Categories: built-in Maldivian household set + user-created customs.
 * Every category carries a label, color AND a lucide icon name so lists,
 * budgets and pickers can all visualize it. Customs pick from ICON_CHOICES.
 */
export interface CategoryDef {
  key: string;
  label: string;
  color: string;
  icon: string; // lucide icon name
  hint: string[];
}

import type { CustomCat } from './types';
export type { CustomCat };

export const CATEGORIES: CategoryDef[] = [
  { key: 'groceries', label: 'Groceries', color: '#C99A00', icon: 'ShoppingBasket', hint: ['sto', 'supermarket', 'redwave', 'maafannu market', 'grocer'] },
  { key: 'food', label: 'Eating Out', color: '#E07B00', icon: 'Coffee', hint: ['cafe', 'restaurant', 'coffee', 'pizza', 'burger', 'koffee'] },
  { key: 'transport', label: 'Transport', color: '#A06A1C', icon: 'Ship', hint: ['ferry', 'taxi', 'mtcc', 'speedboat', 'fuel', 'petrol'] },
  { key: 'housing', label: 'Rent & Home', color: '#96511F', icon: 'House', hint: ['rent', 'lease', 'maintenance'] },
  { key: 'utilities', label: 'Bills', color: '#7A7261', icon: 'Zap', hint: ['stelco', 'mwsc', 'ooredoo', 'dhiraagu', 'electricity', 'water'] },
  { key: 'family', label: 'Family', color: '#C2452D', icon: 'HeartHandshake', hint: ['family', 'mother', 'father', 'transfer home', 'addu'] },
  { key: 'health', label: 'Health', color: '#C65D3B', icon: 'HeartPulse', hint: ['hospital', 'clinic', 'pharmacy', 'igmh', 'adk'] },
  { key: 'education', label: 'Education', color: '#9C5C1A', icon: 'GraduationCap', hint: ['school', 'course', 'tuition', 'mnu', 'college'] },
  { key: 'shopping', label: 'Shopping', color: '#E85D26', icon: 'ShoppingBag', hint: ['shop', 'store', 'gifts', 'home centre'] },
  { key: 'cash', label: 'Cash', color: '#5B554C', icon: 'Banknote', hint: ['atm', 'cash withdrawal'] },
  { key: 'salary', label: 'Salary', color: '#E8930C', icon: 'Briefcase', hint: ['salary', 'payroll', 'allowance'] },
  { key: 'transfer', label: 'Transfers', color: '#8A8171', icon: 'ArrowLeftRight', hint: ['transfer', 'favara', 'bml transfer'] },
  { key: 'savings', label: 'Savings', color: '#F5B800', icon: 'PiggyBank', hint: ['saving', 'goal'] },
  { key: 'other', label: 'Other', color: '#C9C2B2', icon: 'Shapes', hint: [] },
];

/** Preloaded icon choices offered when creating a custom category. */
export const ICON_CHOICES = [
  'ShoppingBasket', 'Coffee', 'Ship', 'CarFront', 'House', 'Zap', 'Waves',
  'HeartHandshake', 'HeartPulse', 'GraduationCap', 'ShoppingBag', 'Banknote',
  'Briefcase', 'PiggyBank', 'Plane', 'Smartphone', 'Dumbbell', 'Baby',
  'PawPrint', 'Gift', 'Fuel', 'Wifi',
];

export const COLOR_CHOICES = [
  '#C99A00', '#E07B00', '#E85D26', '#C2452D', '#B45309',
  '#96511F', '#9C5C1A', '#E8930C', '#7A7261', '#5B554C',
];

export type AnyCat = CategoryDef | CustomCat;

export function allCategories(customs: CustomCat[] = []): AnyCat[] {
  return [...CATEGORIES, ...customs];
}

function find(customs: CustomCat[] = [], key: string): AnyCat | undefined {
  return CATEGORIES.find((c) => c.key === key) ?? customs.find((c) => c.key === key);
}

export const categoryLabel = (key: string, customs: CustomCat[] = []) =>
  find(customs, key)?.label ?? key;

export const categoryColor = (key: string, customs: CustomCat[] = []) =>
  find(customs, key)?.color ?? '#C9C2B2';

export const categoryIcon = (key: string, customs: CustomCat[] = []) =>
  find(customs, key)?.icon ?? 'Shapes';
