# Hermes runtime and skill setup (2026-10-11)

## Runtime
- Model identity: gemini-flash-lite-latest
- Tool-calling verified

## Skill
- Created `~/.hermes/skills/efa/SKILL.md` enforcing ticketing (`/api/hermes/ticket`), database policies (`/api/hermes/db-sql`), and portal-first WhatsApp routing.

## Status
Ready for code wiring: implement `match_link_get`, unify admin identity in webhook, tighten db-sql gating.
