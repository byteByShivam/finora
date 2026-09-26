import { Skeleton } from '@/components/ui/skeleton';

export default function GoalDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Top Header Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-9 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-28 rounded-xl" />
          <Skeleton className="h-9 w-20 rounded-xl" />
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>

      {/* Milestone Progress Bar */}
      <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-3">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-full rounded-full" />
      </div>

      {/* Projections & Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="p-5 rounded-xl border border-slate-200 bg-white space-y-4">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>

        <div className="lg:col-span-2 p-5 rounded-xl border border-slate-200 bg-white space-y-4">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-56 w-full rounded-xl" />
        </div>
      </div>

      {/* Contribution Table */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
        <Skeleton className="h-5 w-40" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
