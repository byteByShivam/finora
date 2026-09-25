'use client';

import { useState, useTransition } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { upsertBudgetAction } from '@/app/actions/budget.actions';
import { BudgetPeriod } from '@prisma/client';

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: { id: string; name: string }[];
  currency?: string;
}

export function BudgetModal({ isOpen, onClose, categories, currency = 'INR' }: BudgetModalProps) {
  const [isPending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<BudgetPeriod>(BudgetPeriod.monthly);
  const [rolloverEnabled, setRolloverEnabled] = useState(false);
  const [alertThresholdPct, setAlertThresholdPct] = useState('80');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    startTransition(async () => {
      const res = await upsertBudgetAction({
        categoryId,
        amount: numAmount,
        period,
        periodStart: new Date(),
        rolloverEnabled,
        alertThresholdPct: parseInt(alertThresholdPct, 10) || 80,
      });

      if (!res.success) {
        setError(res.error);
      } else {
        setAmount('');
        onClose();
      }
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Set Category Budget" description="Set spending caps and threshold alerts">
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-slate-700 mb-1">Expense Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
            required
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Budget Limit ({currency})</label>
          <Input
            type="number"
            step="1"
            required
            placeholder="e.g. 15000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Budget Period</label>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as BudgetPeriod)}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
          >
            <option value={BudgetPeriod.monthly}>Monthly Cap</option>
            <option value={BudgetPeriod.yearly}>Yearly Cap</option>
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Warning Threshold (% of limit)</label>
          <Input
            type="number"
            min="1"
            max="100"
            value={alertThresholdPct}
            onChange={(e) => setAlertThresholdPct(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            You will receive an in-app notification when spending reaches {alertThresholdPct}%.
          </p>
        </div>

        <div className="flex items-center gap-2 pt-1">
          <input
            type="checkbox"
            id="rollover"
            checked={rolloverEnabled}
            onChange={(e) => setRolloverEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
          <label htmlFor="rollover" className="text-xs text-slate-700 cursor-pointer font-medium">
            Enable rollover (add unspent amount to next month&apos;s budget)
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isPending}>
            Save Budget
          </Button>
        </div>
      </form>
    </Modal>
  );
}
