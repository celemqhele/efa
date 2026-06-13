import { createClient, createAdminClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const adminSupabase = await createAdminClient()

  const { data: polls } = await adminSupabase
    .from('polls' as any)
    .select('*, created_by:profiles!polls_created_by_fkey(username)')
    .order('created_at', { ascending: false })

  const pollIds = (polls ?? []).map((p: any) => p.id)
  let applications: any[] = []
  if (pollIds.length > 0) {
    const { data: apps } = await adminSupabase
      .from('poll_applications' as any)
      .select('*, applicant:profiles!poll_applications_applicant_id_fkey(username)')
      .in('poll_id', pollIds)
      .order('created_at', { ascending: true })
    applications = apps ?? []
  }

  return Response.json({ polls: polls ?? [], applications })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const adminSupabase = await createAdminClient()
  const { data: profile } = await adminSupabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const { title, description, allowed_leagues, allowed_international } = body

  if (!title?.trim()) {
    return Response.json({ error: 'title is required' }, { status: 400 })
  }

  const share_code = crypto.randomBytes(4).toString('hex')

  const { data: poll, error } = await adminSupabase
    .from('polls' as any)
    .insert({
      title: title.trim(),
      description: description?.trim() ?? null,
      created_by: user.id,
      status: 'open',
      share_code,
      allowed_leagues: allowed_leagues ?? [],
      allowed_international: allowed_international ?? false,
    })
    .select('*')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })

  await adminSupabase.from('audit_log').insert({
    admin_id: user.id,
    action: 'create_poll',
    target_type: 'poll',
    target_id: poll.id,
    details: { title, share_code },
  })

  return Response.json({ poll })
}
