-- 093: close manager applications for managers who already hold a club
--
-- A manager can be given a club through the WhatsApp manager-management menu or
-- the web admin, both of which call assignManagerToClub. That path never touched
-- manager_applications, so the applicant's application stayed 'pending' and kept
-- showing in the pending list as "(no team yet)" even though they were managing a
-- team. closePendingManagerApplications() in lib/manager-mgmt.ts now does this at
-- assignment time; this migration cleans up the rows that predate that fix.
--
-- The oldest pending application per applicant is approved and stamped with the
-- club they actually manage; any other pending application from the same person
-- is denied, mirroring the application flow's own bookkeeping. The ranking is
-- materialised first so the second UPDATE cannot promote a different row to
-- first place once the winner is no longer pending.

create temporary table _efa_stale_apps on commit drop as
with managed as (
  select distinct t.manager_id as user_id, t.id as team_id
  from public.teams t
  where t.manager_id is not null
)
select
  ma.id,
  row_number() over (
    partition by ma.applicant_id
    order by (ma.team_id is not null), ma.created_at asc
  ) as rn
from public.manager_applications ma
join managed m on m.user_id = ma.applicant_id
where ma.status = 'pending';

update public.manager_applications ma
set
  status = 'approved',
  team_id = t.id,
  reviewed_at = now(),
  reviewed_by = null
from public.teams t, _efa_stale_apps s
where ma.id = s.id
  and s.rn = 1
  and ma.status = 'pending'
  and t.manager_id = ma.applicant_id;

update public.manager_applications ma
set status = 'denied', reviewed_at = now(), reviewed_by = null
from _efa_stale_apps s
where ma.id = s.id
  and s.rn > 1
  and ma.status = 'pending';

drop table _efa_stale_apps;
