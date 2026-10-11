# Hermes WhatsApp takeover with full DB access + auth ticket system

Added infrastructure to let Hermes (opencode-zen/big-pickle, Gemini Flash Lite latest with thinking/ultra max as specified) fully own the WhatsApp Cloud API channel while enforcing a tight SOP, unified admin identity (profiles.role), and a 5-minute auth-ticket gate for all DB reads/writes. WhatsApp no longer accepts submissions/backdoor/postpone — it forwards the relevant `/submit-match/<code>` portal link (screenshots required on portal). EFA's Vercel cron stays intact.

## Problem statement summary
The user wants Hermes to take over with full DB access (via `npm run db` per AGENTS.md), strict guardrails, confirmation on fishy requests, and an auth-ticket model: MODEL (model name), REQUEST (command), USER (target user), LOGGED_IN (verified by contacting from number that has an account). Supabase checks identity/permissions/data access and returns an Auth Code required on every request, valid 5 minutes, rotating after expiry.

## Identity & scope
- Admin identity unified to `profiles.role = 'admin'` (phone→profile). `ADMIN_PHONES` in `app/api/webhook/route.ts` is deprecated in favor of identity resolver; kept only as emergency fallback if explicitly documented.
- WhatsApp scope narrowed: onboarding, league facts (fixtures/results/standings/teams/trophies/manager records), match-link forwarding (by date/opponent), admin manager mgmt (assign/sack/promote/disqualify), maintenance/backdoor-window toggles, broadcast (admin).
- No result/backdoor/postpone on WhatsApp; always redirect to `/submit-match/<code>` (portal requires screenshot).
- Match codes from `match_codes` (trigger `assign_match_code()`); links `https://efa-fxyk.vercel.app/submit-match/<code>`.

## Auth ticket system
Tables (migration `099_auth_tickets.sql`):
- `auth_tickets`: id (uuid, PK), code (text, unique), actor_phone (text), actor_user_id (uuid → profiles), model (text), request (text), user (text), loggedIn (boolean), intent (text), scope (jsonb), status (pending/approved/denied/expired/revoked), expires_at (timestamptz), decision_reason (text), created_at/approved_at/denied_at
- `auth_ticket_audits`: id, ticket_id (FK), action (text), actor_phone (text), details (jsonb), created_at

Function `validate_auth_ticket(p_code, p_actor_phone, p_request_hash, p_scope jsonb)` (SECURITY DEFINER) validates: not expired, approved, actor phone matches, scope compatible, request hash matches, role allows intent/tables. Tickets valid 5 minutes; scope escalation requires new ticket. All write attempts audited.

Ticket issuance: `POST /api/hermes/ticket` accepts `{ model, request, user, loggedIn, actorPhone, intent, scope }`, resolves identity (phone→profile), checks permissions, may require explicit confirmation for fishy requests, returns `{ authCode, expiresAt, allowedScope, warnings, requiresConfirmation }`.

Every subsequent request must include `X-Auth-Code`, `X-Actor-Phone`, `X-Model`, `X-Request-Hash`. Code expires after 5 min → request new ticket.

## DB access
Hermes may run SQL via `npm run db` (per AGENTS.md). Access gated by policy-wrapped `db_sql` tool requiring valid ticket. Guardrails: role-based allowlists, confirmations for fishy ops (DDL, multi-row UPDATE/DELETE, admin-only, cross-tenant), blocks raw PII exfiltration, logs to `audit_log` and `auth_ticket_audits`.

## Safety
Server-side enforcement; never trust model claims. Fishy requests require explicit confirmation. Prompt-injection guard; facts-only; no secrets/tokens/PII leakage. RLS remains authoritative.

## Files
- `lib/identity.ts` — phone normalization + profile→role resolver
- `supabase/migrations/099_auth_tickets.sql` — tickets/audits + validator
- `lib/auth-ticket.ts` — server-only issue/validate helpers
- `app/api/hermes/ticket/route.ts` — ticket issuance
- `app/api/hermes/db-sql/route.ts` — policy-wrapped SQL with ticket validation
- `app/api/hermes/tools/route.ts` — domain tools (facts, match link, admin mgmt, onboarding)
- `.opencode/context/hermes-whatsapp/hermes-whatsapp-sop_2026-10-11.md` — full detailed SOP for Hermes
MD