# User management: update tildedot phone number (2026-10-07)

Updated the `tildedot` profile's WhatsApp phone (was `27685705806`) to `27828000773`
(+27 82 800 0773) directly on Supabase.

## What ran

```sql
update public.profiles set phone = '27828000773' where username = 'tildedot' returning username, phone;
-- 1 row: tildedot -> 27828000773
```

Follows the same pattern as `.opencode/context/user-management/fix-4gxzo-phone-11-digits_2026-10-04.md`.
Note: `dot`/`dot7` are separate profiles and were left untouched.