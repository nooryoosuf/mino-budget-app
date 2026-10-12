/** Mino engine shared types. */
import type { Txn } from '../types';

export interface Proposal {
  kind: 'budget-create' | 'budget-update' | 'goal-create' | 'bulk-file';
  title: string;
  summary: string;
  effect: string;
  payload: Record<string, string | number>;
}

export interface InspectRef {
  label: string;
  q?: string;
  category?: string;
}

export interface Clarify {
  prompt: string;
  slot: 'goal-target';
  draft: { name: string; months: number | null };
}

export interface MinoAnswer {
  text: string;
  mood: 'idle' | 'happy' | 'warning' | 'thinking';
  followUps?: string[];
  proposal?: Proposal;
  clarify?: Clarify;
  inspect?: InspectRef;
}
