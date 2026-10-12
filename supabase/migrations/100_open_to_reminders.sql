-- Manager reminder-consent flag ("open to match reminders").
--
-- Some managers do not want to be messaged with match reminders. When
-- open_to_reminders is false the admin dashboard "Fixtures Due" WhatsApp
-- reminder buttons for that manager render greyed out and are not clickable.
-- Defaults to true, so nothing changes for managers who have not opted out.
--
-- Seeds the first opt-out: anele_arh.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS open_to_reminders boolean NOT NULL DEFAULT true;

UPDATE public.profiles
  SET open_to_reminders = false
  WHERE username = 'anele_arh';
