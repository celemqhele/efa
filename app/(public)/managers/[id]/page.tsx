import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Shell from './_shell'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const supabase = await createClient()
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', id).single() as any
  const name = profile?.username ?? 'Manager'
  return {
    title: `@${name}`,
    description: `@${name} — EFA manager profile with career stats, trophies, and management history.`,
    openGraph: { title: `@${name} | EFA`, description: `@${name} — EFA manager profile with career stats, trophies, and management history.` },
  }
}

export default async function ManagerProfilePage({ params }: PageProps) {
  const supabase = await createClient()
  const { id } = await params

  const { data: _profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single() as any
  const profile = _profile as any

  if (!profile) notFound()

  const { data: tenures } = await supabase
    .from('manager_tenures' as any)
    .select(`
      *,
      team:teams(id, name, logo_league_folder, logo_team_slug)
    `)
    .eq('manager_id', id)
    .order('started_at', { ascending: false }) as any

  const stats = (tenures ?? []).reduce((acc: any, t: any) => {
    acc.played += (t.wins + t.draws + t.losses)
    acc.wins += t.wins
    acc.draws += t.draws
    acc.losses += t.losses
    acc.gf += t.goals_for
    acc.ga += t.goals_against
    return acc
  }, { played: 0, wins: 0, draws: 0, losses: 0, gf: 0, ga: 0 })

  const winRate = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0

  const currentTenure = (tenures ?? []).find((t: any) => !t.ended_at)
  const currentTeam = currentTenure?.team ?? null

  const data = { profile, tenures, stats, winRate, currentTeam }

  return <Shell data={data} />
}
