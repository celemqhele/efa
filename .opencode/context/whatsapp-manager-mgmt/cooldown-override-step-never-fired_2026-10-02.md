# Cooldown override step never fired (WhatsApp manager assign) — 2026-10-02

Fixed a bug where the admin WhatsApp "Assign manager to club" flow blew up with a
misleading `Could not assign: @North West University is in cooldown.` instead of
offering the explicit override/cancel step that was built for exactly this case.
The override gate had been silently dead since the manager-management flows landed,
because `listFreeManagers()` cast its rows to `MgmtManagerOption` instead of renaming
`sacked_at` to `sackedAt`, so every cooldown check downstream read `undefined`.

Follow-up to `.opencode/context/whatsapp-manager-mgmt/whatsapp-admin-manager-mgmt_2026-10-02.md`,
which shipped the flows and their explicit override decision ("`1` overrides,
`2` cancels"). The user reported after using it that the override step did not exist.

## Problem

The user ran Flow A, picked `@maninblack`, and replied `1` to the confirmation. Instead
of the cooldown prompt they got:

```
Could not assign: @North West University is in cooldown.
```

Two separate defects produced that line.

### 1. `sacked_at` never reached the pickers (the real bug)

`lib/manager-mgmt.ts` selects `id, username, sacked_at` but `MgmtManagerOption` declares
the field as `sackedAt`. The rows were bridged with a bare cast, which silences the
compiler without renaming anything:

```ts
return ((profiles ?? []) as MgmtManagerOption[])
```

So every returned object carried `sacked_at`, and `m.sackedAt` was always `undefined`.
`getCooldownEndsAt(undefined)` returns `null`, so the gate at
`app/api/webhook/route.ts:3828` (and its two siblings) always fell through:

- `mgmtManagerPicked` — the override prompt never appeared (route.ts:3828)
- `renderManagerPage` — the list marker never rendered (route.ts:3652)
- `mgmtSackReplacement` — same override gate for Flow C (route.ts:4271)

The flow went straight to `Assign @maninblack to North West University?`, and only then
did `assignManagerToClub()` catch it. That function reads the raw `targetProfile.sacked_at`,
which was always correct, so it returned `SACK_COOLDOWN` and the assignment was correctly
rejected — just far too late, with no way to override.

This is why the error looked contradictory: the manager picker thought nobody was banned
while the write path knew better.

### 2. The error named the club instead of the manager

`mgmtAssignConfirm` interpolated the club:

```ts
result.code === 'SACK_COOLDOWN' ? `@${club?.name ?? 'that manager'} is in cooldown.` : result.message
```

The club is never the thing in cooldown — `profiles.sacked_at` is stamped on the *person*.
That produced the nonsensical `@North West University is in cooldown`, which is what sent
the investigation down the wrong path initially.

### Why the earlier verification missed it

The read-only script from the first context file
(`.recycle/tmp-verify-mgmt-lists_2026-10-02.ts`) reported **0 free managers in cooldown**
and the flows were signed off on that basis. That check read `m.sackedAt` — the same broken
field the buggy code read — so it agreed with the bug and produced a false negative. The
new check reads the raw `sacked_at` column and the mapped `sackedAt` independently and
asserts they match, so a regression cannot hide behind a matching accessor again.

## Fix

- `lib/manager-mgmt.ts` — `listFreeManagers()` now maps the row explicitly instead of
  casting, so `sackedAt` is populated. This revives all three dead call sites at once.
- `app/api/webhook/route.ts` — `renderManagerPage` marker changed from `(banned)` to
  `(cooldown until <date>)` via the existing `formatCooldownDate`. The old label was never
  actually rendered before, so it had gone unnoticed; "banned" also reads as permanent
  when the cooldown is 7 days.
- `app/api/webhook/route.ts` — `mgmtAssignConfirm` now names the manager (resolved from
  `session.mgmt_manager_list` by `mgmt_selected_manager_id`) and includes the cooldown end
  date. Kept as a defensive path: it is only reachable if a manager is sacked between
  picking and confirming, since the pickers now gate first.

## Verification

`tsc --noEmit` clean, eslint 0 errors (7 pre-existing warnings), `next build` compiled.
Read-only script `.recycle/tmp-verify-cooldown-field_2026-10-02.ts` (nothing written):
48 free managers, 2 bannable — `@amow` (until 2026-10-09T21:18Z) and `@minenhle22`
(until 2026-10-07T07:24Z). For `@amow` it asserts `sackedAt === sacked_at`, absence of a
leftover snake_case key, that the gate agrees with ground truth, and that no club owner
leaks into the free list. All pass.

Note `@maninblack` is no longer a valid subject for this test: after the report he was
assigned `North West University` (team `900ec824-0d8e-48e4-b60d-a69de8feb520`) and is
correctly excluded from the free list as busy.

## Restore File Section

- `scripts/tmp-verify-cooldown-field.ts` - read-only assertion that `listFreeManagers()`
  carries `sackedAt` through and that the cooldown gate agrees with the raw `sacked_at`
  column. Moved to `.recycle/tmp-verify-cooldown-field_2026-10-02.ts`.