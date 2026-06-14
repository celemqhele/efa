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
      {/* Header */}
      <div className="grid grid-cols-[18px_1fr_18px_18px_18px_18px_22px_24px] sm:grid-cols-[34px_1fr_32px_32px_32px_32px_32px_42px_44px] items-center gap-0.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 border-b border-border-subtle">
        {Array.from({ length: 9 }).map((_, i) => (
          <Skeleton key={i} className="h-2.5 w-full" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: 24 }).map((_, i) => (
        <div
          key={i}
          className={`grid grid-cols-[18px_1fr_18px_18px_18px_18px_22px_24px] sm:grid-cols-[34px_1fr_32px_32px_32px_32px_32px_42px_44px] items-center gap-0.5 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2.5 ${i % 2 === 0 ? 'bg-bg-base' : 'bg-bg-surface'}`}
        >
          <Skeleton className="h-3 w-3 mx-auto" />
          <div className="flex items-center gap-1 sm:gap-2">
            <SkeletonCircle size={16} />
            <SkeletonText className="h-3 w-24 sm:w-36" />
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

function FixtureCardSkeleton() {
  return (
    <div className="card flex items-center gap-3 px-4 py-3 min-h-[52px]">
      <Skeleton className="h-5 w-12 rounded" />
      <Skeleton className="h-3 w-6 shrink-0" />
      <SkeletonCircle size={32} />
      <div className="flex-1 space-y-1.5">
        <SkeletonText className="h-4 w-40" />
        <SkeletonText className="h-3 w-28" />
      </div>
      <Skeleton className="h-5 w-12 rounded" />
    </div>
  )
}

function FixtureListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-20" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <FixtureCardSkeleton key={i} />
        ))}
      </div>
    </div>
  )
}

function FixtureDetailSkeleton() {
  return (
    <div className="space-y-4">
      {/* VS header */}
      <div className="flex items-center justify-center gap-4 py-6">
        <div className="flex flex-col items-center gap-2">
          <SkeletonCircle size={64} />
          <SkeletonText className="h-4 w-24" />
        </div>
        <Skeleton className="h-8 w-16" />
        <div className="flex flex-col items-center gap-2">
          <SkeletonCircle size={64} />
          <SkeletonText className="h-4 w-24" />
        </div>
      </div>
      {/* Sections */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <SkeletonText className="h-3 w-full" />
          <SkeletonText className="h-3 w-3/4" />
          <SkeletonText className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

function TeamProfileSkeleton() {
  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="card p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-4">
        <SkeletonCircle size={80} />
        <div className="flex-1 space-y-2 text-center sm:text-left">
          <SkeletonText className="h-6 w-40 mx-auto sm:mx-0" />
          <SkeletonText className="h-3 w-28 mx-auto sm:mx-0" />
          <Skeleton className="h-8 w-24 mx-auto sm:mx-0 rounded-lg" />
        </div>
      </div>
      {/* Sections */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <SkeletonText className="h-3 w-full" />
          <SkeletonText className="h-3 w-3/4" />
          <SkeletonText className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

function PollCardSkeleton() {
  return (
    <div className="card p-4 space-y-3">
      <SkeletonText className="h-5 w-3/4" />
      <SkeletonText className="h-3 w-full" />
      <SkeletonText className="h-3 w-1/2" />
      <div className="flex gap-2 pt-2">
        <Skeleton className="h-8 w-20 rounded-lg" />
        <Skeleton className="h-8 w-20 rounded-lg" />
      </div>
    </div>
  )
}

function AdminDashboardSkeleton() {
  return (
    <div className="space-y-4">
      {/* Tournament cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="card p-4 space-y-3">
            <SkeletonText className="h-5 w-32" />
            <SkeletonText className="h-3 w-full" />
            <SkeletonText className="h-3 w-2/3" />
            <Skeleton className="h-8 w-full rounded-lg" />
          </div>
        ))}
      </div>
      {/* Fixtures due */}
      <div className="card p-4 space-y-3">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0">
            <SkeletonCircle size={24} />
            <div className="flex-1 space-y-1">
              <SkeletonText className="h-3 w-36" />
              <SkeletonText className="h-2.5 w-20" />
            </div>
            <Skeleton className="h-7 w-16 rounded" />
          </div>
        ))}
      </div>
    </div>
  )
}

function ResultsListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <FixtureCardSkeleton key={i} />
      ))}
    </div>
  )
}

function ProfilePageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="card p-4 sm:p-6 flex flex-col sm:flex-row items-center gap-4">
        <SkeletonCircle size={80} />
        <div className="flex-1 space-y-2 text-center sm:text-left">
          <SkeletonText className="h-6 w-40 mx-auto sm:mx-0" />
          <SkeletonText className="h-3 w-28 mx-auto sm:mx-0" />
        </div>
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3">
          <Skeleton className="h-5 w-32" />
          <SkeletonText className="h-3 w-full" />
          <SkeletonText className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  )
}

function CalendarGridSkeleton() {
  return (
    <div className="space-y-2">
      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full rounded" />
        ))}
      </div>
      {/* Month grid */}
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

function HomePageSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero card */}
      <div className="card p-4 sm:p-8 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-64" />
        <div className="flex gap-3">
          <Skeleton className="h-9 w-32 rounded-lg" />
          <Skeleton className="h-9 w-32 rounded-lg" />
        </div>
      </div>
      {/* Standings mini-table */}
      <div className="card p-4 space-y-3">
        <Skeleton className="h-5 w-28" />
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border-subtle last:border-0">
            <Skeleton className="h-4 w-4 rounded-full" />
            <SkeletonText className="h-3.5 w-32" />
            <Skeleton className="h-3.5 w-8 ml-auto" />
          </div>
        ))}
      </div>
      {/* Fixtures */}
      <div className="card p-4 space-y-3">
        <Skeleton className="h-5 w-24" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0">
            <SkeletonCircle size={32} />
            <div className="flex-1 space-y-1">
              <SkeletonText className="h-3.5 w-36" />
              <SkeletonText className="h-3 w-20" />
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
