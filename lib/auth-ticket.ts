import { createHash, randomBytes } from 'crypto'
import { createAdminClient } from '@/lib/supabase/server'
import { normalizePhoneDigits } from '@/lib/phone'

export type TicketRequest = {
  model: string
  request: string
  user: string
  loggedIn: boolean
  actorPhone: string | null | undefined
  intent: 'read' | 'write' | 'admin' | 'ddl'
  scope: Record<string, any>
}

export type TicketResponse = {
  authCode: string
  expiresAt: string
  allowedScope: Record<string, any>
  warnings?: string[]
  requiresConfirmation?: boolean
}

export async function issueAuthTicket(req: TicketRequest): Promise<TicketResponse> {
  const supabase = await createAdminClient()
  const digits = normalizePhoneDigits(req.actorPhone)
  if (!digits) throw new Error('invalid_actor_phone')

  const code = randomBytes(24).toString('hex')

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  let actorUserId: string | null = null
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('phone', digits)
    .maybeSingle()
  if (profile?.id) actorUserId = profile.id

  const requiresConfirmation = req.intent === 'ddl' || req.intent === 'admin' || req.scope?.destructive === true || (req.scope?.rowCountEstimate && req.scope.rowCountEstimate > 10)
  const warnings: string[] = []
  if (requiresConfirmation) warnings.push('fishy_or_destructive_request_requires_confirmation')

  const { error } = await supabase.from('auth_tickets').insert({
    code,
    actor_phone: digits,
    actor_user_id: actorUserId,
    model: req.model,
    request: req.request,
    user: req.user,
    loggedIn: req.loggedIn,
    intent: req.intent,
    scope: req.scope,
    status: 'approved',
    expires_at: expiresAt,
    approved_at: new Date().toISOString(),
  })
  if (error) throw error

  return {
    authCode: code,
    expiresAt,
    allowedScope: req.scope,
    warnings,
    requiresConfirmation,
  }
}

export async function validateAuthTicket(code: string, actorPhone: string, requestHash: string, scope: Record<string, any> = {}) {
  const supabase = await createAdminClient()
  const digits = normalizePhoneDigits(actorPhone)
  const { data, error } = await supabase.rpc('validate_auth_ticket', {
    p_code: code,
    p_actor_phone: digits,
    p_request_hash: requestHash,
    p_scope: scope,
  })
  if (error) throw error
  return data as any
}

export function hashRequest(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}
