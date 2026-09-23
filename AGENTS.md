# AGENTS.md — Instructions for AI agents working in this repo

> **SESSION STARTUP: Before doing ANYTHING else, list and read the relevant context files in `.opencode/context/`. This is mandatory at the start of every new session — never skip it. Use `Get-ChildItem -Recurse -Filter *.md -Path ".opencode\context" | Select-Object FullName` to list all context files, then read the relevant ones before answering the user's first question. If you skip this, you WILL miss existing context and make redundant or conflicting changes.**

## Supabase — you CAN run SQL directly (don't ask the user to paste SQL)

You have direct, working access to the remote Supabase Postgres database from the terminal. Use it. Never tell the user "go paste this in the SQL Editor."

### How to run SQL on Supabase

```bash
npm run db -- path/to/migration.sql   # run a SQL file
echo "SELECT 1;" | npm run db         # run SQL from stdin
npm run db -- -c "SELECT 1;"          # run a SQL string
```

- Reads the connection string from `.env.supabase` (gitignored, `SUPABASE_DB_URL`).
- Uses `scripts/db.ts` (node + `pg` via `tsx`). No psql/docker needed.
- The DB password lives in `.env.supabase`. If it has `PASSWORD_HERE`, ask the user to paste the full connection string from Dashboard → Project Settings → Database → Connection string, then fill it in.

### Data reads (no schema change) — REST API with secret key

Schema changes (DDL) need `npm run db`. For plain queries you can also use the REST API with the secret key, but prefer `npm run db` for consistency.

Project ref: `dtxnqtfqsehofezdmdbd`

### Data API grants — auto-granted via default privileges (Oct 30, 2026 rule)

Since Oct 30, 2026, Supabase no longer auto-grants Data API access to new
tables in `public` for existing projects. A table created **without** explicit
grants is unreachable through supabase-js/PostgREST (permission denied), and
this also applies to migrations, preview branches, and `supabase db reset`.

**This repo is already covered:** migration `076_data_api_default_privileges.sql`
re-created the old auto-grant as default privileges for the `postgres` role in
`public` (tables = SELECT/INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER,
sequences = SELECT/UPDATE/USAGE, functions = EXECUTE, for `anon`,
`authenticated` and `service_role`). Any future table created via `npm run db`
(as role `postgres`) is reachable immediately — verified with a throwaway
table.

**Still follow the belt-and-braces rule:** any migration that creates a table
SHOULD also include its grants in the SAME file (adjust the role list to the
minimum the app actually needs — service_role for server-side only,
authenticated for logged-in users, SELECT-only for public reads). The default
privileges are the safety net if a migration forgets; patterns to follow are
`053_backdoor_window.sql` and `066_user_based_slots.sql`.

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.<table> TO service_role, anon, authenticated;
```

NOTE: default privileges do NOT roll back — if you ever need to re-run this on a
fresh/preview database, they are additive and idempotent.

## EFA News / Poster Generation (Leonardo AI)

The user generates comedy/satire "news" for the EFA league. Enter this workflow whenever the user asks to make a **poster prompt** or generate **news** — any request about a poster prompt or news triggers it.

1. **Ideas → research first.** The user gives a joke headline/idea. Before writing anything, pull all the involved subjects from Supabase with `npm run db`:
   - Manager CV/tenures: `manager_tenures` (teams, dates, W/D/L, GF/GA)
   - Teams: `teams` (name, abandon_count)
   - Current form: `standings` / `group_standings` (points, form, GF/GA) and `results` + `fixtures`
   - Trophies: `trophies` · Profile: `profiles` (playstyle, sacked_at) · Forfeits: `forfeit_balances`
   - NOTE: one real manager can have TWO accounts (e.g. `Thando` + `thando_1110`) — search both usernames and merge their records when researching.
   - **FACTS ONLY — no hallucinated stats.** Everything in the prompt/caption that is a fact (records, scores, W/D/L, GF/GA, points, trophies, teams managed, names) MUST come from these Supabase queries verbatim. Never invent numbers, results, or history to fill a gap — if the data isn't there, omit it or leave it to the AI's imagery. Only the joke/narrative itself is invented; the underlying facts are real league data.
2. **Output a Leonardo AI prompt** (LANDSCAPE poster):
   - Paste the user's headline EXACTLY as given — it must appear word-for-word as the poster title.
   - Dump all researched context (identity, record, teams managed, trophies, playstyle, stats) so the image AI knows the subject — it has no league context.
   - Give the AI full creative control over narrative/imagery; only the headline is fixed.
   - **PRIORITISE — no text dumps.** Only the headline may appear as text on the poster. All researched facts are background knowledge / optional visual motifs ONLY — they must NOT be rendered as text blocks, stat lists, labels, or subheadings (no playstyle labels, no team CV strips, no trophy notes, no record breakdowns). Instruct the AI to pick ONE clear focal scene that carries the whole joke and at most 1-2 small supporting props; drop anything that doesn't serve that single gag. Instruct the AI to keep any on-poster text typography plain and tabloid-clean (no em dashes, no long hyphen flourishes).
   - **Style guidance (user reference examples — GUIDANCE, not explicit instructions).** The user likes three poster vibes (reference images: `C:\Users\mqhel\Downloads\WhatsApp Image 2026-09-14 at 20.58.14.jpeg`, `C:\Users\mqhel\Downloads\b3953c8f-e58c-43fb-923b-b8e9482ceb71.jpg`, `C:\Users\mqhel\Downloads\43afd68c-4642-4e59-924e-918a5982d605.jpg`):
     - **Tabloid newspaper front page** (e.g. "Ghana Chronicle") — masthead, date banner, price tag, splash headline, multi-column article with invented quotes, "(sacked)" style portrait captions, "WHAT'S NEXT" box.
     - **Sports broadcast stat card** — bold stat call-outs (e.g. goals scored / conceded), mini standings table (P W D L GF GA GD PTS).
     - **Match fixture card** — day + date + "KICK OFF HH:MM" + tournament branding.
     Let the AI pick the layout best suited to the story; within an adopted layout, structured text (masthead, kicker, headline, mini tables) is on-brand and allowed — but it must be layout-driven, not an arbitrary fact-dump.
3. **Add a post caption** in **English SAL** (South African English as Second Additional Language — SA slang/tabloid banter tone; occasional local flavour words like "yho", "bayajika" are allowed where natural). Meme-style, fits a WhatsApp group.
   - **BANTER STYLE — Twitter/Instagram comment-section energy (researched). NOT ChatGPT prose.** Write like a football Twitter reply or IG comment riffing off the news, not like a newsreader:
     - Short punchy reactions, fragments, not paragraphs. One or two words carry the shot ("washed", "finished", "cooked", "in the mud", "ratio").
     - Facts as deadpan ammunition, no metaphors or flowery build-up around them ("0 wins, 4 losses, 3 scored, 13 conceded").
     - Minimal punctuation: no em dashes, periods rare, sentences are fragments. ALL-CAPS for emphasis/sarcasm.
     - Repetition for effect ("he sold the stadium he sold the stadium"), casual broken grammar ("Korea 2- SA 1", "mara 😂") is a feature not a bug.
     - Emoji as the actual punchline in the mix (😂😭💀), not decoration; SA flavour words used naturally where they fit, never as adornment.
     - Hype/roast energy, even when the target is a mate's team. Never elegiac, never poetic.
   - **NO EM DASHES anywhere** — in the caption text AND instruct the Leonardo prompt to avoid rendering em dashes / long hyphen flourishes in any on-poster text; keep poster typography plain and tabloid-clean.

## File Deletion Policy
**NEVER permanently delete files.** 
Whenever a file needs to be removed:
1. Move it to the `.recycle/` directory instead of using `rm` or `Remove-Item`.
2. Update the "Restore File Section" in the corresponding `.opencode/context/**/*.md` file with:
   - Original path
   - Purpose of the file
   - New path inside `.recycle/`
3. Commit the move and the updated context file.

## Context Files — organization rules

Context files live in `.opencode/context/`, grouped into category folders. Each folder groups a related feature/topic. **Each change or modification gets its own new context file — never update an existing context file with new info**, because editing an existing file erases the old content that may still be useful. New files are added per change so history is preserved.

> **MANDATORY: Every time you edit, add, or remove code in this repo, you MUST create a new context file documenting the change — no exceptions. Write the context file BEFORE committing. If you skip this, the session is incomplete.**

### IMPORTANT: finding context files
The Glob/Grep file tools SKIP hidden/dot-directories, so `.opencode/` is invisible to
them (`glob(".opencode/context/**/*.md")` returns nothing). You MUST use the shell or
the Read tool to work with context files.

**List-first, then shortlist (never keyword-grep first).** When researching any topic,
always begin by listing ALL context files, then shortlist which to read based on the
**file names** (and category folders) — do NOT rely on keyword searches of file contents
first. Keywords often don't match the filename, so keyword-grep hides relevant files and
you end up overlooking them. The filename + category folder is the primary signal.
```powershell
Get-ChildItem -Recurse -Filter *.md -Path ".opencode\context" | Select-Object FullName
```
Only after shortlisting from the full list should you read the chosen files (and, if
still needed to confirm scope, grep within those files). Avoid content-grep over the whole
tree as the first step.

### Category folders

- `check-fixtures/` — WhatsApp check-fixtures flow (phone-update, auto-detect, contact card, session close)
- `whatsapp-results/` — WhatsApp result-submission flow (readable dates, already-submitted handling)
- `onboarding/` — WhatsApp onboarding + admin manager-assignment + team-change requests
- `backdoor/` — backdoor admin flow (WhatsApp override, review page, dashboard link, one-off scripts)
- `fixture-scheduling/` — fixture scheduling and postponement
- `admin-results/` — admin result submission (submit page, direct DB submissions)
- `notification-sounds/` — notification sounds and triggers
- `manager-stats/` — manager stats/trigger fixes
- `efootball-teams/` — eFootball 2027 team restriction and follow-up fixes
- `home-upcoming-widget/` — home page Upcoming widget
- `uel-no-name/` — UEL "No Name" placeholder team replacement + ShieldQuestion logo fallback
- `admin-dashboard/` — admin dashboard UI (tournaments widget button uniformization, postpone overlay)
- `migration-history/` — Supabase schema_migrations tracking / migration bookkeeping
- `forfeit-balances/` — forfeit balance carry-over (website "Use" button, WhatsApp auto-apply)
- `postgrest-embeds/` — PostgREST embed shape issues (unique constraints flipping embeds to one-to-one)
- `knockout-generation/` — knockout bracket generation + progression wiring (advanceWinner, leg mirroring, tie-breaks)
- `season-cup-flow/` — deferred cup creation after league end (start-tournament flow)
- `south-african-premiership/` — South African Premiership (Betway Premiership) league addition
- `deploy-performance/` — Vercel deployment performance / middleware timeout fixes
- `context-file-conventions/` — rules on how context files themselves are written (opening intro, cross-references by path)
- `whatsapp-ux/` — WhatsApp bot UX (welcome menu, input/keyword cleanup, plain-English prompts)
- `draw-seeding/` — seeded group-stage tournament draws (club-record seeding for Run Draw)
- `user-based-competitions/` — slot-owned competitions (slots model, vacant display, sacked-club reclaim)
- `efa-news/` — EFA comedy/satire news + Leonardo AI poster generation workflow
- `knockout-bracket-poster/` — tournament knockout bracket posters (2K PNG generation via react-pdf + Ghostscript)

### Naming requirement
Every context file MUST be named `topic_YYYY-MM-DD.md`, where `YYYY-MM-DD` is the file's creation date (a new file always uses the current date). A context file is written once and never updated; a later change or fix on the same topic gets a brand-new file with the new date.

### Placement rule
When creating a new context file for a change, decide whether it relates to an existing category or is brand-new:
- **Related to an existing category** (a follow-up problem/change on something already documented) → create a brand-new file (new date) in that existing category folder. Never append to the existing file.
- **Brand-new topic** → create a new category folder (kebab-case theme name, e.g. `auth/`) and add it to the list above. This is only allowed when the file is unrelated to every existing category — never create a folder just to isolate a single file that could join an existing chain.

### Opening intro (summary paragraph)
Every context file starts with a short intro paragraph right under the title, before
any `## Problem` / `## Fix` sections:
- First sentence: what was done — the change/fix at a glance.
- For a follow-up file in a topic chain, add one sentence noting what the user
  reported *after* the earlier change (a regression or a newly-surfaced issue), so
  a reader sees how this file connects to the chain.

### Cross-references (by path)
When a point, issue, or action relates to another context file, reference it by its
**full path** (e.g. `.opencode/context/backdoor/backdoor-betis-win_2026-08-16.md`)
rather than only describing it in prose. Apply this anywhere it's relevant, not just
the overview — the intro, the `## Problem`, and especially the **`## Fix` / actions**
(e.g. "undid what was done in `xyzpath` by doing xyz, then reinstated the previous
version created in `xyz2path`"). Because Glob/Grep silently skip `.opencode/`, a
by-path reference is the only reliable way to keep a related file discoverable and
solidifies the context chain.
