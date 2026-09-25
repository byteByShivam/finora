'use client';

import { useState, useTransition } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createRecurringAction } from '@/app/actions/recurring.actions';
import { TxnType, RecurFrequency } from '@prisma/client';

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: string }[];
  currency?: string;
}

export function RecurringModal({
  isOpen,
  onClose,
  accounts,
  categories,
  currency = 'INR',
}: RecurringModalProps) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<TxnType>(TxnType.expense);
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<RecurFrequency>(RecurFrequency.monthly);
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  const availableCategories = categories.filter((c) =>
    type === TxnType.income ? c.type === 'income' : c.type === 'expense'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid amount.');
      return;
    }

    startTransition(async () => {
      const res = await createRecurringAction({
        accountId,
        categoryId: categoryId || null,
        type,
        amount: num,
        description,
        frequency,
        interval: 1,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
      });

      if (!res.success) {
        setError(res.error);
      } else {
        setAmount('');
        setDescription('');
        onClose();
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Recurring Transaction"
      description="Automate recurring bills, rent, salaries or subscriptions"
    >
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-slate-700 mb-1">Schedule Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType(TxnType.expense)}
              className={`py-2 text-xs font-semibold rounded-xl border text-center transition-colors ${
                type === TxnType.expense
                  ? 'border-rose-300 bg-rose-50 text-rose-800'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              Recurring Expense (Bill/Rent)
            </button>
            <button
              type="button"
              onClick={() => setType(TxnType.income)}
              className={`py-2 text-xs font-semibold rounded-xl border text-center transition-colors ${
                type === TxnType.income
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              Recurring Income (Salary/SIP)
            </button>
          </div>
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Description</label>
          <Input
            required
            placeholder="e.g. Netflix, Apartment Rent, Gym Membership..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Amount ({currency})</label>
          <Input
            type="number"
            step="0.01"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Account</label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
            required
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
          >
            <option value="">Select Category (Optional)</option>
            {availableCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as RecurFrequency)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
            >
              <option value={RecurFrequency.daily}>Daily</option>
              <option value={RecurFrequency.weekly}>Weekly</option>
              <option value={RecurFrequency.biweekly}>Bi-Weekly</option>
              <option value={RecurFrequency.monthly}>Monthly</option>
              <option value={RecurFrequency.yearly}>Yearly</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">First Run Date</label>
            <Input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">End Date (Optional)</label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isPending}>
            Schedule Transaction
          </Button>
        </div>
      </form>
    </Modal>
  );
}
