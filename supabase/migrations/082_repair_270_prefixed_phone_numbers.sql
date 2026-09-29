-- Correct stored phone numbers that are 27 followed by a 10-digit national
-- number that kept its local leading zero (e.g. 270601110760 for 060 111 0760).
--
-- 12 digits starting 27 is never a valid South African number (SA mobiles are
-- 27 + 9 digits), and toInternationalPhone() in app/api/webhook/route.ts used to
-- pass these straight through: its rewrite rule only fires for values that start
-- with 0, and these start with 2. The malformed 12-digit value therefore reached
-- the WhatsApp contacts API, which rejects the whole contact card with error
-- 131009 — so a single bad row can break the group sync for everyone.
--
-- Same defect as dot's 270784831815, fixed in 081. 13 rows matched, 4 of them
-- club managers (Supersport, Midlands Wanderers, Sekhukhune United, TS Galaxy).
--
-- The rewrite is purely mechanical and idempotent: only exactly-12-digit values
-- beginning 270 are touched, and 27 + 9 digits is the only valid result.
do $$
declare
  v_fixed integer;
begin
  update profiles p
     set phone = '27' || substring(regexp_replace(p.phone, '\D', '', 'g') from 4)
   where regexp_replace(p.phone, '\D', '', 'g') ~ '^270[0-9]{9}$';

  get diagnostics v_fixed = row_count;

  -- Any remaining 12-digit 27 prefix would mean the rewrite did not do what the
  -- WHERE clause claimed, so fail loudly rather than leave contacts broken.
  if exists (
    select 1 from profiles
     where regexp_replace(phone, '\D', '', 'g') ~ '^270[0-9]{9}$'
  ) then
    raise exception 'phone repair incomplete: malformed 12-digit values remain';
  end if;

  raise notice 'repaired % malformed 27+0 phone value(s)', v_fixed;
end $$;
