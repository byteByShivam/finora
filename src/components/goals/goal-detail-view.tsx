'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Target,
  ArrowLeft,
  Plus,
  Edit2,
  Archive,
  Trash2,
  Calendar,
  Building,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GoalProgressChart } from '@/components/charts/goal-progress-chart';
import { GoalModal } from '@/components/goals/goal-modal';
import { ContributeModal } from '@/components/goals/contribute-modal';
import {
  archiveGoalAction,
  deleteGoalAction,
  deleteContributionAction,
} from '@/app/actions/goal.actions';
import { GoalDetail } from '@/server/services/goal.service';
import { formatCurrency } from '@/lib/money';
import { GoalStatus } from '@prisma/client';

interface GoalDetailViewProps {
  detail: GoalDetail;
  accounts: { id: string; name: string }[];
  currency: string;
}

export function GoalDetailView({ detail, accounts, currency }: GoalDetailViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isContributeOpen, setIsContributeOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { goal, contributions, projections, trend } = detail;

  const handleArchive = () => {
    if (confirm(`Archive goal "${goal.name}"? It will no longer appear in your active goals.`)) {
      startTransition(async () => {
        const res = await archiveGoalAction(goal.id);
        if (!res.success) {
          setError(res.error);
        } else {
          router.push('/goals');
        }
      });
    }
  };

  const handleDelete = () => {
    if (
      confirm(
        `Are you sure you want to delete goal "${goal.name}"? This action cannot be undone.`
      )
    ) {
      startTransition(async () => {
        const res = await deleteGoalAction(goal.id);
        if (!res.success) {
          setError(res.error);
        } else {
          router.push('/goals');
        }
      });
    }
  };

  const handleDeleteContribution = (contributionId: string, amount: number) => {
    if (
      confirm(
        `Reverse contribution of ${formatCurrency(amount, currency)}? Goal progress will be updated accordingly.`
      )
    ) {
      startTransition(async () => {
        const res = await deleteContributionAction(goal.id, contributionId);
        if (!res.success) {
          setError(res.error);
        } else {
          router.refresh();
        }
      });
    }
  };

  const getStatusBadge = () => {
    switch (goal.dynamicStatus) {
      case 'completed':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1">
            <CheckCircle2 className="h-3 w-3" />
            <span>Completed</span>
          </Badge>
        );
      case 'on_track':
        return (
          <Badge className="bg-sky-100 text-sky-800 border-sky-300 gap-1">
            <TrendingUp className="h-3 w-3" />
            <span>On Track</span>
          </Badge>
        );
      case 'at_risk':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1">
            <AlertTriangle className="h-3 w-3" />
            <span>At Risk</span>
          </Badge>
        );
      case 'overdue':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 gap-1">
            <Clock className="h-3 w-3" />
            <span>Overdue</span>
          </Badge>
        );
      case 'archived':
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-300 gap-1">
            <Archive className="h-3 w-3" />
            <span>Archived</span>
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-100 text-slate-800 border-slate-200 gap-1">
            <Target className="h-3 w-3" />
            <span>Active</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Actions Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/goals"
            className="p-2 rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 hover:bg-slate-50 transition-colors"
            title="Back to Goals"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ backgroundColor: goal.color || '#10b981' }}
              />
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">{goal.name}</h1>
              {getStatusBadge()}
            </div>
            {goal.description && (
              <p className="text-xs text-slate-500 mt-0.5 max-w-xl">{goal.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto flex-wrap">
          {goal.status !== GoalStatus.archived && (
            <Button
              size="sm"
              onClick={() => setIsContributeOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <Plus className="h-4 w-4 mr-1.5" />
              <span>Contribute</span>
            </Button>
          )}

          <Button size="sm" variant="outline" onClick={() => setIsEditOpen(true)}>
            <Edit2 className="h-3.5 w-3.5 mr-1.5" />
            <span>Edit</span>
          </Button>

          {goal.status !== GoalStatus.archived ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleArchive}
              disabled={isPending}
              className="text-slate-600 hover:text-slate-900"
            >
              <Archive className="h-3.5 w-3.5 mr-1" />
              <span>Archive</span>
            </Button>
          ) : null}

          <Button
            size="sm"
            variant="outline"
            onClick={handleDelete}
            disabled={isPending}
            className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            <span>Delete</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm p-4">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            Target Amount
          </span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
            {formatCurrency(goal.targetAmount, currency)}
          </span>
          {goal.targetDateFormatted ? (
            <span className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>Target: {goal.targetDateFormatted}</span>
            </span>
          ) : (
            <span className="text-[11px] text-slate-400 mt-1">No deadline set</span>
          )}
        </Card>

        <Card className="border-slate-200 shadow-sm p-4">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            Current Saved
          </span>
          <span className="text-xl font-bold font-mono text-emerald-600 mt-1 block">
            {formatCurrency(goal.currentAmount, currency)}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {goal.contributionCount} total deposit{goal.contributionCount === 1 ? '' : 's'}
          </span>
        </Card>

        <Card className="border-slate-200 shadow-sm p-4">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            Remaining To Save
          </span>
          <span
            className={`text-xl font-bold font-mono mt-1 block ${
              goal.remainingAmount <= 0 ? 'text-emerald-600' : 'text-slate-900'
            }`}
          >
            {goal.remainingAmount <= 0
              ? 'Goal Achieved!'
              : formatCurrency(goal.remainingAmount, currency)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {goal.remainingAmount <= 0 ? 'Surplus saved' : 'Balance remaining'}
          </span>
        </Card>

        <Card className="border-slate-200 shadow-sm p-4">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            Progress Percentage
          </span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
            {goal.percentage}%
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">
            {goal.account ? `Linked: ${goal.account.name}` : 'Direct savings tracking'}
          </span>
        </Card>
      </div>

      {/* Main Progress Bar & Milestone markers */}
      <Card className="border-slate-200 shadow-sm p-5 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-slate-800">Milestone Progress</span>
          <span className="font-mono font-bold text-slate-900">
            {formatCurrency(goal.currentAmount, currency)} / {formatCurrency(goal.targetAmount, currency)} ({goal.percentage}%)
          </span>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden relative">
          <div
            className="h-3 rounded-full transition-all duration-500"
            style={{
              width: `${Math.min(goal.percentage, 100)}%`,
              backgroundColor: goal.color || '#10b981',
            }}
          />
        </div>

        <div className="flex justify-between text-[11px] text-slate-400 font-mono px-1">
          <span>0%</span>
          <span>25%</span>
          <span>50% (Halfway)</span>
          <span>75%</span>
          <span>100% (Target)</span>
        </div>
      </Card>

      {/* Projections & Chart Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Financial Projections Card (1 col) */}
        <Card className="border-slate-200 shadow-sm p-5 space-y-4">
          <div>
            <div className="flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-emerald-600" />
              <CardTitle className="text-base font-semibold text-slate-900">Savings Forecast</CardTitle>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Derived projections based on contribution frequency
            </p>
          </div>

          <div className="space-y-3 pt-2">
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500 block">Required Monthly Contribution</span>
              {projections.requiredMonthlyContribution !== null ? (
                <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">
                  {formatCurrency(projections.requiredMonthlyContribution, currency)} / mo
                </span>
              ) : (
                <span className="text-xs text-slate-400 mt-0.5 block italic">
                  Set a future deadline to calculate
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500 block">Average Monthly Velocity</span>
              {projections.averageMonthlyContribution !== null ? (
                <span className="font-mono font-bold text-emerald-600 text-sm mt-0.5 block">
                  {formatCurrency(projections.averageMonthlyContribution, currency)} / mo
                </span>
              ) : (
                <span className="text-xs text-slate-400 mt-0.5 block italic">
                  Requires ≥ 2 historical deposits
                </span>
              )}
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[11px] text-slate-500 block">Estimated Completion Date</span>
              {projections.estimatedCompletionDate ? (
                <span className="font-mono font-bold text-sky-700 text-sm mt-0.5 block">
                  {projections.estimatedCompletionDate}
                </span>
              ) : (
                <span className="text-xs text-slate-400 mt-0.5 block italic">
                  {goal.dynamicStatus === 'completed'
                    ? 'Goal already achieved!'
                    : 'Insufficient data for projection'}
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Right: Cumulative Trajectory Chart (2 cols) */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm p-5 space-y-2">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Savings Trajectory
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Cumulative progression towards target reference line
            </p>
          </div>

          <div className="pt-2">
            <GoalProgressChart
              data={trend}
              targetAmount={goal.targetAmount}
              currency={currency}
              color={goal.color || '#10b981'}
            />
          </div>
        </Card>
      </div>

      {/* Contributions History Ledger Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">
              Contribution History
            </CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified savings allocations toward this milestone
            </p>
          </div>
          {goal.status !== GoalStatus.archived && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsContributeOpen(true)}
              className="text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              <span>Record Deposit</span>
            </Button>
          )}
        </CardHeader>

        <CardContent className="p-0">
          {contributions.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-400 space-y-3">
              <Target className="h-8 w-8 text-slate-300 mx-auto" />
              <p>No contributions recorded for this goal yet.</p>
              {goal.status !== GoalStatus.archived && (
                <Button
                  size="sm"
                  onClick={() => setIsContributeOpen(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-xs"
                >
                  Add First Contribution
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Note / Description</th>
                    <th className="py-3 px-4">Funding Source</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {contributions.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">
                        {c.createdAtFormatted}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 max-w-xs truncate">
                        {c.note || (c.transaction?.description ? c.transaction.description : 'Deposit')}
                      </td>
                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {c.transaction ? (
                          <span className="inline-flex items-center gap-1.5 text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200 text-[11px]">
                            <Building className="h-3 w-3 text-sky-500" />
                            <span>{c.transaction.accountName || 'Ledger Transfer'}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Direct Entry</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600 whitespace-nowrap">
                        +{formatCurrency(c.amount, currency)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={isPending}
                          onClick={() => handleDeleteContribution(c.id, c.amount)}
                          className="h-7 w-7 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Reverse contribution"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Modal */}
      <GoalModal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        accounts={accounts}
        currency={currency}
        initialData={{
          id: goal.id,
          name: goal.name,
          description: goal.description,
          targetAmount: goal.targetAmount,
          targetDate: goal.targetDate,
          accountId: goal.accountId,
          icon: goal.icon,
          color: goal.color,
          status: goal.status,
        }}
      />

      {/* Contribute Modal */}
      <ContributeModal
        isOpen={isContributeOpen}
        onClose={() => setIsContributeOpen(false)}
        goal={{
          id: goal.id,
          name: goal.name,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          remainingAmount: goal.remainingAmount,
          accountId: goal.accountId,
          account: goal.account,
        }}
        accounts={accounts}
        currency={currency}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
