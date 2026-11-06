# WhatsApp reminder: short backdoor screenshot link

## What was done
The "View their screenshot" line in the admin dashboard WhatsApp reminder now uses a short match-code link, `https://efa-fxyk.vercel.app/<matchCode>/backdoor?side=home`, instead of pasting the full ~300-character Supabase signed Storage URL. A new public route at `app/[code]/backdoor/route.ts` looks up the latest backdoor report and 302-redirects to the proof image, re-signing the Storage URL on every click.

## Problem
Follow-up to `.opencode/context/admin-dashboard/whatsapp-reminder-postpone-backdoor-status_2026-10-10.md`. The reported-side reminder printed `backdoor.screenshot_url`, which is a Supabase signed URL of the form `https://<ref>.supabase.co/storage/v1/object/sign/backdoor-screenshots/<long path>?token=<jwt>`. In a WhatsApp message this dominated the template and wrapped over many lines, making the actual instruction (bring the match code, contact the opponent) hard to read.

## Fix
- `app/[code]/backdoor/route.ts` (new, public): resolves the match code to its fixture, selects the latest backdoor report for that fixture (`side` query filter maps to `side_claimed`, so mutual reports show the correct proof), prefers a `pending` report, extracts `bucket/path` from the stored signed URL and mints a fresh signed URL before redirecting. If signing fails it falls back to the stored URL. Unknown code / no screenshot returns 404.
- `components/ui/DashboardFixtureActions.tsx`:
  - added `APP_BASE` and derived `PORTAL_BASE` from it.
  - `backdoorForSide()` now returns `screenshotLink` = `${APP_BASE}/${matchCode}/backdoor?side=${side}` when the match code is loaded, falling back to the old long URL when the fixture has no code yet.
  - `buildReminder()` prints `screenshotLink` on the `📸 *View their screenshot: ...*` line.

The reminder is sent to the side the report was filed AGAINST, so `side` is the recipient's side and matches `backdoor_submissions.side_claimed`.

## Verification
- `npx tsc --noEmit` clean.
- Live test against a pending report (match code `2WFQB8SW`, `side_claimed = home`): `GET /2WFQB8SW/backdoor?side=home` returns a 302 whose `Location` is a valid Supabase signed image URL; an unknown code returns 404.
- The new route is not behind login (middleware only matches `/profile`, `/notifications`, `/admin`, `/login`, `/register`). The match code is the secret, exactly as the old signed URL was — anyone holding the reminder link can view the proof.

## Restore File Section
- (none — no files recycled this change)

## Cross-references
- Reminder backdoor status line this extends: `.opencode/context/admin-dashboard/whatsapp-reminder-postpone-backdoor-status_2026-10-10.md`
- Same template's round label / ET note change: `.opencode/context/admin-dashboard/whatsapp-reminder-round-label-and-et-penalties_2026-11-07.md`
- Signed URL helper reused by the redirect: `lib/submit-match.ts` (`signedUrlForPath`)
- Backdoor report storage: `app/api/submit-match/route.ts` (`insert` into `backdoor_submissions`)
