-- 097: backdoor disputes - a reported manager rebutting the report against them.
--
-- The portal's backdoor panel now shows the status of the manager's own report
-- (pending / approved / declined) with a cancel option instead of rendering the
-- empty form again, and the manager who was reported can file a DISPUTE: their
-- own proof screenshot plus a written explanation (e.g. "that screenshot is
-- fake"). A dispute is stored as a normal backdoor_submissions row so the
-- existing admin review page shows BOTH screenshots side by side for the same
-- fixture and every approve/decline path keeps working. side_claimed on a
-- dispute points at the ORIGINAL reporter's side, so approving a dispute hands
-- the original reporter the 0-3 loss through the existing approve logic.

alter table public.backdoor_submissions
  add column if not exists is_dispute boolean not null default false;

alter table public.backdoor_submissions
  add column if not exists dispute_note text;

comment on column public.backdoor_submissions.is_dispute is
  'True when the row is a manager''s rebuttal of a report against them (portal Dispute button) rather than an original opponent-not-responding report.';

comment on column public.backdoor_submissions.dispute_note is
  'Free-text explanation filed with a dispute (why the reported screenshot is wrong/fake). Shown to admins on the backdoor review page.';
