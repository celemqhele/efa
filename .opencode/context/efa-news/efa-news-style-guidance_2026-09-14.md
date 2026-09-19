# EFA News — Style Guidance (user reference examples)

Follow-up on `.opencode/context/efa-news/efa-news-poster-text-dump-fix_2026-09-14.md`: the user supplied three real-world reference images of the poster vibes they like and asked that they be treated as **guidance, not explicit instructions** in the Leonardo prompt workflow.

## What was done

Added a **"Style guidance"** bullet to step 2 of the EFA News / Poster Generation section in `AGENTS.md`, describing three reference vibes the user likes (extracted via tesseract OCR since this model cannot view images):

- **Tabloid newspaper front page** — e.g. the "Ghana Chronicle" example: masthead, "FOOTBALL / NATION / PRIDE" banner, date line (Monday 14 September 2026), price tag (GH¢ 5.00), splash headline, multi-column article with invented quotes, "(sacked)" portrait captions, "WHAT'S NEXT" box.
- **Sports broadcast stat card** — e.g. the "WRECKING" Morocco card: bold stat call-outs (16 goals scored / 4 conceded) plus a full mini standings table (P W D L GF GA GD PTS).
- **Match fixture card** — e.g. the FIFA World Cup 2026 card: day + date + "KICK OFF 20:00 (LOCAL TIME)" + tournament branding.

The reference image paths are recorded in `AGENTS.md` (`WhatsApp Image 2026-09-14 at 20.58.14.jpeg`, `b3953c8f-e58c-43fb-923b-b8e9482ceb71.jpg`, `43afd68c-4642-4e59-924e-918a5982d605.jpg` in `C:\Users\mqhel\Downloads`).

## Key reconcile with the no-text-dumps rule

The text-dump fix (`efa-news-poster-text-dump-fix_2026-09-14.md`) banned arbitrary stat/label text-scatter. The style guidance clarifies the exception: **within a fully-adopted layout** (tabloid masthead, kicker, headline, mini standings tables) structured text is on-brand and allowed — but it must be layout-driven, not a catch-all fact-dump. The AI picks the layout best suited to the story and must stick to it.

## Limitations

This model (big-pickle / opencode) does not support image input — the reference images cannot be visually inspected in-session. Content was inferred via tesseract OCR; if deeper visual styling is needed the user must describe it in words (colours, typography, framing, mood).