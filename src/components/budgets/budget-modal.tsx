'use client';

import { useState, useEffect, useTransition } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createBudgetAction, updateBudgetAction } from '@/app/actions/budget.actions';
import { BudgetPeriod } from '@prisma/client';

export interface BudgetFormData {
  id?: string;
  categoryId: string;
  amount: number;
  period: BudgetPeriod;
  rolloverEnabled: boolean;
  alertThresholdPct: number;
  periodStart?: Date | string;
}

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: { id: string; name: string }[];
  currency?: string;
  initialData?: BudgetFormData | null;
  onSuccess?: () => void;
}

export function BudgetModal({
  isOpen,
  onClose,
  categories,
  currency = 'INR',
  initialData,
  onSuccess,
}: BudgetModalProps) {
  const [isPending, startTransition] = useTransition();
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [period, setPeriod] = useState<BudgetPeriod>(BudgetPeriod.monthly);
  const [rolloverEnabled, setRolloverEnabled] = useState(false);
  const [alertThresholdPct, setAlertThresholdPct] = useState('80');
  const [error, setError] = useState<string | null>(null);

  const isEditing = Boolean(initialData?.id);

  useEffect(() => {
    if (initialData) {
      setCategoryId(initialData.categoryId);
      setAmount(initialData.amount.toString());
      setPeriod(initialData.period);
      setRolloverEnabled(initialData.rolloverEnabled);
      setAlertThresholdPct(initialData.alertThresholdPct.toString());
    } else {
      setCategoryId(categories[0]?.id || '');
      setAmount('');
      setPeriod(BudgetPeriod.monthly);
      setRolloverEnabled(false);
      setAlertThresholdPct('80');
    }
    setError(null);
  }, [initialData, categories, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || !Number.isFinite(numAmount) || numAmount <= 0) {
      setError('Budget amount must be a positive number greater than zero.');
      return;
    }

    const threshold = parseInt(alertThresholdPct, 10);
    if (isNaN(threshold) || threshold < 1 || threshold > 100) {
      setError('Warning threshold must be an integer between 1 and 100.');
      return;
    }

    startTransition(async () => {
      let res;
      if (isEditing && initialData?.id) {
        res = await updateBudgetAction(initialData.id, {
          id: initialData.id,
          amount: numAmount,
          rolloverEnabled,
          alertThresholdPct: threshold,
        });
      } else {
        res = await createBudgetAction({
          categoryId,
          amount: numAmount,
          period,
          periodStart: new Date(),
          rolloverEnabled,
          alertThresholdPct: threshold,
        });
      }

      if (!res.success) {
        setError(res.error);
      } else {
        onSuccess?.();
        onClose();
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Category Budget' : 'Set Category Budget'}
      description={
        isEditing
          ? 'Update the spending cap and notification thresholds for this category'
          : 'Define a spending cap and notification thresholds to prevent overspending'
      }
    >
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
            disabled={isEditing}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-500"
            required
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {isEditing && (
            <p className="mt-1 text-[11px] text-slate-400">
              Category cannot be changed once a budget is established.
            </p>
          )}
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">
            Budget Limit ({currency}) <span className="text-rose-500">*</span>
          </label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
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
            disabled={isEditing}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white disabled:bg-slate-50 disabled:text-slate-500"
          >
            <option value={BudgetPeriod.monthly}>Monthly Cap</option>
            <option value={BudgetPeriod.yearly}>Yearly Cap</option>
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">
            Warning Threshold (% of limit)
          </label>
          <Input
            type="number"
            min="1"
            max="100"
            value={alertThresholdPct}
            onChange={(e) => setAlertThresholdPct(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-slate-500">
            You will receive in-app alerts when spending exceeds {alertThresholdPct}%.
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
            Enable unspent balance rollover to subsequent periods
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isPending} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {isEditing ? 'Save Changes' : 'Create Budget'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
