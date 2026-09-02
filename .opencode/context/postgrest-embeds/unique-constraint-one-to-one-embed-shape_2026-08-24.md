# FT fixtures showed "vs" instead of scores — PostgREST embed shape changed to one-to-one

Date: 2026-08-24
Chain: `postgrest-embeds/` (new — DB constraint ↔ API embed shape hazard)

## Symptom

On `/admin/fixtures/manage?date=2026-08-24`, every confirmed (FT) game showed "vs" in the
Score column instead of the actual score. Same latent bug on the admin calendar and the
home page Upcoming Fixtures widget.

## Diagnosis

The data was fine — every confirmed fixture had a results row (verified via SQL join and
by replaying the exact supabase-js query with the service key: `result` came back as
`{"home_score":10,"away_score":1}`, an OBJECT).

Root cause: a **unique index** exists on `results(fixture_id)`
(`results_fixture_id_key`). PostgREST detects the one-to-one cardinality and returns
the `result:results(...)` / `results(...)` embed as a single object, NOT an array.
All code written when the relationship was one-to-many still did `f.result?.[0]`
→ always `undefined` → falsy → rendered 'vs'. The pages that had been written or fixed
with `Array.isArray(x) ? x[0] : x` (team detail, public results, fixture detail h2h)
kept working, which made the bug look intermittent/"timing".

## Fix

Treat the embed as an object everywhere it was array-assumed:

- `app/(admin)/admin/fixtures/manage/page.tsx` — aggregate gate `f.result?.[0]` → `f.result`
- `app/(admin)/admin/fixtures/manage/_mobile.tsx` / `_desktop.tsx` — `fx.result?.[0]` → `fx.result`
- `app/_mobile.tsx` / `app/_desktop.tsx` — home upcoming widget object access
- `app/(admin)/admin/calendar/_mobile.tsx` / `_desktop.tsx` — object access

## Gotchas for next time

- Adding/keeping a UNIQUE constraint on an FK column silently changes every PostgREST
  embed over that relationship from `[...]` to `{...}`. Any code doing `embed?.[0]`
  dies quietly (renders fallback UI, no error).
- When a page shows stale/placeholder UI ("vs", TBC) but SQL says the data exists,
  suspect the embed SHAPE first — log/replay the exact query before touching logic.
- Safe access pattern that survives both shapes:
  `const r = Array.isArray(f.result) ? f.result[0] : f.result`.
- Repro script pattern: read `.env.local`, build URL from the project ref in
  `.env.supabase`, createClient with `SUPABASE_SERVICE_ROLE_KEY`, run the same select
  string as the page. (Script preserved at `.recycle/tmp-test-embed.mts`.)

## Related files
This cross-cutting embed-shape fix touches pages documented elsewhere:
- `.opencode/context/home-upcoming-widget/home-upcoming-widget_2026-08-15.md` — home upcoming
  widget (`f.result` object access)
- `.opencode/context/knockout-generation/backdoor-dashboard-approve-progression_2026-08-24.md` —
  AGG display on the backdoor dashboard
