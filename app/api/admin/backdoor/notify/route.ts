import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notifyBackdoorDecision } from '@/lib/backdoor-notify'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (adminProfile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json().catch(() => null)
  const submissionIds: string[] = body?.submissionIds
  const outcome: 'approved' | 'declined' = body?.outcome

  if (
    !Array.isArray(submissionIds) ||
    submissionIds.length === 0 ||
    !['approved', 'declined'].includes(outcome)
  ) {
    return Response.json(
      { error: 'submissionIds and outcome (approved|declined) required' },
      { status: 400 }
    )
  }

  const adminSupabase = await createAdminClient()
  await notifyBackdoorDecision(adminSupabase, submissionIds, outcome)

  return Response.json({ success: true })
}
