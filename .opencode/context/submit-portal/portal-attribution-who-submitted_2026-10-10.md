# Portal + admin notifications now say WHO submitted / approved everything

The submit-match portal now attributes every record on the match page — the
result, each opponent-not-responding report/dispute, and the postpone request —
to a player name, an admin name, or "the system", and the admin backdoor
notifications include the submitter's username instead of just "a report is on
file". Follows up `.opencode/context/submit-portal/portal-backdoor-status-and-disputes_2026-10-08.md`.
The user asked to "state who submitted anything — result, postpone, backdoor
anything — player name, admin name, or approved/submitted by system".

## Problem

The portal showed what was on file, not who put it there:
- **Result** — the score + screenshot link only. Auto-finalised (0-0 void) and
  manager/submitted results were indistinguishable, and nobody knew which admin
  approved a result.
- **Backdoor reports** — the Details panel rows and the status card said
  "Submitted <date>" with no submitter; `ReportedNote` guessed `opponentName`
  as the reporter (wrong when an admin filed, or a third party claimed).
- **Admin notifications** (`notifyBackdoorSubmitted`) said "X reported as not
  responding." with no submitter name — the earlier complaint "it just says it's
  on file, doesn't say which player or admin submitted it".
- Postpone requests already showed `requestedByName`/`respondedByName`.

## Fix

### `lib/submit-match.ts`
- New `UUID_RE`, `actorOf()`, `loadActorNames()`: one batched fetch of all
  profiles resolves every identity key to `{ name, role }`. Keys may be a user
  id (portal submitter, `reviewed_by`, `finalised_by`) **or** a phone number
  (`backdoor_submissions.submitter_phone` stores the WhatsApp number via the
  bot); `actorOf` tries uuid first, else digits-normalised phone match.
- `buildState()` loads actors for `finalised_by`, every backdoor
  `submitter_phone` and `reviewed_by`, then threads through:
  - `result`: + `isAbandoned`, `finalisedBy`, `finalisedByName`, `finalisedByRole`.
  - `backdoor[]`: + `submitterName`, `reviewedByName`.
  - `myBackdoor`: + `submitterName`, `reviewedByName`.
  - `reportsAgainstMe[]`: + `submitterName`.
- `loadFixture` select unchanged (already had `finalised_by`, `is_abandoned`).

### `app/submit-match/[code]/_portal.tsx`
- New `resultActorLabel()` helper: `finalised_by` set → "Approved by <name>" when
  the actor's role is `admin`, otherwise "Submitted by <name>"; no `finalised_by`
  → "Approved by the system · <override_reason>" (or "Abandoned"); bare fallback
  "Recorded by the system".
- Header result card and `DetailsPanel` result row show that label underneath
  the score.
- `DetailsPanel` backdoor rows add "Submitted by <name>" + " · approved/declined
  by <name>" when reviewed.
- `myBackdoor` status card: "Submitted by <name> <date> · approved/declined by
  <name>."
- `ReportedNote` headlines use `r.submitterName ?? opponentName` as the reporter.

### `lib/backdoor-notify.ts` + callers
- `notifyBackdoorSubmitted` gained optional `submitterName` → body appends " by
  <name>". `notifyBackdoorDisputed` gained optional `byName`.
- Portal callers pass `viewer.username`
  (`app/api/submit-match/route.ts` backdoor submit + dispute).
- Bot caller (`app/api/webhook/route.ts` ~2532) embeds each team's
  `manager:profiles!teams_manager_id_fkey(username)` into the notify fixture
  fetch and passes the **opposite** team's manager username (the reporter is the
  manager of the team opposite `side_claimed`).

## Verification

- `npx tsc --noEmit` clean; `npx next lint` on the four touched apps clean (only
  pre-existing unused-var warnings elsewhere).
- DB spot-check confirmed attribution data is present and correct:
  - auto-finalise rows: `finalised_by` NULL + `override_reason` set (→ system).
  - admin actions: `finalised_by` resolves to admin username/role (`celemqhele`,
    `wandile`).
  - manager submits: `finalised_by` resolves to real manager username, role
    `user`, with a screenshot (e.g. `goat_2`, `siyethemba_`, `whitey`).
  - `profiles` has `id, username, phone, role`; `backdoor_submissions` has
    `submitter_phone, reviewed_by`; `results` has `finalised_by, override_reason,
    is_abandoned` — no migration needed.

## Deliberately not done

- Postpone attribution was already present; no change beyond existing labels.
- The bot stores `result_confirmations.submitted_by` / `results.finalised_by`
  via `getAdminUserId()` in several webhook paths, so some historical bot
  results may be attributed to username `celemqhele`. The portal now reports
  exactly what the DB records rather than guessing — fixing that attribution
  at write-time is a separate concern.
- The user cancelled the "block portal backdoor after 2am" item — it turned out
  the 02:00-02:41 SAST Vercel cron-delay was the cause, not a missing deadline
  gate.

## Context chain (by path)

- Status-card + dispute portal work this follows:
  `.opencode/context/submit-portal/portal-backdoor-status-and-disputes_2026-10-08.md`
- Backdoor notifications surfaced here predate the name:
  `.opencode/context/backdoor/backdoor-submissions-refresh-fix_2026-08-16.md`

## Restore File Section
No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |