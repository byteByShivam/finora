'use client';

import { useState, useTransition } from 'react';
import {
  Repeat,
  Plus,
  Play,
  Pause,
  Trash2,
  Calendar,
  Building,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { RecurringModal } from '@/components/recurring/recurring-modal';
import {
  toggleActiveRecurringAction,
  deleteRecurringAction,
  runCatchUpAction,
} from '@/app/actions/recurring.actions';
import { formatDate } from '@/lib/dates';
import { TxnType, RecurFrequency } from '@prisma/client';

interface RecurringItem {
  id: string;
  description: string | null;
  amount: any;
  type: TxnType;
  frequency: RecurFrequency;
  interval: number;
  startDate: Date;
  endDate: Date | null;
  nextRunAt: Date;
  lastRunAt: Date | null;
  isActive: boolean;
  account: { id: string; name: string };
  category: { id: string; name: string; color: string | null } | null;
  _count: { generatedTransactions: number };
}

interface RecurringViewProps {
  recurringList: RecurringItem[];
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: string }[];
  currency: string;
}

export function RecurringView({
  recurringList,
  accounts,
  categories,
  currency,
}: RecurringViewProps) {
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = (id: string, currentActive: boolean) => {
    setError(null);
    startTransition(async () => {
      const res = await toggleActiveRecurringAction(id, !currentActive);
      if (!res.success) setError(res.error);
    });
  };

  const handleDelete = (id: string, desc: string | null) => {
    setError(null);
    if (confirm(`Delete recurring schedule "${desc || 'Schedule'}"?`)) {
      startTransition(async () => {
        const res = await deleteRecurringAction(id);
        if (!res.success) setError(res.error);
      });
    }
  };

  const handleCatchUp = () => {
    setError(null);
    setFeedback(null);
    startTransition(async () => {
      const res = await runCatchUpAction();
      if (!res.success) {
        setError(res.error);
      } else {
        setFeedback(`Catch-up processed: generated ${res.data.generatedCount} transaction(s).`);
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Recurring Transactions</h1>
          <p className="text-xs text-slate-500 mt-1">
            Automate recurring expenses, rent, salaries, and subscriptions with catch-up generation
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button size="sm" variant="outline" onClick={handleCatchUp} isLoading={isPending}>
            <RefreshCw className="h-4 w-4 mr-1.5" />
            <span>Process Catch-Up</span>
          </Button>

          <Button size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            <span>New Schedule</span>
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-800 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {recurringList.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No recurring schedules"
          description="Create recurring templates for salary deposits or subscription debits to keep your ledger synchronized."
          actionLabel="Create Schedule"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {recurringList.map((r) => {
            const isIncome = r.type === TxnType.income;
            const amountNum = Number(r.amount);

            return (
              <Card
                key={r.id}
                className={`transition-all ${!r.isActive ? 'opacity-60 bg-slate-50/50' : 'hover:border-slate-300'}`}
              >
                <CardHeader className="flex flex-row items-start justify-between pb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-xl shrink-0 ${
                        isIncome ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                      }`}
                    >
                      <Repeat className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base truncate max-w-[170px]">
                        {r.description || 'Recurring Schedule'}
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={r.isActive ? 'success' : 'secondary'}
                          className="text-[10px] capitalize font-mono"
                        >
                          {r.isActive ? 'Active' : 'Paused'}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] capitalize font-mono">
                          {r.frequency}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggle(r.id, r.isActive)}
                      disabled={isPending}
                      className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                      title={r.isActive ? 'Pause schedule' : 'Resume schedule'}
                    >
                      {r.isActive ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(r.id, r.description)}
                      disabled={isPending}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete schedule"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3 pt-1">
                  <div>
                    <p className="text-[10px] uppercase font-sans text-slate-400">Scheduled Amount</p>
                    <p
                      className={`text-xl font-bold font-mono mt-0.5 ${
                        isIncome ? 'text-emerald-800' : 'text-rose-800'
                      }`}
                    >
                      {isIncome ? '+' : '-'}
                      {currency} {amountNum.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <div className="border-t border-slate-100 pt-2 space-y-1.5 text-xs text-slate-600">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Account:</span>
                      <span className="font-medium text-slate-800">{r.account.name}</span>
                    </div>

                    {r.category && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Category:</span>
                        <span className="font-medium text-slate-800">{r.category.name}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Next Due:</span>
                      <span className="font-semibold text-slate-900 font-mono">
                        {formatDate(r.nextRunAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>Generated occurrences:</span>
                      <span className="font-bold text-slate-600">
                        {r._count.generatedTransactions}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Creation Modal */}
      <RecurringModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        accounts={accounts}
        categories={categories}
        currency={currency}
      />
    </div>
  );
}
