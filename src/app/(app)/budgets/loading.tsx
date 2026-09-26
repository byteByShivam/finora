import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

export default function BudgetsLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-80 mt-1" />
        </div>
        <Skeleton className="h-9 w-32 rounded-xl" />
      </div>

      {/* Period Navigation Skeleton */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-white rounded-2xl border border-slate-200">
        <Skeleton className="h-8 w-36 rounded-xl" />
        <Skeleton className="h-8 w-44 rounded-lg" />
      </div>

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4 space-y-3 border-slate-200 shadow-none">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-7 w-7 rounded-lg" />
            </div>
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ))}
      </div>

      {/* Search & Tabs Skeleton */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <Skeleton className="h-9 w-72 rounded-lg" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-8 w-20 rounded-lg" />
          ))}
        </div>
      </div>

      {/* Budgets Grid Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <Card key={i} className="border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-5 w-32" />
              </div>
              <Skeleton className="h-6 w-16 rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-2 w-full rounded-full" />
            </div>
            <div className="pt-2 flex justify-between border-t border-slate-100">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-20" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
