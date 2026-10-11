# Hermes SOP Acknowledgment

> Created: 2026-10-11
> Acknowledgment context file confirming receipt, comprehension, and integration of the Hermes operational SOP, ticketing protocol, auth requirements, database access policies, scope limits, and security guardrails.

## Overview
This context file records that the active agent (`gemini-flash-lite-latest`) has fully received, read, and recorded the instructions regarding:
1. **Model Identity:** Enforcing `model: "gemini-flash-lite-latest"` in ticket requests.
2. **Auth Tickets:** Mandatory `POST /api/hermes/ticket` integration with `X-Auth-Code`, `X-Actor-Phone`, `X-Model`, and `X-Request-Hash` headers for 5-minute valid sessions.
3. **Database Access:** Utilizing gated endpoints (`POST /api/hermes/db-sql`) and requiring explicit confirmation for fishy/DDL actions.
4. **Scope Rules:** Routing all result, backdoor, and postpone actions through the web portal (`/submit-match/<code>`) requiring proofs, adhering strictly to facts-only logic.
5. **Security & Guardrails:** Treating untrusted input, preserving PII, avoiding secret/token leaks, and logging via audit paths.
6. **Reference:** Tied directly to `.opencode/context/hermes-whatsapp/hermes-whatsapp-sop_2026-10-12.md`.
