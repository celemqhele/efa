# WhatsApp delivery visibility: log Graph send results + Meta status callbacks

Added the two log points that were missing from the WhatsApp reply pipeline, so
a reply that Meta accepts but never delivers can finally be diagnosed from the
Vercel runtime logs. The user reported "my whatsapp ai bot not responding" while
the server showed inbound webhooks at 200 with zero errors.

## Problem

The bot received every message and returned 200, yet the user (27732509506)
saw no reply at all. Investigating `vercel logs` exposed two blind spots:

1. **Sends were silent on success.** `sendTextMessage` only called
   `console.error` when Graph returned non-2xx, so "no error logged" was
   indistinguishable from "no send attempted".
2. **Delivery receipts were discarded.** `app/api/webhook/route.ts` returned
   200 immediately when `value.messages` was empty — which is exactly the shape
   of Meta's `statuses` callbacks (sent/delivered/read/**failed** + `errors[]`).
   So the one payload that carries Meta's own failure reason was thrown away,
   and the pipeline always looked healthy.

A useful side observation during diagnosis: every inbound POST was followed
~3s later by a second POST with no log lines, which is the status callback —
i.e. the app *was* sending, Graph *was* accepting, and the failure is downstream
of API acceptance.

Also worth knowing: **Vercel runtime logs only retain roughly the last hour**
(`vercel logs --since 24h` still only returns recent rows), so failures older
than that are unrecoverable without instrumentation.

## Fix

1. **`lib/whatsapp.ts` — `sendTextMessage`**: read the response body once, log
   `WhatsApp send failed: status=<code> <payload>` on failure (status code was
   previously not logged), and on success log
   `[whatsapp] sent ok to=<msisdn> id=<Graph message id> len=<chars>`.
   `sendContactMessage` got the same treatment (`status=` on failure, a
   `contact sent ok` line on success).
2. **`app/api/webhook/route.ts` — `POST`**: before the
   `if (!messages?.length)` early return, log
   `[webhook] status: [{"id","status","recipient_id","timestamp","errors","conversation"}]`
   for `value.statuses[]`, then return 200. The early return for non-message
   payloads is unchanged otherwise.

## Verification

- `npx tsc --noEmit` clean.
- `npm run lint` — only pre-existing warnings, none in the two edited files.

## Gotchas / Notes

- Correlate the two lines: `[whatsapp] sent ok ... id=wamid.X` is API
  acceptance, `[webhook] status: ...` is Meta's verdict. A `failed` status with
  `errors[0].code` (131026 undeliverable, 470 blocked, 131047 outside 24h
  window, quality/limit errors) is the answer to "why did nothing arrive".
- Status callbacks carry no `messages` array, so they must be logged *before*
  the empty-messages return.
- Token health note: `WHATSAPP_ACCESS_TOKEN` was created in Vercel 87 days ago;
  if it were an expired long-lived token every send would 401 and now be
  visible as `WhatsApp send failed: status=401`.

## Cross-references

- Match-code / match-centre link chain this bot's replies belong to:
  `.opencode/context/match-codes/match-code-webhook-and-dashboard_2026-09-30.md`
- The submit portal that replaces code-only replies:
  `.opencode/context/whatsapp-delivery/submit-match-portal_2026-10-07.md`

## Restore File Section

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
