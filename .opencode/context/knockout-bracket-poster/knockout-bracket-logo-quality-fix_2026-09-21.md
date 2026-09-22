# Knockout Bracket Poster — Logo Rendering Quality Fix — 2026-09-21

Follow-up to `.opencode/context/knockout-bracket-poster/knockout-bracket-logo-and-spacing_2026-09-21.md`: the R16 logos in the generated poster looked "scribbled". Root cause was rasterization, not the source artwork.

## Problem
User reported the team logos on the bracket poster appear scribbled/jagged. The source PNGs in `public/logos/fifa-world-cup-2026.football-logos.cc/1280x1280/` are genuinely high-res (verified: 1280x1280, ~17.6k sampled colors, low edge density — not upscaled from small rasters). Diagnosis: Ghostscript was embedding the full 1280² PNG per logo and performing a ~12:1 downscale at final rasterization, which produces soft/moirey edges at the 52pt display size.

## Fix
- `scripts/generate-bracket-png.tsx`:
  - Added `preResizeLogos()`: before rendering, each of the 16 team logos is resized with **sharp** from the 1280² source down to `LOGO_PX` (cached to `node_modules/.cache/bracket/logos/{slug}.png`, slim 208px), flattened onto the `#111a33` card background (eliminates alpha/smask rendering artifacts). The bracket doc now resolves logos from `LOGO_CACHE_DIR` (exported from `scripts/guide/knockout-bracket.tsx`) instead of the raw 1280² files; `ALL_TEAM_SLUGS` exported for the generator loop.
  - Pipeline change: render the PDF at **288 DPI** (2x final) with Ghostscript, then downscale the full page with **sharp lanczos3** to the final 2560x1440. Logo cache size chosen to match the exactly-rendered size at 288 DPI (52pt box → 208px), so Ghostscript does ~1:1 on logos and sharp does the clean final downsample.

## Verification
- `npx tsc --noEmit` clean.
- sharp SSIM of the rendered MD51 home-logo crop vs a clean 104px reference from the cached logo: **0.89** (high structural similarity, i.e. no moire/ringing). RMS-distance experiment across pipelines (OLD 144 DPI vs NEW 288 DPI + lanczos) confirmed the new pipeline is closer to an ideal lanczos reference.
- Region-scan confirms all boxes still render content (MD51~3.7k, MD58~9.6k bright/gold px, QF/SF/FINAL 3.1k–6.3k, footer 8.2k).