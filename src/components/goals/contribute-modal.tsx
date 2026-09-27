'use client';

import { useState, useTransition } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { addContributionAction } from '@/app/actions/goal.actions';
import { formatCurrency } from '@/lib/money';
import { Coins } from 'lucide-react';

interface ContributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    remainingAmount: number;
    accountId?: string | null;
    account?: { id: string; name: string } | null;
  } | null;
  accounts: { id: string; name: string }[];
  currency?: string;
  onSuccess?: () => void;
}

export function ContributeModal({
  isOpen,
  onClose,
  goal,
  accounts,
  currency = 'INR',
  onSuccess,
}: ContributeModalProps) {
  const [isPending, startTransition] = useTransition();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [note, setNote] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!goal) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const num = parseFloat(amount);
    if (isNaN(num) || !Number.isFinite(num) || num <= 0) {
      setError('Please enter a valid positive contribution amount.');
      return;
    }

    startTransition(async () => {
      const res = await addContributionAction({
        goalId: goal.id,
        amount: num,
        date: date ? new Date(date) : new Date(),
        note: note.trim() || null,
        sourceAccountId: sourceAccountId || null,
      });

      if (!res.success) {
        setError(res.error);
      } else {
        setAmount('');
        setNote('');
        setSourceAccountId('');
        onClose();
        if (onSuccess) onSuccess();
      }
    });
  };

  const selectedSourceAccount = accounts.find((a) => a.id === sourceAccountId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Contribute to "${goal.name}"`}
      description="Record a savings deposit or transfer funds toward this milestone."
    >
      {/* Goal Summary Pill */}
      <div className="mb-4 rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-xs flex items-center justify-between">
        <div>
          <span className="text-slate-500 block">Current Progress</span>
          <span className="font-mono font-bold text-slate-900 text-sm">
            {formatCurrency(goal.currentAmount, currency)}
          </span>
          <span className="text-slate-400 font-mono text-xs ml-1">
            / {formatCurrency(goal.targetAmount, currency)}
          </span>
        </div>
        <div className="text-right">
          <span className="text-slate-500 block">Remaining</span>
          <span className="font-mono font-bold text-emerald-600">
            {formatCurrency(Math.max(0, goal.remainingAmount), currency)}
          </span>
        </div>
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-slate-700 mb-1">
            Contribution Amount ({currency}) <span className="text-rose-500">*</span>
          </label>
          <Input
            type="number"
            step="any"
            min="1"
            required
            autoFocus
            placeholder="e.g. 5000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Date</label>
          <Input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">
            Funding Account (Optional)
          </label>
          <select
            value={sourceAccountId}
            onChange={(e) => setSourceAccountId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-xs bg-white text-slate-800"
          >
            <option value="">Direct savings entry (No account transfer)</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>

          {goal.accountId && sourceAccountId && sourceAccountId !== goal.accountId && (
            <div className="mt-2 rounded-lg bg-sky-50 border border-sky-200/80 p-2.5 text-[11px] text-sky-800 flex items-center gap-2">
              <Coins className="h-4 w-4 text-sky-600 shrink-0" />
              <span>
                Will create an internal transfer from <strong>{selectedSourceAccount?.name}</strong> to{' '}
                <strong>{goal.account?.name || 'Linked Goal Account'}</strong>.
              </span>
            </div>
          )}
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Note (Optional)</label>
          <Input
            placeholder="e.g. Monthly salary savings, bonus allocation, festival gift..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-700"
          >
            {isPending ? 'Recording...' : 'Add Contribution'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
