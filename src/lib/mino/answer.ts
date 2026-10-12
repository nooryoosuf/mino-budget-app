/**
 * Mino answer composer — plain-language replies built ONLY from tool output.
 * Concise by default. Honest about thin data. Never invents figures:
 * unknown intents and empty histories get graceful fallbacks, never numbers.
 */
import { categoryLabel } from '../categories';
import { fmt } from './tools';
import {
  biggestExpenses, budgetStatus, compareMonths, evaluatePurchase, frequentSpending, monthKey,
  outflowOf, proposeBudgetUpdate, proposeGoal, safePosition, savingsPlan,
  searchMerchant, spendingByCategory, summarizeMonth, summarizeWeek,
} from './tools';
import { detectAnomalies } from './radar';
import type { Intent } from './parse';
import type { MinoAnswer } from './types';
import type { StoreShape } from '../store';

const thin = (s: StoreShape) => s.txns.length < 3;

export function suggestionsFor(s: StoreShape): string[] {
  const out = ['Where did my money go?', 'Plan my money until payday'];
  if (s.txns.length >= 8) out.push('Anything unusual lately?');
  if (s.txns.length > 0) out.push('Show my biggest expenses');
  if (s.budgets.length > 0) out.push('Which budgets are over?');
  else out.push('Set my food budget to MVR 2,000');
  if (s.goals.length > 0) out.push('Am I on track?');
  else out.push('Help me save MVR 10,000 for a trip in 6 months');
  out.push('Can I afford MVR 8,000?');
  return out.slice(0, 5);
}

export function respond(raw: string, intent: Intent, s: StoreShape): MinoAnswer {
  if (s.txns.length === 0 && !['greet', 'help', 'unknown'].includes(intent.kind)) {
    return {
      mood: 'idle',
      text: `I don't have anything to work with yet — no transactions recorded. Add a few manually, paste a BML alert on Home, or load demo data in Settings and ask me again.`,
      followUps: ['What can you help with?'],
    };
  }

  switch (intent.kind) {
    case 'greet': {
      const name = s.prefs.displayName.trim().split(' ')[0];
      return {
        mood: 'happy',
        text: `Hey${name ? ` ${name}` : ''}! I'm Mino, your money treasurer. Ask me where your money went, whether you can afford something, or how to reach payday comfortably — all from your own records.`,
        followUps: suggestionsFor(s).slice(0, 3),
      };
    }
    case 'help':
      return {
        mood: 'idle',
        text: `Here's what I can do with your real data: spending breakdowns by week, month, category or merchant; income and savings summaries; month comparisons; budget tracking; payday plans; purchase checks; and savings plans. Say "set my food budget to MVR 2,000" and I'll draft it for your approval.`,
        followUps: suggestionsFor(s).slice(0, 3),
      };

    case 'spend-week': {
      const w = summarizeWeek(s);
      return {
        mood: 'idle',
        text: `In the last 7 days you recorded ${fmt(w.expense)} of spending across ${w.n} transaction${w.n === 1 ? '' : 's'}. Income in the same window: ${fmt(w.income)}.`,
        followUps: ['Where did my money go?', 'Compare with last month'],
        inspect: { label: 'See these transactions', q: '' },
      };
    }

    case 'spend-month': {
      const m = summarizeMonth(s, intent.offset);
      if (m.n === 0) {
        return { mood: 'idle', text: `Nothing recorded for ${m.label} yet — I won't guess. Log a few transactions and I'll break it down.`, followUps: ['Plan my money until payday'] };
      }
      const { slices } = spendingByCategory(s, m.from, m.to, 3);
      const top = slices.map((c) => `${fmt(c.value)} on ${c.label.toLowerCase()}`).join(', ');
      return {
        mood: 'idle',
        text: `${m.label}: ${fmt(m.income)} in, ${fmt(m.expense)} out across ${m.n} records. ${top ? `Biggest slices — ${top}.` : ''} Net ${m.net >= 0 ? 'kept' : 'over'}: ${fmt(Math.abs(m.net))}.`,
        followUps: ['Show my biggest expenses', 'Compare with last month', 'Plan my money until payday'],
        inspect: { label: 'See the transactions', q: '' },
      };
    }

    case 'spend-category': {
      const mk = monthKey(intent.offset);
      const list = s.txns.filter((t) => t.date.slice(0, 7) === mk && t.category === intent.category && (t.type === 'expense' || t.type === 'cash_withdrawal'));
      const total = list.reduce((a, t) => a + t.amountLaari, 0);
      const label = categoryLabel(intent.category, s.customCats);
      if (list.length === 0) {
        return { mood: 'idle', text: `No ${label.toLowerCase()} spending recorded ${intent.offset === -1 ? 'last' : 'this'} month. If some's missing, log it or check the category on those transactions.`, followUps: ['Where did my money go?'] };
      }
      const avg = Math.round(total / Math.max(1, list.length));
      return {
        mood: 'idle',
        text: `${label} ${intent.offset === -1 ? 'last' : 'this'} month: ${fmt(total)} across ${list.length} transaction${list.length === 1 ? '' : 's'} (about ${fmt(avg)} each).`,
        followUps: ['Which budgets are over?', 'Compare with last month'],
        inspect: { label: `See ${label.toLowerCase()} transactions`, category: intent.category },
      };
    }

    case 'spend-merchant': {
      const r = searchMerchant(s, intent.merchant);
      if (r.n === 0) {
        return { mood: 'idle', text: `I can't find "${intent.merchant}" in your records — no match on merchant or notes. Try the exact shop name as it appears in Activity.`, followUps: ['Show my biggest expenses'] };
      }
      return {
        mood: 'idle',
        text: `"${intent.merchant}" shows up ${r.n} time${r.n === 1 ? '' : 's'} — about ${fmt(r.total)} of recorded spending in the recent matches.`,
        followUps: ['Where did my money go?'],
        inspect: { label: 'See matching transactions', q: intent.merchant },
      };
    }

    case 'income': {
      const m = summarizeMonth(s, intent.offset);
      return {
        mood: 'idle',
        text: `Recorded income for ${m.label}: ${fmt(m.income)}. That's salary and other money-in — transfers between your own accounts aren't counted.`,
        followUps: ['Where did my money go?', 'How much did I save?'],
      };
    }

    case 'saved': {
      const m = summarizeMonth(s, 0);
      const kept = m.income - m.expense;
      if (m.income === 0) {
        return { mood: 'idle', text: `No income recorded this month, so I can't compute a savings rate. Log your salary first — then I'll tell you exactly what you kept.` };
      }
      const rate = Math.round((kept / m.income) * 100);
      return {
        mood: kept >= 0 ? 'happy' : 'warning',
        text: kept >= 0
          ? `You kept ${fmt(kept)} of ${fmt(m.income)} — a ${rate}% savings rate. Nicely held.`
          : `Spending beat income by ${fmt(Math.abs(kept))} this month. Want a payday plan to turn that around?`,
        followUps: kept >= 0 ? ['Help me save for a trip', 'Am I on track?'] : ['Plan my money until payday', 'Show my biggest expenses'],
      };
    }

    case 'compare': {
      const { cur, prev, deltaPct } = compareMonths(s);
      if (prev.n === 0) {
        return { mood: 'idle', text: `Last month has no records, so there's nothing honest to compare against. This month so far: ${fmt(cur.expense)} out. Keep logging and I'll compare properly.` };
      }
      const dir = (deltaPct ?? 0) >= 0 ? 'up' : 'down';
      return {
        mood: 'idle',
        text: `${cur.label} so far: ${fmt(cur.expense)}. Last month: ${fmt(prev.expense)}. That's ${Math.abs(deltaPct ?? 0)}% ${dir} — income was ${fmt(cur.income)} vs ${fmt(prev.income)}.`,
        followUps: ['Show my biggest expenses', 'Where did my money go?'],
      };
    }

    case 'radar': {
      const flags = detectAnomalies(s);
      if (flags.length === 0) {
        return {
          mood: 'happy',
          text: s.txns.length < 4
            ? `Too little history for a proper scan — log a few more weeks and I'll watch for duplicates and spikes.`
            : `All clear — no duplicates, spikes or outsized outflows in your recent records.`,
          followUps: ['Show my biggest expenses', 'Where did my money go?'],
        };
      }
      const top = flags[0];
      return {
        mood: top.severity === 'bad' ? 'warning' : 'warning',
        text: `${flags.length} thing${flags.length === 1 ? '' : 's'} worth a look: ${flags.map((f) => `${f.title} — ${f.detail}`).join(' ')}`,
        followUps: ['Show my biggest expenses', 'Where did my money go?'],
        inspect: top.merchant ? { label: 'Inspect flagged transactions', q: top.merchant } : { label: 'Review in Activity', q: '' },
      };
    }

    case 'biggest': {
      const top = biggestExpenses(s, 0);
      if (top.length === 0) return { mood: 'idle', text: `No expenses recorded this month yet.` };
      const lines = top.slice(0, 3).map((t) => `${t.merchant} · ${fmt(t.amountLaari)}`).join('; ');
      return {
        mood: 'idle', text: `Your biggest this month: ${lines}.`,
        followUps: ['Where did my money go?', 'Can I afford MVR 8,000?'],
        inspect: { label: 'Review them in Activity', q: '' },
      };
    }

    case 'frequent': {
      const f = frequentSpending(s);
      if (!f.merchant && !f.category) {
        return { mood: 'idle', text: `Not enough history to call anything "common" yet — log a few more weeks and I'll spot your repeats.` };
      }
      const bits: string[] = [];
      if (f.merchant) bits.push(`${f.merchant.name} shows up ${f.merchant.n} times (${fmt(f.merchant.total)})`);
      if (f.category) bits.push(`${f.category.label.toLowerCase()} ${f.category.n} times (${fmt(f.category.total)})`);
      return {
        mood: 'idle',
        text: `Your most common spending ${f.scope}: ${bits.join(' · ')}. Small repeats like these are usually the easiest place to trim.`,
        followUps: ['Show my biggest expenses', 'Where did my money go?'],
        inspect: f.merchant ? { label: `See ${f.merchant.name} visits`, q: f.merchant.name } : undefined,
      };
    }

    case 'budgets': {
      if (s.budgets.length === 0) {
        return { mood: 'idle', text: `You haven't set any budgets yet. Tell me one — "set my food budget to MVR 2,000" — and I'll draft it for your approval.`, followUps: ['Plan my money until payday'] };
      }
      const lines = budgetStatus(s);
      const over = lines.filter((l) => l.status === 'over');
      const summary = lines.map((l) => `${l.name}: ${fmt(l.spent)} of ${fmt(l.limit)}`).join('; ');
      return {
        mood: over.length ? 'warning' : 'happy',
        text: over.length
          ? `${over.length} envelope${over.length === 1 ? ' is' : 's are'} over: ${over.map((l) => `${l.name} (${fmt(l.spent)} vs ${fmt(l.limit)})`).join(', ')}. The rest — ${summary}.`
          : `All envelopes holding: ${summary}.`,
        followUps: ['Plan my money until payday', 'Am I on track?'],
      };
    }

    case 'balance': {
      const { available, payday } = safePosition(s);
      return {
        mood: 'idle',
        text: `From your records: about ${fmt(available)} available (opening balance plus recorded income minus recorded outgo). That's a recorded figure, not your live bank balance — and ${payday.days} day${payday.days === 1 ? '' : 's'} to payday.`,
        followUps: ['Plan my money until payday', 'What bills are coming?'],
      };
    }

    case 'payday': {
      const { payday } = safePosition(s);
      return {
        mood: 'idle',
        text: `${payday.days} day${payday.days === 1 ? '' : 's'} to payday — ${payday.date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}. Your payday is set to day ${s.prefs.paydayDay}; change it in Budgets if that's off.`,
        followUps: ['Plan my money until payday', 'What bills are coming?'],
      };
    }

    case 'upcoming': {
      const { upcoming } = safePosition(s);
      if (upcoming.length === 0) {
        return { mood: 'idle', text: `No upcoming bills on my list before payday. Add recurring bills in Budgets and I'll watch them for you.` };
      }
      const total = upcoming.reduce((a, r) => a + r.amountLaari, 0);
      return {
        mood: 'idle',
        text: `Before payday: ${upcoming.map((r) => `${r.name} ${fmt(r.amountLaari)} (${r.nextDate.slice(5)})`).join('; ')} — ${fmt(total)} all together.`,
        followUps: ['Plan my money until payday', 'Can I afford MVR 8,000?'],
      };
    }

    case 'plan': {
      const { calc, payday, upcoming } = safePosition(s);
      return {
        mood: 'idle',
        text: `Payday plan: ${fmt(calc.safeLaari)} safe across ${payday.days} days — about ${fmt(calc.perDayLaari)} a day. That already holds back ${fmt(upcoming.reduce((a, r) => a + r.amountLaari, 0))} for bills${calc.warnings.length ? ` (note: ${calc.warnings[0]})` : ''}. Full breakdown's on Home.`,
        followUps: ['Can I afford MVR 8,000?', 'Which budgets are over?'],
      };
    }

    case 'ontrack': {
      if (s.budgets.length === 0 && s.goals.length === 0) {
        return { mood: 'idle', text: `Nothing to measure against yet — no budgets, no goals. Set one ("set my food budget to MVR 2,000") and I'll keep score honestly.` };
      }
      const lines = budgetStatus(s);
      const bad = lines.filter((l) => l.status !== 'ok');
      const goals = s.goals.map((g) => `${g.name} ${Math.round((g.savedLaari / Math.max(1, g.targetLaari)) * 100)}%`);
      return {
        mood: bad.length ? 'warning' : 'happy',
        text: bad.length
          ? `Needs attention: ${bad.map((l) => `${l.name} at ${Math.round(l.pct)}%`).join(', ')}.${goals.length ? ` Goals — ${goals.join('; ')}.` : ''}`
          : `On track across the board.${goals.length ? ` Goals — ${goals.join('; ')}.` : ''}`,
        followUps: ['Plan my money until payday', 'Help me save for a trip'],
      };
    }

    case 'afford': {
      const v = evaluatePurchase(s, intent.amountLaari);
      const verdict = v.verdict === 'comfortable'
        ? `Looks affordable — ${fmt(v.remaining)} would remain after obligations and savings.`
        : v.verdict === 'tight'
          ? `Possible, but tight — only ${fmt(Math.max(0, v.remaining))} left for the rest of the cycle. Consider waiting until payday.`
          : `I'd hold off — this would put you ${fmt(Math.abs(v.remaining))} past your safe position.`;
      const math = v.lines.map((l) => `${l.label}: ${fmt(Math.abs(l.laari))}`).join(' · ');
      return {
        mood: v.verdict === 'unwise' ? 'warning' : v.verdict === 'tight' ? 'warning' : 'happy',
        text: `${intent.item === 'this' ? 'That' : `The ${intent.item}`} at ${fmt(v.amountLaari)}: ${verdict} My maths — ${math}.${v.caveats.length ? ` Caveats: ${v.caveats[0]}` : ''}`,
        followUps: ['Plan my money until payday', 'Show my biggest expenses'],
      };
    }

    case 'goal-plan': {
      const months = intent.months ?? 6;
      const p = savingsPlan(s, intent.targetLaari, months);
      return {
        mood: 'idle',
        text: `${fmt(p.targetLaari)} in ${months} months means ≈${fmt(p.monthlyLaari)} a month.${p.lastMonthNet > 0 ? ` Last month you kept ${fmt(p.lastMonthNet)} — ${p.feasible ? 'that pace covers it.' : 'that pace falls short, so something has to give.'}` : ` I can't judge feasibility yet — no surplus recorded last month.`}`,
        followUps: ['Am I on track?', 'Plan my money until payday'],
      };
    }

    case 'goal-create': {
      if (intent.targetLaari === null) {
        return {
          mood: 'happy',
          text: `A ${intent.name} fund — love it. How much should we aim for? Just reply with a number like MVR 10,000${intent.months ? ` (I'll spread it over ${intent.months} months)` : ''}.`,
          clarify: { prompt: 'goal-target', slot: 'goal-target', draft: { name: intent.name, months: intent.months } },
          followUps: [],
        };
      }
      const r = proposeGoal(s, intent.name, intent.targetLaari, intent.months ?? undefined);
      if ('error' in r) return { mood: 'idle', text: r.error };
      return { mood: 'happy', text: `Here's the draft — confirm and I'll create it.`, proposal: r, followUps: ['Am I on track?'] };
    }

    case 'budget-set':
    case 'budget-change': {
      const current = intent.kind === 'budget-change'
        ? (() => {
          const b = s.budgets.find((x) => x.category === intent.category);
          const base = b ? b.limitLaari : 0;
          return { amountLaari: Math.max(0, base + intent.deltaLaari) };
        })()
        : { amountLaari: intent.amountLaari };
      if (current.amountLaari <= 0) {
        return { mood: 'idle', text: `That would take the envelope to zero or below — tell me the new monthly figure directly, like "set food budget to MVR 1,500".` };
      }
      const r = proposeBudgetUpdate(s, intent.category, current.amountLaari);
      if ('error' in r) return { mood: 'idle', text: r.error };
      return { mood: 'idle', text: `Here's the draft — confirm and I'll save it.`, proposal: r };
    }

    case 'bulk-file': {
      const n = s.txns.filter((t) => !t.reviewed).length;
      if (n === 0) return { mood: 'happy', text: `Nothing needs filing — every transaction is already reviewed.` };
      return {
        mood: 'idle',
        text: `I'll file ${n} unreviewed transaction${n === 1 ? '' : 's'} and remember the merchants for next time. Confirm and I'll do it.`,
        proposal: {
          kind: 'bulk-file', title: `File ${n} as ${intent.raw}?`,
          summary: `${n} unreviewed → ${intent.raw}.`,
          effect: 'Merchant memory updates too, so future matches file themselves.',
          payload: { category: intent.category },
        },
      };
    }

    default: {
      if (thin(s)) {
        return {
          mood: 'idle',
          text: `I want to answer from your real records, not guess — and there's barely anything here yet. Try "where did my money go?" once you've logged a few transactions, or "what can you help with?" for ideas.`,
          followUps: ['What can you help with?'],
        };
      }
      return {
        mood: 'idle',
        text: `I'm not sure what you're asking — I only answer from your recorded data, I never guess. Try one of these, or rephrase with a month, category or merchant.`,
        followUps: suggestionsFor(s).slice(0, 3),
      };
    }
  }
}
