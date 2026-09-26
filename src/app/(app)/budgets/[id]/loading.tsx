import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardHeader, CardContent } from '@/components/ui/card';

export default function BudgetDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Back button */}
      <Skeleton className="h-4 w-32" />

      {/* Header card skeleton */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-2xl" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-36" />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      </div>

      {/* KPI Cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="p-4 space-y-2.5 border-slate-200 shadow-none">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-36" />
            <Skeleton className="h-3 w-28" />
          </Card>
        ))}
      </div>

      {/* Chart Skeleton */}
      <Card className="border-slate-200 shadow-none">
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3 w-64" />
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center p-6">
          <Skeleton className="h-full w-full rounded-xl" />
        </CardContent>
      </Card>

      {/* Ledger Skeleton */}
      <Card className="border-slate-200 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-4 w-28" />
        </CardHeader>
        <CardContent className="space-y-3 p-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-12 w-full rounded-xl" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
