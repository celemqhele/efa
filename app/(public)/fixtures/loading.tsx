import { FixtureListSkeleton } from '@/components/ui/Skeleton'

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-bg-surface0 animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-5 w-32 bg-bg-surface0 animate-pulse rounded" />
          <div className="h-3 w-20 bg-bg-surface0 animate-pulse rounded" />
        </div>
      </div>
      <FixtureListSkeleton count={3} />
    </div>
  )
}
