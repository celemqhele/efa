import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ReviewShell from './_review'
import { listOpenSeasons } from '@/lib/season-applications'

export const revalidate = 0

export default async function TournamentApplicationsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/')

  const adminSupabase = await createAdminClient()

  const { data } = await adminSupabase
    .from('tournament_applications')
    .select(`
      id, season_id, applicant_id, team_id, status, review_note, expires_at, created_at,
      season:season_id(name),
      applicant:applicant_id(id, username, avatar_url, sacked_at),
      team:team_id(id, name, logo_league_folder, logo_team_slug)
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  const openSeasons = await listOpenSeasons(adminSupabase)

  const applications = (data ?? []).map((row: any) => ({
    ...row,
    season: Array.isArray(row.season) ? row.season[0] : row.season,
    applicant: Array.isArray(row.applicant) ? row.applicant[0] : row.applicant,
    team: Array.isArray(row.team) ? row.team[0] : row.team,
  }))

  return <ReviewShell applications={applications} openSeasons={openSeasons} />
}