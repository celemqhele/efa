import type { CSSProperties } from 'react'

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

// ── Preset layout skeletons ────────────────────────────────────────────────

function StandingsTableSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-bg-surface">
      {/* Header row */}
      <div className="grid grid-cols-[18px_1fr_18px_18px_18px_18px_22px_24px] sm:grid-cols-[34px_1fr_32px_32px_32px_32px_32px_42px_44px] items-center gap-0.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 border-b border-border-subtle">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-full" />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className={`grid grid-cols-[18px_1fr_18px_18px_18px_18px_22px_24px] sm:grid-cols-[34px_1fr_32px_32px_32px_32px_32px_42px_44px] items-center gap-0.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2.5 ${i % 2 === 0 ? 'bg-bg-base' : 'bg-bg-surface'}`}
        >
          <Skeleton className="h-3 w-3 mx-auto" />
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            <SkeletonCircle size={16} />
            <Skeleton className="h-3 w-20 sm:w-32" />
          </div>
          {Array.from({ length: 6 }).map((_, j) => (
            <Skeleton key={j} className="h-3 w-3 mx-auto" />
          ))}
          <Skeleton className="h-3 w-4 mx-auto" />
        </div>
      ))}
    </div>
  )
}

function TournamentSelectorSkeleton() {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Skeleton key={i} className="h-11 sm:h-9 w-20 rounded-lg" />
      ))}
    </div>
  )
}

// ── Fixture page skeleton ──────────────────────────────────────────────────

function FixtureCardSkeleton() {
  return (
    <div className="card flex flex-col gap-2.5">
      {/* Top: tournament badge + status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Skeleton className="h-[18px] w-[26px] rounded border" />
          <Skeleton className="h-[14px] w-[28px] rounded" />
        </div>
        <Skeleton className="h-[18px] w-[60px] rounded border" />
      </div>
      {/* Middle: teams */}
      <div className="flex items-center gap-3">
        <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="h-[14px] w-[72px] rounded" />
        </div>
        <div className="shrink-0 flex flex-col items-center gap-1">
          <Skeleton className="h-[10px] w-[18px]" />
          <Skeleton className="h-[18px] w-[32px]" />
        </div>
        <div className="flex-1 flex flex-col items-center gap-1 min-w-0">
          <Skeleton className="w-12 h-12 rounded-full" />
          <Skeleton className="h-[14px] w-[72px] rounded" />
        </div>
      </div>
      {/* Bottom: result badge + chevron */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-[18px] w-[22px] rounded border" />
        <Skeleton className="w-4 h-4" />
      </div>
    </div>
  )
}

function FixtureListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-5">
      {[Math.min(count, 3), Math.max(count - 3, 1)].filter(Boolean).map((groupCount, gi) => (
        <section key={gi}>
          <div className="flex items-center gap-2 mb-2.5 px-1">
            <Skeleton className="w-1 h-4 rounded-full" />
            <Skeleton className="h-[12px] w-[72px]" />
            <Skeleton className="h-[10px] w-[24px]" />
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

// ── Fixture detail skeleton ────────────────────────────────────────────────

function FixtureDetailSkeleton() {
  return (
    <div className="space-y-4">
      {/* VS header */}
      <div className="flex items-center justify-center gap-4">
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="w-16 h-16 rounded-full" />
          <Skeleton className="h-[14px] w-[80px] rounded" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <Skeleton className="h-[10px] w-[18px]" />
          <Skeleton className="h-[28px] w-[48px]" />
        </div>
        <div className="flex flex-col items-center gap-2">
          <Skeleton className="w-16 h-16 rounded-full" />
          <Skeleton className="h-[14px] w-[80px] rounded" />
        </div>
      </div>
      {/* Cards */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3">
          <Skeleton className="h-[18px] w-[120px] rounded" />
          <Skeleton className="h-[12px] w-full" />
          <Skeleton className="h-[12px] w-3/4" />
          <Skeleton className="h-[12px] w-1/2" />
        </div>
      ))}
    </div>
  )
}

// ── Team profile skeleton ──────────────────────────────────────────────────

function TeamProfileSkeleton() {
  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="card p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-4">
        <Skeleton className="w-20 h-20 rounded-full" />
        <div className="flex-1 space-y-2 text-center sm:text-left">
          <Skeleton className="h-6 w-40 mx-auto sm:mx-0 rounded" />
          <Skeleton className="h-3 w-28 mx-auto sm:mx-0" />
          <Skeleton className="h-8 w-24 mx-auto sm:mx-0 rounded-lg" />
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3">
          <Skeleton className="h-[18px] w-[120px] rounded" />
          <Skeleton className="h-[12px] w-full" />
          <Skeleton className="h-[12px] w-3/4" />
        </div>
      ))}
    </div>
  )
}

// ── Poll card skeleton ─────────────────────────────────────────────────────

function PollCardSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <Skeleton className="h-[18px] w-3/4 rounded" />
      <Skeleton className="h-[12px] w-full" />
      <Skeleton className="h-[12px] w-1/2" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  )
}

// ── Admin dashboard skeleton ───────────────────────────────────────────────

function AdminDashboardSkeleton() {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="space-y-1">
        <Skeleton className="h-6 w-44" />
        <Skeleton className="h-3 w-56" />
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[44px] w-[100px] rounded-lg shrink-0" />
        ))}
      </div>

      {/* Stat cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="card flex items-center gap-3 py-3 px-3">
            <Skeleton className="w-4 h-4 shrink-0" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-5 w-8" />
              <Skeleton className="h-[10px] w-16" />
            </div>
          </div>
        ))}
      </div>

      {/* Conflict alert card */}
      <div className="card border-l-4 border-l-bg-surface0">
        <div className="flex items-center gap-2 mb-3">
          <Skeleton className="w-4 h-4" />
          <Skeleton className="h-[14px] w-[120px]" />
          <Skeleton className="h-[18px] w-[26px] rounded-full ml-auto" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-[72px] w-full rounded-lg" />
        </div>
      </div>

      {/* Section cards (details/summary) */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-0 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3.5 border-b border-border">
            <Skeleton className="w-4 h-4 shrink-0" />
            <Skeleton className="h-[14px] w-[120px]" />
            <Skeleton className="h-[16px] w-[28px] rounded-full ml-auto" />
            <Skeleton className="w-4 h-4" />
          </div>
          <div className="p-4 space-y-2">
            {Array.from({ length: 2 }).map((_, j) => (
              <Skeleton key={j} className="h-[72px] w-full rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Results page skeleton ──────────────────────────────────────────────────

function ResultsListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-5">
      <section>
        <div className="flex items-center gap-2 mb-2.5 px-1">
          <Skeleton className="w-1 h-4 rounded-full" />
          <Skeleton className="h-[12px] w-[80px]" />
          <Skeleton className="h-[10px] w-[24px]" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: count }).map((_, i) => (
            <div key={i} className="card flex items-center gap-3 border-l-4 border-l-bg-surface0">
              <Skeleton className="w-10 h-10 rounded-full shrink-0" />
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-[16px] w-[28px] rounded border" />
                  <Skeleton className="h-[12px] w-[24px]" />
                </div>
                <Skeleton className="h-[14px] w-[120px]" />
                <Skeleton className="h-[10px] w-[100px]" />
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <Skeleton className="h-5 w-10" />
                <Skeleton className="h-[16px] w-[20px] rounded border" />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

// ── Profile page skeleton ──────────────────────────────────────────────────

function ProfilePageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-4">
        <Skeleton className="w-20 h-20 rounded-full shrink-0" />
        <div className="flex-1 space-y-2 text-center sm:text-left">
          <Skeleton className="h-6 w-40 mx-auto sm:mx-0 rounded" />
          <Skeleton className="h-3 w-28 mx-auto sm:mx-0" />
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3">
          <Skeleton className="h-[18px] w-[120px] rounded" />
          <Skeleton className="h-[12px] w-full" />
          <Skeleton className="h-[12px] w-2/3" />
        </div>
      ))}
    </div>
  )
}

// ── Calendar skeleton ──────────────────────────────────────────────────────

function CalendarGridSkeleton() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full rounded" />
        ))}
      </div>
      {Array.from({ length: 5 }).map((_, row) => (
        <div key={row} className="grid grid-cols-7 gap-1">
          {Array.from({ length: 7 }).map((_, col) => (
            <Skeleton key={col} className="aspect-square rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Home page skeleton ─────────────────────────────────────────────────────

function HomePageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="card p-4 sm:p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>
      {/* Standings mini */}
      <div className="card p-4 space-y-3">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border-subtle last:border-0">
            <Skeleton className="h-4 w-4 rounded-full" />
            <Skeleton className="h-[14px] w-32" />
            <Skeleton className="h-[14px] w-8 ml-auto" />
          </div>
        ))}
      </div>
      {/* Fixtures mini */}
      <div className="card p-4 space-y-3">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0">
            <SkeletonCircle size={32} />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-[14px] w-36" />
              <Skeleton className="h-[12px] w-20" />
            </div>
            <Skeleton className="h-5 w-10 rounded" />
          </div>
        ))}
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
