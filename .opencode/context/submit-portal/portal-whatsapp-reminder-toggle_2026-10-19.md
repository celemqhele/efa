# Portal yes/no toggle: "I want to continue getting WhatsApp reminders"

Added a self-service WhatsApp-reminder opt-out to the submit-match portal. The
portal home panel now shows a No/Yes radio ("I want to continue getting WhatsApp
reminders", default Yes) built with the same control as the portal's "Mark as
forfeit?" radio; picking No writes the existing `profiles.open_to_reminders` flag
for the manager's OWN profile, so every later portal visit comes back with No
selected and the admin dashboard greys out that manager's reminder buttons
automatically. Until now that flag could only be flipped by an admin on the Users
& Managers page (`.opencode/context/admin-dashboard/manager-reminder-opt-out_2026-10-12.md`);
the user asked for managers to be able to do it themselves from the portal, with
the greying "just like Supersport's one" (`anele_arh`, the seeded opt-out).

## Problem

The dashboard greys out the H/A WhatsApp reminder icons for a manager whose
`profiles.open_to_reminders` is `false` (Supersport's manager `anele_arh` was the
first, seeded by migration `100_open_to_reminders.sql`), but the only way to set
that flag was the admin switch on `app/(admin)/admin/users/manage/ManagersClient.tsx`.
Managers had no way to opt themselves out, so every opt-out needed an admin.

## Fix

### Data

No migration needed: `profiles.open_to_reminders boolean NOT NULL DEFAULT true`
already exists (migration `100_open_to_reminders.sql`, applied 2026-10-12).

### Server

- `lib/submit-match.ts`
  - `Viewer` type gains `openToReminders: boolean`.
  - `resolveViewer` now selects `open_to_reminders` and sets
    `openToReminders: profile?.open_to_reminders !== false` (so a null/missing
    value reads as opted IN, matching the column default).
  - `buildState` puts `openToReminders` on the serialized `viewer`, which is what
    the portal reads to pre-select the radio.
- `app/api/submit-match/route.ts`
  - New POST case `reminderPref` → `setReminderPref(admin, fixture, viewer, form)`
    (added just above `cancelBackdoor`).
  - `setReminderPref` validates the posted value is exactly `yes` or `no`, updates
    **only** `profiles.open_to_reminders` on `.eq('id', viewer.userId)` (the
    viewer's own row, never the opponent's), writes an `audit_log` row
    (`action: 'portal_open_to_reminders'`, `target_type: 'profile'`), and returns
    `{ ok, title, message }` for the portal's success modal.

### Portal UI

- `app/submit-match/[code]/_portal.tsx`
  - New presentational component `ReminderPrefCard` (defined after `inputClass`,
    before `SubmitPortal`) reusing the exact forfeit-radio markup: a muted
    uppercase heading, a row of `sr-only` radios drawn as circles that fill with a
    dot when selected, and a hint line that changes with the state. It is fully
    controlled by the server value (`open` prop), so it can never drift: the
    current value is `state.viewer.openToReminders !== false`.
  - The home panel now wraps the four option cards in a `space-y-3` div and renders
    `<ReminderPrefCard>` underneath them, so the question is seen on every visit
    (the user's "every time they go to portal it will default to no").
  - Picking Yes/No calls `send(formFor('reminderPref', { openToReminders: 'yes'|'no' }))`;
    `send()` shows the confirmation modal and then `refresh()`es the portal state,
    which re-reads `state.viewer.openToReminders` and re-checks the radio.

The admin dashboard side was NOT touched: it already reads the same flag
(`app/(admin)/admin/dashboard/page.tsx` embed → `_desktop.tsx` / `_mobile.tsx` →
`components/ui/DashboardFixtureActions.tsx` → `components/ui/WhatsAppButton.tsx`
`disabled`), so a portal opt-out greys the reminder icons with no further work.
The generic "Message {username}" button on the Users & Managers page stays enabled
on purpose (regular admin contact, not a match reminder) - see the note in
`.opencode/context/admin-dashboard/manager-reminder-opt-out_2026-10-12.md`.

## Verification

- `npx tsc --noEmit` and `npx eslint` on the three changed files: clean.
- Server path proven against the real DB with the handler's exact statements on a
  non-manager profile (`amow`, so no dashboard side effects): the
  `update profiles set open_to_reminders = false where id = ...` and the
  `audit_log` insert both succeeded, then both were reverted (`amow` back to
  `true`, test audit row deleted; `open_to_reminders=false` count back to 1 =
  `anele_arh`). `audit_log.target_type` is plain `text` (no CHECK constraint) and
  `'profile'` was already in use, so the insert cannot violate a constraint.
- Portal render verified with a temporary tsx SSR smoke script that loaded REAL
  fixtures through `loadFixture` + `resolveViewer` + `buildState` (admin client
  from `.env.local`, no login needed) and rendered `SubmitPortal` with
  `renderToStaticMarkup`:
  - `DKC2UKYT` (Supersport / `anele_arh`, opted out) → label present, exactly one
    checked radio, `value="no"`. PASS
  - `88EXWXS3` (AmaZulu / `goat_2`, opted in) → label present, exactly one checked
    radio, `value="yes"`. PASS
  - The menu ("Submit the result", "Report opponent not responding") still renders
    inside the new wrapper div.
  - The script lived at `scripts/_render-portal-smoke.ts` and was recycled to
    `.recycle/scripts/_render-portal-smoke.ts` afterwards (see Restore File Section).
- Note on the render harness: `tsconfig.json` uses `"jsx": "preserve"` (Next), so
  tsx compiles `.tsx` with the classic runtime and needs a global `React`; the
  smoke script set `globalThis.React = React` to satisfy it.

## Files touched

- `lib/submit-match.ts`
- `app/api/submit-match/route.ts`
- `app/submit-match/[code]/_portal.tsx`

## Cross-references

- `.opencode/context/admin-dashboard/manager-reminder-opt-out_2026-10-12.md` (owns the `open_to_reminders` flag, dashboard greying, admin toggle)
- `.opencode/context/submit-portal/portal-forfeit-radio-control_2026-10-11.md` (the No/Yes radio control this toggle copies)
- `.opencode/context/submit-portal/portal-forfeit-and-deadline-rules_2026-10-10.md`
- `.opencode/context/admin-dashboard/time-based-whatsapp-reminders_2026-09-08.md` (reminders are admin click-to-WhatsApp links; no automated sender)

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| `scripts/_render-portal-smoke.ts` | Temporary tsx SSR smoke test that rendered the portal home panel with real fixture data to verify the WhatsApp-reminder toggle default | `.recycle/scripts/_render-portal-smoke.ts` |
