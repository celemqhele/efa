-- 084: Per-fixture match codes for the WhatsApp match-centre deep links.
--
-- Every fixture gets a unique 8-char code the moment it is inserted, so codes
-- exist for the whole season — including TBC/unscheduled games and knockout
-- fixtures created later (generate-fixtures, start-season, generate-knockouts,
-- generate-super-cup, generate-friendlies, phase generator). The admin
-- dashboard embeds the code in reminder links (`?text=Hi MC-XXXXXXXX`); the
-- webhook resolves the code back to the fixture.

begin;

-- 1. match_codes: one code per fixture; fixture deletion removes its code.
create table if not exists public.match_codes (
  id          uuid primary key default gen_random_uuid(),
  fixture_id  uuid not null unique references public.fixtures(id) on delete cascade,
  code        text not null unique,
  created_at  timestamptz not null default now()
);

-- 2. Code allocator: random 8-char code from an unambiguous alphabet
--    (no 0/O/1/I), inserted atomically; unique_violation is retried so bulk
--    fixture inserts always succeed even on an unlucky duplicate.
create or replace function public.match_code_for_fixture(new_fixture_id uuid)
returns text
language plpgsql
volatile
as $$
declare
  chars constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code  text := '';
  retry int  := 0;
begin
  loop
    code := '';
    for i in 1..8 loop
      code := code || substr(chars, 1 + floor(random() * length(chars))::int, 1);
    end loop;
    begin
      insert into public.match_codes (fixture_id, code)
      values (new_fixture_id, code);
      return code;
    exception when unique_violation then
      retry := retry + 1;
      exit when retry >= 10;
    end;
  end loop;
  raise exception 'match_code_for_fixture: could not allocate a code for % after % retries', new_fixture_id, retry;
end;
$$;

-- 3. Auto-assign a code on every fixture insert (single source of truth: the
--    same allocator used by the Season 4 backfill below).
create or replace function public.assign_match_code()
returns trigger
language plpgsql
volatile
as $$
begin
  perform public.match_code_for_fixture(new.id);
  return new;
end;
$$;

drop trigger if exists trg_assign_match_code on public.fixtures;
create trigger trg_assign_match_code
  after insert on public.fixtures
  for each row
  execute function public.assign_match_code();

-- 4. Belt-and-braces Data API grants (default privileges from 076 cover these
--    too, this keeps the file self-contained).
grant select, insert, update, delete on table public.match_codes to service_role, anon, authenticated;
grant execute on function public.match_code_for_fixture(uuid) to service_role, anon, authenticated;
grant execute on function public.assign_match_code() to service_role, anon, authenticated;

-- 5. Backfill codes for every game already scheduled in the current season
--    (Season 4, all tournaments: Betway Premiership, Motsepe, CAF CL/Confed,
--    Nedbank Cup, CAF Super Cup). match_code_for_fixture performs the insert
--    itself; the `not exists` guard keeps it idempotent.
select public.match_code_for_fixture(f.id)
  from public.fixtures f
  join public.tournaments t on t.id = f.tournament_id
 where t.season_id = '912d5ea4-5e4e-493b-8308-0745ad338a1a'
   and not exists (select 1 from public.match_codes mc where mc.fixture_id = f.id);

commit;