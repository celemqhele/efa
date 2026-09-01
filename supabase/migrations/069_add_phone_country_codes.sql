-- Prepend the SA country code (27) to every locally-formatted profile phone
-- (10 digits starting with 0), so wa.me links and the WhatsApp contacts API work.
UPDATE public.profiles
SET phone = concat('27', regexp_replace(phone, '\D', '', 'g'))
WHERE regexp_replace(phone, '\D', '', 'g') ~ '^0[0-9]{9}$';