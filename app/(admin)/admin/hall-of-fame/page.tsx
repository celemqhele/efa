export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import HallOfFameAdmin from './HallOfFameAdmin'

export default async function AdminHallOfFamePage() {
  const supabase = await createClient()

  const [{ data: teams }, { data: seasons }, { data: tournaments }, { data: trophiesRaw }] =
    await Promise.all([
      supabase.from('teams').select('id, name, logo_league_folder, logo_team_slug').order('name'),
      supabase.from('seasons').select('id, name').order('created_at', { ascending: false }),
      supabase
        .from('tournaments')
        .select('id, name, type, season_id')
        .order('created_at', { ascending: false }) as any,
      supabase
        .from('trophies')
        .select(
          `id, trophy_type, awarded_at,
          team:teams(id, name, logo_league_folder, logo_team_slug),
          season:seasons(id, name),
          tournament:tournaments(id, name)`
        )
        .order('awarded_at', { ascending: false }),
    ])

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900">Hall of Fame</h1>
        <p className="text-slate-400 text-sm mt-1">
          Manually award or remove trophies for any season.
        </p>
      </div>

      <HallOfFameAdmin
        teams={teams ?? []}
        seasons={seasons ?? []}
        tournaments={tournaments ?? []}
        trophies={(trophiesRaw ?? []) as any}
      />
    </div>
  )
}
