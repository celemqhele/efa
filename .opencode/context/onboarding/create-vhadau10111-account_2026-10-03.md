Created user Vhadau10111 (auth user id `e88b8741-9a9c-4f2a-bbde-3cc4a0859284`, email `vhadau10111@efa.local`, password `Efootball@2026`) and set his phone to `27849575839` (+27 84 957 5839).

**Problem hit:** the first attempt created only the `auth.users` row and skipped the `profiles` insert, so he existed in Supabase Auth but was invisible on the website (which reads `profiles`). There are 9 other auth users in the same orphaned state on the live DB — worth a separate cleanup.

**Fix:** inserted the `profiles` row (`username: Vhadau10111`, `role: user`) using the same shape as `scripts/create-naitor-user.ts`, which creates the auth user *and* the profile in one go. Migration `092_set_vhadau10111_phone.sql` then set the phone.

**Files**
- Created: `supabase/migrations/092_set_vhadau10111_phone.sql`
- Recycled: `scripts/create-vhadau10111.ts`, `scripts/tmp-create-vhadau-profile.ts`

**Verify:** `SELECT username, phone, role FROM profiles WHERE id='e88b8741-9a9c-4f2a-bbde-3cc4a0859284'` returns `Vhadau10111 | 27849575839 | user`.
