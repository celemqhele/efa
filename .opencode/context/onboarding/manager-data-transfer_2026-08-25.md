# Manager data transfer — trophies manager-based + transfer feature (25 Aug)

## Problem
When a user creates a new EFA account (e.g. lost their old WhatsApp), their
historical data (forfeit balances, tenures, hall of fame trophies) stays tied
to the old account. Additionally, trophies were team-based (`team_id`) rather
than manager-based, so there was no clean way to associate trophies with a
specific manager.

## Solution

### 1. Trophies → manager-based (migration 062)
- Added `manager_id UUID REFERENCES profiles(id)` to `trophies` table
- Backfilled all 12 existing trophies using tenure records + manual assignment:
  - Terrence: 5 trophies (Brentford x3, Morocco, Al Hilal)
  - phiwayinkosi: 1 (Brighton)
  - wandile: 1 (Tottenham)
  - dot7: 1 (Nottingham Forest)
  - tildedot: 1 (Newcastle)
  - 3 Liverpool/Newcastle Phase 1 trophies remain NULL (no tenure records)
- Future trophies auto-set `manager_id` from the team's current manager

### 2. Transfer function + API
- Created `transfer_manager_data(from_user_id, to_user_id)` Postgres function
  - Transfers: forfeit_balances, manager_tenures, trophies
  - Updates `manager_username` on tenures to the new user's username
  - Returns counts of transferred rows
- Created `POST /api/admin/managers/transfer` API route
  - Admin-only, audit logged
  - Validates both users exist, calls the DB function

### 3. Admin UI — Transfer Manager Data
- Added "Transfer Manager Data" button in the admin managers detail panel
  (visible when a current manager is selected)
- Opens a dialog with user selector dropdown + confirmation
- Shows transfer result (counts of forfeits, tenures, trophies moved)

### 4. Public manager profile — trophies display
- Both desktop and mobile profiles now show a "Hall of Fame" section
- Trophies fetched by `manager_id` with team logo, type label, and date

## Files Changed

### Migration
- `supabase/migrations/062_trophies_manager_id_and_transfer.sql`

### API Routes
- `app/api/admin/managers/transfer/route.ts` (new) — transfer endpoint

### Frontend
- `app/(admin)/admin/managers/ManagersClient.tsx` — Transfer button + dialog
- `app/(admin)/admin/hall-of-fame/HallOfFameAdmin.tsx` — auto-set manager_id on award
- `app/(admin)/admin/hall-of-fame/page.tsx` — include manager_id in query
- `app/(public)/managers/[id]/page.tsx` — fetch trophies by manager_id
- `app/(public)/managers/[id]/_desktop.tsx` — Hall of Fame card
- `app/(public)/managers/[id]/_mobile.tsx` — Hall of Fame section

### Types
- `lib/supabase/types.ts` — added `manager_id` to trophies Row/Insert

## Notes
- `npm run lint` passes (only pre-existing warnings)
- `npx tsc --noEmit` passes
- Migration applied to live Supabase

## Restore File Section
| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| (none) | All changes were edits to existing files + 1 new API route | N/A |
