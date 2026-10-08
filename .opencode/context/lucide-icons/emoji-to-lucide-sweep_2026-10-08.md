# Emoji → lucide-react sweep (website UI)

Swept the website UI and removed emoji characters, replacing them with lucide-react icons after the user asked to "use lucid react in the website not emojis". All icon-class emoji in `app/` and `components/` `.tsx` files were replaced; emoji inside WhatsApp message copy, WhatsApp bot strings, and the data-keyed emoji-reaction feature were deliberately kept (see scope).

## Problem

The user directed that the website should use lucide-react icons instead of emoji. A code-point scan of `app/**/*.tsx` and `components/**/*.tsx` (PowerShell regex over surrogate pairs + BMP symbol ranges) found emoji used as UI icons in status badges, list bullets, copy-link feedback, generated-state pills and empty-state markers, plus emoji inside notification title strings that render in the website bell.

## Fix

Replacements (all lucide-react `^1.17.0`, aliases `CheckCircle2`/`CircleCheck`, `XCircle`/`CircleX`, `AlertTriangle`/`TriangleAlert` verified in the package types):

- `app/(admin)/admin/backdoor-submissions/BackdoorSubmissionsClient.tsx` — status badges refactored to a `STATUS_META` map with `Hourglass`/`CheckCircle2`/`XCircle`/`CircleSlash`/`Clock`; the fixture-level dispute tag and the per-submission dispute badge now use `<Scale>`.
- `components/ui/ForfeitBalanceBadge.tsx` — ⚖ ×2 → `<Scale className="w-3 h-3 shrink-0" />` + first lucide import. (Emoji chars are finicky in the Edit tool; this file was rewritten via .NET `File` + UTF-8 no-BOM `WriteAllText`, which worked.)
- `app/(public)/fixtures/[id]/_desktop.tsx` + `_mobile.tsx` — 2× ⚠ per file → `<AlertTriangle>` (import added).
- `components/ui/DNABadge.tsx` — ✓ → `<Check>`, ⚠ → `<AlertTriangle>`, ⚡ → `<Zap>` (import added).
- `app/(public)/teams/[id]/_desktop.tsx` + `_mobile.tsx` — ✓ → `<Check>`, ⚠ → `<AlertTriangle>`, ⚡ → `<Zap>` in the DNA tendency/weakness lists; kept the typographic `›` bullet as-is on the viewer-facing list (it is punctuation, not an emoji). Icons inherit the wrapper span's colour classes; sizing `w-3.5 h-3.5`.
- `app/submit-match/[code]/_portal.tsx:404` — "Copied ✓" → inline `<Check>` beside "Copied" (first lucide import in the portal).
- `app/(admin)/admin/tournaments/create/CreateTournamentClient.tsx` — 2× ✓ pill → `<Check>`.
- `GenerateFixturesButton.tsx` + `GenerateKnockoutsButton.tsx` — "Fixtures/Knockouts Generated ✓" → `<Check>` + text.
- `app/(public)/polls/[share_code]/_desktop.tsx:170` + `_mobile.tsx:177` — 🚫 (U+1F6AB) empty-state marker → `<Ban>` (desktop `w-10 h-10`, mobile `w-9 h-9`).
- `app/api/submit-match/route.ts:313` — stray ✓ in the success `message` string removed.
- Notification titles (these render in the website bell, which already icons per type): `app/api/admin/end-season/route.ts` titles "Division 1 Champions 🏆" and "Promoted to Division 1 🎉" stripped; `lib/cron/notification-logic.ts:117` "⏰ 1 hour left!" stripped. Added missing type icons so the bell stays visual: `division_champion → Trophy`, `promotion → TrendingUp`, `relegation → ArrowDown`, `relegation_playoff`/`promotion_playoff → Swords` in both `app/(protected)/notifications/_desktop.tsx`, `_mobile.tsx` and `components/ui/GlobalNotifications.tsx`.

## Scope exclusions (intentional, verified against the final scan)

- `components/ui/DashboardFixtureActions.tsx:63-67` — 👋⚽📱✅🚨 are WhatsApp share-message text, not website-rendered icons.
- `app/api/webhook/route.ts` — every emoji there (👋, ⚠️, ⏳, ✅, 🕴️, ⏰, ⚖️) is WhatsApp bot message copy.
- `components/ui/ReactionsPanel.tsx` — the emoji choices are data-keyed reaction values stored in the DB; removing them would break stored reaction data.
- `lib/system-prompt.ts` — 👀 / 🎮 are Leonardo/AI prompt text.

## Verification

- `npx tsc --noEmit` — clean.
- `npx next lint` — warnings only, all pre-existing (confirmed none introduced by this sweep).
- Final emoji re-scan of `app/**/*.tsx` + `components/**/*.tsx` shows only the two intentional exclusions above.

## Notes for future sweeps

- Emoji chars (surrogate-pair symbols like ⚖/⚠⚡) render garbled in the PowerShell console; confirm the exact character via the `Read` tool before editing, and when the Edit tool mishandles a codepoint, fall back to .NET file rewrite (read file, `$content.Replace('⚖','X')`, then `[IO.File]::WriteAllText` with UTF8 no BOM).
- `Select-String` needs .NET `\uXXXX` escapes (`\x{...}` fails); there is no `rg` on this machine.