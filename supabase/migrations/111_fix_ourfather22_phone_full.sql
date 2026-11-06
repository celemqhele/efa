-- 111: Set the correct full phone number for ourfather_22 (Andries)
-- 091 stored '2793866987', which dropped a digit; profile has since lost its
-- phone entirely. Correct E.164 for +27 79 386 6987 is 27793866987.
begin;
update public.profiles
set phone = '27793866987'
where id = '9fcb1eeb-d2f3-4df2-b855-e9ba780f41bc';
commit;
