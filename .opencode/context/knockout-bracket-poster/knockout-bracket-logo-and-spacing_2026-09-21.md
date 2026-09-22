# Knockout Bracket Poster — Logos in R16 Boxes + Spacing Rework — 2026-09-21

Follow-up to `.opencode/context/knockout-bracket-poster/knockout-bracket-poster-2k-png_2026-09-21.md`: after the poster was generated, the user asked to (1) use the real team logos in the R16 cards with the words below them, and (2) rework the spacing.

## Problem
The first PNG rendered team names + managers as text only. User request: use the actual club logos instead, with the team name and `(manager)` **below** the logo, and the overall card spacing needed polish. Also, the first version had tiny text (name 5pt) because every R16 box line carried both name and manager; switching to a logo-centric card freed room.

## Fix
- `scripts/guide/knockout-bracket.tsx`:
  - New `TeamSlot` — renders the team **logo** (52x52) at the top of each R16 half, team name (7pt gold) at `top+60`, `(manager)` (6pt muted grey) at `top+74`. `cx` = 25% / 75% of the card width.
  - Logos resolved via a new `teamLogo(slug)` helper → `pathToFileURL(process.cwd() + '/public/logos/' + folder + '/1280x1280/' + slug + '-national-team.png')` (folder = `fifa-world-cup-2026.football-logos.cc` for all 16, verified files on disk).
  - Re-laid-out geometry (page 1280x720pt): R16 cards now 250x96 at `x=40`/`x=990`, y = [137,247,397,507]; QF 150x104 at `x=300`/`x=830`, y = [188,448]; SF 110x120 at `x=470`/`x=700`, y = 310; FINAL 120x132 at `x=580`, `y=304`; footer note y=642 + sub-line y=690.
  - Connector endpoint map updated to the new box edges (left half 290→295→300→…; right 990→985→980→…; QF→SF stubs 450/460/470 and 700/810/820/830).
- Regenerated PNG → `public/EFA-InternationalCup-KnockoutBracket.png` (2560x1440).

## Bug caught during verification
Absolute-positioned children inside `R16Box`/`StageBox` were given box coords **plus** the box's own `left/top` (doubled offset), so logos/text landed outside the cards. Fixed all inner positions to be box-relative (child `top`/`left` relative to the absolutely-positioned box `View`).

## Verification
- Regeneration needed `Remove-Item` on the output PNG first (Ghostscript couldn't overwrite a locked file from a prior run).
- `sharp` pixel analysis on the PNG: bright colorful crest pixels present in all 16 logo slots (home+away x each of the 8 R16 cards); team-name bands have ~300px of light text and manager bands ~225px of muted `#94A3B8` text; "VS" gold px present; QF/SF/FINAL boxes each contain bright+gold content (~3.3k–6.3k px); gold connectors present at left mid, left QF→SF, and right SF→QF stubs.