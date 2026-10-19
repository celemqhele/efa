# Portal: backdoor status notes are visible again and stand out

The backdoor panel now keeps showing a claim after it leaves the live statuses
(`void_game_played`, `expired`) instead of coming up blank when the option is
clicked, and the "who submitted / who approved / when" note plus the status pill
are accent-tinted so an acknowledgement is obvious at first glance.

Follow-up to `.opencode/context/submit-portal/portal-backdoor-status-and-disputes_2026-10-08.md`
(the status card design) and to
`.opencode/context/submit-portal/portal-attribution-who-submitted_2026-10-10.md`
(the attribution note). After those, the admin reported: "the note for backdoor
submittions who submitted who apprved when pending is no longer showing you need
to click backdoor option, nothing pops out" and "notes and stuff need to be
different colour to be visible that what they did is acklnowledged and can see it
at first glance. things like under review, the note explaining whats's happening
who submitted who approeved etc."

## Problem

1. **The claim vanished as soon as it stopped being live.**
   `lib/submit-match.ts` built `myBackdoorRow` only from a `LIVE_BD` list
   (`pending`, `approved`, `declined`) and the query in `buildState` filtered
   `status` server-side with `.neq('status', 'expired')` on top. A claim becomes
   `void_game_played` the moment a real score is submitted for that fixture
   (see `.opencode/context/auto-finalise/pending-backdoors-resolved-every-02-00_2026-10-20.md`
   for the same status), so clicking "Report opponent not responding" showed the
   empty form again - which reads exactly like "the system deleted my report".
2. **Ownership matching could fail silently.** `isMineSubmission` compares the
   stored `submitter_phone` with the viewer's phone / user id. A claim filed from
   WhatsApp can carry a phone that is missing from the manager's profile, so the
   row was not recognised as theirs and the card did not render either.
3. **The note was visually flat.** The attribution line used
   `border-border bg-bg-base text-text-secondary`, i.e. the same look as ordinary
   helper text, so an acknowledgement did not stand out.

## Fix

- **`lib/submit-match.ts`**: replaced `LIVE_BD` with
  `VISIBLE_BD = ['pending','approved','declined','void_game_played','expired']`,
  removed the `.neq('status','expired')` filter from the backdoor query, and
  added a read-only fallback for ownership: a manager always reports the OTHER
  side, so a claim whose `side_claimed` is the opposite of the viewer's side is
  theirs when the phone/user-id check cannot confirm it. (A claim pointing at the
  viewer's own side stays in `reportsAgainstMe`, so the two never collide.)
- **`app/submit-match/[code]/_portal.tsx`**:
    - `BD_STATUS` gained `void_game_played` ("Replaced by result") and `expired`
      ("Expired"), and `outcomeLine` explains both, so the card always says what
      happened,
    - the attribution note and the dispute note are now accent-tinted
      (`border-accent/40 bg-accent/10 text-text-primary`, `font-semibold`) so the
      "Submitted by X on <date> - approved by Y" line is visible at a glance,
    - the status pill keeps its warning/success/error tone ("Under review" is
      amber), giving three distinct colours next to the gold note.

## Result

SSR render-checks against production data (three `void_game_played` claims, two
`pending` ones) all show the status card with its note, e.g.
"Replaced by result / Your report was closed because a result was submitted for
this match. Submitted by parmalat_ 17 Oct, 22:49." and
"Under review / Your report is with the admin. ... Submitted by mubizamaan". No
claim now comes up blank.
