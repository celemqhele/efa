# WhatsApp / chat link previews showed a generic EFA card for every link

## What was done

Replaced the site-wide generic link-preview metadata with per-route metadata and a
dynamic preview-image route, so a link pasted into WhatsApp renders the actual page
(a poll's own title, a real scoreline, a fixture matchup) instead of "EFA —
Efootball Federal Association". This is a new topic: no earlier context file covered
Open Graph metadata or link previews, and the defect predated the Jun 2026
per-page metadata work recorded below.

## Problem

The user reported that pasting **any** EFA link into WhatsApp produced a preview box
reading "Efootball Federal Association APP / The official league management site for
efootball" rather than the specific page.

Confirmed against production with `Invoke-WebRequest` on the OG tags, not inferred:

```
https://efa-fxyk.vercel.app/standings  og:title "Standings | EFA"                        <- correct
https://efa-fxyk.vercel.app/polls      og:title "EFA - Efootball Federal Association"     <- generic fallback
https://efa-fxyk.vercel.app/           og:title "EFA - Efootball Federal Association"     <- generic fallback
```

Root cause: **31 of 41 routes had no `metadata` export at all**, so they inherited
`title.default` from `app/layout.tsx`. The routes without metadata included every
link a member would realistically share:

- `app/(public)/polls/[share_code]/page.tsx` — poll share links
- `app/(public)/fixtures/[id]/page.tsx` — match cards
- `app/(public)/results/[id]/page.tsx` — result cards
- `app/(public)/calendar/page.tsx`, `app/(public)/polls/page.tsx`,
  `app/(public)/teams/[id]/fixtures/page.tsx`
- `app/(auth)/login`, `app/(auth)/register`
- `app/(protected)/profile`, `app/(protected)/notifications`
- 21 of 22 admin pages

WhatsApp reads `og:title` / `og:description` / `og:image` and **ignores** the `<title>`
element entirely, so a route with no `openGraph` block has nothing page-specific to
show. Only 10 routes had metadata, added in commit `8f07c48` ("Add OG image, per-page
metadata, ...").

### The reported strings were never in the codebase

Worth recording so this is not re-investigated. The exact text the user quoted
(`"…APP"`, `"The official league management site for efootball"`) appears in **neither**
the working tree nor any commit in history. Verified with `git log --all -S` across the
full repo. The live site served `"The official EFA league management platform for
competitive eFootball."`, so what the user saw was almost certainly WhatsApp's own
link-preview cache (keyed on the exact URL, cached for weeks) from before `8f07c48`,
or a paraphrase. The code defect above is real regardless and fully explains the
generic card.

### Also found

- `metadataBase` was unset in `app/layout.tsx`, so OG image URLs fell back to Next's
  `VERCEL_URL` / `localhost:3000` env chain. Worked on Vercel by luck; would emit
  `localhost` image URLs anywhere else.
- `app/opengraph-image.tsx:7-9` fetched an Inter TTF from `fonts.gstatic.com` at request
  time with no timeout, try/catch, or cache. Satori **throws** when it has no font, so a
  Google Fonts outage would 500 the OG route and strip the image off every preview
  site-wide.
- One static OG image for the entire site, so even correct titles all shared the same
  generic "EFA" card.
- No `app/robots.ts` and no `app/sitemap.ts` anywhere. Not blocking crawlers (they are
  allowed by default), but nothing was helping discovery either.
- `app/(admin)/admin/standings/page.tsx` had `title`/`description` but no `openGraph`
  block.
- `viewport.themeColor` was the CSS var `'var(--color-accent)'`, which is not a valid
  value for that field.
- `middleware.ts` 307-redirects all `/admin/*` for unauthenticated requests, so shared
  admin links get scraped as `/login`. **Deliberately not fixed** — admin metadata
  should not be indexed, and the crawlers being redirected to login is correct here.

## Fix

### `lib/og.ts` (new)

Shared helpers so each route's block stays a few lines and `og:` / `twitter:` never
drift apart:

- `ogMeta({ title, description, path, subtitle, badge, home, away, withImage })` —
  returns a `Metadata` fragment with `openGraph` + `twitter` + canonical, pointing
  `images` at `/api/og`.
- `ogImagePath(params)` — builds the query string. Crests use short keys
  (`hf`/`hs`/`af`/`as`) to keep the URL well within what crawlers tolerate.
- `formatMatchday(value)` — see the date trap below.
- `roundLabel(roundType, leg)` — `qf` → `Quarter-final`, appends `— Leg 2` when `leg > 1`.

### `app/api/og/route.tsx` (new)

Dynamic 1200×630 card via `ImageResponse`. Params: `title`, `subtitle`, `badge`, plus
optional `hf`/`hs`/`af`/`as` crests. When both crests resolve it renders a
`crest — VS — crest` row above a centred headline; otherwise a left-aligned text card.
Per-crest `try/catch` with a 4s `AbortSignal` timeout so a bad slug degrades to a
text-only card rather than a failed preview.

### Per-route metadata added

| Route | Title | Subtitle / badge |
|---|---|---|
| `polls/[share_code]` | poll `title` | voting state + eligibility, badge `VOTE`/`CLOSED` |
| `fixtures/[id]` | `Home vs Away` | tournament · Matchday · date · round, badge `FINAL`/`POSTPONED` |
| `results/[id]` | `Home 2 - 1 Away` | tournament · Matchday · date, badge `FORFEIT`/`FINAL`/`FULL TIME` |
| `calendar` | `Fixtures — September 2026` | from the `?month=` param |
| `polls` | `Polls` | badge `VOTING` |
| `teams/[id]/fixtures` | `<Team> — Fixtures` | |
| `login` / `register` | `Sign in` / `Register` | `withImage: false` |
| `profile` / `notifications` | `My profile` / `Notifications` | `withImage: false` |

Result scorelines include the shootout when `pen_home_score`/`pen_away_score` are set.

### Query dedup via React `cache()`

`fixtures/[id]`, `results/[id]` and `polls/[share_code]` already ran the exact query
their page body needs. Those fetches were lifted into `cache()`-wrapped helpers shared
by `generateMetadata` and the page, so previews do not double the DB round trip. This
was the first use of `cache()` in the repo.

### `app/layout.tsx`

`metadataBase` set (falling back to `https://efa-fxyk.vercel.app`, since
`NEXT_PUBLIC_APP_URL` is empty in both `.env.local` and `.env.prod`). Restored
explicit `openGraph.title`/`description` and added `twitter.title`/`description` so any
*future* metadata-less route still degrades to something sensible. `themeColor` changed
to literal `#0a1128`. Removed the empty `<head></head>`.

### `app/robots.ts` + `app/sitemap.ts` (new)

`robots.ts` names `WhatsApp`, `facebookexternalhit`, `Twitterbot`, `Googlebot` and the
rest explicitly so a future blanket `Disallow: /` is caught in review rather than
silently stripping every shared preview. Both rules disallow `/admin/`, `/api/`,
`/profile`, `/notifications`.

`sitemap.ts` lists the 9 static public routes plus up to 1000 team profiles, with
`revalidate = 3600`. Fixture and result pages are deliberately excluded — there are
thousands and they churn constantly. The `teams` query is wrapped in `try/catch` so a DB
blip degrades to a shorter sitemap instead of a 500 to every crawler.

### `next.config.mjs`

Added `outputFileTracingExcludes: { '/api/og': ['./public/logos/**'] }`. See below.

## Gotchas worth not rediscovering

### `fixtures.scheduled_date` is shifted by the driver

The column is a plain `DATE` holding the matchday a manager sees. Verified:

```
stored in DB     : 2026-09-25
pg returns       : 2026-09-24T22:00:00.000Z   (parsed as SAST midnight, -2h)
getSastDateKey() : 2026-09-25                 correct
toISOString()    : 2026-09-24                 WRONG, renders a day early
```

Any `.toISOString().slice(0, 10)` on this column silently renders the matchday one day
early. `formatMatchday()` in `lib/og.ts` routes through `getSastDateKey` from
`lib/app-time.ts` to avoid it. There is **no kick-off time column** on `fixtures` (only
`scheduled_date`, `window_start`, `window_end`, and `window_*` is null for most rows), so
preview text shows matchday + date and never invents a time.

### Satori cannot parse variable fonts

The repo already had `app/fonts/GeistVF.woff` and `GeistMonoVF.woff` sitting unreferenced.
Using Geist for the OG cards failed the build at prerender:

```
TypeError: Cannot read properties of undefined (reading '256')
Error occurred prerendering page "/opengraph-image"
```

Fixed by committing **static** Poppins TTFs (`app/fonts/Poppins-SemiBold.ttf`,
`app/fonts/Poppins-Bold.ttf`, from the `google/fonts` GitHub repo) and registering them
at weights 600/700. Poppins is also the app's actual UI font per `tailwind.config`
(`fontFamily.sans: ['Poppins', ...]`), so the card now matches the site. Both OG
renderers fall back to no font at all if the files are missing, so a missing font
degrades type quality instead of 500ing every preview.

`Buffer` is not assignable to `ArrayBuffer` under this tsconfig; convert with
`buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)`.

### `/api/og` must never touch `public/logos` on disk

`public/logos` is **538 MB** and Vercel caps a function bundle at 250 MB uncompressed.
This repo has already failed two deploys on exactly this — see
`.opencode/context/south-african-premiership/vercel-function-size-admin-seasons_2026-08-27.md`
and `.opencode/context/south-african-premiership/vercel-function-size-polls-apply_2026-08-27.md`.
Both were caused by tracing at folder level.

`app/api/og/route.tsx` therefore fetches crests over HTTP from `request.url` origin and
inlines them as base64 data URIs, never reading them with `fs`. The `outputFileTracingExcludes`
entry in `next.config.mjs` is deliberate insurance, not decoration. **If a future change
makes this route read logos from disk, expect the deploy to fail on function size.**

Crest folder/slug are validated against `/^[a-z0-9][a-z0-9.-]*$/` and
`/^[a-z0-9][a-z0-9-]*$/`. Verified that `hf=does-not-exist&af=..%2F..%2Fetc&as=passwd`
returns HTTP 200 with a text-only card rather than 500ing or reading a system file.

## WhatsApp cache — set expectations with members

Previews are cached **per-URL** and barely re-crawled. Links already shared in the group
will keep showing the old card even after this deploy; there is no way to force a
re-fetch of a URL that has already been sent. Verify changes by sharing a URL that has
**never** been shared before, or a cache-buster (`?v=2`).

## Verification

- `npx tsc --noEmit` — clean
- `npm run build` — succeeds. `/opengraph-image` and `/robots.txt` prerender static,
  `/sitemap.xml` static with a 1h revalidate. No function-size errors.
- `npx next lint` and `npx eslint` both hang indefinitely in this environment and had to
  be abandoned. `npm run build` does surface the ESLint pass, and the only warnings it
  reports are pre-existing unused-variable warnings in unrelated files.
- Ran `next start` with real Supabase credentials (`.env.local` has
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` **empty**, so every
  DB-backed page 500s without them being injected at build time):

```
/fixtures/5212ec93-...  og:title "Morocco vs Cabo Verde | EFA"
                        og:description "... EFA International Cup · Matchday 301 · Fri 25 Sep 2026 · Final"
                        og:image  /api/og?...&badge=FINAL&hf=fifa-world-cup-2026...&hs=morocco-national-team
/results/0ae6d956-...   og:title "Morocco 5 - 4 Cabo Verde | EFA"
/polls/f79b9129         og:title "2026 SA Club Selection | EFA"
                        og:description "... Pick your South African club based on EFA
                        International Cup placement ... Poll by @mubizamaan."
/calendar               og:title "Fixtures - September 2026 | EFA"
```

`Fri 25 Sep 2026` confirms the SAST date handling is correct end to end.

- `/api/og` returns real PNGs (magic `89-50-4E-47`) in all three cases: text-only
  (114,685 bytes), with crests (150,870 bytes — larger, so the logos embedded), and
  with a bad/path-traversal crest (HTTP 200, text-only).
- `/sitemap.xml` returns 150 URLs (9 static + 141 teams).
- `/robots.txt` lists all the named agents.

### Not verified

The rendered cards were **not** visually inspected — the agent doing this work has no
image input. Font parsing, weight selection and crest placement were confirmed
structurally (build prerender, PNG byte size difference) but not by eye. Worth one
manual look at a shared link in WhatsApp after deploy.

## Restore File Section

| Original Path | Purpose | New Path |
|---|---|---|
| (none — no files deleted or moved) | | |

## Related files

- `lib/og.ts` — shared metadata + date/round helpers
- `app/api/og/route.tsx` — dynamic preview card
- `app/fonts/Poppins-SemiBold.ttf`, `app/fonts/Poppins-Bold.ttf` — static faces for Satori
- `app/robots.ts`, `app/sitemap.ts` — crawler hygiene
- `next.config.mjs` — `outputFileTracingExcludes` function-size guard
- `.opencode/context/south-african-premiership/vercel-function-size-admin-seasons_2026-08-27.md` — the 250 MB Vercel limit this had to avoid
- `.opencode/context/south-african-premiership/vercel-function-size-polls-apply_2026-08-27.md` — same class of bug, second occurrence
- `.opencode/context/logo-upscaling/logo-upscaling_2026-08-27.md` — why `public/logos` grew to 538 MB
- `.opencode/context/deploy-performance/middleware-timeout_2026-08-28.md` — related `middleware.ts` behaviour on `/admin/*`
