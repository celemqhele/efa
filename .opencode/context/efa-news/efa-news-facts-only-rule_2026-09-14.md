# EFA News — Facts-Only Rule (no hallucinated stats)

Follow-up on `.opencode/context/efa-news/efa-news-style-guidance_2026-09-14.md`: the user clarified that the text inside the style-reference images is illustrative filler, so the workflow must guarantee every factual detail comes from Supabase verbatim — never invented.

## What was done

Added a **"FACTS ONLY — no hallucinated stats"** bullet to step 1 of the EFA News / Poster Generation section in `AGENTS.md`:
- Every fact in the prompt/caption (records, scores, W/D/L, GF/GA, points, trophies, teams managed, names) MUST come verbatim from the Supabase queries.
- Never invent numbers, results, or history to fill a gap — omit or leave it to the AI's imagery instead.
- Only the joke/narrative is invented; the underlying facts are real league data.

## Why

The style-reference images OCR'd in `efa-news-style-guidance_2026-09-14.md` contain fabricated numbers (e.g. "Morocco 16 goals scored"). Those images are guidance for layout/vibe only — their stats are not real. The researched context that goes into Leonardo prompts and SAL captions must always be genuinely queried league data so the comedy stays grounded in reality.

## Conventions this locks in

- Read-first culture: query Supabase for every subject before writing the prompt.
- When data is thin (no trophies, no current season standings), reflect that honestly rather than padding.
- The poster AI may invent imagery/mood freely; it may NOT be handed fabricated stats to render.