'use client';

import { useEffect } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GoalsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Goals route error:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-6 space-y-4">
      <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center text-rose-600">
        <AlertCircle className="h-6 w-6" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-slate-900">Failed to load goals</h2>
        <p className="text-xs text-slate-500 max-w-sm">
          An error occurred while loading your financial goals and contribution ledger.
        </p>
      </div>
      <Button size="sm" onClick={() => reset()} className="text-xs">
        <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
        <span>Try Again</span>
      </Button>
    </div>
  );
}
