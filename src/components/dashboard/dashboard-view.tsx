'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  Plus,
  Landmark,
  Building,
  CreditCard,
  Coins,
  Receipt,
  Calendar,
  Layers,
  ArrowLeftRight,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import {
  IncomeVsExpenseChart,
  CategoryBreakdownChart,
  CashFlowTrendChart,
} from '@/components/charts/dashboard-charts';
import { TransactionModal } from '@/components/transactions/transaction-modal';
import { DashboardSnapshot } from '@/server/services/analytics.service';
import { formatCurrency } from '@/lib/money';
import { formatDateTime } from '@/lib/dates';
import { AccountType, TxnType } from '@prisma/client';

interface DashboardViewProps {
  snapshot: DashboardSnapshot;
  currency: string;
  accounts: { id: string; name: string; currency?: string }[];
  categories: { id: string; name: string; type: string; color?: string | null }[];
}

export function DashboardView({
  snapshot,
  currency,
  accounts,
  categories,
}: DashboardViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isTxnModalOpen, setIsTxnModalOpen] = useState(false);

  const activePeriod = searchParams.get('period') || snapshot.period.key || 'this_month';
  const [customFrom, setCustomFrom] = useState(searchParams.get('from') || '');
  const [customTo, setCustomTo] = useState(searchParams.get('to') || '');
  const [showCustomInputs, setShowCustomInputs] = useState(activePeriod === 'custom');

  const { metrics, accounts: accountList, categoryBreakdown, cashFlowTrend, recentTransactions, hasAccounts, hasTransactions, hasPeriodActivity } = snapshot;

  const handlePeriodChange = (period: string) => {
    if (period === 'custom') {
      setShowCustomInputs(true);
      return;
    }
    setShowCustomInputs(false);
    const params = new URLSearchParams();
    params.set('period', period);
    router.push(`/dashboard?${params.toString()}`);
  };

  const applyCustomRange = () => {
    if (!customFrom || !customTo) return;
    const params = new URLSearchParams();
    params.set('period', 'custom');
    params.set('from', customFrom);
    params.set('to', customTo);
    router.push(`/dashboard?${params.toString()}`);
  };

  const getAccountIcon = (type: AccountType) => {
    switch (type) {
      case AccountType.bank:
        return <Building className="h-4 w-4" />;
      case AccountType.credit_card:
        return <CreditCard className="h-4 w-4" />;
      case AccountType.investment:
        return <TrendingUp className="h-4 w-4" />;
      case AccountType.cash:
        return <Coins className="h-4 w-4" />;
      default:
        return <Wallet className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Dashboard Top Header & Period Selector */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Financial Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">
            Real-time balance tracking, cash flow analytics, and expenditure distribution
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-stretch md:self-auto">
          {/* Period selector buttons */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs">
            <button
              type="button"
              onClick={() => handlePeriodChange('this_month')}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-all ${
                activePeriod === 'this_month'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('last_month')}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-all ${
                activePeriod === 'last_month'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last Month
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('last_3_months')}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-all ${
                activePeriod === 'last_3_months'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Last 3M
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('this_year')}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-all ${
                activePeriod === 'this_year'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              This Year
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange('custom')}
              className={`rounded-lg px-2.5 py-1.5 font-medium transition-all ${
                activePeriod === 'custom'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Custom
            </button>
          </div>

          <Button size="sm" onClick={() => setIsTxnModalOpen(true)} className="gap-1.5 text-xs">
            <Plus className="h-4 w-4" />
            <span>Add Transaction</span>
          </Button>
        </div>
      </div>

      {/* Custom Date Range Picker inputs when active */}
      {showCustomInputs && (
        <div className="flex flex-wrap items-center gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm text-xs">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <span className="text-slate-500 font-medium">Custom Range:</span>
          </div>
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-8 text-xs w-36"
            />
            <span className="text-slate-400">to</span>
            <Input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-8 text-xs w-36"
            />
          </div>
          <Button size="sm" onClick={applyCustomRange} className="h-8 text-xs">
            Apply
          </Button>
        </div>
      )}

      {/* Active Filter Period Indicator */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span className="font-medium">
          Period: <span className="text-slate-900 font-semibold">{snapshot.period.label}</span>
        </span>
        <span>
          {metrics.transactionCount} transaction{metrics.transactionCount === 1 ? '' : 's'} recorded in period
        </span>
      </div>

      {/* Zero State: No Accounts Created */}
      {!hasAccounts && (
        <Card className="p-8 text-center border-dashed border-2 border-slate-300">
          <Landmark className="h-12 w-12 text-slate-400 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Welcome to Finora!</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            You do not have any accounts yet. Create your first bank account, cash wallet, or credit card to get started.
          </p>
          <div className="mt-5">
            <Link href="/accounts">
              <Button size="sm" className="gap-1.5 text-xs">
                <Plus className="h-4 w-4" />
                <span>Create Financial Account</span>
              </Button>
            </Link>
          </div>
        </Card>
      )}

      {/* KPI Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Net Balance */}
        <Card className="p-5 border-slate-200 shadow-sm relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total Net Balance</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-slate-900 mt-2">
            {formatCurrency(metrics.totalBalance, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5 flex items-center justify-between">
            <span>Across {metrics.activeAccountCount} active account(s)</span>
            {metrics.totalCreditDebt > 0 && (
              <span className="text-rose-500 font-medium">
                Debt: {formatCurrency(metrics.totalCreditDebt, currency)}
              </span>
            )}
          </p>
        </Card>

        {/* Period Income */}
        <Card className="p-5 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Period Income</span>
            <div className="h-8 w-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-emerald-600 mt-2">
            +{formatCurrency(metrics.periodIncome, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Transfers excluded from revenue
          </p>
        </Card>

        {/* Period Expenses */}
        <Card className="p-5 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Period Expenses</span>
            <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl font-bold font-mono tracking-tight text-rose-600 mt-2">
            -{formatCurrency(metrics.periodExpense, currency)}
          </p>
          <p className="text-[11px] text-slate-400 mt-1.5">
            Living expenses & disbursements
          </p>
        </Card>

        {/* Net Cash Flow & Savings Rate */}
        <Card className="p-5 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Net Cash Flow</span>
            <div className="h-8 w-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <p
            className={`text-2xl font-bold font-mono tracking-tight mt-2 ${
              metrics.netCashFlow >= 0 ? 'text-emerald-600' : 'text-rose-600'
            }`}
          >
            {metrics.netCashFlow >= 0 ? '+' : ''}
            {formatCurrency(metrics.netCashFlow, currency)}
          </p>
          <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1.5">
            <span
              className={`font-semibold font-mono ${
                metrics.savingsRate >= 20
                  ? 'text-emerald-600'
                  : metrics.savingsRate > 0
                  ? 'text-blue-600'
                  : 'text-slate-500'
              }`}
            >
              {metrics.savingsRate.toFixed(1)}%
            </span>
            <span>savings rate (of income)</span>
          </div>
        </Card>
      </div>

      {/* Main Charts Row: Income vs Expense + Spending by Category */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Income vs Expense Chart */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">Income vs. Expenses</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">
                Cashflow comparison across {snapshot.period.label}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-slate-600">Income</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
                <span className="text-slate-600">Expense</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <IncomeVsExpenseChart data={cashFlowTrend} currency={currency} />
          </CardContent>
        </Card>

        {/* Category Spending Breakdown */}
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-900">Spending by Category</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Expense distribution for {snapshot.period.label}
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <CategoryBreakdownChart data={categoryBreakdown} currency={currency} />
          </CardContent>
        </Card>
      </div>

      {/* Secondary Row: Cash Flow Trend & Account Balances */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow Trend */}
        <Card className="lg:col-span-2 border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-slate-900">Net Cash Flow Trend</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Net movement per time bucket (Income - Expense, excluding transfers)
            </p>
          </CardHeader>
          <CardContent className="pt-2">
            <CashFlowTrendChart data={cashFlowTrend} currency={currency} />
          </CardContent>
        </Card>

        {/* Account Balances & Allocation */}
        <Card className="border-slate-200 shadow-sm flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">Account Allocation</CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Distribution of current holdings</p>
            </div>
            <Link
              href="/accounts"
              className="text-xs font-medium text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
            >
              <span>Manage</span>
              <ArrowRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3.5 pt-2 flex-1">
            {accountList.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No active accounts found.
              </div>
            ) : (
              accountList.slice(0, 5).map((acc) => {
                const isCard = acc.type === AccountType.credit_card;
                return (
                  <Link
                    key={acc.id}
                    href={`/accounts/${acc.id}`}
                    className="block group p-2.5 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-white shrink-0"
                          style={{ backgroundColor: acc.color || '#2563eb' }}
                        >
                          {getAccountIcon(acc.type)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 group-hover:text-emerald-700 transition-colors truncate">
                            {acc.name}
                          </p>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">
                            {acc.type.replace('_', ' ')}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <p className="font-mono font-bold text-slate-900">
                          {formatCurrency(acc.currentBalance, currency)}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          {isCard
                            ? `${acc.allocationPercentage.toFixed(0)}% limit used`
                            : `${acc.allocationPercentage.toFixed(0)}% of assets`}
                        </p>
                      </div>
                    </div>

                    {/* Mini allocation progress bar */}
                    <div className="w-full bg-slate-100 rounded-full h-1 mt-2 overflow-hidden">
                      <div
                        className="h-1 rounded-full transition-all"
                        style={{
                          width: `${Math.min(acc.allocationPercentage, 100)}%`,
                          backgroundColor: acc.color || '#2563eb',
                        }}
                      />
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Transactions Widget */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base font-semibold text-slate-900">Recent Transactions</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Latest financial activity recorded in your ledger
            </p>
          </div>
          <Link
            href="/transactions"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 inline-flex items-center gap-1"
          >
            <span>View all transactions</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {recentTransactions.length === 0 ? (
            <div className="p-8 text-center">
              <Receipt className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-slate-500">No transactions recorded yet.</p>
              <div className="mt-3">
                <Button size="sm" variant="outline" onClick={() => setIsTxnModalOpen(true)} className="text-xs">
                  Record Transaction
                </Button>
              </div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50/70 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Account</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentTransactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 text-slate-500 font-mono whitespace-nowrap">
                        {formatDateTime(tx.occurredAt)}
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900 max-w-xs truncate">
                        {tx.description || (tx.type === 'transfer' ? 'Transfer' : 'Untitled')}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        {tx.type === 'transfer' ? (
                          <span className="text-slate-400 italic">Transfer</span>
                        ) : tx.categoryName ? (
                          <span className="inline-flex items-center gap-1.5">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: tx.categoryColor || '#3b82f6' }}
                            />
                            <span className="text-slate-700">{tx.categoryName}</span>
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">Uncategorized</span>
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap text-slate-700">
                        {tx.type === 'transfer' ? (
                          <span className="flex items-center gap-1">
                            <span>{tx.accountName}</span>
                            <ArrowLeftRight className="h-3 w-3 text-sky-500" />
                            <span>{tx.transferAccountName || 'Account'}</span>
                          </span>
                        ) : (
                          tx.accountName
                        )}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            tx.type === 'income'
                              ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                              : tx.type === 'expense'
                              ? 'text-rose-700 bg-rose-50 border-rose-200'
                              : 'text-sky-700 bg-sky-50 border-sky-200'
                          }`}
                        >
                          {tx.type}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold whitespace-nowrap">
                        <span
                          className={
                            tx.type === 'income'
                              ? 'text-emerald-700'
                              : tx.type === 'expense'
                              ? 'text-rose-700'
                              : 'text-sky-700'
                          }
                        >
                          {tx.type === 'income' ? '+' : tx.type === 'expense' ? '-' : '↔ '}
                          {formatCurrency(tx.amount, tx.currency || currency)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isTxnModalOpen}
        onClose={() => setIsTxnModalOpen(false)}
        accounts={accounts}
        categories={categories}
        onSuccess={() => router.refresh()}
      />
    </div>
  );
}
