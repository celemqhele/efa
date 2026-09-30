-- 083: Reassign Hungry Lions to maninblack, delete the duplicate hunger_ account,
-- and set wamashudu's phone number.
--
-- maninblack is the surviving account of the same manager: hunger_ was created
-- separately after "having issues", so the club, seats, tenure, notifications
-- and poll applications move to maninblack before the hunger_ account is removed.

begin;

-- 1. Hungry Lions club -> maninblack
update public.teams
   set manager_id = 'e30cea5f-5128-4ec0-872e-8dd1ed0d81fd'
 where manager_id = '81e59b06-bec0-46f9-8bd9-16d2d8303bfc';

-- 2. Season 4 seats (Motsepe / CAF CL / Nedbank participants) -> maninblack
update public.tournament_participants
   set user_id = 'e30cea5f-5128-4ec0-872e-8dd1ed0d81fd'
 where user_id = '81e59b06-bec0-46f9-8bd9-16d2d8303bfc';

-- 3. Open Hungry Lions tenure -> maninblack. manager_tenures.manager_id is
--    SET NULL on profile delete, so this must run before the delete.
update public.manager_tenures
   set manager_id = 'e30cea5f-5128-4ec0-872e-8dd1ed0d81fd',
       manager_username = 'maninblack'
 where manager_id = '81e59b06-bec0-46f9-8bd9-16d2d8303bfc';

-- 4. Notifications -> maninblack
update public.notifications
   set user_id = 'e30cea5f-5128-4ec0-872e-8dd1ed0d81fd'
 where user_id = '81e59b06-bec0-46f9-8bd9-16d2d8303bfc';

-- 5. Poll applications (2026 SA Club Selection) -> maninblack. No uniqueness
--    clash: maninblack's own approved application is on a different poll.
update public.poll_applications
   set applicant_id = 'e30cea5f-5128-4ec0-872e-8dd1ed0d81fd'
 where applicant_id = '81e59b06-bec0-46f9-8bd9-16d2d8303bfc';

-- 6. wamashudu phone number (+27 71 106 3817), stored digits-only
update public.profiles
   set phone = '27711063817'
 where id = '1909a51f-b351-4c12-9246-1f1f7c0cc3f9';

-- 7. Remove the duplicate account. Profile first: profiles -> auth.users is
--    RESTRICT, so the auth row cannot go until the profile has.
delete from public.profiles
 where id = '81e59b06-bec0-46f9-8bd9-16d2d8303bfc';

delete from auth.users
 where id = '81e59b06-bec0-46f9-8bd9-16d2d8303bfc';

commit;