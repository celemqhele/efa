-- 091: Fix phone number for ourfather_22 (Andries)
-- Update to +27 79 386 6987
begin;
update public.profiles set phone = '2793866987' where id = '9fcb1eeb-d2f3-4df2-b855-e9ba780f41bc';
commit;
