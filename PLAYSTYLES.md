# Team Playstyles & DNA Profiles

Reference for assigning and updating team playstyle DNA profiles. This file documents all 11 DNA profiles, their characteristics, and the workflow for populating/updating them for a tournament.

---

## 11 DNA Profiles

### 1. Elite Dominators
**Icon:** crown | **Color:** amber
Total control — high possession, heavy passing, clinical shooting, defensive solidity. Suffocates opponents through complete territorial and technical dominance. Keeper rarely tested.
- **Tendencies:** Dictates tempo, creates high shot volume, defends by keeping the ball, dominates passing + pressing metrics
- **Weaknesses:** Compact low blocks frustrate build-up, quick direct attacks bypass high line, physical fouling disrupts rhythm

### 2. Tiki-Taka
**Icon:** theater | **Color:** blue
Possession as both attack and defence. Very high possession (>56%), exceptional pass accuracy (>81%), very few crosses. Danger through central combinations, one-twos, through balls.
- **Tendencies:** Ball retention above all, short precise passes, central combinations, midfield squeeze for triangles, coordinated pressing
- **Weaknesses:** Intense pressing forces errors, direct long balls bypass structure, compact low blocks deny space between lines

### 3. Gegenpressing
**Icon:** zap | **Color:** yellow
High-intensity counter-pressing. High tackles, interceptions, elevated fouls. 5-second rule: win ball back immediately after losing it. Fouls are tactical disruption.
- **Tendencies:** Instant attack-to-defence switch, coordinated pressing traps, tactical fouls, high defensive line, shots from turnovers
- **Weaknesses:** Energy drops in final 20 min, composed build-up bypasses press, long diagonals expose space behind fullbacks

### 4. Disciplined Pressers
**Icon:** brain | **Color:** indigo
Organized pressing through positioning and reading — not aggression. High interceptions and tackles, but very low fouls. Maximum ball recovery with minimum risk.
- **Tendencies:** Cuts passing lanes via anticipation, wins ball through interceptions, rarely fouls, forces low-value passes, maintains compact shape
- **Weaknesses:** Elite dribblers break structure, unpredictable passing hard to read, quick one-twos unlock pressing lines

### 5. Quick Counter
**Icon:** dagger | **Color:** red
Vertical explosive transitions. Low possession, high shot volume, high offsides, high saves. Absorbs pressure then explodes forward. Thrives when opponents push up.
- **Tendencies:** Medium-to-low block absorption, minimal-touch attacks, forwards test defensive line, keeper triggers counter, avoids sideways passes
- **Weaknesses:** Possession teams deny transitions, deep low blocks leave no space, isolated forwards can't hold ball up

### 6. Long Ball Counter
**Icon:** shield | **Color:** slate
Deep defence, direct attacks bypassing midfield. Very low possession, low passes, low accuracy, very high saves. Keeper is central defender in possession.
- **Tendencies:** Compact low block (often back five), direct from goal kicks, keeper faces distance shots, interceptions win ball, rare but dangerous corners
- **Weaknesses:** Man-marking target man, keeper pressing forces errors, possession teams exhaust defenders, can't chase games

### 7. The Grinders
**Icon:** muscle | **Color:** orange
Physical combative football — wins through duels, set-pieces, sheer work rate. High fouls, tackles, free kicks. Low possession and pass accuracy. Makes game uncomfortable for technical opponents.
- **Tendencies:** Physical in every duel, gives and wins fouls, direct football, dangerous from set-pieces, wears opponents down
- **Weaknesses:** Technical possession teams pick apart, foul count gives away set-pieces, can't force physical dominance = exposed

### 8. Out Wide
**Icon:** arrows_horizontal | **Color:** cyan
Expansive attacking through width. High crosses, high corners, moderate possession. Full width is attacking channel — overlaps, underlaps, crosses. Stretches defences horizontally.
- **Tendencies:** Attacks both flanks, delivers crosses early, wins corners through wide pressure, stretches defensive shape, width as weapon
- **Weaknesses:** Compact narrow defences with aerial CBs, back-five formations outnumber wide areas, poor delivery = no plan B

### 9. Set-Piece Specialists
**Icon:** triangle | **Color:** violet
Dead-ball situations are primary scoring method. High corners, free kicks, fouls won, crosses. Rehearsed routines for every set-piece. Actively wins fouls in dangerous areas.
- **Tendencies:** Wins fouls via purposeful carries, rehearsed corner routines, free kick shots + headers, throw-ins as set-pieces, studies opponent setups
- **Weaknesses:** Strong aerial defending, opponents avoid giving fouls, poor delivery kills output, predictable routines countered

### 10. Shoot-on-Sight
**Icon:** target | **Color:** pink
Volume shooting philosophy. Very high total shots, low shot accuracy (<0.5 SoT/shots). Shoots from distance, tight angles, early phases. Statistical approach: more shots = more goals.
- **Tendencies:** Shoots from anywhere, generates corners from blocks, aggressive forward runs (accepts offsides), hunts rebounds, quantity over quality
- **Weaknesses:** Organized defences block lanes, keepers with strong handling, aggressive press stops shots, frustration leads to worse attempts

### 11. Pragmatic Stabilizers
**Icon:** scale | **Color:** green
Default fallback — balanced style with no extreme tendencies. Team has limited data, is still developing identity, or adapts game-by-game. Not negative — just not yet dominant in any direction.
- **Tendencies:** Balanced game, adapts to opponent, no strong statistical signals, shifts between styles, may reflect transitional period
- **Weaknesses:** Specialists find edges, can't impose game, lacks automatic responses in critical moments

---

## Workflow: Assign/Update Playstyles for a Tournament

### Step 1: Identify teams
Query all teams participating in the tournament:
```sql
SELECT DISTINCT t.id, t.name
FROM fixtures f
JOIN teams t ON t.id IN (f.home_team_id, f.away_team_id)
WHERE f.tournament_id = '<tournament_id>';
```

### Step 2: Check for existing match data
For each team, check if they have confirmed fixtures with match_stats:
```sql
SELECT f.id, f.status, r.id as result_id, ms.*
FROM fixtures f
JOIN results r ON r.fixture_id = f.id
JOIN match_stats ms ON ms.result_id = r.id
WHERE f.status = 'confirmed'
  AND (f.home_team_id = '<team_id>' OR f.away_team_id = '<team_id>')
ORDER BY f.scheduled_date DESC
LIMIT 5;
```

### Step 3a: Has match data → Auto-analyze
Run the DNA scoring engine (`lib/dna-engine.ts` → `getTeamDNA()`) on match stats. The engine computes scores for all 11 profiles and returns the top 1-3 matches with levels (+++++ through ----).

### Step 3b: No match data → Manual assignment
Assign a primary profile based on the team's real-world playing style. Use the 11 profiles above as reference. The `primary_level` for manual assignments should be `+++` (Solid Match) as a baseline — it will be refined when actual match data becomes available.

### Step 4: Upsert into team_dna
Use `/api/admin/assign-dna` payload format:
```json
{
  "team_id": "<uuid>",
  "primary": { "profile": "Profile Name", "level": "+++", "score": 0.5 },
  "secondary": null,
  "tertiary": null
}
```

### Step 5: Generate personalized descriptions
Run: `npx tsx scripts/generate-playstyle-descriptions.ts`
This creates `primary_about`, `primary_tendencies`, `primary_weaknesses`, `primary_coach_note` per team.

### Step 6: Generate coach notes for fixtures
Run: `npx tsx scripts/generate-fixture-coach-notes.ts`
This creates per-fixture `confidence`, `opponent_will_exploit`, and `recommendations` in `fixture_coach_notes`.

---

## Script

For automated population: `npx tsx scripts/populate-tournament-dna.ts <tournament_id>`
This script handles Steps 1-6 for all teams in a tournament.

### Requirements
- `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables set
- Tournament must exist with participating teams
- Match stats optional — teams without stats get manual profile assignments

---

## Level Scale

| Level | Score Range | Label |
|-------|-------------|-------|
| +++++ | ≥0.80 | Pure Expression |
| ++++ | ≥0.65 | Strong Match |
| +++ | ≥0.50 | Solid Match |
| ++ | ≥0.38 | Moderate Match |
| + | ≥0.27 | Developing |
| - | ≥0.18 | Marginal |
| -- | ≥0.10 | Weak Match |
| --- | ≥0.04 | Very Weak |
| ---- | <0.04 | Forced Match |
