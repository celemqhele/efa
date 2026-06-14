import { ResultsListSkeleton } from '@/components/ui/Skeleton'

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
      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card h-[68px] animate-pulse bg-bg-surface0" />
        ))}
      </div>
      <ResultsListSkeleton count={4} />
    </div>
  )
}
