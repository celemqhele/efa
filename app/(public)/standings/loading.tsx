import { StandingsTableSkeleton, TournamentSelectorSkeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div>
        <div className="h-8 w-40 bg-bg-surface0 animate-pulse rounded" />
      </div>
      <TournamentSelectorSkeleton />
      <StandingsTableSkeleton />
    </div>
  )
}
