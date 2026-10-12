/**
 * Mino provider seam — the model is configurable, the math is not.
 *
 * Today: `LocalMinoProvider` (deterministic on-device NLU + real tools).
 * It needs no API key, no network, and never invents figures.
 *
 * Later: implement `MinoProvider` with an LLM that ONLY emits validated
 * tool calls (see TOOLS below); trusted app code keeps doing the maths.
 * Required server-side env at that point (documented in .env.example):
 *   MINO_MODEL_URL, MINO_MODEL_KEY — never ship keys in client bundles.
 */
import type { StoreShape } from '../store';
import { parseIntent } from './parse';
import { respond, suggestionsFor } from './answer';
import type { MinoAnswer } from './types';

export const TOOL_SCHEMAS = [
  'get_financial_summary', 'get_spending_by_category', 'get_transactions',
  'compare_spending_periods', 'get_budget_status', 'calculate_safe_to_spend',
  'get_upcoming_expenses', 'evaluate_purchase', 'get_savings_goals',
  'calculate_savings_plan', 'create_budget', 'update_budget',
  'create_savings_goal', 'categorize_transaction',
] as const;

export interface MinoProvider {
  readonly id: string;
  answer(input: string, state: StoreShape): Promise<MinoAnswer>;
  suggestions(state: StoreShape): string[];
}

export class LocalMinoProvider implements MinoProvider {
  readonly id = 'local-v1';
  async answer(input: string, state: StoreShape): Promise<MinoAnswer> {
    // tiny beat so the thinking state reads honestly as "working"
    await new Promise((r) => setTimeout(r, 350));
    return respond(input, parseIntent(input, state), state);
  }
  suggestions(state: StoreShape): string[] {
    return suggestionsFor(state);
  }
}

export const minoProvider: MinoProvider = new LocalMinoProvider();
