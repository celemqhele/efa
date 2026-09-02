# UEL No Name Team Replacement — 2026-08-16

Replaced Barcelona with a placeholder club "No Name" in the EFA Europa League (Season 3) only, awarded 3-0 wins to all UEL opponents, and rendered the placeholder's logo as a lucide `ShieldQuestion` icon app-wide.

## Key IDs
- **No Name team**: `0843691f-32e7-46cb-b1d5-005d06863a55` (`logo_league_folder='custom'`, `logo_team_slug='noname'`, no manager).
- **Barcelona team**: `1d70ba4a-35a9-4153-9305-1d215d7635f0` (manager `ac6a7b31-1549-4f5b-a229-8b4563da5561`) — unchanged in UCL and EFA Premier League.
- **UEL (Season 3)**: `80e86b39-1314-403d-ad91-ff7666fdde80` (UEL participant row `f6b6aebc-23c8-4c69-a7bb-bc6e05601d61`).
- **UCL (Season 3)**: `7174e29f-64c7-4f77-97f2-0fefe15d7e35` (Barcelona group A row `34c10c74-9ab5-4632-8a8f-317faa7637cb`) — untouched.
- **EFA Premier League**: `35adbc8e-fc5d-4311-9a26-e12e902fda3f` — untouched.

## Decisions
- Team name **"No Name"**, icon **ShieldQuestion** (lucide-react), plain 3-0 losses (no absent/forfeit flags), logo coverage **everywhere**.
- No `public/logos/custom/noname.png` exists; placeholder detection matches `custom` + `noname` only (Atlas Lions/Cobalt FC stay as images).

## DB work (`scripts/no-name-uel-swap.ts`)
- Created No Name team; swapped UEL participant + 8 fixtures (4 home, 4 away); Barcelona now has 0 UEL fixtures.
- Awarded results (all 3-0): `b01f0d96` No Name 0-3 Betis; `3ab0098c` Al Khaleej 3-0; `26cc1021` Real Madrid 3-0; `93b7a224` No Name 0-3 Real Madrid; `c70a0b95` No Name 0-3 Leverkusen; `166b977d` No Name 0-3 Al Khaleej; `df826bb0` Real Betis 3-0. `c89f4869` Leverkusen 3-0 was already applied and skipped.
- `recalculateStandings`: groupRowsWritten 10, fixturesProcessed 40, participantsProcessed 10.
- Verified: group B — No Name 8 played / 0 W / 0 pts / 0 GF / 24 GA; Leverkusen 13, Betis 10, Real Madrid 9, Al Khaleej 9 (absent 1, gd_penalty -3 preserved).
- Notifications: script deleted stale + inserted `result_confirmed` for the 7 processed fixtures; leftover stale "Leverkusen 3-0 Barcelona" notifications for `c89f4869` deleted via SQL.

## UI work
- `components/ui/TeamLogo.tsx`: `getPlaceholderIcon` returns `ShieldQuestion` (className `w-full h-full text-text-muted`, strokeWidth 1.5) for `custom`/`noname`.
- Converted every direct `getTeamLogo` `<Image>` render site to `<TeamLogo leagueFolder teamSlug context alt className="<display size>">` (pass context + explicit size className). All public + admin pages, profile, managers, calendar, fixtures/results/teams/hall-of-fame, results-submit, seasons, tournaments, users, notifications, dashboard, team management.
- Local `TeamLogoInline` copies in `app/(admin)/admin/export/` and `app/(admin)/admin/polls/page.tsx` render ShieldQuestion for `custom`/`noname`.
- `next/image` retained only where avatars (manager/requester `avatar_url`) are rendered.
- Verified: `npx tsc --noEmit` clean; `npm run lint` warning-only (pre-existing).

## Related files
- `.opencode/context/tbc-badge/tbc-club-badge-for-null-teams_2026-08-25.md` — complements the `ShieldQuestion` placeholder with a TBC badge for null teams; both render through `TeamLogo.tsx`/`getPlaceholderIcon`.
