-- Merge `whatsapp_number` into `phone` — both fields mean the same thing
-- and are used for WhatsApp contact/identity. Keep a single `phone` field.

-- Copy whatsapp_number into phone where phone is missing
UPDATE public.profiles
SET phone = whatsapp_number
WHERE phone IS NULL AND whatsapp_number IS NOT NULL;

-- Drop the redundant column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS whatsapp_number;