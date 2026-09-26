'use client';

import { useState, useEffect, useTransition } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createRecurringAction, updateRecurringAction } from '@/app/actions/recurring.actions';
import { RecurringScheduleItem } from '@/server/services/recurring.service';
import { TxnType, RecurFrequency } from '@prisma/client';
import { ArrowLeftRight, TrendingDown, TrendingUp } from 'lucide-react';

interface RecurringModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: { id: string; name: string }[];
  categories: { id: string; name: string; type: string }[];
  currency?: string;
  initialData?: RecurringScheduleItem | null;
}

export function RecurringModal({
  isOpen,
  onClose,
  accounts,
  categories,
  currency = 'INR',
  initialData,
}: RecurringModalProps) {
  const [isPending, startTransition] = useTransition();
  const isEdit = Boolean(initialData);

  const [type, setType] = useState<TxnType>(TxnType.expense);
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [transferAccountId, setTransferAccountId] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [frequency, setFrequency] = useState<RecurFrequency>(RecurFrequency.monthly);
  const [interval, setInterval] = useState('1');
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sync state when opening or when initialData changes
  useEffect(() => {
    if (initialData) {
      setType(initialData.type);
      setAccountId(initialData.accountId);
      setTransferAccountId(initialData.transferAccountId || '');
      setCategoryId(initialData.categoryId || '');
      setAmount(initialData.amount.toString());
      setDescription(initialData.description || '');
      setNotes(initialData.notes || '');
      setFrequency(initialData.frequency);
      setInterval(initialData.interval.toString());
      setStartDate(
        initialData.startDate instanceof Date
          ? initialData.startDate.toISOString().slice(0, 10)
          : new Date(initialData.startDate).toISOString().slice(0, 10)
      );
      setEndDate(
        initialData.endDate
          ? (initialData.endDate instanceof Date
              ? initialData.endDate.toISOString().slice(0, 10)
              : new Date(initialData.endDate).toISOString().slice(0, 10))
          : ''
      );
    } else {
      setType(TxnType.expense);
      setAccountId(accounts[0]?.id || '');
      setTransferAccountId(accounts[1]?.id || '');
      setCategoryId('');
      setAmount('');
      setDescription('');
      setNotes('');
      setFrequency(RecurFrequency.monthly);
      setInterval('1');
      setStartDate(new Date().toISOString().slice(0, 10));
      setEndDate('');
    }
    setError(null);
  }, [initialData, isOpen, accounts]);

  const availableCategories = categories.filter((c) =>
    type === TxnType.income ? c.type === 'income' : c.type === 'expense'
  );

  const availableDestAccounts = accounts.filter((a) => a.id !== accountId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid positive amount.');
      return;
    }

    const intervalNum = parseInt(interval, 10);
    if (isNaN(intervalNum) || intervalNum < 1) {
      setError('Interval must be at least 1.');
      return;
    }

    if (type === TxnType.transfer) {
      if (!transferAccountId) {
        setError('Please select a destination account for transfer.');
        return;
      }
      if (transferAccountId === accountId) {
        setError('Source and destination accounts cannot be identical.');
        return;
      }
    }

    if (endDate && new Date(endDate) < new Date(startDate)) {
      setError('End date must be on or after start date.');
      return;
    }

    startTransition(async () => {
      if (isEdit && initialData) {
        const res = await updateRecurringAction(initialData.id, {
          accountId,
          transferAccountId: type === TxnType.transfer ? transferAccountId : null,
          categoryId: type === TxnType.transfer ? null : categoryId || null,
          type,
          amount: num,
          description: description || null,
          notes: notes || null,
          frequency,
          interval: intervalNum,
          endDate: endDate ? new Date(endDate) : null,
        });

        if (!res.success) {
          setError(res.error);
        } else {
          onClose();
        }
      } else {
        const res = await createRecurringAction({
          accountId,
          transferAccountId: type === TxnType.transfer ? transferAccountId : null,
          categoryId: type === TxnType.transfer ? null : categoryId || null,
          type,
          amount: num,
          description: description || null,
          notes: notes || null,
          frequency,
          interval: intervalNum,
          startDate: new Date(startDate),
          endDate: endDate ? new Date(endDate) : null,
        });

        if (!res.success) {
          setError(res.error);
        } else {
          onClose();
        }
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Recurring Schedule' : 'Create Recurring Schedule'}
      description={
        isEdit
          ? 'Update scheduled template rules. Historical transactions remain unaffected.'
          : 'Automate recurring bills, rent, salaries, or account transfers.'
      }
    >
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Type Selector (3 options: Expense, Income, Transfer) */}
        <div>
          <label className="block font-medium text-slate-700 mb-1.5">Schedule Type</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setType(TxnType.expense)}
              className={`py-2 px-2 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-colors ${
                type === TxnType.expense
                  ? 'border-rose-400 bg-rose-50 text-rose-800 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <TrendingDown className="h-3.5 w-3.5 text-rose-600" />
              <span>Expense</span>
            </button>
            <button
              type="button"
              onClick={() => setType(TxnType.income)}
              className={`py-2 px-2 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-colors ${
                type === TxnType.income
                  ? 'border-emerald-400 bg-emerald-50 text-emerald-800 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              <span>Income</span>
            </button>
            <button
              type="button"
              onClick={() => setType(TxnType.transfer)}
              className={`py-2 px-2 text-xs font-semibold rounded-xl border flex items-center justify-center gap-1.5 transition-colors ${
                type === TxnType.transfer
                  ? 'border-sky-400 bg-sky-50 text-sky-800 shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              <ArrowLeftRight className="h-3.5 w-3.5 text-sky-600" />
              <span>Transfer</span>
            </button>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block font-medium text-slate-700 mb-1">
            Description <span className="text-slate-400 font-normal">(e.g. Netflix, Rent, Salary, Emergency Savings)</span>
          </label>
          <Input
            required
            placeholder="e.g. Netflix, Apartment Rent, Monthly Salary..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        {/* Amount */}
        <div>
          <label className="block font-medium text-slate-700 mb-1">Amount ({currency})</label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        {/* Account Selection */}
        {type === TxnType.transfer ? (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">From Account (Source)</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
              <label className="block font-medium text-slate-700 mb-1">To Account (Destination)</label>
              <select
                value={transferAccountId}
                onChange={(e) => setTransferAccountId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                required
              >
                <option value="">Select Destination</option>
                {availableDestAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Account</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full rounded-xl border border-slate-300 p-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                className="w-full rounded-xl border border-slate-300 p-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Select Category (Optional)</option>
                {availableCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Frequency & Interval */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block font-medium text-slate-700 mb-1">Frequency</label>
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as RecurFrequency)}
              className="w-full rounded-xl border border-slate-300 p-2 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={RecurFrequency.daily}>Daily</option>
              <option value={RecurFrequency.weekly}>Weekly</option>
              <option value={RecurFrequency.biweekly}>Bi-Weekly (Every 2 Weeks)</option>
              <option value={RecurFrequency.monthly}>Monthly</option>
              <option value={RecurFrequency.yearly}>Yearly</option>
            </select>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Every (Interval)</label>
            <Input
              type="number"
              min="1"
              max="99"
              required
              value={interval}
              onChange={(e) => setInterval(e.target.value)}
              placeholder="1"
            />
          </div>
        </div>

        {/* Start Date & End Date */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Start / Next Date</label>
            <Input
              type="date"
              required
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">End Date (Optional)</label>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              placeholder="No expiry"
            />
          </div>
        </div>

        {/* Notes */}
        <div>
          <label className="block font-medium text-slate-700 mb-1">Notes (Optional)</label>
          <Input
            placeholder="Account reference, memo, cancellation terms..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isPending}>
            {isEdit ? 'Save Changes' : 'Schedule Transaction'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
