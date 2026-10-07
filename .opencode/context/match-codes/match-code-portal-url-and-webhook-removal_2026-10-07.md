# Match codes: webhook MC/BQH flow removed, portal URL replaces it (2026-10-07)

Deleted the WhatsApp bot's match-centre (MC code / BQH token) conversation flow from
`app/api/webhook/route.ts` and pointed managers at the web portal instead
(`https://efa-fxyk.vercel.app/submit-match/<code>`, see
`.opencode/context/submit-portal/submit-match-portal-and-postponed-confirmed_2026-10-07.md`).

## Problem

The pinned match-centre sessions (deep-linking a match via `MC<code>` from the reminder, then a
long menu with open-backdoor/view/postpone steps) were over-engineered for WhatsApp and depended on
delivery reliability that the bot was not giving. The reminders already carried the codes; the user
wanted the whole flow on the web where a screenshot and a form render properly.

## Fix

- Removed from `app/api/webhook/route.ts` (via the splice script
  `C:\Users\mqhel\AppData\Local\Temp\opencode\splice_webhook.py`, 265 lines): `MATCH_CODE_RE`,
  `BQH_TOKEN_RE`, `extractMatchCode`, `fixtureForMatchCode`, `MATCH_CENTRE_MENU`,
  `managerOwnsFixture`, `handleMatchCentreLink`, `openBackdoorFromCode`, `handleMatchCentreMenu`,
  and the `handleText` deep-link branch.
- Kept the standalone bot `backdoor` command and the classic per-team flows (they still work and are
  used by managers who don't log into the site).
- `handleText`'s match-centre branch was replaced with a legacy fallback: it clears the session and
  re-sends the welcome menu, so a reminder link that is somehow tapped inside WhatsApp no longer
  dead-ends.
- Removed `pinExpiryIso` and `PINNED_SESSION_TTL_MS`; kept the generic pinned-session machinery
  (`pinned_until`, `unpinSession`, `handleExpiredSession` pin check) and `SESSION_MAX_IDLE_MS`,
  since other pinned flows still rely on it.
- `app/api/admin/fixtures/[id]/match-code/route.ts` comment now describes the portal URL as the
  consumer of the codes.
- Portal links were wired into the admin reminder template (URL + `?action=backdoor` shortcut) in
  `components/ui/DashboardFixtureActions.tsx`.

## Files

- `C:\Users\mqhel\efa\app\api\webhook\route.ts`
- `C:\Users\mqhel\efa\app\api\admin\fixtures\[id]\match-code\route.ts`
- `C:\Users\mqhel\efa\components\ui\DashboardFixtureActions.tsx`