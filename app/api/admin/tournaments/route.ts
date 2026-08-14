import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createAdminClient()

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (id) {
    const { data: tournamentRaw } = await supabase
      .from('tournaments')
      .select('id, name, type, status, settings, tournament_participants(count)')
      .eq('id', id)
      .single()
    const tournament = tournamentRaw as any
    const participants = tournament?.tournament_participants
    const arr = Array.isArray(participants) ? participants : participants ? [participants] : []
    const team_count = arr[0]?.count ?? 0
    if (tournament) {
      delete tournament.tournament_participants
      tournament.team_count = team_count
    }
    return NextResponse.json({ tournament })
  }

  const { data: tournaments } = await supabase
    .from('tournaments')
    .select('id, name, type, status')
    .order('created_at', { ascending: false })

  return NextResponse.json(tournaments ?? [])
}
