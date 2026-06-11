-- Backfill manager_tenures with complete history reconstructed from audit logs
-- Season started 2026-05-22 (first fixture date)
BEGIN;

-- 1. Clear existing tenures (rebuild from scratch)
DELETE FROM manager_tenures;

-- 2. Teams with NO manager changes (whole season)
-- Manager managed from season start to present
INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, t.manager_id, p.username, '2026-05-22'::date, NULL
FROM teams t
JOIN profiles p ON p.id = t.manager_id
WHERE t.manager_id IS NOT NULL
  AND t.logo_team_slug IN (
    'arsenal', 'aston-villa', 'bournemouth', 'brentford',
    'chelsea', 'crystal-palace', 'fulham', 'ipswich-town',
    'leeds-united', 'manchester-united', 'nottingham-forest',
    'santos', 'tottenham-hotspur', 'wolves'
  );

-- 3. Brighton: GOAT (May 22 → May 30), phiwayinkosi (May 30 → now)
INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, 'cf740a3a-e6bc-4a8a-834a-b7e5926f11b0', 'GOAT', '2026-05-22'::date, '2026-05-30 17:16:57+00'
FROM teams t WHERE t.name = 'Brighton';

INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '401bb18b-8b3b-4f05-966f-36e6d5ccdc1b', 'phiwayinkosi', '2026-05-30 17:16:57+00', NULL
FROM teams t WHERE t.name = 'Brighton';

-- 4. Burnley: tildedot (May 22 → May 30), khushu (May 30 → May 31), anele_arh (May 31 → now)
INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '77b16465-91bb-4cf0-bbad-ff1128953a28', 'tildedot', '2026-05-22'::date, '2026-05-30 17:16:37+00'
FROM teams t WHERE t.name = 'Burnley';

INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, 'f280d8c6-8453-4123-9f21-1c5016ce06fd', 'khushu', '2026-05-30 17:56:38+00', '2026-05-31 19:34:57+00'
FROM teams t WHERE t.name = 'Burnley';

INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '8da10e48-6fcc-478a-96f8-a0c78e150059', 'anele_arh', '2026-05-31 19:34:57+00', NULL
FROM teams t WHERE t.name = 'Burnley';

-- 5. Everton: MpenduleSphaa (May 22 → May 22 22:04), dot (May 22 22:04 → Jun 4), matolo7 (Jun 4 → now)
INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '16529e45-fb94-4d2b-a5bd-e11f65af2b98', 'MpenduleSphaa', '2026-05-22'::date, '2026-05-22 22:04:52+00'
FROM teams t WHERE t.name = 'Everton';

INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '263d3ad9-7210-4e35-b8b7-670536d49772', 'dot', '2026-05-22 22:04:52+00', '2026-06-04 19:59:00+00'
FROM teams t WHERE t.name = 'Everton';

INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, 'cac349db-932a-4e3f-9d3f-59d96c169a23', 'matolo7', '2026-06-04 19:59:00+00', NULL
FROM teams t WHERE t.name = 'Everton';

-- 6. Liverpool: ayathaba (May 22 → May 30), siyethemba_ (May 30 → now)
INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '886f3fb5-c7ef-4c93-9bf1-d8225c12819b', 'ayathaba', '2026-05-22'::date, '2026-05-30 17:16:17+00'
FROM teams t WHERE t.name = 'Liverpool';

INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '985248d2-0e12-4020-86cf-deb3be7cd9cc', 'siyethemba_', '2026-05-30 17:16:17+00', NULL
FROM teams t WHERE t.name = 'Liverpool';

-- 7. Manchester City: mubizamaan (May 22 → Jun 7), thando_1110 (Jun 7 → Jun 8), Thando (Jun 9 → now)
INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '16ec92ad-afb3-4c5b-851b-20eb423b06f9', 'mubizamaan', '2026-05-22'::date, '2026-06-07 21:09:47+00'
FROM teams t WHERE t.name = 'Manchester City';

INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '0d1019ad-9727-4dc6-b683-fdefc5deec8a', 'thando_1110', '2026-06-07 21:09:47+00', '2026-06-08 21:57:59+00'
FROM teams t WHERE t.name = 'Manchester City';

-- Brief reassignment: thando_1110 assigned Jun 9 19:59, sacked Jun 9 21:28
INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '0d1019ad-9727-4dc6-b683-fdefc5deec8a', 'thando_1110', '2026-06-09 19:59:58+00', '2026-06-09 21:28:20+00'
FROM teams t WHERE t.name = 'Manchester City';

INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '2c1dd4b3-041a-4262-866c-4cbcd5c0a4aa', 'Thando', '2026-06-09 21:28:20+00', NULL
FROM teams t WHERE t.name = 'Manchester City';

-- 8. Newcastle: Thando (May 22 → May 22 22:05), calvin (May 22 22:05 → Jun 8), GOAT (Jun 8 → now)
INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '2c1dd4b3-041a-4262-866c-4cbcd5c0a4aa', 'Thando', '2026-05-22'::date, '2026-05-22 22:05:11+00'
FROM teams t WHERE t.name = 'Newcastle United';

INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, 'ac6a7b31-1549-4f5b-a229-8b4563da5561', 'calvin', '2026-05-22 22:05:11+00', '2026-06-08 19:34:15+00'
FROM teams t WHERE t.name = 'Newcastle United';

INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, 'cf740a3a-e6bc-4a8a-834a-b7e5926f11b0', 'GOAT', '2026-06-08 19:34:19+00', NULL
FROM teams t WHERE t.name = 'Newcastle United';

-- 9. Sunderland: Obakeng (May 22 → Jun 1 15:38), Obakeng (Jun 1 16:03 → Jun 2), mapansela (Jun 2 → now)
INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '38666d4a-1f37-473f-8997-1ca06121de90', 'Obakeng', '2026-05-22'::date, '2026-06-01 15:38:51+00'
FROM teams t WHERE t.name = 'Sunderland';

INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '38666d4a-1f37-473f-8997-1ca06121de90', 'Obakeng', '2026-06-01 16:03:41+00', '2026-06-02 16:22:37+00'
FROM teams t WHERE t.name = 'Sunderland';

INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, 'b21a7b53-b7de-4574-81b2-194fcd156a22', 'mapansela', '2026-06-02 16:22:37+00', NULL
FROM teams t WHERE t.name = 'Sunderland';

-- 10. West Ham: Lindokuhle (May 22 → May 23), lloyd_freshboi (May 23 → Jun 4), hlabaking103 (Jun 4 → now)
INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, 'b4270e0e-2697-4c7f-9173-0d355818da30', 'Lindokuhle', '2026-05-22'::date, '2026-05-23 12:04:15+00'
FROM teams t WHERE t.name = 'West Ham United';

INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, '50960109-d172-472a-8346-250b6a29f26f', 'lloyd_freshboi', '2026-05-23 12:04:15+00', '2026-06-04 19:59:16+00'
FROM teams t WHERE t.name = 'West Ham United';

INSERT INTO manager_tenures (team_id, manager_id, manager_username, started_at, ended_at)
SELECT t.id, 'cc0040f7-19b9-46d2-9721-e162f6583467', 'hlabaking103', '2026-06-04 19:59:16+00', NULL
FROM teams t WHERE t.name = 'West Ham United';

-- 11. Recalculate stats for all tenures
-- This uses the existing recalc_tenure_stats function from migration 010
DO $$
DECLARE
  tenure_record RECORD;
BEGIN
  FOR tenure_record IN SELECT id FROM manager_tenures LOOP
    PERFORM recalc_tenure_stats(tenure_record.id);
  END LOOP;
END $$;

COMMIT;
