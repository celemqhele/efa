'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Search, X, User, Trophy, Users, Globe } from 'lucide-react'
import { getTeamLogo } from '@/lib/logo-resolver'

interface SearchResult {
  id: string
  label: string
  subtitle: string
  href: string
  avatar?: string | null
  logoFolder?: string | null
  logSlug?: string | null
  leagueFolder?: string | null
}

interface SearchData {
  managers: SearchResult[]
  teams: SearchResult[]
  leagues: SearchResult[]
  countries: SearchResult[]
}

const SECTION_META: Record<string, { icon: React.ReactNode; title: string }> = {
  managers: { icon: <User className="w-3.5 h-3.5" />, title: 'Managers' },
  teams: { icon: <Trophy className="w-3.5 h-3.5" />, title: 'Teams' },
  leagues: { icon: <Users className="w-3.5 h-3.5" />, title: 'Leagues' },
  countries: { icon: <Globe className="w-3.5 h-3.5" />, title: 'Countries' },
}

function SectionGroup({ sectionKey, results }: { sectionKey: string; results: SearchResult[] }) {
  if (results.length === 0) return null
  const meta = SECTION_META[sectionKey]
  return (
    <div>
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-text-muted uppercase tracking-wider px-3 pt-3 pb-1">
        {meta?.icon}
        {meta?.title ?? sectionKey}
      </p>
      {results.map((r) => (
        <div key={r.id}>
          <ResultRow result={r} />
        </div>
      ))}
    </div>
  )
}

function ResultRow({ result }: { result: SearchResult }) {
  const router = useRouter()
  const isManager = result.subtitle === 'Manager'
  const isTeam = result.subtitle === 'Team'
  const isCountry = result.subtitle === 'Country'
  const isLeague = result.subtitle === 'League'

  const showAvatar = isManager && result.avatar
  const showLogo = (isTeam || isCountry || isLeague) && (result.logoFolder || result.leagueFolder) && result.logSlug

  return (
    <button
      onClick={() => { router.push(result.href) }}
      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-bg-elevated transition-colors text-left"
    >
      {showAvatar ? (
        <Image src={result.avatar!} alt="" width={28} height={28} className="rounded-full object-cover shrink-0" />
      ) : showLogo ? (
        <Image
          src={getTeamLogo(result.logoFolder ?? result.leagueFolder!, result.logSlug!, 'standings_row')}
          alt="" width={28} height={28}
          className="object-contain rounded-full shrink-0"
        />
      ) : isManager ? (
        <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center shrink-0">
          <User className="w-3.5 h-3.5 text-accent" />
        </div>
      ) : (
        <div className="w-7 h-7 rounded-full bg-border-subtle flex items-center justify-center shrink-0">
          <Trophy className="w-3.5 h-3.5 text-text-muted" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground-primary truncate">{result.label}</p>
        <p className="text-xs text-text-muted">{result.subtitle}</p>
      </div>
    </button>
  )
}

export default function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchData | null>(null)
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
        setResults(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setResults(data)
    } catch {}
    setLoading(false)
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(val), 200)
  }

  function closeSearch() {
    setOpen(false)
    setQuery('')
    setResults(null)
  }

  const hasResults = results && (results.managers.length > 0 || results.teams.length > 0 || results.leagues.length > 0 || results.countries.length > 0)

  const resultsPanel = (insideOverlay: boolean) => (
    <>
      {query.length >= 2 && (
        <div className={insideOverlay ? '' : 'absolute bottom-full mb-1 left-0 right-0 bg-bg-elevated border border-border rounded-xl shadow-2xl z-50 max-h-[70vh] overflow-y-auto'}>
          {loading ? (
            <div className="flex items-center justify-center py-6">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : hasResults ? (
            <div onClick={closeSearch}>
              <SectionGroup sectionKey="managers" results={results!.managers} />
              <SectionGroup sectionKey="teams" results={results!.teams} />
              <SectionGroup sectionKey="leagues" results={results!.leagues} />
              <SectionGroup sectionKey="countries" results={results!.countries} />
            </div>
          ) : (
            <p className="text-sm text-text-muted text-center py-6">No results for &ldquo;{query}&rdquo;</p>
          )}
        </div>
      )}
    </>
  )

  return (
    <>
      {/* Mobile search trigger */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="sm:hidden p-2 rounded-lg hover:bg-bg-elevated transition-colors text-text-muted hover:text-accent"
          title="Search"
        >
          <Search className="w-5 h-5" />
        </button>
      )}

      {/* Mobile full-screen overlay */}
      {open && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-[100] bg-bg-primary flex flex-col sm:hidden animate-fade-in"
        >
          {/* Search bar with close */}
          <div className="flex items-center gap-3 px-4 pt-safe-area-top pb-3 border-b border-border">
            <Search className="w-5 h-5 text-text-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleChange}
              placeholder="Search managers, teams..."
              className="flex-1 bg-transparent text-base text-foreground-primary outline-none placeholder:text-text-muted"
            />
            <button onClick={closeSearch} className="p-2 rounded-lg hover:bg-bg-elevated text-text-muted">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Results */}
          <div className="flex-1 overflow-y-auto px-2 pb-4">
            {resultsPanel(true)}
          </div>
        </div>
      )}

      {/* Desktop inline search */}
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="hidden sm:flex p-2 rounded-lg hover:bg-bg-elevated transition-colors text-text-muted hover:text-accent"
          title="Search"
        >
          <Search className="w-5 h-5" />
        </button>
      ) : (
        <div ref={containerRef} className="hidden sm:block relative">
          <div className="flex items-center gap-2 bg-bg-elevated border border-border rounded-xl px-3 py-1.5 min-w-[220px] sm:min-w-[280px] animate-fade-in">
            <Search className="w-4 h-4 text-text-muted shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={handleChange}
              placeholder="Search managers, teams..."
              className="flex-1 bg-transparent text-sm text-foreground-primary outline-none placeholder:text-text-muted min-w-0"
            />
            {query && (
              <button
                onClick={() => { setQuery(''); setResults(null); inputRef.current?.focus() }}
                className="p-0.5 rounded hover:bg-border text-text-muted"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {resultsPanel(false)}
        </div>
      )}
    </>
  )
}
