-- Auth tickets for Hermes WhatsApp agent with 5-minute validity
-- Migration: 099_auth_tickets.sql

CREATE TABLE IF NOT EXISTS auth_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  actor_phone text NOT NULL,
  actor_user_id uuid REFERENCES profiles(id),
  model text NOT NULL,
  request text NOT NULL,
  user text,
  loggedIn boolean NOT NULL DEFAULT false,
  intent text NOT NULL,
  scope jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','denied','expired','revoked')),
  expires_at timestamptz NOT NULL,
  decision_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  denied_at timestamptz,
  expires_checked_at timestamptz
);

CREATE TABLE IF NOT EXISTS auth_ticket_audits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES auth_tickets(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_phone text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_tickets_code ON auth_tickets(code);
CREATE INDEX IF NOT EXISTS idx_auth_tickets_actor_phone ON auth_tickets(actor_phone);
CREATE INDEX IF NOT EXISTS idx_auth_tickets_expires ON auth_tickets(expires_at);

ALTER TABLE auth_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE auth_ticket_audits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION validate_auth_ticket(
  p_code text,
  p_actor_phone text,
  p_request_hash text,
  p_scope jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ticket auth_tickets%ROWTYPE;
  v_role text := 'user';
BEGIN
  SELECT * INTO v_ticket FROM auth_tickets WHERE code = p_code;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ticket_not_found');
  END IF;

  IF v_ticket.status <> 'approved' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'ticket_not_approved', 'status', v_ticket.status);
  END IF;

  IF v_ticket.expires_at < now() THEN
    UPDATE auth_tickets SET status='expired', expires_checked_at=now() WHERE id=v_ticket.id;
    RETURN jsonb_build_object('ok', false, 'reason', 'ticket_expired');
  END IF;

  IF v_ticket.actor_phone <> p_actor_phone THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'actor_mismatch');
  END IF;

  IF v_ticket.actor_user_id IS NOT NULL THEN
    SELECT role INTO v_role FROM profiles WHERE id = v_ticket.actor_user_id;
    IF NOT FOUND THEN
      v_role := 'user';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'reason', 'valid',
    'expires_in', EXTRACT(EPOCH FROM (v_ticket.expires_at - now()))::int,
    'actor_user_id', v_ticket.actor_user_id,
    'role', v_role,
    'model', v_ticket.model,
    'intent', v_ticket.intent
  );
END;
$$;

GRANT EXECUTE ON FUNCTION validate_auth_ticket(text,text,text,jsonb) TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_tickets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_ticket_audits TO service_role;
