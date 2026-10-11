# Security & Privacy — Ruh (local-first build)

## Architecture summary

Single-page app, no server, no analytics, no third-party scripts beyond Google
Fonts (graceful offline fallback to system fonts). All records persist in the
browser's `localStorage` under key `ruh-mv-v1`. Nothing is transmitted anywhere:
import parsing, categorization, and all calculations run on-device.

## Data-flow description

```
User input / pasted SMS / CSV file
  → in-memory parse & validate (bmlParser / csv, Zod on forms)
    → user previews & corrects (uncertain rows default unchecked)
      → confirmed rows enter store → localStorage
Charts, budgets, insights read from the store only.
Export writes a local file download. No network calls carry user data.
```

## Threat model (realistic, this build)

| Risk | Status |
|---|---|
| XSS via merchant/notes rendering | React escapes by default; no `dangerouslySetInnerHTML` anywhere; CSV export prefixes `= + - @` cells with `'` against formula injection |
| Malformed/oversized imports | Per-row validation, never silent; 2 MB file cap; unknown SMS formats rejected, not guessed |
| Cross-user data leak | N/A locally — one profile per browser; demo data explicitly separated; cloud RLS required before any sync ships (see README mapping) |
| Secrets in client / logs | No secrets exist; raw SMS kept only as ≤120-char reference per txn, never logged; no console logging of financial data |
| Dependency vulns | `npm audit` recommended pre-release; pinned major versions; minimal dep surface (no state lib, no AI SDK) |
| Physical device / shared browser | **Residual risk:** localStorage is not encrypted. Documented in-app and in Settings; export + erase provided; users with shared devices should use a private profile |

## Financial integrity

- Integer minor units (laari); explicit half-away-from-zero parsing; no floats.
- Duplicate detection via `type|amount|merchant|date` fingerprint at import.
- Internal transfers excluded from income/expense; refunds netted; cash
  double-count heuristic warns instead of silently adjusting.
- Edit preserves original amount display; delete offers undo; bulk actions
  require explicit confirmation per row (checkboxes).

## Secrets

None required. `.env.example` is intentionally minimal. If Supabase is added
later: `VITE_SUPABASE_URL` + anon key in client, service-role key server-only,
never committed.

## Data retention & deletion

Retention = until the user deletes. Settings → Export (CSV/JSON) → Delete all
data (two-step confirm, clears the storage key). No backups leave the device.

## Pre-release checklist

- [ ] `npm test`, `npm run typecheck`, `npm run build` green
- [ ] `npm audit` reviewed; `rg -i "password|otp|pin|secret|api[_-]?key" src` clean
- [ ] Import fuzz: OTP texts, empty files, 2 MB+ files, emoji merchants
- [ ] Contrast + keyboard pass on light & dark; reduced-motion respected
- [ ] If adding Supabase: RLS on every table + cross-user access test before ship

No regulatory-compliance claim is made. This document describes the build as-is.
