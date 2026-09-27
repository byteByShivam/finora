'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import {
  Target,
  Plus,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Building,
  Trash2,
  Archive,
  AlertCircle,
  AlertTriangle,
  Clock,
  Search,
  ExternalLink,
  Edit2,
  Shield,
  Laptop,
  Palmtree,
  Car,
  Home,
  GraduationCap,
  Sparkles,
  PiggyBank,
  Heart,
  Plane,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { GoalModal } from '@/components/goals/goal-modal';
import { ContributeModal } from '@/components/goals/contribute-modal';
import { archiveGoalAction, deleteGoalAction } from '@/app/actions/goal.actions';
import { GoalWithProgress, GoalSummaryStats, DynamicGoalStatus } from '@/server/services/goal.service';
import { formatCurrency } from '@/lib/money';
import { GoalStatus } from '@prisma/client';

const ICON_MAP: Record<string, any> = {
  Target,
  Shield,
  Laptop,
  Palmtree,
  Car,
  Home,
  GraduationCap,
  TrendingUp,
  PiggyBank,
  Heart,
  Plane,
  Sparkles,
};

interface GoalsViewProps {
  goals: GoalWithProgress[];
  summary: GoalSummaryStats;
  accounts: { id: string; name: string }[];
  currency: string;
}

export function GoalsView({ goals, summary, accounts, currency }: GoalsViewProps) {
  const [isPending, startTransition] = useTransition();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalWithProgress | null>(null);
  const [contributeGoal, setContributeGoal] = useState<GoalWithProgress | null>(null);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'completed' | 'archived'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleArchive = (id: string, name: string) => {
    setError(null);
    if (confirm(`Archive goal "${name}"?`)) {
      startTransition(async () => {
        const res = await archiveGoalAction(id);
        if (!res.success) setError(res.error);
      });
    }
  };

  const handleDelete = (id: string, name: string) => {
    setError(null);
    if (confirm(`Are you sure you want to delete goal "${name}"? This action cannot be undone.`)) {
      startTransition(async () => {
        const res = await deleteGoalAction(id);
        if (!res.success) setError(res.error);
      });
    }
  };

  // Filter goals by tab and search
  const filteredGoals = goals.filter((g) => {
    // Search match
    if (searchQuery.trim()) {
      const match = g.name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!match) return false;
    }

    if (filterTab === 'all') return true;
    if (filterTab === 'archived') return g.status === GoalStatus.archived;
    if (filterTab === 'completed') return g.dynamicStatus === 'completed' || g.status === GoalStatus.achieved;
    if (filterTab === 'active') {
      return g.status !== GoalStatus.archived && g.dynamicStatus !== 'completed';
    }
    return true;
  });

  const getStatusBadge = (dynamicStatus: DynamicGoalStatus) => {
    switch (dynamicStatus) {
      case 'completed':
        return (
          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 gap-1 text-[11px]">
            <CheckCircle2 className="h-3 w-3" />
            <span>Completed</span>
          </Badge>
        );
      case 'on_track':
        return (
          <Badge className="bg-sky-100 text-sky-800 border-sky-300 gap-1 text-[11px]">
            <TrendingUp className="h-3 w-3" />
            <span>On Track</span>
          </Badge>
        );
      case 'at_risk':
        return (
          <Badge className="bg-amber-100 text-amber-800 border-amber-300 gap-1 text-[11px]">
            <AlertTriangle className="h-3 w-3" />
            <span>At Risk</span>
          </Badge>
        );
      case 'overdue':
        return (
          <Badge className="bg-rose-100 text-rose-800 border-rose-300 gap-1 text-[11px]">
            <Clock className="h-3 w-3" />
            <span>Overdue</span>
          </Badge>
        );
      case 'archived':
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-300 gap-1 text-[11px]">
            <Archive className="h-3 w-3" />
            <span>Archived</span>
          </Badge>
        );
      default:
        return (
          <Badge className="bg-slate-100 text-slate-700 border-slate-200 gap-1 text-[11px]">
            <Target className="h-3 w-3" />
            <span>Active</span>
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financial Savings Goals</h1>
          <p className="text-xs text-slate-500 mt-1">
            Track milestones, calculate savings velocity, and allocate contributions
          </p>
        </div>

        <Button
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700"
        >
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

      {/* Summary KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-slate-200 shadow-sm p-4">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            Total Target
          </span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
            {formatCurrency(summary.totalTarget, currency)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            Across {summary.totalGoalsCount} goal{summary.totalGoalsCount === 1 ? '' : 's'}
          </span>
        </Card>

        <Card className="border-slate-200 shadow-sm p-4">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            Total Saved
          </span>
          <span className="text-xl font-bold font-mono text-emerald-600 mt-1 block">
            {formatCurrency(summary.totalSaved, currency)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {summary.completedGoalsCount} completed
          </span>
        </Card>

        <Card className="border-slate-200 shadow-sm p-4">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            Total Remaining
          </span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
            {formatCurrency(Math.max(0, summary.totalRemaining), currency)}
          </span>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {summary.activeGoalsCount} in progress
          </span>
        </Card>

        <Card className="border-slate-200 shadow-sm p-4">
          <span className="text-[11px] font-medium text-slate-500 uppercase tracking-wider block">
            Overall Progress
          </span>
          <span className="text-xl font-bold font-mono text-slate-900 mt-1 block">
            {summary.overallPercentage}%
          </span>
          <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2 overflow-hidden">
            <div
              className="bg-emerald-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(summary.overallPercentage, 100)}%` }}
            />
          </div>
        </Card>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs self-start">
          <button
            type="button"
            onClick={() => setFilterTab('active')}
            className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
              filterTab === 'active'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Active ({goals.filter((g) => g.status !== GoalStatus.archived && g.dynamicStatus !== 'completed').length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('completed')}
            className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
              filterTab === 'completed'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Completed ({goals.filter((g) => g.dynamicStatus === 'completed' || g.status === GoalStatus.achieved).length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('all')}
            className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
              filterTab === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({goals.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterTab('archived')}
            className={`rounded-lg px-3 py-1.5 font-medium transition-all ${
              filterTab === 'archived'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Archived ({goals.filter((g) => g.status === GoalStatus.archived).length})
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <Input
            placeholder="Search goals..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs h-9 bg-white"
          />
        </div>
      </div>

      {/* Goals Cards Grid */}
      {filteredGoals.length === 0 ? (
        <EmptyState
          icon={Target}
          title={searchQuery ? 'No matching goals found' : 'No goals found in this view'}
          description={
            searchQuery
              ? 'Try adjusting your search query or switching filters.'
              : 'Define savings milestones to track your progress.'
          }
          actionLabel="Create Goal"
          onAction={() => setIsCreateOpen(true)}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredGoals.map((g) => {
            const IconComp = ICON_MAP[g.icon || 'Target'] || Target;
            const isCompleted = g.dynamicStatus === 'completed' || g.status === GoalStatus.achieved;

            return (
              <Card
                key={g.id}
                className="border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col justify-between overflow-hidden"
              >
                <div className="p-5 space-y-4">
                  {/* Card Header: Icon, Name, and Status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
                        style={{
                          backgroundColor: `${g.color || '#10b981'}15`,
                          color: g.color || '#10b981',
                        }}
                      >
                        <IconComp className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/goals/${g.id}`}
                          className="font-bold text-slate-900 text-sm hover:text-emerald-700 transition-colors truncate block"
                        >
                          {g.name}
                        </Link>
                        {g.description && (
                          <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
                            {g.description}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0">{getStatusBadge(g.dynamicStatus)}</div>
                  </div>

                  {/* Amounts & Percentage */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-baseline justify-between text-xs">
                      <div>
                        <span className="font-mono font-bold text-slate-900 text-base">
                          {formatCurrency(g.currentAmount, currency)}
                        </span>
                        <span className="text-slate-400 font-mono text-[11px] ml-1">
                          / {formatCurrency(g.targetAmount, currency)}
                        </span>
                      </div>
                      <span
                        className={`font-mono font-bold text-xs ${
                          isCompleted
                            ? 'text-emerald-600'
                            : g.dynamicStatus === 'at_risk' || g.dynamicStatus === 'overdue'
                            ? 'text-rose-600'
                            : 'text-slate-700'
                        }`}
                      >
                        {g.percentage}%
                      </span>
                    </div>

                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isCompleted
                            ? 'bg-emerald-500'
                            : g.dynamicStatus === 'at_risk' || g.dynamicStatus === 'overdue'
                            ? 'bg-rose-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{
                          width: `${Math.min(g.percentage, 100)}%`,
                          backgroundColor: isCompleted ? '#10b981' : g.color || '#10b981',
                        }}
                      />
                    </div>
                  </div>

                  {/* Metadata Row: Target Date, Remaining, Linked Account */}
                  <div className="space-y-1.5 pt-1 text-[11px] text-slate-500 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Remaining</span>
                      <span className="font-mono font-semibold text-slate-800">
                        {g.remainingAmount <= 0
                          ? 'Target Reached'
                          : formatCurrency(g.remainingAmount, currency)}
                      </span>
                    </div>

                    {g.targetDateFormatted && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>Deadline</span>
                        </span>
                        <span className="font-medium text-slate-700">{g.targetDateFormatted}</span>
                      </div>
                    )}

                    {g.account && (
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          <span>Account</span>
                        </span>
                        <span className="font-medium text-slate-700">{g.account.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Card Footer: Action Buttons */}
                <div className="px-5 py-3 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {g.status !== GoalStatus.archived && (
                      <Button
                        size="sm"
                        onClick={() => setContributeGoal(g)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-xs h-8 px-3"
                      >
                        <Plus className="h-3.5 w-3.5 mr-1" />
                        <span>Contribute</span>
                      </Button>
                    )}
                    <Link href={`/goals/${g.id}`}>
                      <Button variant="outline" size="sm" className="text-xs h-8 px-2.5">
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        <span>Details</span>
                      </Button>
                    </Link>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingGoal(g)}
                      className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                      title="Edit Goal"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    {g.status !== GoalStatus.archived && (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={isPending}
                        onClick={() => handleArchive(g.id, g.name)}
                        className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900"
                        title="Archive Goal"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleDelete(g.id, g.name)}
                      className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                      title="Delete Goal"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Goal Modal (Create or Edit) */}
      <GoalModal
        isOpen={isCreateOpen || Boolean(editingGoal)}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingGoal(null);
        }}
        accounts={accounts}
        currency={currency}
        initialData={
          editingGoal
            ? {
                id: editingGoal.id,
                name: editingGoal.name,
                description: editingGoal.description,
                targetAmount: editingGoal.targetAmount,
                targetDate: editingGoal.targetDate,
                accountId: editingGoal.accountId,
                icon: editingGoal.icon,
                color: editingGoal.color,
                status: editingGoal.status,
              }
            : null
        }
      />

      {/* Contribute Modal */}
      <ContributeModal
        isOpen={Boolean(contributeGoal)}
        onClose={() => setContributeGoal(null)}
        goal={
          contributeGoal
            ? {
                id: contributeGoal.id,
                name: contributeGoal.name,
                targetAmount: contributeGoal.targetAmount,
                currentAmount: contributeGoal.currentAmount,
                remainingAmount: contributeGoal.remainingAmount,
                accountId: contributeGoal.accountId,
                account: contributeGoal.account,
              }
            : null
        }
        accounts={accounts}
        currency={currency}
      />
    </div>
  );
}
