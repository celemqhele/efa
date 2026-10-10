# User management: set matolo7 phone number (2026-10-10)

Set the `matolo7` profile's WhatsApp phone, which was `null` and therefore not
rendering in the opponent-number reminder. Stored digits-only in the app's
canonical E.164 form.

## What ran

```sql
update public.profiles
set phone = '27692853965'
where username = 'matolo7'
returning id, username, phone;
-- 1 row: matolo7 (cac349db-932a-4e3f-9d3f-59d96c169a23) -> 27692853965
```

`27692853965` is `+27 69 285 3965` as the user supplied it. `formatPhoneDisplay`
(`lib/phone.ts`) renders it as `+27 69 2853965`, matching the reminder template's
`+XX XX XXXXXXX` shape. Manager is `matolo7` at team `Polokwane City`.

Follows the same digits-only pattern as
`.opencode/context/user-management/fix-tildedot-phone_2026-10-07.md` and
`.opencode/context/user-management/fix-4gxzo-phone-11-digits_2026-10-04.md`.

## Restore File Section

No files deleted.

| Original Path | Description | Recycle Bin Path |
|---------------|-------------|------------------|
| N/A | N/A | N/A |
