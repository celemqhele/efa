-- 096: web submission portal (/submit-match/<matchcode>) + postpone agreements
--
-- Three objects:
--   1. fixtures.postponed_confirmed - "postponed confirmed": the two managers
--      agreed a postponement, so a locked 3-0 result is already written and
--      counted, the fixture date has moved, and the row is genuinely confirmed
--      in the database. The flag exists so upcoming/reminder lists can show it
--      like a scheduled fixture on the NEW date without using the 'scheduled'
--      status tag (which would un-confirm it and drop it out of standings).
--   2. postpone_requests - one side asks to move the game, the other accepts or
--      declines from the same portal link. Accept = 3-0 to the acceptor.
--   3. match-screenshots storage bucket - proof screenshots uploaded by the
--      portal (backdoor proofs keep using the existing backdoor-screenshots
--      bucket so the admin review flow is untouched).

-- ─── 1. fixtures.postponed_confirmed ──────────────────────────────────────────
alter table public.fixtures
  add column if not exists postponed_confirmed boolean not null default false;

comment on column public.fixtures.postponed_confirmed is
  'True while a postponement-agreed fixture is still upcoming on its moved date: result is locked (3-0 to the acceptor) and standings already count it, but reminder/upcoming lists must still show it as due. Cleared by the auto-finalise cron once the moved date has passed.';

-- ─── 2. postpone_requests ─────────────────────────────────────────────────────
create table if not exists public.postpone_requests (
  id uuid primary key default gen_random_uuid(),
  fixture_id uuid not null references public.fixtures (id) on delete cascade,
  requested_by uuid not null references public.profiles (id),
  requested_by_phone text,
  new_date date not null,
  reason text not null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined')),
  responded_by uuid references public.profiles (id),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live request per fixture: the opponent answers it or it gets superseded.
create unique index if not exists postpone_requests_pending_fixture_idx
  on public.postpone_requests (fixture_id)
  where status = 'pending';

create index if not exists postpone_requests_status_idx
  on public.postpone_requests (status, created_at desc);

grant select, insert, update, delete on table public.postpone_requests
  to service_role, anon, authenticated;

-- ─── 3. match-screenshots bucket ──────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('match-screenshots', 'match-screenshots', false)
on conflict (id) do nothing;

drop policy if exists "Managers can upload match screenshots" on storage.objects;
create policy "Managers can upload match screenshots"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'match-screenshots'
  and exists (select 1 from profiles where id = auth.uid())
);

create policy "Match screenshots are readable by the portal owner"
on storage.objects for select
to authenticated
using (bucket_id = 'match-screenshots');

-- Uploads and signed-URL reads go through the service role (createAdminClient),
-- which bypasses RLS - the policies above only matter for direct browser uploads.
