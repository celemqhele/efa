# EFA News — Twitter/Instagram Banter Caption Style

Follow-up on `.opencode/context/efa-news/efa-news-facts-only-rule_2026-09-14.md`: the user reported captions sounded like "ChatGPT humour" and wanted the caption voice to match real football Twitter / Instagram comment-section banter. This change bakes the researched banter style into `AGENTS.md`.

## Problem

Generated captions used ChatGPT-prose voice: long paragraphs, flowery metaphors, em dashes, and SA flavour words used as decoration. User wanted short, brutal, banter-style captions like a football Twitter reply or IG comment.

## Research

Searched football Twitter (FT) and Instagram comment-section banter. Key mechanics learned:
- Short punchy reactions/fragments; one or two words carry the shot (washed, finished, cooked, in the mud, ratio).
- Facts used as deadpan ammunition with no metaphors around them.
- ALL-CAPS for emphasis/sarcasm.
- Minimal punctuation — periods rare, fragments normal, no em dashes.
- Repetition for effect; casual broken grammar is a feature ("Korea 2- SA 1", "mara 😂").
- Emoji as the actual punchline (😂😭💀), not decoration.
- SA flavour words used naturally where they fit, never as adornment.
- Hype/roast energy even when the target is a mate's team; never elegiac/poetic.
- No em dashes anywhere — in captions AND in instructions to the Leonardo prompt (plain, tabloid-clean on-poster typography).

## Fix

Updated step 3 of the EFA News / Poster Generation section in `AGENTS.md`:
- Added a **BANTER STYLE** sub-block describing the researched Twitter/IG comment-section mechanics as the caption voice (NOT ChatGPT prose).
- Added **NO EM DASHES anywhere** rule: no em dashes in caption text, and the Leonardo prompt must be instructed to avoid em dashes / long hyphen flourishes in on-poster text.
- Also added the plain-tabloid-typography (no em dashes) instruction to the step 2 PRIORITISE bullet in `AGENTS.md`.

## Files changed

- `AGENTS.md` — step 2 typography note + step 3 BANTER STYLE block + NO EM DASHES rule.
- This context file (follow-up in `efa-news/`).