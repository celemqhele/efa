import type { CSSProperties } from 'react'
import {
  Shield, Swords, ChevronRight, CalendarDays, Trophy, User,
  Star, Gamepad2, BarChart3, Dna, TrendingUp, MessageSquare,
  CheckCircle, Hourglass, AlertTriangle, Flag, RefreshCw,
  ClipboardList, Shirt, Vote, Home, Plane,
} from 'lucide-react'

function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-bg-surface0 ${className ?? ''}`}
      style={style}
    />
  )
}

function SkeletonText({ className }: { className?: string }) {
  return <Skeleton className={`h-3.5 w-full ${className ?? ''}`} />
}

function SkeletonCircle({ size }: { size: number }) {
  return (
    <Skeleton
      className="rounded-full shrink-0"
      style={{ width: size, height: size }}
    />
  )
}

function Ghost({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`opacity-20 animate-pulse ${className ?? ''}`}>{children}</div>
}

// ── Standings table skeleton ──────────────────────────────────────────────

function StandingsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg-surface">
      {/* Mobile */}
      <div className="sm:hidden">
        <div className="grid grid-cols-[18px_1fr_18px_18px_18px_18px_22px_24px] items-center gap-0.5 px-2 py-1.5 text-[9px] font-bold uppercase tracking-wider text-text-muted border-b border-border-subtle">
          <span className="text-center">#</span><span>Team</span>
          <span className="text-center">P</span><span className="text-center">W</span>
          <span className="text-center">D</span><span className="text-center">L</span>
          <span className="text-center">GD</span><span className="text-center text-accent">Pts</span>
        </div>
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className={`grid grid-cols-[18px_1fr_18px_18px_18px_18px_22px_24px] items-center gap-0.5 px-2 py-1.5 text-[10px] border-l-4 ${i < 12 ? 'border-l-accent' : i < 20 ? 'border-l-blue-500' : 'border-l-transparent'} ${i % 2 === 0 ? 'bg-bg-base' : 'bg-bg-surface'}`}
          >
            <Ghost className="contents">
              <span className="text-center font-bold text-text-muted">{i + 1}</span>
              <div className="flex items-center gap-1 min-w-0">
                <Shield className="w-4 h-4 shrink-0 text-text-muted" />
                <span className="font-semibold text-text-primary truncate leading-tight">Team Name</span>
              </div>
              <span className="text-center text-text-secondary">10</span>
              <span className="text-center text-text-secondary">5</span>
              <span className="text-center text-text-secondary">3</span>
              <span className="text-center text-text-secondary">2</span>
              <span className="text-center font-semibold text-feedback-success">+5</span>
              <span className="text-center font-black text-accent">18</span>
            </Ghost>
          </div>
        ))}
      </div>
      {/* Desktop */}
      <div className="hidden sm:block">
        <div className="grid grid-cols-[34px_1fr_32px_32px_32px_32px_32px_42px_44px] items-center gap-2 px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border-subtle">
          <span className="text-center">#</span><span>Team</span>
          <span className="text-center">P</span><span className="text-center">W</span>
          <span className="text-center">D</span><span className="text-center">L</span>
          <span className="text-center">A</span><span className="text-center">GD</span>
          <span className="text-center text-accent">Pts</span>
        </div>
        {Array.from({ length: 24 }).map((_, i) => (
          <div
            key={i}
            className={`grid grid-cols-[34px_1fr_32px_32px_32px_32px_32px_42px_44px] items-center gap-2 px-3 py-2.5 text-xs border-l-4 ${i < 12 ? 'border-l-accent' : i < 20 ? 'border-l-blue-500' : 'border-l-transparent'} ${i % 2 === 0 ? 'bg-bg-base' : 'bg-bg-surface'}`}
          >
            <Ghost className="contents">
              <span className="text-center font-bold text-text-muted">{i + 1}</span>
              <div className="flex items-center gap-2 min-w-0">
                <Shield className="w-7 h-7 shrink-0 text-text-muted" />
                <span className="font-semibold text-text-primary truncate">Team Name</span>
              </div>
              <span className="text-center text-text-secondary">10</span>
              <span className="text-center text-text-secondary">5</span>
              <span className="text-center text-text-secondary">3</span>
              <span className="text-center text-text-secondary">2</span>
              <span className="text-center text-text-secondary">0</span>
              <span className="text-center font-semibold text-feedback-success">+5</span>
              <span className="text-center font-black text-accent">18</span>
            </Ghost>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Tournament selector skeleton ──────────────────────────────────────────

function TournamentSelectorSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {['PL', 'UCL', 'EL'].map((label) => (
        <div
          key={label}
          className="px-5 py-3 sm:px-4 sm:py-2 rounded-lg text-sm font-semibold border min-h-[44px] sm:min-h-0 flex items-center bg-transparent text-text-muted border-border"
        >
          <Ghost>{label}</Ghost>
        </div>
      ))}
    </div>
  )
}

// ── Fixture card skeleton ─────────────────────────────────────────────────

function FixtureCardSkeleton() {
  return (
    <div className="card flex flex-col gap-2.5">
      <Ghost className="contents">
        {/* Top: tournament badge + matchday + status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded border bg-accent/10 text-accent border-accent/25">PL</span>
            <span className="text-[10px] text-text-muted font-semibold">MD3</span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded border font-semibold bg-slate-500/20 text-text-muted border-slate-500/30">Scheduled</span>
        </div>
        {/* Teams */}
        <div className="flex items-center gap-3">
          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <Shield className="w-12 h-12 text-text-muted" />
            <span className="text-sm font-semibold text-foreground-primary text-center leading-tight truncate max-w-full">Home Team</span>
          </div>
          <div className="shrink-0 flex flex-col items-center gap-1">
            <span className="text-[10px] font-black uppercase tracking-widest text-text-muted">vs</span>
            <span className="text-xs font-mono text-text-muted font-semibold">20:45</span>
          </div>
          <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <Shield className="w-12 h-12 text-text-muted" />
            <span className="text-sm font-semibold text-foreground-primary text-center leading-tight truncate max-w-full">Away Team</span>
          </div>
        </div>
        {/* Bottom */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 border border-green-500/30">W</span>
          </div>
          <ChevronRight className="w-4 h-4 text-text-muted" />
        </div>
      </Ghost>
    </div>
  )
}

// ── Fixture list skeleton ─────────────────────────────────────────────────

function FixtureListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-5">
      {/* Date group */}
      {[Math.min(count, 3), Math.max(count - 3, 1)].filter(Boolean).map((groupCount, gi) => (
        <section key={gi}>
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <div className="w-1 h-4 rounded-full bg-accent opacity-20 animate-pulse" />
            <h2 className="text-xs font-black uppercase tracking-widest text-text-muted opacity-20 animate-pulse">Today</h2>
            <span className="text-[10px] text-text-muted opacity-20 animate-pulse">({groupCount})</span>
          </div>
          <div className="space-y-2.5">
            {Array.from({ length: groupCount }).map((_, i) => (
              <FixtureCardSkeleton key={i} />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

// ── Fixture detail skeleton ───────────────────────────────────────────────

function FixtureDetailSkeleton() {
  return (
    <div className="space-y-6">
      {/* Match header */}
      <div className="card p-6">
        <div className="text-center mb-4 opacity-20 animate-pulse">
          <span className="text-xs font-medium text-gold uppercase tracking-widest">Premier League · Matchday 3</span>
          <p className="text-text-muted text-xs mt-1">Sat, 15 March 2026</p>
        </div>
        <Ghost className="contents">
          {/* Teams vs */}
          <div className="flex items-center justify-between gap-4">
            {/* Home */}
            <div className="flex-1 flex flex-col items-center gap-3">
              <Shield className="w-20 h-20 text-text-muted" />
              <div className="text-center">
                <p className="font-bold text-foreground-primary text-sm">Home Team</p>
                <p className="text-xs text-text-muted">@manager</p>
              </div>
            </div>
            {/* Score/VS */}
            <div className="text-center">
              <span className="text-3xl font-black text-foreground-muted">VS</span>
            </div>
            {/* Away */}
            <div className="flex-1 flex flex-col items-center gap-3">
              <Shield className="w-20 h-20 text-text-muted" />
              <div className="text-center">
                <p className="font-bold text-foreground-primary text-sm">Away Team</p>
                <p className="text-xs text-text-muted">@manager</p>
              </div>
            </div>
          </div>
        </Ghost>
      </div>

      {/* Pre-match sections */}
      <div className="card p-5 border-gold/20 opacity-20 animate-pulse">
        <details open className="group">
          <summary className="list-none lg:pointer-events-none flex items-center justify-between cursor-pointer">
            <h2 className="section-header">
              <Star className="w-5 h-5 text-gold" /> Coach's Analysis
            </h2>
            <ChevronRight className="w-4 h-4 text-text-muted transition-transform group-open:rotate-90 lg:hidden shrink-0" />
          </summary>
          <div className="mt-4 lg:mt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-3">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Home Team — vs Away Team</p>
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                <p className="text-xs text-text-muted">Recommendation content placeholder</p>
              </div>
            </div>
            <div className="space-y-3">
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider">Away Team — vs Home Team</p>
              <div className="bg-accent/10 border border-accent/20 rounded-lg p-3">
                <p className="text-xs text-text-muted">Recommendation content placeholder</p>
              </div>
            </div>
          </div>
        </details>
      </div>

      <div className="card p-5 border-accent/20 bg-bg-elevated opacity-20 animate-pulse">
        <details open className="group">
          <summary className="list-none lg:pointer-events-none flex items-center justify-between cursor-pointer">
            <h2 className="section-header">
              <Gamepad2 className="w-5 h-5 text-gold" /> Matchroom Instructions
            </h2>
            <ChevronRight className="w-4 h-4 text-text-muted transition-transform group-open:rotate-90 lg:hidden shrink-0" />
          </summary>
          <div className="mt-4 lg:mt-0 space-y-3">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-gold/10 border border-gold/20">
              <Home className="w-5 h-5 text-gold shrink-0 mt-0.5" />
              <div>
                <p className="text-gold font-bold text-sm uppercase tracking-wider">HOME — Home Team</p>
                <p className="text-foreground-primary font-semibold">@manager</p>
                <p className="text-foreground-secondary text-sm mt-1">YOU CREATE THE MATCHROOM</p>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-bg-surface border border-border">
              <Plane className="w-5 h-5 text-foreground-secondary shrink-0 mt-0.5" />
              <div>
                <p className="text-foreground-secondary font-bold text-sm uppercase tracking-wider">AWAY — Away Team</p>
                <p className="text-foreground-primary font-semibold">@manager</p>
                <p className="text-text-muted text-sm mt-1">You join the matchroom</p>
              </div>
            </div>
          </div>
        </details>
      </div>

      <div className="card p-5 opacity-20 animate-pulse">
        <details open className="group">
          <summary className="list-none lg:pointer-events-none flex items-center justify-between cursor-pointer">
            <h2 className="section-header">
              <BarChart3 className="w-5 h-5 text-gold" /> Win Probability
            </h2>
            <ChevronRight className="w-4 h-4 text-text-muted transition-transform group-open:rotate-90 lg:hidden shrink-0" />
          </summary>
          <div className="mt-4 lg:mt-0 space-y-3">
            <div className="flex justify-between text-sm font-semibold">
              <span className="text-feedback-success">45%</span>
              <span className="text-text-muted">20% Draw</span>
              <span className="text-accent">35%</span>
            </div>
            <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
              <div className="bg-feedback-success rounded-l-full" style={{ width: '45%' }} />
              <div className="bg-text-muted" style={{ width: '20%' }} />
              <div className="bg-accent rounded-r-full" style={{ width: '35%' }} />
            </div>
            <div className="flex justify-between text-xs text-text-muted">
              <span>Home Team</span>
              <span>Away Team</span>
            </div>
          </div>
        </details>
      </div>

      <div className="card p-5 opacity-20 animate-pulse">
        <details open className="group">
          <summary className="list-none lg:pointer-events-none flex items-center justify-between cursor-pointer">
            <h2 className="section-header">
              <Swords className="w-5 h-5 text-gold" /> Head to Head (Last 5)
            </h2>
            <ChevronRight className="w-4 h-4 text-text-muted transition-transform group-open:rotate-90 lg:hidden shrink-0" />
          </summary>
          <div className="mt-4 lg:mt-0 space-y-2">
            {['2–1', '0–0', '3–0', '1–2', '1–1'].map((score, i) => (
              <div key={i} className="flex items-center gap-2 p-3 rounded-lg bg-navy-border/30">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <Shield className="w-6 h-6 text-text-muted shrink-0" />
                  <span className="text-xs text-text-muted">Home Team</span>
                </div>
                <span className="font-bold text-foreground-primary tabular-nums text-sm px-2 shrink-0">{score}</span>
                <div className="flex items-center justify-end gap-1.5 flex-1 min-w-0">
                  <span className="text-xs text-text-muted text-right">Away Team</span>
                  <Shield className="w-6 h-6 text-text-muted shrink-0" />
                </div>
                <span className="text-xs font-black w-5 text-center shrink-0 text-green-400">W</span>
              </div>
            ))}
          </div>
        </details>
      </div>

      <div className="card p-5 opacity-20 animate-pulse">
        <details open className="group">
          <summary className="list-none lg:pointer-events-none flex items-center justify-between cursor-pointer">
            <h2 className="section-header">
              <Dna className="w-5 h-5 text-gold" /> Team DNA
            </h2>
            <ChevronRight className="w-4 h-4 text-text-muted transition-transform group-open:rotate-90 lg:hidden shrink-0" />
          </summary>
          <div className="mt-4 lg:mt-0 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Home Team</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border text-green-500 border-green-500/30 bg-green-500/10">
                  <Shield className="w-3.5 h-3.5" /> DNA Label
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border text-accent border-accent/30 bg-accent/10">
                  <Swords className="w-3.5 h-3.5" /> DNA Label
                </span>
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Away Team</p>
              <div className="flex flex-wrap gap-1.5">
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border text-green-500 border-green-500/30 bg-green-500/10">
                  <Shield className="w-3.5 h-3.5" /> DNA Label
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border text-accent border-accent/30 bg-accent/10">
                  <Swords className="w-3.5 h-3.5" /> DNA Label
                </span>
              </div>
            </div>
          </div>
        </details>
      </div>

      <div className="card p-5 opacity-20 animate-pulse">
        <details open className="group">
          <summary className="list-none lg:pointer-events-none flex items-center justify-between cursor-pointer">
            <h2 className="section-header">
              <TrendingUp className="w-5 h-5 text-gold" /> Recent Form (Last 6)
            </h2>
            <ChevronRight className="w-4 h-4 text-text-muted transition-transform group-open:rotate-90 lg:hidden shrink-0" />
          </summary>
          <div className="mt-4 lg:mt-0 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-text-muted truncate min-w-0">Home Team</span>
              <div className="flex gap-1">
                {['W', 'W', 'D', 'L', 'W', 'W'].map((r, i) => (
                  <span key={i} className="w-5 h-5 rounded text-[9px] font-black flex items-center justify-center bg-green-500/20 text-green-500">W</span>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm text-text-muted truncate min-w-0">Away Team</span>
              <div className="flex gap-1">
                {['L', 'W', 'L', 'D', 'L', 'W'].map((r, i) => (
                  <span key={i} className="w-5 h-5 rounded text-[9px] font-black flex items-center justify-center bg-red-500/20 text-red-500">L</span>
                ))}
              </div>
            </div>
          </div>
        </details>
      </div>

      {/* Score Submission card */}
      <div className="card p-5 opacity-20 animate-pulse">
        <h2 className="section-header">
          <CheckCircle className="w-5 h-5 text-gold" /> Score Submission
        </h2>
        <div className="space-y-2 mt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Home Team</span>
            <span className="text-foreground-muted">Pending</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-muted">Away Team</span>
            <span className="text-foreground-muted">Pending</span>
          </div>
        </div>
      </div>

      {/* Banter Board */}
      <div className="card p-5">
        <h2 className="section-header opacity-20 animate-pulse">
          <MessageSquare className="w-5 h-5 text-gold" /> Banter Board
          <span className="text-text-muted text-sm font-normal ml-auto">3 comments</span>
        </h2>
        <div className="mt-4 space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-3 opacity-20 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-navy-border flex items-center justify-center text-xs font-bold text-gold shrink-0">U</div>
              <div className="flex-1 p-3 rounded-lg bg-navy-border/40">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-gold">@user</span>
                  <span className="text-xs text-foreground-muted">15 Mar</span>
                </div>
                <p className="text-sm text-foreground-secondary">This is a ghost comment placeholder for the skeleton.</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Team profile skeleton ─────────────────────────────────────────────────

function TeamProfileSkeleton() {
  return (
    <div className="space-y-space-6 pt-space-4">
      {/* Hero */}
      <div className="card">
        <div className="bg-gradient-to-br from-bg-base via-accent/10 to-bg-surface h-20 sm:h-28 relative">
          <div className="absolute inset-0 bg-gradient-to-t from-bg-surface to-transparent" />
        </div>
        <div className="px-space-4 sm:px-space-6 pb-space-6 -mt-8 sm:-mt-10 relative">
          <div className="flex items-end gap-space-3 sm:gap-space-5">
            <div className="bg-bg-base rounded-lg overflow-hidden opacity-20 animate-pulse">
              <Shield className="w-20 h-20 sm:w-24 sm:h-24 text-text-muted" />
            </div>
            <div className="pb-1 flex-1 min-w-0 opacity-20 animate-pulse">
              <h1 className="text-xl sm:text-2xl font-black text-text-primary truncate">Team Name Here</h1>
              <div className="flex items-center gap-space-3 flex-wrap mt-0.5">
                <p className="text-text-muted text-sm">
                  Manager: <span className="text-accent font-semibold">@manager</span>
                </p>
              </div>
            </div>
          </div>

          {/* Playstyle section (ghost) */}
          <div className="mt-space-6 space-y-space-6 opacity-20 animate-pulse">
            <h2 className="section-header">Playstyle</h2>
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-full border text-green-500 border-green-500/30 bg-green-500/10">
              <Shield className="w-4 h-4" /> Playstyle Label <span className="font-mono font-bold ml-1 text-accent">++</span>
            </span>
            <div className="flex items-center gap-3 bg-bg-elevated border border-border rounded-xl px-4 py-3">
              <span className="font-mono font-bold text-lg text-accent">++</span>
              <div>
                <p className="text-text-primary text-sm font-semibold">Advanced</p>
                <p className="text-text-muted text-xs mt-0.5">Description of the level</p>
              </div>
            </div>
            <div className="card p-space-5">
              <p className="text-text-secondary text-sm leading-relaxed">About text describing the playstyle tendencies for this team.</p>
            </div>
            <div className="card p-space-5 space-y-space-3">
              <h3 className="font-semibold text-text-primary text-sm">What to Expect</h3>
              <ul className="space-y-1.5">
                {['Tendency one about playstyle', 'Tendency two about tactics', 'Tendency three about approach'].map((t, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="text-blue-400 shrink-0 mt-0.5">›</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card p-space-5 space-y-space-3">
              <h3 className="font-semibold text-sm text-red-400">How to Exploit Their Weaknesses</h3>
              <ul className="space-y-1.5">
                {['Weakness in defense', 'Weakness in possession', 'Weakness under pressure'].map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                    <span className="text-red-400 shrink-0 mt-0.5">⚡</span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Manager Observations */}
      <div className="card p-space-5 opacity-20 animate-pulse">
        <h2 className="section-header mb-space-3">
          <span className="text-accent">📋</span> Manager Observations
        </h2>
        <div className="space-y-space-2">
          {['Positive observation about form', 'Neutral observation about tactics', 'Negative observation about defense'].map((note, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${i === 0 ? 'bg-feedback-success' : i === 2 ? 'bg-feedback-error' : 'bg-text-muted'}`} />
              <p className="text-text-secondary">{note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Upcoming Fixtures */}
      <div className="card p-space-5 opacity-20 animate-pulse">
        <div className="flex items-center justify-between mb-space-4">
          <h2 className="section-header mb-0">
            <span className="text-accent">📅</span> Upcoming Fixtures
          </h2>
          <span className="text-xs text-accent">All fixtures →</span>
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-space-3 py-space-3 min-h-[52px]">
              <Shield className="w-8 h-8 shrink-0 text-text-muted" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">
                  <span className="text-text-muted font-normal">vs</span> Opponent Name
                </p>
                <p className="text-xs text-text-muted truncate">Tournament Name</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium text-text-primary">Sat 15 Mar</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Results */}
      <div className="card p-space-5 opacity-20 animate-pulse">
        <div className="flex items-center justify-between mb-space-4">
          <h2 className="section-header mb-0">
            <span className="text-accent">🏁</span> Recent Results
          </h2>
          <span className="text-xs text-accent">All results →</span>
        </div>
        <div className="divide-y divide-border">
          {[['W'], ['D'], ['L']].map(([outcome], i) => (
            <div key={i} className="flex items-center gap-space-3 py-space-3 min-h-[52px]">
              <span className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black shrink-0 ${
                outcome === 'W' ? 'bg-feedback-success/20 text-feedback-success' : outcome === 'D' ? 'bg-feedback-warning/20 text-feedback-warning' : 'bg-feedback-error/20 text-feedback-error'
              }`}>{outcome}</span>
              <Shield className="w-7 h-7 shrink-0 text-text-muted" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">
                  <span className="text-text-muted font-normal">vs</span> Opponent Name
                </p>
                <p className="text-xs text-text-muted truncate">Tournament Name</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-base sm:text-sm font-black tabular-nums text-feedback-success">2–1</p>
                <p className="text-[10px] text-text-muted">Sat 15 Mar</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Season Stats */}
      <div className="card p-space-5 opacity-20 animate-pulse">
        <h2 className="section-header">
          <span className="text-accent">📊</span> Season Statistics
          <span className="ml-2 text-xs font-normal text-text-muted normal-case tracking-normal">Premier League</span>
        </h2>
        {/* Mobile */}
        <div className="sm:hidden -mx-space-5 overflow-x-auto snap-x snap-mandatory scrollbar-none">
          <div className="flex gap-space-3 px-space-5 w-max">
            {[['P', '10'], ['W', '5'], ['D', '3'], ['L', '2'], ['GF', '18'], ['GA', '10'], ['GD', '+8'], ['PTS', '18']].map(([label, value]) => (
              <div key={label} className="snap-start shrink-0 w-[90px] text-center p-space-3 rounded-lg bg-border-subtle/30">
                <p className="text-xl font-black text-text-primary">{value}</p>
                <p className="text-xs text-text-muted font-medium mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>
        {/* Desktop */}
        <div className="hidden sm:grid grid-cols-8 gap-space-3">
          {[['P', '10'], ['W', '5'], ['D', '3'], ['L', '2'], ['GF', '18'], ['GA', '10'], ['GD', '+8'], ['PTS', '18']].map(([label, value]) => (
            <div key={label} className="text-center p-space-3 rounded-lg bg-border-subtle/30">
              <p className="text-xl font-black text-text-primary">{value}</p>
              <p className="text-xs text-text-muted font-medium mt-0.5">{label}</p>
            </div>
          ))}
        </div>
        <div className="mt-space-4 flex flex-wrap gap-space-4 text-sm">
          <div className="flex items-center gap-space-2">
            <span className="text-text-muted">Clean Sheets:</span>
            <span className="font-bold text-text-primary">3</span>
          </div>
          <div className="flex items-center gap-space-2">
            <span className="text-text-muted">Biggest Win:</span>
            <span className="font-bold text-feedback-success">5–0</span>
          </div>
        </div>
      </div>

      {/* Recent Form */}
      <div className="card p-space-5 opacity-20 animate-pulse">
        <h2 className="section-header">
          <span className="text-accent">📈</span> Recent Form
        </h2>
        <div className="flex items-center gap-space-4">
          <span className="text-sm text-text-muted">Last 6</span>
          <div className="flex gap-1">
            {['W', 'W', 'D', 'L', 'W', 'W'].map((r, i) => (
              <span key={i} className="w-6 h-6 rounded text-[11px] font-black flex items-center justify-center bg-green-500/20 text-green-500">{r}</span>
            ))}
          </div>
        </div>
      </div>

      {/* Trophy Cabinet */}
      <div className="card p-space-5 opacity-20 animate-pulse">
        <h2 className="section-header">
          <span className="text-accent">🏆</span> Trophy Cabinet
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-3">
          {[['League Champion', 'Season 2024/25'], ['UCL Winner', 'Season 2024/25']].map(([title, season]) => (
            <div key={title} className="flex items-center gap-space-3 p-space-3 rounded-lg border border-accent/20 bg-accent-muted/10">
              <Trophy className="w-8 h-8 text-accent" />
              <div>
                <p className="text-sm font-bold text-accent">{title}</p>
                <p className="text-xs text-text-muted">{season}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Season History */}
      <div className="card p-space-5 opacity-20 animate-pulse">
        <h2 className="section-header">
          <span className="text-accent">📋</span> Season History
        </h2>
        <div className="space-y-space-3">
          {[['Premier League', 'Current'], ['UCL', 'Completed']].map(([tName, status]) => (
            <div key={tName} className="p-space-3 rounded-lg bg-border-subtle/30">
              <div className="flex items-center justify-between mb-space-2">
                <p className="text-xs font-semibold text-accent uppercase tracking-wider">{tName}</p>
                <span className={`text-[10px] font-bold px-space-2 py-0.5 rounded-full ${
                  status === 'Current' ? 'bg-feedback-success/20 text-feedback-success' : 'bg-text-muted/20 text-text-muted'
                }`}>{status}</span>
              </div>
              <div className="grid grid-cols-7 gap-space-2 text-center text-xs">
                {[['P', '10'], ['W', '5'], ['D', '3'], ['L', '2'], ['GF', '18'], ['GA', '10'], ['PTS', '18']].map(([label, val]) => (
                  <div key={label}>
                    <p className="font-bold text-text-primary">{val}</p>
                    <p className="text-text-muted">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Manager History */}
      <div className="card p-space-5 opacity-20 animate-pulse">
        <h2 className="section-header">
          <span className="text-accent">👔</span> Manager History
        </h2>
        <div className="space-y-space-3">
          {[true, false].map((isCurrent, i) => (
            <div key={i} className={`rounded-xl border p-space-4 ${isCurrent ? 'border-accent/30 bg-accent-muted/20' : 'border-border bg-bg-base/20'}`}>
              <div className="flex items-center gap-space-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${isCurrent ? 'bg-accent-muted text-accent' : 'bg-border text-text-muted'}`}>M</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-space-2 flex-wrap">
                    <p className="font-bold text-text-primary">@manager</p>
                    {isCurrent && <span className="text-xs bg-accent-muted text-accent border border-accent/30 px-1.5 py-0.5 rounded-full font-semibold">Current</span>}
                  </div>
                  <p className="text-xs text-text-muted mt-0.5">Jan 2025 → Present</p>
                </div>
                <div className="flex gap-space-4 shrink-0 text-center">
                  <div><p className="text-base font-black text-feedback-success">10</p><p className="text-[10px] text-text-muted font-medium">W</p></div>
                  <div><p className="text-base font-black text-feedback-warning">3</p><p className="text-[10px] text-text-muted font-medium">D</p></div>
                  <div><p className="text-base font-black text-feedback-error">2</p><p className="text-[10px] text-text-muted font-medium">L</p></div>
                  <div><p className="text-base font-black text-text-secondary">15</p><p className="text-[10px] text-text-muted font-medium">P</p></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* H2H */}
      <div className="card p-space-5 opacity-20 animate-pulse">
        <details>
          <summary className="section-header cursor-pointer list-none flex items-center justify-between">
            <span className="flex items-center gap-space-2"><span className="text-accent">⚔️</span> Head-to-Head Record</span>
            <span className="text-text-muted text-xs">3 opponents · Tap to expand</span>
          </summary>
          <div className="mt-space-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-text-muted uppercase tracking-wider border-b border-border">
                  <th className="pb-space-2 pr-space-3">Opponent</th>
                  <th className="pb-space-2 text-center pr-space-2">P</th>
                  <th className="pb-space-2 text-center pr-space-2">W</th>
                  <th className="pb-space-2 text-center pr-space-2">D</th>
                  <th className="pb-space-2 text-center pr-space-2">L</th>
                  <th className="pb-space-2 text-center">GF–GA</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {[['Opponent A', '3', '2', '1', '0', '5–2'], ['Opponent B', '2', '1', '0', '1', '3–3'], ['Opponent C', '1', '0', '1', '0', '1–1']].map(([name, p, w, d, l, gd]) => (
                  <tr key={name} className="text-text-secondary">
                    <td className="py-space-2 pr-space-3 font-medium">
                      <span className="hover:text-accent transition-colors">{name}</span>
                    </td>
                    <td className="py-space-2 text-center">{p}</td>
                    <td className="py-space-2 text-center text-feedback-success font-semibold">{w}</td>
                    <td className="py-space-2 text-center text-feedback-warning font-semibold">{d}</td>
                    <td className="py-space-2 text-center text-feedback-error font-semibold">{l}</td>
                    <td className="py-space-2 text-center text-text-muted">{gd}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </div>
  )
}

// ── Results list skeleton ─────────────────────────────────────────────────

function ResultsListSkeleton({ count = 3 }: { count?: number }) {
  const accentColors = ['border-l-green-500/40', 'border-l-slate-500/20', 'border-l-red-500/40']
  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-center gap-2 mb-2.5 px-1 opacity-20 animate-pulse">
          <div className="w-1 h-4 rounded-full bg-accent" />
          <h2 className="text-xs font-black uppercase tracking-widest text-text-muted">March 2026</h2>
          <span className="text-[10px] text-text-muted">({count})</span>
        </div>
        <div className="space-y-2">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className={`card flex items-center gap-3 border-l-4 ${accentColors[i % accentColors.length]} opacity-20 animate-pulse`}>
              <Shield className="w-10 h-10 shrink-0 text-text-muted" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded border bg-accent/10 text-accent border-accent/25">PL</span>
                  <span className="text-[10px] text-text-muted font-semibold">MD3</span>
                </div>
                <p className="text-sm font-semibold text-foreground-primary truncate">Opponent Team Name</p>
                <p className="text-[10px] text-text-muted mt-0.5">Sat, 15 Mar 2026 · 20:45</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-xl font-black text-foreground-primary tabular-nums leading-none">2–1</span>
                <span className="text-[10px] font-black px-1.5 py-0.5 rounded border bg-green-500/15 text-green-500 border-green-500/30">W</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Poll card skeleton ────────────────────────────────────────────────────

function PollCardSkeleton() {
  return (
    <div className="border rounded-lg transition-colors duration-base bg-bg-surface border-border p-space-4 sm:p-space-5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-space-3 opacity-20 animate-pulse">
        <div className="space-y-space-1.5 min-w-0 flex-1">
          <div className="flex items-center gap-space-3">
            <h3 className="font-semibold text-text-primary text-sm sm:text-base">Poll Question Title</h3>
            <span className="text-[10px] px-space-1.5 py-space-0.5 rounded-full border font-medium shrink-0 bg-feedback-success/10 border-feedback-success/30 text-feedback-success">Open</span>
          </div>
          <p className="text-xs text-text-muted">Description of the poll goes here as placeholder content.</p>
          <p className="text-[10px] text-text-muted">
            Share code: <code className="bg-bg-base px-space-1 rounded">ABC123</code> · Created 15/03/2026 · by admin
          </p>
        </div>
        <div className="flex items-center gap-space-2 shrink-0 self-stretch sm:self-auto">
          <div className="flex-1 sm:flex-initial text-xs sm:text-sm border border-border text-text-secondary rounded-lg px-4 py-2 font-semibold">Copy Link</div>
          <div className="flex-1 sm:flex-initial text-xs sm:text-sm bg-accent text-bg-surface rounded-lg px-4 py-2 font-semibold">Close</div>
        </div>
      </div>
      <div className="mt-space-4 border-t border-border pt-space-3">
        <div className="flex items-center gap-space-2 text-xs text-text-muted opacity-20 animate-pulse">
          <ChevronRight className="w-3 h-3" />
          Applications (3)
        </div>
      </div>
    </div>
  )
}

// ── Admin dashboard skeleton ──────────────────────────────────────────────

function AdminDashboardSkeleton() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="opacity-20 animate-pulse">
        <h1 className="text-xl font-bold text-foreground-primary">Admin Dashboard</h1>
        <p className="text-xs text-text-muted mt-0.5">Saturday, 15 March 2026</p>
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 snap-x snap-mandatory opacity-20 animate-pulse">
        {['Submit Result', 'Fixtures', 'Seasons', 'Managers', 'Polls'].map((label) => (
          <div key={label} className="snap-start shrink-0 whitespace-nowrap text-xs font-semibold px-4 py-2.5 rounded-lg min-h-[44px] flex items-center justify-center border border-border text-text-secondary">
            {label}
          </div>
        ))}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {[
          { icon: AlertTriangle, label: 'Conflicts', count: 2, accent: 'border-l-4 border-l-red-500/40' },
          { icon: CalendarDays, label: 'Fixtures Due', count: 8, accent: '' },
          { icon: Hourglass, label: 'Pending', count: 3, accent: '' },
          { icon: RefreshCw, label: 'Requests', count: 1, accent: '' },
          { icon: Flag, label: 'Flagged', count: 2, accent: '' },
        ].map(({ icon: Icon, label, count, accent }) => (
          <div key={label} className={`card flex items-center gap-3 py-3 px-3 ${accent} opacity-20 animate-pulse`}>
            <Icon className="w-4 h-4 shrink-0 text-text-muted" />
            <div className="flex-1 min-w-0">
              <p className="text-lg font-black text-foreground-primary leading-none">{count}</p>
              <p className="text-[10px] uppercase tracking-widest text-text-muted font-semibold mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Conflict alert */}
      <div className="card border-l-4 border-l-red-500/40 opacity-20 animate-pulse">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="w-4 h-4 text-red-400" />
          <h2 className="text-sm font-bold text-foreground-primary flex-1">Result Conflicts</h2>
          <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5 font-semibold">2</span>
        </div>
        <div className="space-y-2">
          <div className="bg-navy-light rounded-lg border border-red-500/20 px-3 py-2.5">
            <div className="flex items-center justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400 shrink-0" />
                <span className="text-xs text-slate-400 font-semibold shrink-0">MD3</span>
                <span className="text-xs text-foreground-primary font-medium truncate">Home Team vs Away Team</span>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">2–1</span>
              <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">1–0</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section cards */}
      <div className="space-y-3">
        {/* Tournaments */}
        <details className="card p-0 overflow-hidden group opacity-20 animate-pulse" open>
          <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer list-none">
            <Trophy className="w-4 h-4 text-gold shrink-0" />
            <span className="text-sm font-bold text-foreground-primary flex-1">Tournaments</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">2</span>
            <ChevronRight className="w-4 h-4 text-text-muted transition-transform group-open:rotate-90" />
          </summary>
          <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
            {[['Premier League', 'PL', 'active'], ['UCL', 'UCL', 'active']].map(([name, type, status]) => (
              <div key={name} className="bg-navy-light rounded-lg border border-navy-border px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground-primary truncate">{name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded border text-blue-400 bg-blue-500/10 border-blue-500/20">{type}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded border text-green-400 bg-green-500/10 border-green-500/20">{status}</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-gold font-black text-lg">24</p>
                    <p className="text-[10px] text-text-muted">fixtures</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>

        {/* Fixtures Due */}
        <details className="card p-0 overflow-hidden group opacity-20 animate-pulse" open>
          <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer list-none">
            <CalendarDays className="w-4 h-4 text-gold shrink-0" />
            <span className="text-sm font-bold text-foreground-primary flex-1">Fixtures Due</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">2</span>
            <ChevronRight className="w-4 h-4 text-text-muted transition-transform group-open:rotate-90" />
          </summary>
          <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="bg-navy-light rounded-lg border border-navy-border overflow-hidden">
                <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
                  <span className="text-slate-400 text-xs font-semibold">MD3</span>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-xs font-mono">20:45</span>
                    <span className="text-[10px] px-2 py-0.5 rounded border text-slate-400 bg-slate-500/10 border-slate-500/20">scheduled</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 px-3 pb-2.5 pt-1">
                  <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <Shield className="w-6 h-6 text-text-muted" />
                    <span className="text-xs font-semibold text-foreground-primary text-center leading-tight truncate max-w-full">Home Team</span>
                  </div>
                  <div className="shrink-0 px-1">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400/70">vs</span>
                  </div>
                  <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <Shield className="w-6 h-6 text-text-muted" />
                    <span className="text-xs font-semibold text-foreground-primary text-center leading-tight truncate max-w-full">Away Team</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>

        {/* Pending Confirmations */}
        <details className="card p-0 overflow-hidden group opacity-20 animate-pulse">
          <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer list-none">
            <Hourglass className="w-4 h-4 text-yellow-400 shrink-0" />
            <span className="text-sm font-bold text-foreground-primary flex-1">Pending Confirmations</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">1</span>
            <ChevronRight className="w-4 h-4 text-text-muted transition-transform group-open:rotate-90" />
          </summary>
          <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
            <div className="flex items-center justify-between gap-2 bg-navy-light rounded-lg border border-navy-border px-3 py-2.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Shield className="w-4 h-4 text-text-muted shrink-0" />
                  <span className="text-sm font-medium text-foreground-primary truncate">Home Team</span>
                  <span className="text-[10px] text-text-muted">vs</span>
                  <span className="text-sm font-medium text-foreground-primary truncate">Away Team</span>
                  <Shield className="w-4 h-4 text-text-muted shrink-0" />
                </div>
                <p className="text-[10px] text-text-muted mt-0.5">MD3 · 15/03/2026</p>
              </div>
            </div>
          </div>
        </details>

        {/* Team Change Requests */}
        <details className="card p-0 overflow-hidden group opacity-20 animate-pulse">
          <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer list-none">
            <RefreshCw className="w-4 h-4 text-blue-400 shrink-0" />
            <span className="text-sm font-bold text-foreground-primary flex-1">Team Change Requests</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">1</span>
            <ChevronRight className="w-4 h-4 text-text-muted transition-transform group-open:rotate-90" />
          </summary>
          <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
            <div className="bg-navy-light rounded-lg border border-navy-border px-3 py-2.5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-full bg-navy-border flex items-center justify-center text-[10px] text-text-muted shrink-0">U</div>
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium text-foreground-primary">username</span>
                  <div className="flex items-center gap-1 text-[10px] text-text-muted mt-0.5">
                    <span>Current Team</span>
                    <span>→</span>
                    <span className="text-accent font-semibold">Requested Team</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </details>

        {/* Flagged Teams */}
        <details className="card p-0 overflow-hidden group opacity-20 animate-pulse">
          <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer list-none">
            <Flag className="w-4 h-4 text-red-400 shrink-0" />
            <span className="text-sm font-bold text-foreground-primary flex-1">Flagged Teams</span>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent/15 text-accent border border-accent/25">2</span>
            <ChevronRight className="w-4 h-4 text-text-muted transition-transform group-open:rotate-90" />
          </summary>
          <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 bg-navy-light rounded-lg border border-red-500/20 px-3 py-2.5">
                <Shield className="w-7 h-7 text-text-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground-primary truncate">Flagged Team Name</p>
                  <p className="text-[10px] text-text-muted">Manager: @manager</p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-red-400 font-black text-lg">{3 + i}</span>
                  <p className="text-[10px] text-text-muted">abandons</p>
                </div>
              </div>
            ))}
          </div>
        </details>

        {/* Audit Log */}
        <details className="card p-0 overflow-hidden group opacity-20 animate-pulse">
          <summary className="flex items-center gap-2 px-4 py-3.5 cursor-pointer list-none">
            <ClipboardList className="w-4 h-4 text-text-muted shrink-0" />
            <span className="text-sm font-bold text-foreground-primary flex-1">Recent Audit Log</span>
            <ChevronRight className="w-4 h-4 text-text-muted transition-transform group-open:rotate-90" />
          </summary>
          <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
            {[['Result submitted', 'on fixture'], ['Team changed', 'on team']].map(([action, target]) => (
              <div key={action} className="flex items-start gap-2.5 text-xs py-2 border-b border-border last:border-0">
                <div className="w-1.5 h-1.5 rounded-full bg-accent mt-1.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-foreground-primary font-medium">{action}</span>
                  <span className="text-text-muted ml-1">{target}</span>
                  <div className="text-text-muted mt-0.5">
                    @admin · 15 Mar, 20:45
                  </div>
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  )
}

// ── Profile page skeleton ─────────────────────────────────────────────────

function ProfilePageSkeleton() {
  return (
    <div className="space-y-space-8 max-w-3xl mx-auto">
      {/* Profile Card */}
      <div className="card p-space-6 flex flex-col sm:flex-row items-center sm:items-start gap-space-6 opacity-20 animate-pulse">
        <div className="shrink-0">
          <div className="w-20 h-20 rounded-full bg-bg-surface0 flex items-center justify-center">
            <User className="w-10 h-10 text-text-muted" />
          </div>
        </div>
        <div className="flex-1 text-center sm:text-left space-y-space-2 min-w-0">
          <div className="flex items-center justify-center sm:justify-start gap-space-2 flex-wrap">
            <h1 className="text-2xl font-black text-text-primary">@username</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-accent/15 text-accent text-xs font-semibold tracking-wide">
              <Star className="w-3.5 h-3.5 fill-accent/30" /> Admin
            </span>
          </div>
          <div className="inline-flex items-center gap-space-2 text-text-secondary">
            <Shield className="w-6 h-6 text-text-muted" />
            <span className="text-sm font-semibold">Team Name</span>
            <span className="text-text-muted text-xs">→</span>
          </div>
          <p className="text-xs text-text-muted">user@example.com</p>
        </div>
        <div className="flex gap-space-4 sm:flex-col justify-center sm:justify-start pt-space-4 sm:pt-0">
          <div className="text-center sm:text-right">
            <p className="text-xl font-black text-text-primary">15</p>
            <p className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">Matches</p>
          </div>
          <div className="text-center sm:text-right">
            <p className="text-xl font-black text-accent">67%</p>
            <p className="text-[9px] text-text-muted uppercase font-bold tracking-tighter">Win Rate</p>
          </div>
        </div>
      </div>

      {/* Management History */}
      <div className="card p-space-5 space-y-space-4 opacity-20 animate-pulse">
        <h2 className="section-header">
          <Shirt className="w-5 h-5 text-gold" /> Management History
        </h2>
        <div className="space-y-space-3">
          {[true, false].map((isCurrent, i) => (
            <div key={i} className={`p-space-4 rounded-xl border flex items-center gap-space-4 ${isCurrent ? 'bg-accent/5 border-accent/20' : 'bg-bg-elevated border-border'}`}>
              <div className="w-10 h-10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-bold text-text-primary truncate block text-sm">Team Name</span>
                <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Jan 2025 — Present</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-text-primary">15 <span className="text-[9px] text-text-muted font-bold">P</span></p>
                <p className="text-xs font-black text-accent">67% <span className="text-[9px] text-text-muted font-bold">WR</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Team Change Request */}
      <div className="card p-space-5 space-y-space-3 opacity-20 animate-pulse">
        <h2 className="section-header">
          <RefreshCw className="w-5 h-5 text-gold" /> Team Management
        </h2>
        <div className="flex items-center justify-between">
          <span className="text-sm text-text-muted">Team change options</span>
          <span className="border border-border text-text-secondary rounded-lg px-4 py-2 text-xs font-semibold">Request Change</span>
        </div>
      </div>

      {/* Upcoming Fixtures */}
      <div className="card p-space-5 space-y-space-4 opacity-20 animate-pulse">
        <h2 className="section-header">
          <CalendarDays className="w-5 h-5 text-gold" /> Upcoming Fixtures
        </h2>
        <div className="space-y-space-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-space-4 p-space-4 rounded-xl border border-border">
              <Shield className="w-10 h-10 text-text-muted shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-text-primary truncate">
                  vs <span>Opponent Name</span>
                </p>
                <p className="text-xs text-text-muted mt-space-0.5">Tournament · Sat 15 Mar</p>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs text-text-muted">in <span className="font-bold text-text-primary">3d</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Theme Settings placeholder */}
      <div className="card p-space-5 space-y-space-4 opacity-20 animate-pulse">
        <h2 className="section-header">
          <Star className="w-5 h-5 text-gold" /> Theme Settings
        </h2>
        <div className="flex gap-space-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-10 h-10 rounded-full bg-bg-surface0" />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Calendar skeleton ─────────────────────────────────────────────────────

function CalendarGridSkeleton() {
  return (
    <div className="space-y-2 opacity-20 animate-pulse">
      <div className="grid grid-cols-7 gap-1">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <div key={d} className="text-center text-[10px] font-bold uppercase tracking-wider text-text-muted py-1">{d}</div>
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, row) => (
        <div key={row} className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, col) => (
            <div key={col} className="aspect-square rounded-lg bg-border-subtle/30 p-1">
              <p className="text-xs font-semibold text-text-muted">{row * 7 + col + 1}</p>
              <div className="w-full h-1 rounded-full bg-accent/20 mt-1" />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Home page skeleton ────────────────────────────────────────────────────

function HomePageSkeleton() {
  return (
    <div>
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-bg-surface to-bg-base border border-border p-space-4 sm:p-space-6 mb-space-4 sm:mb-space-6 shadow-sm opacity-20 animate-pulse">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-accent),transparent_70%)] opacity-5" />
        <div className="relative">
          <div className="flex items-center gap-space-2 sm:gap-space-3 mb-space-1 sm:mb-space-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded bg-bg-surface0" />
            <div>
              <h1 className="text-base sm:text-xl font-bold text-text-primary">Efootball Federal Association</h1>
              <p className="text-[11px] sm:text-xs text-accent">Season 2025/26 — Live</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-space-2 mt-space-3 sm:mt-space-4">
            <div className="text-xs px-space-3 sm:px-space-4 min-h-[36px] sm:min-h-0 border border-border text-text-secondary rounded-lg flex items-center font-semibold">View Standings</div>
            <div className="text-xs px-space-3 sm:px-space-4 min-h-[36px] sm:min-h-0 border border-border text-text-secondary rounded-lg flex items-center font-semibold">Fixtures</div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-space-6">
        {/* Left column */}
        <div className="lg:col-span-2 space-y-space-6">
          {/* Upcoming Fixtures */}
          <div className="card p-space-3 sm:p-space-4 opacity-20 animate-pulse">
            <div className="flex items-center justify-between mb-space-2 sm:mb-space-3">
              <div>
                <h2 className="section-header mb-0">Upcoming Fixtures</h2>
                <p className="text-[11px] sm:text-xs text-accent mt-0.5">Saturday, 15 March 2026 · Team Name</p>
              </div>
              <span className="text-xs text-accent font-medium">View all →</span>
            </div>
            <div className="divide-y divide-border">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center py-space-2 sm:py-space-3 gap-space-1 sm:gap-space-3">
                  <div className="flex-1 flex items-center gap-space-1 sm:gap-space-2">
                    <Shield className="w-5 h-5 sm:w-7 sm:h-7 shrink-0 text-text-muted" />
                    <span className="text-xs sm:text-sm font-medium text-text-primary truncate">Home Team</span>
                  </div>
                  <div className="text-center min-w-[36px] sm:min-w-[60px]">
                    <span className="text-[11px] sm:text-xs text-accent font-medium">vs</span>
                    <div className="text-[9px] sm:text-[10px] mt-0.5 text-text-muted">Scheduled</div>
                  </div>
                  <div className="flex-1 flex items-center justify-end gap-space-1 sm:gap-space-2">
                    <span className="text-xs sm:text-sm font-medium text-text-primary truncate text-right">Away Team</span>
                    <Shield className="w-5 h-5 sm:w-7 sm:h-7 shrink-0 text-text-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Latest Results */}
          <div className="card p-space-3 sm:p-space-4 opacity-20 animate-pulse">
            <div className="flex items-center justify-between mb-space-2 sm:mb-space-3">
              <h2 className="section-header mb-0">Latest Results</h2>
              <span className="text-xs text-accent font-medium">View all →</span>
            </div>
            <div className="space-y-space-1 sm:space-y-space-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between py-space-1.5 sm:py-space-2 px-space-2 sm:px-space-3 rounded-lg border border-transparent hover:border-border">
                  <div className="flex items-center gap-space-1 sm:gap-space-2 flex-1">
                    <Shield className="w-4 h-4 sm:w-6 sm:h-6 shrink-0 text-text-muted" />
                    <span className="text-xs sm:text-sm text-text-primary font-medium truncate">Home Team</span>
                  </div>
                  <div className="mx-space-1 sm:mx-space-3 text-center">
                    <span className="text-text-primary font-bold text-xs sm:text-sm">2–1</span>
                  </div>
                  <div className="flex items-center gap-space-1 sm:gap-space-2 flex-1 justify-end">
                    <span className="text-xs sm:text-sm text-text-primary font-medium truncate text-right">Away Team</span>
                    <Shield className="w-4 h-4 sm:w-6 sm:h-6 shrink-0 text-text-muted" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-space-6">
          {/* Mini Standings */}
          <div className="card p-space-4 opacity-20 animate-pulse">
            <div className="flex items-center justify-between mb-space-3">
              <h2 className="section-header mb-0"><span className="text-accent">PL</span> Top 6</h2>
              <span className="text-xs text-accent font-medium">Full table →</span>
            </div>
            <div className="space-y-space-1">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="flex items-center gap-space-2 py-space-1 rounded-lg px-space-1">
                  <span className={`w-5 text-center text-xs font-bold ${i < 4 ? 'text-accent' : 'text-text-muted'}`}>{i + 1}</span>
                  <Shield className="w-5 h-5 shrink-0 text-text-muted" />
                  <span className="flex-1 text-xs text-text-primary truncate font-medium">Team Name</span>
                  <span className="text-xs font-bold text-text-primary w-5 text-right">{20 - i * 2}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Unbeaten Runs */}
          <div className="card p-space-4 opacity-20 animate-pulse">
            <h2 className="section-header">Unbeaten Runs</h2>
            <div className="space-y-space-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="flex items-center gap-space-2">
                  <Shield className="w-6 h-6 text-text-muted" />
                  <span className="flex-1 text-sm text-text-primary truncate">Team Name</span>
                  <span className="text-xs bg-feedback-success/20 text-feedback-success px-space-2 py-0.5 rounded font-bold">{5 + i} unbeaten</span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Links */}
          <div className="card p-space-4 opacity-20 animate-pulse">
            <h2 className="section-header">Quick Links</h2>
            <div className="grid grid-cols-2 gap-space-2">
              {[
                { icon: Trophy, label: 'Hall of Fame' },
                { icon: ClipboardList, label: 'Rules' },
                { icon: CalendarDays, label: 'Calendar' },
                { icon: Vote, label: 'Polls' },
              ].map(({ icon: Icon, label }) => (
                <div key={label} className="flex flex-col items-center gap-space-1.5 p-space-3 rounded-lg bg-bg-elevated border border-border">
                  <Icon className="w-6 h-6 text-accent" />
                  <span className="text-xs text-text-secondary font-medium">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export {
  Skeleton,
  SkeletonText,
  SkeletonCircle,
  StandingsTableSkeleton,
  TournamentSelectorSkeleton,
  FixtureCardSkeleton,
  FixtureListSkeleton,
  FixtureDetailSkeleton,
  TeamProfileSkeleton,
  PollCardSkeleton,
  AdminDashboardSkeleton,
  ResultsListSkeleton,
  ProfilePageSkeleton,
  CalendarGridSkeleton,
  HomePageSkeleton,
}
