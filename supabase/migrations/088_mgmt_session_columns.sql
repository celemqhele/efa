-- 088: manager-management WhatsApp flow session columns
--
-- The WhatsApp admin menu adds three flows (assign a manager to a managerless
-- club, sack a manager with or without a replacement, promote a Division 2
-- manager into a Division 1 club). Each is a multi-step conversation, so the
-- webhook has to remember the candidate lists and the current selection between
-- messages, exactly like the existing manager-applications flow does with its
-- admin_assign_* columns.
--
-- These are deliberately prefixed mgmt_ rather than reusing admin_assign_*: the
-- applications flow owns those four columns and both flows are reachable from
-- the same admin numbers, so sharing them would let one flow overwrite the
-- other's in-progress list.
--
-- Lists are stored as jsonb snapshots rather than re-queried at each step, which
-- keeps the numbering in the message the admin actually replied to stable even if
-- someone gets sacked or assigned while the admin is looking at the list.

ALTER TABLE public.whatsapp_sessions
  ADD COLUMN IF NOT EXISTS mgmt_step text,
  ADD COLUMN IF NOT EXISTS mgmt_team_list jsonb,
  ADD COLUMN IF NOT EXISTS mgmt_manager_list jsonb,
  ADD COLUMN IF NOT EXISTS mgmt_tournament_list jsonb,
  ADD COLUMN IF NOT EXISTS mgmt_selected_team_id uuid,
  ADD COLUMN IF NOT EXISTS mgmt_selected_manager_id uuid,
  ADD COLUMN IF NOT EXISTS mgmt_selected_tournament_id uuid,
  ADD COLUMN IF NOT EXISTS mgmt_current_manager_id uuid,
  ADD COLUMN IF NOT EXISTS mgmt_promote_source_team_id uuid,
  ADD COLUMN IF NOT EXISTS mgmt_page integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.whatsapp_sessions.mgmt_step IS
  'Manager-management flow step: mgmt_assign_team, mgmt_assign_manager, mgmt_assign_cooldown, mgmt_assign_confirm, mgmt_sack_tournament, mgmt_sack_team, mgmt_sack_action, mgmt_sack_replacement, mgmt_sack_confirm, mgmt_promote_manager, mgmt_promote_team, mgmt_promote_confirm';
COMMENT ON COLUMN public.whatsapp_sessions.mgmt_page IS
  'Zero-based page index into mgmt_manager_list (20 entries per page).';

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.whatsapp_sessions TO service_role, anon, authenticated;