'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import Shell from './_shell'

interface Poll {
  id: string
  title: string
  description: string | null
  status: string
  share_code: string
  created_at: string
  created_by: { username: string } | { username: string }[]
}

interface Application {
  id: string
  poll_id: string
  applicant_id: string
  team_name: string
  team_slug: string
  team_league: string
  status: string
  created_at: string
  applicant: { username: string } | { username: string }[]
}

export default function AdminPollsPage() {
  const supabase = createClient()
  const [polls, setPolls] = useState<Poll[]>([])
  const [applications, setApplications] = useState<Application[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedPoll, setExpandedPoll] = useState<string | null>(null)

  const [showCreate, setShowCreate] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [selectedLeagues, setSelectedLeagues] = useState<string[]>([])
  const [allowInternational, setAllowInternational] = useState(false)
  const [creating, setCreating] = useState(false)

  const LEAGUE_OPTIONS = [
    { value: 'english-premier-league-2025-2026.football-logos.cc', label: 'Premier League' },
    { value: 'england-efl-championship-2025-2026.football-logos.cc', label: 'Championship' },
    { value: 'spain-la-liga-2025-2026.football-logos.cc', label: 'La Liga' },
    { value: 'spain-la-liga-2-2025-2026.football-logos.cc', label: 'La Liga 2' },
    { value: 'germany-bundesliga-2025-2026.football-logos.cc', label: 'Bundesliga' },
    { value: 'germany-2-bundesliga-2025-2026.football-logos.cc', label: '2. Bundesliga' },
    { value: 'italy-serie-a-2025-2026.football-logos.cc', label: 'Serie A' },
    { value: 'italy-serie-b-2025-2026.football-logos.cc', label: 'Serie B' },
    { value: 'france-ligue-1-2025-2026.football-logos.cc', label: 'Ligue 1' },
    { value: 'france-ligue-2-2025-2026.football-logos.cc', label: 'Ligue 2' },
    { value: 'netherlands-eredivisie-2025-2026.football-logos.cc', label: 'Eredivisie' },
    { value: 'portugal-primeira-liga-2025-2026.football-logos.cc', label: 'Primeira Liga' },
    { value: 'scotland-premiership-2025-2026.football-logos.cc', label: 'Premiership' },
    { value: 'romania-liga-1-2025-2026.football-logos.cc', label: 'Liga 1' },
    { value: 'argentina-primera-division-2025-2026.football-logos.cc', label: 'Primera División' },
    { value: 'brazil-serie-a-2025-2026.football-logos.cc', label: 'Série A' },
    { value: 'brazil-serie-b-2025-2026.football-logos.cc', label: 'Série B' },
    { value: 'saudi-arabia-pro-league-2025-2026.football-logos.cc', label: 'Saudi Pro League' },
  ]

  const loadPolls = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const res = await fetch('/api/admin/polls')
    const data = await res.json()
    if (res.ok) {
      setPolls(data.polls ?? [])
      setApplications(data.applications ?? [])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadPolls() }, [loadPolls])

  function toggleLeague(value: string) {
    setSelectedLeagues((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    )
  }

  async function handleCreate() {
    if (!title.trim()) return
    setCreating(true)
    setError('')

    const res = await fetch('/api/admin/polls', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: title.trim(),
        description: description.trim() || null,
        allowed_leagues: selectedLeagues.length > 0 ? selectedLeagues : [],
        allowed_international: allowInternational,
      }),
    })

    const data = await res.json()
    if (!res.ok) {
      setError(data.error ?? 'Failed to create poll')
      setCreating(false)
      return
    }

    setShowCreate(false)
    setTitle('')
    setDescription('')
    setSelectedLeagues([])
    setAllowInternational(false)
    setCreating(false)
    loadPolls()
  }

  async function handleClose(pollId: string) {
    const res = await fetch(`/api/admin/polls/${pollId}/close`, { method: 'POST' })
    if (res.ok) loadPolls()
  }

  async function handleDeleteApplication(appId: string) {
    const res = await fetch(`/api/admin/polls/applications/${appId}`, { method: 'DELETE' })
    if (res.ok) loadPolls()
  }

  async function copyLink(shareCode: string) {
    const url = `${window.location.origin}/polls/${shareCode}`
    await navigator.clipboard.writeText(url)
  }

  return (
    <Shell data={{
      polls,
      applications,
      loading,
      error,
      expandedPoll,
      showCreate,
      title,
      description,
      selectedLeagues,
      allowInternational,
      creating,
      LEAGUE_OPTIONS,
      setShowCreate,
      setTitle,
      setDescription,
      setExpandedPoll,
      setSelectedLeagues,
      setAllowInternational,
      toggleLeague,
      handleCreate,
      handleClose,
      handleDeleteApplication,
      copyLink,
    }} />
  )
}
