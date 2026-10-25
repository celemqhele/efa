# Created users `nyanda_yephahla` + `maskandi_mfana`, assigned North West University + Siwelele (26 Oct)

Created two new EFA accounts in one pass — **nyanda_yephahla** (+27 76 180 7405) and **maskandi_mfana** (+27 79 393 5582) — with the platform default password, and assigned them to **North West University** (Motsepe Foundation Championship) and **Siwelele** (Betway Premiership) respectively, following the create-and-assign pattern in `.opencode/context/user-management/create-mjitta-user-assign-orlando-pirates_2026-10-26.md` and `.opencode/context/user-management/create-high-chief-user-assign-durban-city_2026-10-20.md` (assignment always through the real `assignManagerToClub()` service function).

## What was done

**1. Created both users and assigned both clubs in a single script** — new one-off `scripts/create-assign-nyanda-maskandi_2026-10-26.ts` (compiled from `scripts/create-mandane-user.ts` + the `.recycle/scripts/assign-high-chief-durban-city_2026-10-20.ts` assignment body, looped over both users):

| Username | Phone (digits-only) | Email | Club | Team id |
|---|---|---|---|---|
| `nyanda_yephahla` | `27761807405` (+27 76 180 7405) | `nyanda_yephahla@efa.local` | North West University | `900ec824-0d8e-48e4-b60d-a69de8feb520` |
| `maskandi_mfana` | `27793935582` (+27 79 393 5582) | `maskandi_mfana@efa.local` | Siwelele | `60fb79a7-dbb4-42e4-a040-34680092e204` |

- `PASSWORD = 'Efootball@2026'` for both — the shared `DEFAULT_USER_PASSWORD` from `app/api/webhook/route.ts` / `DEFAULT_PASSWORD` from `app/api/admin/reset-password/route.ts`.
- Both usernames stored lowercase with the underscore as given (matches the `high_chief` / `nyanda_yephahla`-style casing rule in `.opencode/context/user-management/create-high-chief-user-assign-durban-city_2026-10-20.md`).
- Case-insensitive username guard (`ilike('username', …)`) and a phone-clash guard (`eq('phone', …)`) ran clean for both before creation — pre-checked by hand too (`WHERE username ILIKE '%nyanda%' OR username ILIKE '%maskandi%' OR phone IN (…)` → 0 rows).
- Then `auth.admin.createUser({ email_confirm: true, user_metadata: { username } })`, profile upsert (username + phone), and per-user verification of username / phone / `must_change_password`.
- Run: `npx tsx scripts/create-assign-nyanda-maskandi_2026-10-26.ts`

```
[create] @nyanda_yephahla  phone 27761807405
[create] auth user created: 8a37a717-0387-460e-9778-50e6de81f939
[create] @maskandi_mfana   phone 27793935582
[create] auth user created: 49853d43-af29-4899-b222-5421fae63b7f
```

`must_change_password = true` on both (column default, see `.opencode/context/onboarding/first-login-password-prompt_2026-10-14.md`), and the `password_is_default()` RPC from `.opencode/context/onboarding/pre-update-default-password-sweep_2026-10-14.md` catches them too.

**2. Assignments** — `assignManagerToClub()` from `lib/manager-mgmt.ts` (the function behind `app/api/admin/managers/assign/route.ts`), `adminId: null` (script-run), for each user/club pair:

- **North West University** team id `900ec824-…` (`motsepe-foundation-championship-2026-2027.football-logos.cc` / `north-west-university`) — was **vacant** (`manager_id IS NULL`), single row for that logo (verified by folder+slug query, no sibling club rows). Returned `reclaimed: 3` for its unowned seats (Betway Premiership, CAF Champions League, Nedbank Cup — note the club's logo folder is Motsepe yet it holds a Premiership seat). Open tenure `6a9ef51f-0e56-440a-8350-c8a871960e02` started `2026-10-25T22:12:57Z` (= 26 Oct 00:12 SAST).
- **Siwelele** team id `60fb79a7-…` (`south-african-premiership-2026-2027.football-logos.cc` / `siwelele`) — was **vacant**, single row for that logo. Returned `reclaimed: 3` for its unowned seats (Betway Premiership, Nedbank Cup, CAF Champions League). Open tenure `de9e65cf-7ce8-4031-b148-a2a15fed2e50` started `2026-10-25T22:13:10Z` (= 26 Oct 00:13 SAST).
- Each call also inserted audit_log `assign_manager` and closed any pending manager applications for that user, as the service function does.

Going through the service function mattered here for the same reason as in `.opencode/context/user-management/create-mjitta-user-assign-orlando-pirates_2026-10-26.md`: plain SQL would have set `teams.manager_id` and the tenure but left all six seats managerless.

## Verification

- `teams.manager_id` set on both clubs (`8a37a717-…` on North West University, `49853d43-…` on Siwelele); exactly one open tenure each with the right `manager_username`.
- All 3 `tournament_participants` seats per club now carry the matching `user_id` (6 seats total).
- `auth.users.email_confirmed_at` set and `encrypted_password = crypt('Efootball@2026', encrypted_password)` → `true` for both profiles (exact bcrypt check, same test as `password_is_default()`), `must_change_password = true` on both.
- Neither club had any auto-forfeit / placeholder result on a pending fixture (`scheduled` / `awaiting_confirmation` / `confirmed_pending`) — 18 open fixtures across both clubs, all with no `results` row — so there was nothing to withdraw.

## Notes

- Both accounts were done in one script rather than the usual create/assign file pair, since the two requests arrived together and the loop keeps the guards and verification identical for each user. Re-running is safe: the username/phone guards fail fast before any auth write.
- `tsx` resolved the `@/*` tsconfig path alias and the `next/headers` import chain (`lib/manager-mgmt` → `lib/slot-utils` → `lib/supabase/server`) fine from a plain script — `createAdminClient()` never calls `cookies()`, so no request context is needed.
- Script-only change: no app code, no migration, so no `schema_migrations` bookkeeping was needed.

## Files

- `scripts/create-assign-nyanda-maskandi_2026-10-26.ts` — one-off create-both + assign-both script.

## Restore File Section

No files deleted. Nothing moved to `.recycle/` for this change.
