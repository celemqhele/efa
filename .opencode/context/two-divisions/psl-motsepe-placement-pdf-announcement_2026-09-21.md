# PSL / Motsepe Placement Announcement — Converted to a Designed PDF

Converted the PSL/Motsepe division-placement announcement from a plain Markdown document into a branded 3-page PDF (`public/EFA-Announcement-LeaguePlacement.pdf`, ~415 KB) for posting to the WhatsApp group with design, following the same `@react-pdf/renderer` navy/gold build system as the onboarding guides. Follow-up to `.opencode/context/two-divisions/psl-motsepe-placement-announcement_2026-09-21.md`, which created the Markdown version — the user asked for a PDF "with design" to post to the group.

## Problem
- The first pass wrote `public/EFA-PSL-Motsepe-Placement-Announcement.md` (plain Markdown). The user needs to post the announcement to the group, so it must be a designed PDF, not a `.md` file.
- Same content requirements as before: managers only (no team/club names — managers pick new SA clubs later), full combined 32-manager table first, then the 16+16 split.

## Fix / Actions
- New doc component `scripts/guide/placement-announcement.tsx` (default-exported `Document`, same style system as `scripts/guide/shared.tsx`):
  - **Page 1 — Cover:** `CoverPage` (EFA logo, "EFA OFFICIAL ANNOUNCEMENT" / "2026 LEAGUE PLACEMENT", tagline "Based on Performance in the EFA International Cup").
  - **Page 2 — Overall table:** intro paragraph + note, then the full 32-row ranking table (`# / MANAGER / P / W / D / L / GF / GA / GD / PTS`). Top-16 rows tinted green, bottom-16 tinted red; rank numbers colored the same way. Compact cell styles kept the whole 32-row table on one A4 page.
  - **Page 3 — Split:** two side-by-side columns — "PSL · FIRST DIVISION · TOP 16" (green, badge `1`) and "MOTSEPE · SECOND DIVISION · BOTTOM 16" (red, badge `2`), each listing its 16 managers with rank + points, plus `Footer`.
- New generator entry `scripts/generate-announcement-pdf.tsx` + `package.json` script `generate-announcement-pdf` (runs `tsx scripts/generate-announcement-pdf.tsx`), output `public/EFA-Announcement-LeaguePlacement.pdf`. Kept separate from the guide-PDF generator since it's a one-shot announcement, not part of the guide set.
- The manager stat array (`MANAGERS`) is derived from the group-stage data pulled in the previous context file (group_standings for tournament `e2c61a3e-072e-4a07-8024-76de20c2a99a` → current `manager_tenures` mapping). Same sort basis: points → goal diff (incl. forfeit `gd_penalty`) → goals for, matching `lib/standings-core.ts` `sortStandingsRows`.

## Verification
- `npx tsc --noEmit` clean; `npx eslint` clean on the two touched script files (removed unused `Font` import / `GOLD_BRIGHT` const).
- Rendered output checked with Ghostscript (`gswin64c`): 3 pages; page 2 contains all 32 table rows (1–32, `loneprsly` last); page 3 contains all 32 manager names in two 16-name columns (PSL left, Motsepe right). Visual design can't be previewed in this toolchain — layout verified by text extraction code review.
- Iteration note: first render spilled row 32 and the split onto a 4th page; compacted cell padding (2.5), font (7.5), and page padding (24) to land exactly 3 pages.

## Restore File Section
| Original Path | Description | New Path |
|---------------|-------------|----------|
| `public/EFA-PSL-Motsepe-Placement-Announcement.md` | Markdown draft of the announcement (superseded by the designed PDF) | `.recycle/psl-motsepe-announcement/EFA-PSL-Motsepe-Placement-Announcement.md` |

## Context chain (by path)
- Original announcement content + manager mapping:
  `.opencode/context/two-divisions/psl-motsepe-placement-announcement_2026-09-21.md`
- Two-division season model this feeds:
  `.opencode/context/two-divisions/two-divisions-standings_2026-09-02.md`
- PDF design/build pattern reused (guide generator + `scripts/guide/shared.tsx`):
  `.opencode/context/whatsapp-ux/guide-split-four-docs_2026-09-12.md`
- File-deletion/restore policy applied for the superseded `.md`:
  `.opencode/context/context-file-conventions/mandatory-context-file-rule_2026-09-03.md`