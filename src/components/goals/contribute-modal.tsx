'use client';

import { useState, useTransition } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { contributeGoalAction } from '@/app/actions/goal.actions';

interface ContributeModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: { id: string; name: string; remaining: number } | null;
  transactions: { id: string; description: string | null; amount: number; occurredAt: Date }[];
  currency?: string;
}

export function ContributeModal({
  isOpen,
  onClose,
  goal,
  transactions,
  currency = 'INR',
}: ContributeModalProps) {
  const [isPending, startTransition] = useTransition();
  const [transactionId, setTransactionId] = useState(transactions[0]?.id || '');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!goal) return null;

  const selectedTxn = transactions.find((t) => t.id === transactionId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setError('Please enter a valid contribution amount.');
      return;
    }

    if (selectedTxn && num > selectedTxn.amount) {
      setError(`Contribution cannot exceed transaction amount (${currency} ${selectedTxn.amount}).`);
      return;
    }

    startTransition(async () => {
      const res = await contributeGoalAction({
        goalId: goal.id,
        transactionId,
        amount: num,
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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Contribute to "${goal.name}"`}
      description={`Link a verified ledger transaction to fund this savings goal.`}
    >
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-slate-700 mb-1">Select Funding Transaction</label>
          {transactions.length === 0 ? (
            <p className="text-slate-500 py-2">No eligible transactions found to link.</p>
          ) : (
            <select
              value={transactionId}
              onChange={(e) => {
                setTransactionId(e.target.value);
                const t = transactions.find((x) => x.id === e.target.value);
                if (t) setAmount(t.amount.toString());
              }}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
              required
            >
              {transactions.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.description || 'Transaction'} — {currency} {t.amount.toLocaleString()} (
                  {new Date(t.occurredAt).toLocaleDateString()})
                </option>
              ))}
            </select>
          )}
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">
            Contribution Amount ({currency})
          </label>
          <Input
            type="number"
            step="0.01"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          {selectedTxn && (
            <p className="mt-1 text-[11px] text-slate-500">
              Max available from this transaction: {currency} {selectedTxn.amount.toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isPending} disabled={transactions.length === 0}>
            Add Contribution
          </Button>
        </div>
      </form>
    </Modal>
  );
}
