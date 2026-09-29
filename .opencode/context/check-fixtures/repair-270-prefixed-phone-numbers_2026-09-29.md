# Repair 27+0 phone values that could never pass the WhatsApp contacts API

## Intro
Follow-up to `.opencode/context/check-fixtures/manager-phone-backfill_2026-09-29.md`, where `dot`'s malformed `270784831815` turned out to be one of a whole class of numbers rather than a one-off. While adding that note to the new assign script (`.opencode/context/onboarding/assign-vacant-season4-seats_2026-09-29.md`) a dry-run test against `dot7` exposed the same pattern there, and 13 profiles turned out to be affected — 4 of them current Season 4 club managers.

## Problem
`toInternationalPhone()` in `app/api/webhook/route.ts:1385` normalises a stored number to E.164 for the WhatsApp contacts API. It had exactly one rewrite rule:

```ts
if (digits.startsWith('0') && digits.length === 10) return `27${digits.slice(1)}`
```

South African numbers were often saved as the country code followed by a **10-digit national number that kept its local leading zero** — `060 111 0760` became `270601110760`. That is 12 digits, which is never valid for SA (mobiles are 27 + 9 digits), and the rule above cannot see it, because the value starts with `2`, not `0`. So it fell through to `return digits` and shipped as `+270601110760`.

WhatsApp rejects such a contact card with **error 131009** ("parameter phone is not valid"), and the failure is per-card — so a single bad row in a group sync breaks the card for that member and, depending on how the caller handles the rejection, can take the whole sync attempt with it.

The previous fix in `081` corrected `dot`'s value in the data but not the normaliser, so nothing stopped the next bad entry recurring.

## Fix
Both layers, so future bad data is corrected at the boundary rather than only in the table.

**`app/api/webhook/route.ts` — normaliser.** Added a second rule, placed after the existing one (it cannot collide, since the `0`-prefixed branch never matches a value starting `2`):

```ts
if (digits.startsWith('270') && digits.length === 12) return `27${digits.slice(3)}`
```

**`supabase/migrations/082_repair_270_prefixed_phone_numbers.sql` — data.** A single `update` restricted by `~ '^270[0-9]{9}$'`, so exactly 12-digit `270`-prefixed values are rewritten and nothing else is touched. The `where` clause makes it idempotent — a second run matches zero rows. It raises if any malformed value survives, rather than leaving broken contacts behind a successful migration.

## Verification
13 rows repaired, 0 remaining. Four were current club managers: `anele_arh` (Supersport), `phiwayinkosi` (Midlands Wanderers), `siyethemba_` (Sekhukhune United), `tildedot` (TS Galaxy). The rest are clubless: `andile_vg`, `ayathaba`, `dot7`, `khumoshxta`, `khumoshxta_`, `Majun_buu`, `nkosinathi_`, `siyambonga23`, `thapelo`.

**Two of the corrections are independently confirmed**, which is what makes this safe to apply mechanically rather than asking each manager:

| Manager | Was | Now | Evidence |
|---|---|---|---|
| `phiwayinkosi` | `270694021679` | `27694021679` | inbound `whatsapp_sessions` row keyed `27694021679`, matched to a fixture involving their club |
| `siyethemba_` | `270813435890` | `27813435890` | inbound session keyed `27813435890`, matched to a fixture involving their club |

WhatsApp's inbound `from` field is always valid E.164, so those two session numbers are ground truth — and the mechanical rewrite reproduces them exactly, which validates the rule for the other eleven. The remaining eleven are corrected by pattern only (12 digits beginning `270` has exactly one valid SA interpretation, so the risk is low, but it is inference).

`npx tsc --noEmit` clean.

Also fixed while in the file: `scripts/assign-manager-to-club.ts` was updating `profiles.phone` **before** its `--dry-run` branch, so a dry run wrote to production. Verified with `dot7` — the number is now unchanged after a dry run. And the script checked no Supabase errors at all, meaning a failed write still printed `✓ ... seats reclaimed N` and left a half-applied assignment (manager_id set, no tenure, no audit row). Every mutation now goes through a `must()` helper that throws.

## Second duplicate pair found
`khumoshxtA` and `khumoshxta_` share `27795932223` — the same pattern as `ozilitf`/`ozilotf_` in `.opencode/context/check-fixtures/manager-phone-backfill_2026-09-29.md`, and the reason the ambiguous usernames `dot`/`dot7` and `karabo_`/`karabo05` needed disambiguating. Three known pairs now. Still safe, because the app never resolves a profile by phone (session → `matched_fixture_id` → fixture teams → `teams.manager_id` → profile) and there is no unique constraint on `profiles.phone`, but it makes username-based scripts fragile.

## Notes / follow-ups
- A sweep for near-duplicate usernames would be worth doing before the next season.
- `anele_arh`'s inbound session is stuck in `awaiting_phone_team_confirm`. Unrelated to this defect, but that manager's onboarding never completed — and Supersport is one of the three clubs whose fixture was voided by the `auto-finalise-prev-day` cron at 00:41Z. See `.opencode/context/onboarding/assign-vacant-season4-seats_2026-09-29.md`.
- No number was changed by inference alone from a local format that could be ambiguous; the `270` prefix is unambiguous, which is why this was applied without per-manager confirmation.

## Restore File Section
- (none — no files recycled this change)

## Cross-references
- The single-instance data fix this generalises: `.opencode/context/check-fixtures/manager-phone-backfill_2026-09-29.md`
- Where `dot`'s original malformed value was first diagnosed: `.opencode/context/onboarding/assign-vacant-season4-seats_2026-09-29.md`
- Duplicate-account pattern: `.opencode/context/onboarding/onboarding-and-manager-applications_2026-08-15.md`
- WhatsApp group / contact-card flow: `.opencode/context/check-fixtures/manager-phone-backfill_2026-09-29.md`
- Normaliser: `app/api/webhook/route.ts` (`toInternationalPhone`)
- Script fixed in passing: `scripts/assign-manager-to-club.ts`
- Migration: `supabase/migrations/082_repair_270_prefixed_phone_numbers.sql`
