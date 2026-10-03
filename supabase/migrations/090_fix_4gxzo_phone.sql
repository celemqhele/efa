-- 090: Fix phone number for 4gxzo
-- Input: +27 78 870 7749
-- Stored: 27788707749
-- Looks like digits transposed/misread (88 vs 87? Or 78 870 -> 77 887?)
begin;
update public.profiles set phone = '2788707749' where id = '46e2d62a-a905-4447-b8f1-6c30273dbd0b';
commit;
