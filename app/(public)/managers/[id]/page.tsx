import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getTeamLogo } from '@/lib/logo-resolver'
import { format } from 'date-fns'
import { ClipboardList, BarChart3, Shirt, Binoculars, Shield, UserRound } from 'lucide-react'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function ManagerProfilePage({ params }: PageProps) {
  const supabase = await createClient()
  const { id } = await params

  // 1. Fetch Profile
  const { data: _profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single() as any
  const profile = _profile as any

  if (!profile) notFound()

  // 2. Fetch Tenures (Career History)
  const { data: tenures } = await supabase
    .from('manager_tenures' as any)
    .select(`
      *,
      team:teams(id, name, logo_league_folder, logo_team_slug)
    `)
    .eq('manager_id', id)
    .order('started_at', { ascending: false }) as any

  // 3. Calculate Aggregated Stats
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

  return (
    <div className="space-y-6">
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-br from-navy-light via-gold/10 to-navy-card h-32 relative" />
        <div className="px-6 py-6 -mt-8 relative flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
          <div className="relative shrink-0">
            <div className="w-24 h-24 rounded-full bg-navy-card border-4 border-navy-card shadow-xl overflow-hidden flex items-center justify-center bg-navy">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.username} width={96} height={96} className="object-cover w-full h-full" />
              ) : (
                <UserRound className="w-10 h-10 text-gold" />
              )}
            </div>
            {currentTeam?.logo_team_slug && (
              <div className="absolute bottom-0 right-0 translate-x-1/4 translate-y-1/4 w-8 h-8 rounded-full bg-navy-card shadow-md flex items-center justify-center overflow-hidden">
                <Image
                  src={getTeamLogo(currentTeam.logo_league_folder, currentTeam.logo_team_slug, 'standings_row')}
                  alt={currentTeam.name}
                  width={20}
                  height={20}
                  className="object-contain"
                />
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-black text-foreground-primary">@{profile.username}</h1>
            <p className="text-foreground-muted font-medium uppercase tracking-widest text-xs mt-1">Professional Manager</p>
          </div>
          <div className="flex gap-4">
             <div className="text-center">
                <p className="text-2xl font-black text-foreground-primary">{stats.played}</p>
                <p className="text-[10px] text-foreground-muted uppercase font-bold tracking-tighter">Matches</p>
             </div>
             <div className="text-center">
                <p className="text-2xl font-black text-gold">{winRate}%</p>
                <p className="text-[10px] text-foreground-muted uppercase font-bold tracking-tighter">Win Rate</p>
             </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left Col: Bio / Details ─────────────────────────────────────── */}
        <div className="lg:col-span-1 space-y-6">
          <div className="card p-5">
            <h2 className="section-header text-sm">
              <ClipboardList className="w-5 h-5 text-gold" /> Profile Details
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mb-1">Playstyle</p>
                <p className="text-sm text-foreground-secondary font-medium">
                  {profile.playstyle || 'Tactical adaptive'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-foreground-muted uppercase tracking-wider mb-1">Member Since</p>
                <p className="text-sm text-foreground-secondary font-medium">
                  {format(new Date(profile.created_at), 'MMMM yyyy')}
                </p>
              </div>
            </div>
          </div>

          <div className="card p-5">
            <h2 className="section-header text-sm">
              <BarChart3 className="w-5 h-5 text-gold" /> Career Statistics
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-xl bg-navy-light/50 border border-navy-border/50">
                <p className="text-xs text-foreground-muted mb-1 font-bold">Wins</p>
                <p className="text-xl font-black text-green-400">{stats.wins}</p>
              </div>
              <div className="p-3 rounded-xl bg-navy-light/50 border border-navy-border/50">
                <p className="text-xs text-foreground-muted mb-1 font-bold">Draws</p>
                <p className="text-xl font-black text-yellow-400">{stats.draws}</p>
              </div>
              <div className="p-3 rounded-xl bg-navy-light/50 border border-navy-border/50">
                <p className="text-xs text-foreground-muted mb-1 font-bold">Losses</p>
                <p className="text-xl font-black text-red-400">{stats.losses}</p>
              </div>
              <div className="p-3 rounded-xl bg-navy-light/50 border border-navy-border/50">
                <p className="text-xs text-foreground-muted mb-1 font-bold">Goal Diff</p>
                <p className="text-xl font-black text-foreground-primary">
                  {stats.gf - stats.ga > 0 ? `+${stats.gf - stats.ga}` : stats.gf - stats.ga}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Col: History ──────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-5">
            <h2 className="section-header">
              <Shirt className="w-5 h-5 text-gold" /> Management History
            </h2>
            
            {(tenures ?? []).length === 0 ? (
              <div className="py-12 text-center text-foreground-muted">
                <Binoculars className="w-8 h-8 text-text-muted mx-auto mb-2" />
                <p className="text-sm font-medium">No management history found.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tenures.map((tenure: any) => {
                  const isCurrent = !tenure.ended_at
                  const played = tenure.wins + tenure.draws + tenure.losses
                  const tWinRate = played > 0 ? Math.round((tenure.wins / played) * 100) : 0
                  
                  return (
                    <div key={tenure.id} className={`p-4 rounded-2xl border transition-all ${
                      isCurrent 
                        ? 'bg-gold/5 border-gold/30 shadow-sm' 
                        : 'bg-navy-light/20 border-navy-border hover:border-foreground-muted/30'
                    }`}>
                      <div className="flex flex-col sm:flex-row gap-4">
                        {/* Club Identity */}
                         <div className="flex items-center gap-3 flex-1 min-w-0">
                           <div className="w-12 h-12 flex items-center justify-center shrink-0">
                             {tenure.team?.logo_team_slug ? (
                               <Image 
                                 src={getTeamLogo(tenure.team.logo_league_folder, tenure.team.logo_team_slug, 'standings_row')} 
                                 alt={tenure.team.name} width={36} height={36} className="object-contain" 
                               />
                             ) : <Shield className="w-5 h-5 text-text-muted" />}
                           </div>
                          <div className="min-w-0">
                            <Link href={`/teams/${tenure.team_id}`} className="font-bold text-foreground-primary hover:text-gold transition-colors truncate block">
                              {tenure.team?.name || 'Unknown Club'}
                            </Link>
                            <p className="text-[10px] text-foreground-muted font-bold uppercase tracking-wider">
                              {format(new Date(tenure.started_at), 'MMM yyyy')} — {tenure.ended_at ? format(new Date(tenure.ended_at), 'MMM yyyy') : 'Present'}
                            </p>
                          </div>
                          {isCurrent && (
                            <span className="ml-auto sm:ml-0 text-[10px] bg-gold/20 text-gold border border-gold/30 px-2 py-0.5 rounded-full font-black uppercase">Active</span>
                          )}
                        </div>

                        {/* Performance Grid */}
                        <div className="grid grid-cols-4 gap-3 text-center bg-navy-card/50 rounded-xl p-2 border border-navy-border/50 sm:w-64">
                          <div>
                            <p className="text-xs font-black text-foreground-primary">{played}</p>
                            <p className="text-[9px] text-foreground-muted font-bold uppercase">P</p>
                          </div>
                          <div>
                            <p className="text-xs font-black text-green-400">{tenure.wins}</p>
                            <p className="text-[9px] text-foreground-muted font-bold uppercase">W</p>
                          </div>
                          <div>
                            <p className="text-xs font-black text-foreground-primary">{tWinRate}%</p>
                            <p className="text-[9px] text-foreground-muted font-bold uppercase">WR</p>
                          </div>
                          <div>
                            <p className="text-xs font-black text-foreground-primary">{tenure.goals_for - tenure.goals_against}</p>
                            <p className="text-[9px] text-foreground-muted font-bold uppercase">GD</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
