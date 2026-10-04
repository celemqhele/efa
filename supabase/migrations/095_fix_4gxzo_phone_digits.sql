-- 095: restore 4gxzo's (Hungry Lions) full SA mobile number
--
-- Migration 090 "fixed" 27788707749 to 2788707749 believing the stored value was a
-- digit transposition. It was not: 2788707749 is only 10 digits, one short of an SA
-- mobile (country code 27 + 9 national digits), so it can never resolve to a WhatsApp
-- account and it fails the app's own validator (PHONE_DIGIT_LENGTHS['27'] = 11..11 in
-- lib/phone.ts). The manager confirmed the number is +27 78 870 7749 = 27788707749.
--
-- This reverses 090. Kept as a migration (not an ad-hoc UPDATE) so the change is
-- reproducible on a fresh/preview database and shows up in schema history.

update public.profiles
set phone = '27788707749'
where id = '46e2d62a-a905-4447-b8f1-6c30273dbd0b'
  and phone is distinct from '27788707749';