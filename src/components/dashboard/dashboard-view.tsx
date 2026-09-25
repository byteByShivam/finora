'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  ArrowRight,
  Plus,
  AlertTriangle,
  ArrowLeftRight,
  ShieldAlert,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SpendingTrendChart, CategoryBreakdownChart } from '@/components/charts/dashboard-charts';
import { QuickTransactionModal } from '@/components/transactions/quick-transaction-modal';
import { DashboardSnapshot } from '@/server/services/analytics.service';
import { formatDateTime } from '@/lib/dates';

interface DashboardViewProps {
  snapshot: DashboardSnapshot;
  currency: string;
  categories: { id: string; name: string; type: string }[];
}

export function DashboardView({ snapshot, currency, categories }: DashboardViewProps) {
  const [isAddTxnOpen, setIsAddTxnOpen] = useState(false);
  const { metrics, accounts, recentTransactions, categoryBreakdown, spendingTrend, budgets, goals } = snapshot;

  const activeAlerts = budgets.filter((b) => b.isOverBudget || b.isWarning);

  return (
    <div className="space-y-8">
      {/* Top Banner / Alerts if any budget reached threshold */}
      {activeAlerts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 shrink-0">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-900">
                {activeAlerts.length} Budget Alert{activeAlerts.length > 1 ? 's' : ''} Require Attention
              </p>
              <p className="text-xs text-amber-700">
                {activeAlerts[0].categoryName} is at {activeAlerts[0].percentage}% of its allocated limit.
              </p>
            </div>
          </div>
          <Link
            href="/budgets"
            className="text-xs font-semibold text-amber-900 bg-white border border-amber-300 px-3.5 py-1.5 rounded-xl hover:bg-amber-50 shadow-sm transition-colors"
          >
            Review Budgets
          </Link>
        </div>
      )}

      {/* Hero Financial Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Balance */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Net Balance</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <Wallet className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {currency} {metrics.totalBalance.toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Across {accounts.length} active account(s)</p>
          </CardContent>
        </Card>

        {/* Monthly Income */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Monthly Income</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <TrendingUp className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-emerald-700 font-mono">
                +{currency} {metrics.monthlyIncome.toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Current calendar month</p>
          </CardContent>
        </Card>

        {/* Monthly Expenses */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Monthly Expenses</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
                <TrendingDown className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-rose-700 font-mono">
                -{currency} {metrics.monthlyExpense.toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-500">Current calendar month</p>
          </CardContent>
        </Card>

        {/* Net Savings & Savings Rate */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Net Savings</p>
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                <PiggyBank className="h-4 w-4" />
              </div>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
                {currency} {metrics.netSavings.toLocaleString()}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              <span className="font-semibold text-emerald-700">{metrics.savingsRate}%</span>
              <span className="text-slate-400">savings rate</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section: Spending Trend + Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Spending Trend</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Daily income vs. expense cashflow this month</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => setIsAddTxnOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Transaction
            </Button>
          </CardHeader>
          <CardContent>
            <SpendingTrendChart data={spendingTrend} currency={currency} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Category Expenses</CardTitle>
            <p className="text-xs text-slate-500 mt-1">Breakdown by spending category</p>
          </CardHeader>
          <CardContent>
            <CategoryBreakdownChart data={categoryBreakdown} currency={currency} />
          </CardContent>
        </Card>
      </div>

      {/* Middle Row: Recent Transactions + Budgets + Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Transactions List */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle>Recent Transactions</CardTitle>
              <p className="text-xs text-slate-500 mt-1">Latest ledger entries across all accounts</p>
            </div>
            <Link
              href="/transactions"
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0">
            {recentTransactions.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">No transactions recorded yet.</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentTransactions.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-4 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-xl shrink-0 ${
                          t.type === 'income'
                            ? 'bg-emerald-50 text-emerald-600'
                            : t.type === 'expense'
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {t.type === 'income' ? (
                          <TrendingUp className="h-4 w-4" />
                        ) : t.type === 'expense' ? (
                          <TrendingDown className="h-4 w-4" />
                        ) : (
                          <ArrowLeftRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {t.description || (t.type === 'transfer' ? 'Account Transfer' : 'Transaction')}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500">
                          <span>{t.accountName}</span>
                          {t.categoryName && (
                            <>
                              <span>•</span>
                              <span>{t.categoryName}</span>
                            </>
                          )}
                          <span>•</span>
                          <span>{formatDateTime(t.occurredAt)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span
                        className={`text-sm font-bold font-mono ${
                          t.type === 'income'
                            ? 'text-emerald-700'
                            : t.type === 'expense'
                            ? 'text-rose-700'
                            : 'text-blue-700'
                        }`}
                      >
                        {t.type === 'income' ? '+' : t.type === 'expense' ? '-' : ''}
                        {currency} {t.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Budgets & Goals Highlights Column */}
        <div className="space-y-6">
          {/* Active Budgets */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle>Category Budgets</CardTitle>
              <Link href="/budgets" className="text-xs text-emerald-700 font-semibold hover:underline">
                Manage
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {budgets.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">No monthly budgets set.</div>
              ) : (
                budgets.slice(0, 3).map((b) => (
                  <div key={b.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">{b.categoryName}</span>
                      <span className="text-slate-500 font-mono">
                        {currency} {b.spent.toLocaleString()} / {b.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          b.isOverBudget ? 'bg-rose-500' : b.isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(b.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Savings Goals */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle>Savings Goals</CardTitle>
              <Link href="/goals" className="text-xs text-emerald-700 font-semibold hover:underline">
                View All
              </Link>
            </CardHeader>
            <CardContent className="space-y-4">
              {goals.length === 0 ? (
                <div className="text-center py-4 text-xs text-slate-400">No active goals found.</div>
              ) : (
                goals.map((g) => (
                  <div key={g.id} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate">{g.name}</span>
                      <span className="text-emerald-700 font-bold">{g.percentage}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{ width: `${g.percentage}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      {currency} {g.currentAmount.toLocaleString()} of {currency} {g.targetAmount.toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Accounts Overview Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Your Accounts</h2>
            <p className="text-xs text-slate-500">Connected banks, cash wallets, cards & investments</p>
          </div>
          <Link
            href="/accounts"
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>Manage Accounts</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {accounts.map((acc) => (
            <Card key={acc.id} className="hover:border-emerald-300 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: acc.color || '#3b82f6' }}
                  />
                  <Badge variant="outline" className="text-[10px] uppercase font-mono">
                    {acc.type}
                  </Badge>
                </div>
                <h4 className="font-bold text-slate-900 text-sm truncate">{acc.name}</h4>
                <p className="mt-2 text-xl font-bold font-mono text-slate-900">
                  {currency} {acc.balance.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Transaction Modal */}
      <QuickTransactionModal
        isOpen={isAddTxnOpen}
        onClose={() => setIsAddTxnOpen(false)}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
