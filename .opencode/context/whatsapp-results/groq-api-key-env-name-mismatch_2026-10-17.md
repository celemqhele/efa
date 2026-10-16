# WhatsApp bot: fix the Groq API key env var name (`GROQ_API_KEY` vs `GROQ_API`)

Fixed the bot's primary LLM path: `lib/whatsapp.ts` authenticated Groq with
`process.env.GROQ_API_KEY`, but the production Vercel project only defines an env
var named **`GROQ_API`** — so every Groq request went out as
`Authorization: Bearer undefined`, came back 401, and the code silently fell
through to the Gemini fallback (or to a hard-coded apology). Both call sites now
read `process.env.GROQ_API_KEY ?? process.env.GROQ_API`, so the deployed name
works and either spelling keeps working.

Found while investigating a "someone tried to postpone and it said something went
wrong" report against the match portal (see
`.opencode/context/submit-portal/postpone-stale-request-block-and-portal-error-transparency_2026-10-17.md`).
The portal turned out to be the actual cause; this is an independent defect that
surfaced during the log audit. Related OCR/LLM work is in
`.opencode/context/whatsapp-results/ocr-vision-first-reader_2026-09-23.md` and
`.opencode/context/whatsapp-results/ocr-stat-reliability-fixes_2026-09-22.md`.

## Problem

`lib/whatsapp.ts`:

- `const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions'` (L3) — the
  **URL**, and
- `Authorization: \`Bearer ${process.env.GROQ_API_KEY}\`` (L341 in
  `cleanOcrWithGroq`, L452 in `conversationalReply`) — the **key**.

`vercel env ls production` / `vercel env pull` list the production variables and
there is **no `GROQ_API_KEY`**; there is a `GROQ_API`. So `process.env.GROQ_API_KEY`
is `undefined` in production, the header is `Bearer undefined`, Groq replies
`401 {"error":{"message":"Invalid API Key",...,"code":"invalid_api_key"}}`, and
both functions move on:

- `cleanOcrWithGroq` → dead, so OCR text cleaning always falls to the next tier.
- `conversationalReply` → Groq skipped, then the Gemini fallback
  (`gemini-3.1-flash-lite`, `GEMINI_API_KEY`).

Note on the misleading error string: `conversationalReply` returns
`"Sorry, something went wrong on my side. Please try again."` when both providers
fail, but its only caller (`app/api/webhook/route.ts:5878`) switches on
`intent.intent` and its `default` branch sends `resultFlowReprompt(session)` /
`sendWelcomeMenu` — it **never sends `intent.reply`**. So that apology text is
effectively unreachable in the bot; a manager typing a postponement request gets
the menu/reprompt, not that message. That ruled the bot out as the source of the
reported generic error (the portal was).

## Fix

`lib/whatsapp.ts`, both Groq call sites (L341 and L452), one-line change each:

```diff
-      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
+      Authorization: `Bearer ${process.env.GROQ_API_KEY ?? process.env.GROQ_API}`,
```

Accepting both names is deliberate: the code has always said `GROQ_API_KEY`, so
renaming or re-adding the Vercel variable in either direction keeps working.
`GROQ_API` doubles as the module-level URL constant name, which is what made the
mismatch easy to miss — the env var and the constant share a name but are
different things.

## Verification

- `npx tsc --noEmit` — clean.
- `npx eslint lib/whatsapp.ts` — clean.
- Production env names confirmed with `vercel env pull` (`GROQ_API`,
  `GEMINI_API_KEY` present; no `GROQ_API_KEY`). The CLI redacts the values, so the
  key itself could not be exercised locally.

## Notes

- Not changed here: the `GEMINI_API_KEY` value and the
  `gemini-3.1-flash-lite` model name (both used by `analyzeScreenshot` vision
  OCR through the same `GEMINI_API` constant) were left alone — every result
  screenshot flow depends on them, and the OCR path was working in production.
- If the bot's Groq replies are still unhealthy after this deploys, the next thing
  to check is whether the `GROQ_API` value is a valid key (it is also the name of
  the URL constant, so a copy/paste of the endpoint into the value would look
  plausible but fail).
