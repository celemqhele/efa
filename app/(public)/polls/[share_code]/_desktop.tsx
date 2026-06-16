'use client'

import { useState, useMemo } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'

interface TeamEntry {
  slug: string
  name: string
}

interface LeagueEntry {
  folder: string
  region: string
  country: string
  league: string
  isNational?: boolean
  teams: TeamEntry[]
}

interface PollApp {
  id: string
  team_slug: string
  team_league: string
  team_name: string
  status: string
}

function logoSrc(folder: string, slug: string) {
  return `/logos/${folder}/128x128/${slug}.png`
}

export default function Desktop({ data }: { data: any }) {
  const { poll, leagues, user } = data

  const [search, setSearch] = useState('')
  const [selectedLeague, setSelectedLeague] = useState('')
  const [loadingTeam, setLoadingTeam] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [takenTeams, setTakenTeams] = useState<Set<string>>(new Set())
  const [myApps, setMyApps] = useState<PollApp[]>([])

  // Load taken slots and my applications on mount
  useState(() => {
    fetch(`/api/polls/${poll.share_code}`)
      .then((r) => r.json())
      .then((data) => {
        setTakenTeams(new Set(data.taken_slots ?? []))
        setMyApps(data.my_applications ?? [])
      })
      .catch(() => {})
  })

  const isOpen = poll.status === 'open'

  const filteredLeagues = useMemo(() => {
    return leagues
      .filter((l: any) => !selectedLeague || l.folder === selectedLeague)
      .map((l: any) => ({
        ...l,
        teams: l.teams.filter((t: any) => {
          const q = search.toLowerCase().trim()
          if (!q) return true
          return t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q)
        }),
      }))
      .filter((l: any) => l.teams.length > 0)
  }, [leagues, search, selectedLeague])

  function teamKey(league: string, slug: string) {
    return `${league}|${slug}`
  }

  function isTeamTaken(league: string, slug: string) {
    return takenTeams.has(teamKey(league, slug))
  }

  function myAppFor(league: string, slug: string) {
    return myApps.find((a) => a.team_league === league && a.team_slug === slug)
  }

  async function handleApply(league: string, slug: string, name: string) {
    if (!user) {
      setError('You must be logged in to apply.')
      return
    }
    setLoadingTeam(teamKey(league, slug))
    setError('')
    setSuccess('')

    const res = await fetch(`/api/polls/${poll.share_code}/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ team_name: name, team_slug: slug, team_league: league }),
    })

    const responseData = await res.json()
    setLoadingTeam(null)

    if (!res.ok) {
      setError(responseData.error ?? 'Failed to apply')
      return
    }

    setTakenTeams((prev) => new Set(prev).add(teamKey(league, slug)))
    setMyApps((prev) => [...prev, responseData.application])
    setSuccess(`Applied for ${name}!`)
  }

  async function handleWithdraw(appId: string, league: string, slug: string) {
    setLoadingTeam(teamKey(league, slug))
    setError('')
    setSuccess('')

    const res = await fetch(`/api/polls/${poll.share_code}/withdraw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_id: appId }),
    })

    setLoadingTeam(null)

    if (!res.ok) {
      const responseData = await res.json()
      setError(responseData.error ?? 'Failed to withdraw')
      return
    }

    setTakenTeams((prev) => {
      const next = new Set(prev)
      next.delete(teamKey(league, slug))
      return next
    })
    setMyApps((prev) => prev.filter((a) => a.id !== appId))
    setSuccess(`Withdrew from ${league} team.`)
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-2xl font-bold text-text-primary">{poll.title}</h1>
        {poll.description && (
          <p className="text-text-muted text-sm mt-1">{poll.description}</p>
        )}
        <span className={`inline-block mt-2 text-xs px-3 py-1 rounded-full border font-medium ${
          isOpen
            ? 'bg-feedback-success/10 border-feedback-success/30 text-feedback-success'
            : 'bg-bg-elevated border-border text-text-muted'
        }`}>
          {isOpen ? 'Open for applications' : 'Closed'}
        </span>
      </div>

      {!user && (
        <Card className="p-4 text-center">
          <p className="text-sm text-text-muted">
            <a href="/login" className="text-accent underline">Log in</a> to apply for teams.
          </p>
        </Card>
      )}

      {/* Alerts */}
      {error && (
        <div className="bg-feedback-error/10 border border-feedback-error/30 rounded-lg p-4 text-feedback-error text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-feedback-success/10 border border-feedback-success/30 rounded-lg p-4 text-feedback-success text-sm">
          {success}
        </div>
      )}

      {/* My Applications */}
      {myApps.length > 0 && (
        <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border">
            <h2 className="font-semibold text-text-primary flex items-center gap-2">
              <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
              My Applications
            </h2>
          </div>
          <div className="divide-y divide-border/60">
            {myApps.map((app) => (
              <div key={app.id} className="flex items-center justify-between px-5 py-3 hover:bg-accent/5 transition-colors">
                <div className="flex items-center gap-3">
                  <Image src={logoSrc(app.team_league, app.team_slug)} alt={app.team_name} width={28} height={28} className="object-contain rounded" />
                  <span className="text-sm text-text-primary font-medium">{app.team_name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${
                    app.status === 'pending' ? 'text-feedback-warning border-feedback-warning/30 bg-feedback-warning/5' :
                    app.status === 'approved' ? 'text-feedback-success border-feedback-success/30 bg-feedback-success/5' :
                    app.status === 'denied' ? 'text-feedback-error border-feedback-error/30 bg-feedback-error/5' :
                    'text-text-muted border-border'
                  }`}>{app.status}</span>
                </div>
                {app.status === 'pending' && (
                  <Button variant="ghost" className="text-xs" onClick={() => handleWithdraw(app.id, app.team_league, app.team_slug)}>
                    Withdraw
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <input
          type="search"
          placeholder="Search teams..."
          className="input-field flex-1"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input-field w-auto"
          value={selectedLeague}
          onChange={(e) => setSelectedLeague(e.target.value)}
        >
          <option value="">All leagues</option>
          {leagues.map((l: any) => (
            <option key={l.folder} value={l.folder}>{l.league}</option>
          ))}
        </select>
      </div>

      {/* Team table by league */}
      {filteredLeagues.map((league: any) => (
        <div key={league.folder}>
          <h2 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
            <span>{league.country}</span>
            <span className="text-text-muted text-sm font-normal">— {league.league}</span>
            <span className="ml-auto text-xs text-text-muted">{league.teams.length} teams</span>
          </h2>
          <div className="bg-bg-elevated border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg-base border-b-2 border-accent/20">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Team</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-semibold text-text-muted uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {league.teams.map((team: any) => {
                  const taken = isTeamTaken(league.folder, team.slug)
                  const myApp = myAppFor(league.folder, team.slug)
                  const isMine = !!myApp
                  const isLoading = loadingTeam === teamKey(league.folder, team.slug)
                  const disabled = !isOpen || taken || isLoading || !user

                  return (
                    <tr key={team.slug} className={`hover:bg-accent/5 transition-colors ${taken && !isMine ? 'opacity-50' : ''}`}>
                      <td className="px-5 py-3 min-w-0">
                        <div className="flex items-center gap-3">
                          <Image src={logoSrc(league.folder, team.slug)} alt={team.name} width={32} height={32} className="object-contain rounded shrink-0" />
                          <span className={`font-medium truncate ${isMine ? 'text-accent' : 'text-text-primary'}`}>{team.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        {isMine ? (
                          <span className="text-xs font-medium text-accent">Applied</span>
                        ) : taken ? (
                          <span className="text-xs text-text-muted">Taken</span>
                        ) : (
                          <span className="text-xs text-feedback-success">Available</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {isMine ? (
                          <Button variant="ghost" className="text-xs" onClick={() => handleWithdraw(myApp!.id, league.folder, team.slug)}>
                            Withdraw
                          </Button>
                        ) : !disabled ? (
                          <Button variant="primary" className="text-xs" onClick={() => handleApply(league.folder, team.slug, team.name)}>
                            {isLoading ? 'Applying...' : 'Apply'}
                          </Button>
                        ) : (
                          <span className="text-xs text-text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {filteredLeagues.length === 0 && (
        <Card className="p-12 text-center">
          <p className="text-text-muted">No teams match your search.</p>
        </Card>
      )}
    </div>
  )
}
