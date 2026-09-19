# EFA News — Poster Text-Dump Fix

Follow-up on `.opencode/context/efa-news/efa-news-workflow_2026-09-14.md`: the first generated poster dumped every researched fact onto the image as text. This change adds text-prioritisation rules to the Leonardo prompt workflow in `AGENTS.md`.

## Problem

The user ran OCR (tesseract) on the generated Thando poster and found the AI rendered ALL the researched context as text blocks on the image:
- Playstyle label `"TACTICAL ADAPTIVE"`
- A team CV strip (`NEWCASTLE UNITED 0 wins`, `MANCHESTER CITY 33 conceded`, `BRAZIL`, `LIVERPOOL`, `BOURNEMOUTH his best run... still nothing to show`)
- `TROPHIES? NO.` notes
- `HANA NATIONAL STADIUM` sign, `EFA SCANDAL!` banner, `ALL IN ON RED`

The prompt dumped context (as designed) but never told the AI what to prioritise, so the AI treated every fact as equally display-worthy and filled the poster with text beyond the headline.

## Fix

Updated step 2 of the EFA News / Poster Generation section in `AGENTS.md` with a **PRIORITISE — no text dumps** bullet:
- Only the headline may appear as text on the poster.
- Researched facts are background knowledge / optional visual motifs only — never as text blocks, stat lists, labels, or subheadings (no playstyle labels, no team CV strips, no trophy notes, no record breakdowns).
- Instruct the AI to pick ONE clear focal scene that carries the whole joke, with at most 1-2 small supporting props.
- Drop anything that doesn't serve that single gag.

## Files changed

- `AGENTS.md` — added prioritisation rule to the workflow (step 2).
- This context file (follow-up in `efa-news/`).