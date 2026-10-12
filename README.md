# Mino App · Your Budgeting Companion

A Maldives-first personal finance & budgeting app. MVR by default, salary-cycle
safe-to-spend, Favara/family transfer handling, cash-spending honesty, BML SMS
import foundation, budgets, island-themed savings goals, and calculated insights.

**Stack:** React 19 + TypeScript + Vite · Tailwind CSS v4 · Recharts · Framer Motion
· React Hook Form + Zod · Lucide icons · Vitest. No backend, no paid APIs.

**Liquid Glass:** hand-rolled material in `src/components/glass/` (`GlassButton`,
`GlassBar`, shared SVG refraction filters, clear/regular/tinted variants) using
`backdrop-filter: url(#ruh-lg)` displacement + CSS specular layers, with a frosted
fallback where SVG-filter backdrops are unsupported. Preview it in
Settings → "Liquid Glass lab". We evaluated `nikdelvin/liquid-glass` (MIT) and
deliberately did **not** take the dependency: it ships Astro components, not a
React package (integration = git-clone + manual port, incl. Anime.js), with very
low maintenance activity (13 commits, 110 stars) — reimplementing its documented
technique dependency-free keeps our bundle small and our conventions intact.

## Implementation plan (as built)

- **Architecture:** local-first SPA. `src/lib/` holds pure, tested domain logic
  (`money`, `bmlParser`, `categorize`, `csv`, `safeToSpend`, `insights`);
  `src/lib/store.tsx` is the only persistence boundary (localStorage);
  `src/components/` + `src/views/` are thin UI over the store. No state library.
- **UI:** light sand theme default, midnight-ink dark theme; lagoon-teal accent;
  tabular numerals; bottom nav on mobile, sidebar on desktop; lazy-loaded views.
- **Database:** browser localStorage under key `ruh-mv-v1` (see limitations below).
  Schema section below maps 1:1 to a future Supabase/Postgres schema with RLS.
- **Security:** no auth in this build (nothing leaves the device). See `SECURITY.md`.
- **Testing:** `npm test` — 17 unit tests across parsing, money, budgets,
  safe-to-spend, CSV, insights. `npm run typecheck`, `npm run build` verified.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173
npm test         # vitest run
npm run build    # production bundle in dist/
npm run preview  # serve the production build
```

No credentials, no `.env` values, no external services required.

## BML alerts (sender 455)

A website cannot read your SMS inbox — no browser API exists for that, by
design. Mino therefore offers two honest paths:

1. **Share from your SMS app (recommended):** open the 455 message → Share →
   Mino. The installed app opens straight into the import preview with the
   text prefilled. Works because of the Web Share Target in the manifest.
2. **Paste:** copy the 455 text into Import → Pasted SMS.

Both flows run the versioned on-device parser with confidence scores and
duplicate detection.

3. **Android app (full-auto):** the Capacitor build (`android/`, custom
   `SmsConsentPlugin`) watches sender 455 through Android's SMS User Consent
   API — one tap per alert, no SMS permission, Play-policy safe. Enable it in
   Settings → "Auto-read 455 alerts". Debug APKs are built free in CI
   (Actions → "Android APK (debug)" → Run workflow → download `mino-debug-apk`).
   Sideload to test; Play release ($25) comes later if wanted.

## Ask Mino (personal treasurer)

Tap the Mino mascot (bottom-right) or "Ask Mino" anywhere in the app. Mino
answers from your **real recorded data** using deterministic tools in
`src/lib/mino/` (spending, income, budgets, payday plan, affordability,
savings plans) — no AI API, no network, no account needed. Budget, goal and
bulk-filing changes are drafted as **proposal cards** and only apply after
you confirm. Unknown questions and thin data get honest fallbacks, never
invented figures. `src/lib/mino/provider.ts` is the seam where a future
server-side LLM could plug in (tool-calling only; maths stay in app code).

### Optional AI brain (free, off by default)

Mino understands common phrasing fully offline. For trickier wording, add a
free Google AI Studio key in Settings → "Mino's AI brain". The model acts
**only as an intent router**: it sees your question plus monthly aggregates
and must return one structured `finance_intent` call — all money maths and
replies still run in local code. No raw transactions, SMS text, or history
ever leave the device. Any failure (offline, bad key, quota) silently falls
back to the offline engine. Remove the key anytime to go offline-only.

## Using the app (main journey)

1. Onboarding: name → trusted opening balance → payday → start fresh or load demo.
2. Overview: recorded in/out/net, cash-flow chart, safe-to-spend card with
   actual-vs-estimate breakdown, spending mix, recent activity.
3. Quick-add (＋) or Import: paste BML SMS texts or CSV → preview with
   confidence → uncheck anything uncertain → confirm. Duplicates skipped.
4. Activity: search/filter/sort, edit + delete (undo), bulk-file unreviewed.
5. Budgets: payday config, envelopes with pace alerts, recurring bills.
6. Goals: island identity per goal, progress + monthly pace.
7. Insights: income-vs-spending, top merchants, calculated observations only.
8. Settings: rules, export CSV / backup JSON, demo toggle, full erase.

## Key domain rules

- Money is **integer laari** everywhere (`src/lib/money.ts`). No float ledger math.
- Internal transfers are never income/expense. Refunds contra expenses.
  ATM withdrawals count as outflow; if manual cash purchases also exist in the
  same cycle the safe-to-spend card warns about double-counting.
- The parser **never invents** a transaction: unknown SMS → `ok:false` + review.
  Amount vs balance are separate fields. See `src/lib/bmlParser.ts`.
- Insights require data (≥5 txns); otherwise the section says so honestly.

## Future Supabase mapping (not yet implemented)

Tables: `profiles`, `accounts`, `transactions` (amount_minor int, type, category,
merchant, occurred_on, source, reviewed, import_session, parser_id, user_id),
`categories`, `rules`, `budgets`, `goals`, `recurring`, `import_sessions`,
`merchants`. RLS: `user_id = auth.uid()` on all user tables; service-role key
server-only. Deletion cascades per user; export = SELECT own rows.

## What's complete / simulated / pending

- ✅ Complete: all six sections, quick-add, CSV+SMS import with preview,
  versioned SMS parser + fixtures, rules + learned categorization, budgets,
  safe-to-spend with breakdown, goals, insights, theming, tests, docs.
- 🟡 Simulated: demo ledger (explicitly labelled, one-tap reset).
- ⏳ Pending external access: live BML balance (no official API — intentionally
  not integrated), automatic SMS reading (needs a real Android build + Play
  policy review), cloud sync (needs Supabase project + RLS review), Dhivehi
  localization (needs native-speaker testing).
