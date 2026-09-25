'use client';

import { useState, useTransition } from 'react';
import {
  Target,
  Plus,
  Coins,
  CheckCircle2,
  Calendar,
  Building,
  Trash2,
  Archive,
  AlertCircle,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { GoalModal } from '@/components/goals/goal-modal';
import { ContributeModal } from '@/components/goals/contribute-modal';
import { archiveGoalAction, deleteGoalAction } from '@/app/actions/goal.actions';
import { formatDate } from '@/lib/dates';
import { GoalStatus } from '@prisma/client';

interface GoalItem {
  id: string;
  name: string;
  targetAmountNum: number;
  currentAmountNum: number;
  percentage: number;
  remaining: number;
  targetDate: Date | null;
  color: string | null;
  icon: string | null;
  status: GoalStatus;
  account?: { id: string; name: string } | null;
}

interface GoalsViewProps {
  goals: GoalItem[];
  accounts: { id: string; name: string }[];
  transactions: { id: string; description: string | null; amount: number; occurredAt: Date }[];
  currency: string;
}

export function GoalsView({ goals, accounts, transactions, currency }: GoalsViewProps) {
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [contributeGoal, setContributeGoal] = useState<GoalItem | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleArchive = (id: string) => {
    setError(null);
    startTransition(async () => {
      const res = await archiveGoalAction(id);
      if (!res.success) setError(res.error);
    });
  };

  const handleDelete = (id: string, name: string) => {
    setError(null);
    if (confirm(`Are you sure you want to delete goal "${name}"?`)) {
      startTransition(async () => {
        const res = await deleteGoalAction(id);
        if (!res.success) setError(res.error);
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financial Savings Goals</h1>
          <p className="text-xs text-slate-500 mt-1">
            Target milestones backed by verified transactions from your ledger
          </p>
        </div>

        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          <span>New Goal</span>
        </Button>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-4 text-xs text-rose-800 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No goals set"
          description="Define emergency funds, vacation milestones, or asset purchases to track your savings progress."
          actionLabel="Create Goal"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {goals.map((g) => {
            const isAchieved = g.status === GoalStatus.achieved;

            return (
              <Card
                key={g.id}
                className={`relative overflow-hidden transition-all ${
                  isAchieved ? 'border-emerald-300 bg-emerald-50/15' : 'hover:border-slate-300'
                }`}
              >
                {/* Accent line */}
                <div
                  className="h-1.5 w-full"
                  style={{ backgroundColor: g.color || '#10b981' }}
                />

                <CardHeader className="flex flex-row items-start justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: g.color || '#10b981' }}
                    >
                      <Target className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-base truncate max-w-[170px]">{g.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge
                          variant={isAchieved ? 'success' : 'outline'}
                          className="text-[10px] capitalize font-mono"
                        >
                          {g.status}
                        </Badge>
                        {g.account && (
                          <span className="text-[10px] text-slate-500 flex items-center gap-1">
                            <Building className="h-3 w-3" />
                            {g.account.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {g.status !== GoalStatus.archived && (
                      <button
                        type="button"
                        onClick={() => handleArchive(g.id)}
                        disabled={isPending}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        title="Archive goal"
                      >
                        <Archive className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(g.id, g.name)}
                      disabled={isPending}
                      className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete goal"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-2">
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-500 font-medium">Progress</span>
                      <span className="font-mono font-bold text-emerald-800">{g.percentage}%</span>
                    </div>

                    <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{ width: `${g.percentage}%` }}
                      />
                    </div>
                  </div>

                  <div className="border-t border-slate-100 pt-3 flex items-center justify-between text-xs font-mono">
                    <div>
                      <p className="text-[10px] uppercase font-sans text-slate-400">Current</p>
                      <p className="font-semibold text-slate-900 mt-0.5">
                        {currency} {g.currentAmountNum.toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] uppercase font-sans text-slate-400">Target</p>
                      <p className="font-semibold text-slate-900 mt-0.5">
                        {currency} {g.targetAmountNum.toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {g.targetDate && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      <span>Target Date: {formatDate(g.targetDate)}</span>
                    </div>
                  )}

                  {!isAchieved && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs font-semibold"
                      onClick={() => setContributeGoal(g)}
                    >
                      <Coins className="h-3.5 w-3.5 mr-1.5 text-emerald-600" />
                      <span>Contribute from Transaction</span>
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Goal Creation Modal */}
      <GoalModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        accounts={accounts}
        currency={currency}
      />

      {/* Contribute Modal */}
      <ContributeModal
        isOpen={!!contributeGoal}
        onClose={() => setContributeGoal(null)}
        goal={contributeGoal}
        transactions={transactions}
        currency={currency}
      />
    </div>
  );
}
