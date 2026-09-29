# eFootball Allowlist Is the Logo CDN, Not the Game Roster — and a Crest-Colour Matcher for the 32 Season 4 Clubs

Verified that no South African club exists in eFootball, documented that `lib/efootball-2027-teams.json` mirrors the `football-logos.cc` CDN rather than Konami's actual licensed roster (and is stale on top of that), and added `scripts/extract-club-palettes.ts` to propose a colour-matched eFootball crest for all 32 Season 4 clubs. The user asked for eFootball logo/club suggestions for the Season 4 split because "all these teams are not available on konami" — the user's premise was right and my first instinct (that the repo allowlist proved they *were* available) was wrong.

## Problem
- The user wants a suggested eFootball club + logo for each of the 32 Season 4 clubs, on the basis that none of the real SA clubs are in the game.
- `lib/efootball-2027-teams.json` appears to contradict that: it contains `south-african-premiership-2026-2027`, `motsepe-foundation-championship-2026-2027` and `abc-motsepe-league-2026-2027`, which together cover all 32 Season 4 clubs (11 + 17 + 4, with the 3 vacant Div 2 slots included). I initially treated that file as authoritative and told the user no work was needed.
- That was wrong. The file's keys are `*.football-logos.cc` CDN folder names, and `.opencode/context/efootball-teams/efootball_teams_2026-08-15.md` describes it as the set of clubs that "exist in eFootball 2027 (v6.0.0)" — but the data is a **logo library**, and the fact that a logo pack exists on a CDN says nothing about the game client.
- Konami's official license page (https://www.konami.com/efootball/en/page/license_efootball) lists 28 club leagues: English, English 2nd, Spanish, Spanish 2nd, Italian, Italian 2nd, Ligue 1, Ligue 2, Liga Portugal, Trendyol Süper Lig, Eredivisie, Belgian, Danish, Scottish, Swiss, Brasileirão, Brazilian 2nd, Argentine, Chilean, Colombian, American (MLS), Moroccan, Liga Super Malaysia, Korean, J1, J2, AFC Champions League Elite, AFC Champions League Two. **There is no South African league.** All 32 clubs need a substitute.

## Fix / Actions
- Confirmed the premise with the user, who clarified they meant the game, not the website.
- Added `scripts/extract-club-palettes.ts` (`npx tsx scripts/extract-club-palettes.ts`):
  - Reads crest PNGs already on disk at `public/logos/<folder>/256x256/<slug>.png` via `sharp` (already a dependency — no new packages, no third-party palette site, no logo upload).
  - Drops pixels with `alpha < 128` (most crests sit on transparency, so without this every badge reads as blank/white).
  - Bins each pixel into one of 12 hue families × dark/mid/light lightness, plus `black`/`grey`/`white` achromatic families, and keeps the top 4 families per crest.
  - Weights families by `sqrt(area)`, not area, and scores asymmetrically: `0.75 * directed(A→B) + 0.25 * directed(B→A)` in OKLab.
  - Emits a ranked table, crest hex per club, per-club runner-ups, and `node_modules/.cache/club-palettes.json`.
  - Pass extra args to inspect specific palettes, e.g. `npx tsx scripts/extract-club-palettes.ts sundowns brazil`.
- **Two earlier scoring attempts were wrong and were rewritten** (kept here because the failure modes are easy to repeat):
  1. *Weighting by raw area + down-weighting near-black/near-white* made Brazil extract as blue-dominant (32% blue, 13% yellow, green below threshold) because the CBF shield fill dominates the artwork — so a colour-by-area metric can never see the yellow-and-green that makes Brazil look like Mamelodi Sundowns. The near-black down-weight was separately harmful: it crushed Ghana's black to weight 0.026 despite 21% area, for no good reason.
  2. *Symmetric scoring* ranked near-identical palettes above candidates that actually contain the target's signature colours.
- Built the candidate pool from **the filesystem, not the JSON**, because the JSON is stale: 12 of its 108 entries have no logo at any size. It lists `ipswich` where disk has `burnley`, `betis` vs `real-betis`, `ac-milan` vs `milan`, `lecci` vs `lecce`, `como` vs `como-1907`, plus promotion/relegation churn (`alaves`/`leganes`/`las-palmas`/`valladolid` vs `deportivo`/`elche`/`levante`/`oviedo`; `monza`/`venezia`/`empoli` vs `cremonese`/`pisa`/`sassuolo`).
- Added a greedy one-to-one matching over the full score matrix, because the plain closest-match ranking reused one eFootball club for two different EFA clubs 5 times (South Africa ×2, Belgium ×2, Lecce ×2, Milan ×2, Portugal ×2) — identical crests on opposite sides of a fixture.
- Per the user's instruction, **did not** rebuild `lib/efootball-2027-teams.json`; only documented the problem.

## Recommendations (not applied — user chose "just document it for now")
1. Rebuild `lib/efootball-2027-teams.json` from Konami's license list: drop the 3 SA packs, add the ~18 real in-game leagues currently missing (Morocco, Malaysia, Korea, J1, J2, AFC CL Elite/Two, Portugal, Turkey, Eredivisie, MLS, Belgian, Danish, Scottish, Swiss, Chile, Colombia, Argentina, plus the second divisions of England/Spain/Italy/Brazil), and sync slugs to what is actually on disk.
2. Verify the World Cup national-team entries separately — Konami's page says "National teams from around the globe coming soon", which does not match the 48 national teams in the JSON. Needs a direct check in a real client.
3. That allowlist gates the season wizard, admin managers page, webhook `getTeamsForAssignment` and the poll registry, so until it is corrected the team-picking UI offers 48 non-existent SA clubs while hiding real in-game clubs.

## Limitations (stated in the output, not hidden)
- The top-2 candidates are within 0.8% of each other for **all 32** clubs, so the ranking is only weakly determined; every runner-up is listed as a co-equal option and the user's own knowledge of the kits should win where it conflicts.
- 2 crests are effectively single-colour and produce a near-arbitrary nearest match: **Cape Town City** (89% one gold family) and **Hope** (96% white).
- Crest is not kit. Matching crest artwork is the right target for a *logo* swap, but it is not the same as matching jerseys — the clearest case being Mamelodi Sundowns, where the user asked for **Brazil** (correct on kits: yellow + green) while the crest metric prefers **Australia** (75% gold / 22% green, unique-assignment pick) or **South Africa** (51% green / 41% gold, closest but collides with AmaZulu).
- The pool is the repo's existing 108 clubs (EPL, La Liga, Serie A, World Cup), a subset of the real game, so some clubs get a worse match than a full 28-league pool would have found.
- No kit imagery exists on disk, so nothing here compares strip patterns.

## Related files
- `lib/efootball-2027-teams.json` — the stale allowlist at the centre of this finding.
- `lib/logo-resolver.ts` — `getTeamLogo` path shape and `slugToDisplayName` (reused for pool labels; note WC slugs already include the `-national-team` suffix, matching the filenames).
- `scripts/extract-club-palettes.ts` — new colour extractor/matcher.
- `.opencode/context/efootball-teams/efootball_teams_2026-08-15.md` — the context file whose "clubs that exist in eFootball 2027" claim this file corrects.
- `.opencode/context/two-divisions/season-4-two-division-setup_2026-09-27.md` — the 32 clubs being matched.
- `.opencode/context/two-divisions/standings-zone-colors-missing-from-css_2026-09-27.md` — unrelated but the same root pattern: a class present in code that never reached the output because its source was outside the scanned path.
