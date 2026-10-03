-- 094: pin match-code sessions so a slow manager does not lose the submission
--
-- Every WhatsApp session used to self-destruct after 60 minutes of silence, so a
-- manager who took a screenshot at 17:10 and only answered the confirm prompt at
-- 20:12 lost the whole flow and was bounced back to the main menu.
--
-- A session opened from a match-code deep link is exempt from that idle sweep:
-- the manager already proved which fixture they are submitting, and the confirm
-- step re-validates the 7-day submission window anyway (submissionBlockReason), so
-- a long-lived pin cannot be used to submit an out-of-window result.
--
-- pinned_until is a timestamp rather than a boolean so the pin still ages out: a
-- stale pin from a forgotten match code cannot linger indefinitely and hijack a
-- later "1" from an unrelated conversation. Seven days matches the submission
-- window, which is the longest a pinned flow is useful for.

alter table public.whatsapp_sessions
  add column if not exists pinned_until timestamptz;