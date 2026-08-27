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
  return `/logos/${folder}/1280x1280/${slug}.png`
}

export default function Mobile({ data }: { data: any }) {
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
    <div className="px-4 pb-8 space-y-5">
      {/* Header */}
      <div className="bg-bg-elevated border border-border rounded-xl p-4 text-center">
        <h1 className="text-lg font-bold text-text-primary">{poll.title}</h1>
        {poll.description && (
          <p className="text-text-muted text-xs mt-1">{poll.description}</p>
        )}
        <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full border font-medium min-h-[24px] ${
          isOpen
            ? 'bg-feedback-success/10 border-feedback-success/30 text-feedback-success'
            : 'bg-bg-elevated border-border text-text-muted'
        }`}>
          {isOpen ? 'Open for applications' : 'Closed'}
        </span>
      </div>

      {!user && (
        <Card className="p-3 text-center">
          <p className="text-sm text-text-muted">
            <a href={`/login?redirect=${encodeURIComponent(`/polls/${poll.share_code}`)}`} className="text-accent underline">Log in</a> to apply for teams.
          </p>
        </Card>
      )}

      {/* Alerts */}
      {error && (
        <div className="bg-feedback-error/10 border border-feedback-error/30 rounded-lg p-3 text-feedback-error text-xs">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-feedback-success/10 border border-feedback-success/30 rounded-lg p-3 text-feedback-success text-xs">
          {success}
        </div>
      )}

      {/* My Applications */}
      {myApps.length > 0 && (
        <div className="bg-bg-elevated border border-border rounded-xl p-4 space-y-2">
          <h2 className="font-semibold text-text-primary text-sm flex items-center gap-2">
            <span className="w-1 h-4 rounded-full bg-accent shrink-0" />
            My Applications
          </h2>
          <div className="space-y-2">
            {myApps.map((app) => (
              <div key={app.id} className="flex items-center justify-between bg-bg-surface rounded-lg px-3 py-2 min-h-[48px]">
                <div className="flex items-center gap-2">
                  <Image src={logoSrc(app.team_league, app.team_slug)} alt={app.team_name} width={24} height={24} className="object-contain rounded" />
                  <span className="text-sm text-text-primary">{app.team_name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                    app.status === 'pending' ? 'text-feedback-warning border-feedback-warning/30 bg-feedback-warning/5' :
                    app.status === 'approved' ? 'text-feedback-success border-feedback-success/30 bg-feedback-success/5' :
                    app.status === 'denied' ? 'text-feedback-error border-feedback-error/30 bg-feedback-error/5' :
                    'text-text-muted border-border'
                  }`}>{app.status}</span>
                </div>
                {app.status === 'pending' && (
                  <Button variant="ghost" className="text-xs min-h-[32px]" onClick={() => handleWithdraw(app.id, app.team_league, app.team_slug)}>
                    Withdraw
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2">
        <input
          type="search"
          placeholder="Search teams..."
          className="input-field flex-1 min-h-[48px] text-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="input-field w-auto min-h-[48px] text-sm"
          value={selectedLeague}
          onChange={(e) => setSelectedLeague(e.target.value)}
        >
          <option value="">All leagues</option>
          {leagues.map((l: any) => (
            <option key={l.folder} value={l.folder}>{l.league}</option>
          ))}
        </select>
      </div>

      {/* Team cards by league */}
      {filteredLeagues.map((league: any) => (
        <div key={league.folder}>
          <h2 className="font-semibold text-text-primary mb-2 flex items-center gap-2 text-sm">
            <span>{league.country}</span>
            <span className="text-text-muted text-xs font-normal">— {league.league}</span>
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {league.teams.map((team: any) => {
              const taken = isTeamTaken(league.folder, team.slug)
              const myApp = myAppFor(league.folder, team.slug)
              const isMine = !!myApp
              const isLoading = loadingTeam === teamKey(league.folder, team.slug)
              const disabled = !isOpen || taken || isLoading || !user

              return (
                <button
                  key={team.slug}
                  disabled={isMine || (disabled && !isMine)}
                  onClick={() => !isMine && handleApply(league.folder, team.slug, team.name)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border transition-all text-left h-auto min-h-[80px]
                    ${isMine
                      ? 'border-accent bg-accent/10'
                      : taken
                      ? 'cursor-not-allowed border-border bg-bg-base opacity-50'
                      : 'border-border bg-bg-surface hover:border-accent/40 hover:bg-accent/5 cursor-pointer'
                    }`}
                >
                  <div className="w-8 h-8 flex items-center justify-center">
                    <Image
                      src={logoSrc(league.folder, team.slug)}
                      alt={team.name}
                      width={32} height={32}
                      className="object-contain"
                      onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3' }}
                    />
                  </div>
                  <span className="text-[9px] text-center leading-tight text-text-secondary font-medium line-clamp-2 w-full">
                    {team.name}
                  </span>
                  {isMine && <span className="text-[9px] text-accent font-medium">Applied</span>}
                  {taken && !isMine && <span className="text-[9px] text-text-muted font-medium">Taken</span>}
                  {isLoading && <span className="text-[9px] text-accent">Applying...</span>}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {filteredLeagues.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-text-muted text-sm">No teams match your search.</p>
        </Card>
      )}
    </div>
  )
}
