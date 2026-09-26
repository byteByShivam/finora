'use client';

import { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function BudgetsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Budgets Error:', error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[50vh] p-4">
      <Card className="max-w-md w-full border-red-100 bg-white shadow-sm">
        <CardContent className="pt-6 pb-6 text-center space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-red-50 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              Unable to load budgets
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              An error occurred while calculating budget adherence and aggregations.
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            <Button
              onClick={() => reset()}
              variant="outline"
              className="gap-2 border-slate-200 hover:bg-slate-50 text-slate-700"
            >
              <RefreshCw className="w-4 h-4" />
              Try again
            </Button>
            <Button
              onClick={() => {
                window.location.href = '/budgets';
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              Reset view
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
