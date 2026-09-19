# EFA News / Poster Generation Workflow

Added the EFA comedy/satire "news" workflow to `AGENTS.md`: when the user asks for a poster prompt or generates news, this chat researches the involved managers/teams in Supabase and outputs a Leonardo AI landscape-poster prompt (exact headline + all context dumped) plus a post caption in English SAL.

## What was done

- Added the `## EFA News / Poster Generation (Leonardo AI)` section to `AGENTS.md` (right after the Supabase section). It defines:
  - **Trigger:** any request about making a poster prompt or about the news.
  - **Step 1 — Research first:** pull all involved subjects from Supabase via `npm run db` (`manager_tenures`, `teams`, `standings`/`group_standings`, `results` + `fixtures`, `trophies`, `profiles`, `forfeit_balances`). Explicit note that one manager can have two accounts (e.g. `Thando` + `thando_1110`) — search both and merge.
  - **Step 2 — Leonardo prompt:** LANDSCAPE poster; headline must appear word-for-word; dump all researched context (identity, record, teams managed, trophies, playstyle, stats) so the image AI has league context; full creative control to the AI, only the headline is fixed.
  - **Step 3 — Caption:** in English SAL (South African English as Second Additional Language — SA slang/tabloid banter tone; occasional local flavour words like "yho", "bayajika" allowed). Meme-style for a WhatsApp group.
- Added the new category folder `efa-news/` to the Context Files category list in `AGENTS.md`.
- Created this new category `efa-news/`.

## Notes

- This workflow was exercised once already to produce the "Thando sacked for selling Ghana's stadium and betting on red (he lost)" poster prompt (Thando = manager of Ghana, EFA International Cup Group D, P4 W0 D0 L4, GF 3 / GA 13, 0 pts; career across Newcastle, Man City, Brazil, Liverpool, Bournemouth, Ghana; 0 trophies; playstyle "Tactical adaptive").