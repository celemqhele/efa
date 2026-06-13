import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function GET(request: Request, { params }: { params: { share_code: string } }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: poll } = await supabase
    .from('polls' as any)
    .select('*, created_by:profiles!polls_created_by_fkey(username)')
    .eq('share_code', params.share_code)
    .maybeSingle()

  if (!poll) {
    return Response.json({ error: 'Poll not found' }, { status: 404 })
  }

  // Count applications per team
  const adminSupabase = await createAdminClient()
  const { data: applications } = await adminSupabase
    .from('poll_applications' as any)
    .select('team_slug, team_league, status, applicant_id')
    .eq('poll_id', poll.id)

  const takenTeams = new Set(
    (applications ?? [])
      .filter((a: any) => a.status !== 'withdrawn')
      .map((a: any) => `${a.team_league}|${a.team_slug}`)
  )

  const myApplications = user
    ? (applications ?? []).filter((a: any) => a.applicant_id === user.id)
    : []

  return Response.json({
    poll,
    taken_slots: [...takenTeams],
    my_applications: myApplications,
  })
}
