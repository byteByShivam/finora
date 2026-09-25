'use client';

import { useState, useTransition } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createTransactionAction } from '@/app/actions/transaction.actions';
import { TxnType } from '@prisma/client';
import { ArrowLeftRight, TrendingUp, TrendingDown } from 'lucide-react';

interface QuickTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: { id: string; name: string; currency?: string }[];
  categories: { id: string; name: string; type: string }[];
}

export function QuickTransactionModal({
  isOpen,
  onClose,
  accounts,
  categories,
}: QuickTransactionModalProps) {
  const [isPending, startTransition] = useTransition();
  const [type, setType] = useState<TxnType>(TxnType.expense);
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [transferAccountId, setTransferAccountId] = useState(accounts[1]?.id || '');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16));
  const [error, setError] = useState<string | null>(null);

  const availableCategories = categories.filter((c) =>
    type === TxnType.income ? c.type === 'income' : c.type === 'expense'
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than 0.');
      return;
    }

    if (type === TxnType.transfer && (!transferAccountId || transferAccountId === accountId)) {
      setError('Transfer requires a different destination account.');
      return;
    }

    startTransition(async () => {
      const res = await createTransactionAction({
        type,
        accountId,
        transferAccountId: type === TxnType.transfer ? transferAccountId : null,
        categoryId: type === TxnType.transfer ? null : categoryId || null,
        amount: numAmount,
        currency: 'INR',
        description: description || null,
        notes: notes || null,
        occurredAt: new Date(occurredAt),
      });

      if (!res.success) {
        setError(res.error);
      } else {
        setAmount('');
        setDescription('');
        setNotes('');
        onClose();
      }
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Transaction" description="Record income, expense or account transfer">
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      {/* Type Switcher */}
      <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-100 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => setType(TxnType.expense)}
          className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            type === TxnType.expense
              ? 'bg-white text-rose-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingDown className="h-3.5 w-3.5" />
          <span>Expense</span>
        </button>
        <button
          type="button"
          onClick={() => setType(TxnType.income)}
          className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            type === TxnType.income
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="h-3.5 w-3.5" />
          <span>Income</span>
        </button>
        <button
          type="button"
          onClick={() => setType(TxnType.transfer)}
          className={`flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            type === TxnType.transfer
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span>Transfer</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-slate-700 mb-1">Amount</label>
          <div className="relative">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400 text-sm">₹</span>
            <Input
              type="number"
              step="0.01"
              required
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="pl-8 text-base font-semibold"
            />
          </div>
        </div>

        {/* Source Account */}
        <div>
          <label className="block font-medium text-slate-700 mb-1">
            {type === TxnType.transfer ? 'Source Account' : 'Account'}
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
            required
          >
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Transfer Destination Account */}
        {type === TxnType.transfer ? (
          <div>
            <label className="block font-medium text-slate-700 mb-1">Destination Account</label>
            <select
              value={transferAccountId}
              onChange={(e) => setTransferAccountId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
              required
            >
              <option value="">Select destination...</option>
              {accounts
                .filter((a) => a.id !== accountId)
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
            </select>
          </div>
        ) : (
          <div>
            <label className="block font-medium text-slate-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
            >
              <option value="">Select Category (Optional)</option>
              {availableCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div>
          <label className="block font-medium text-slate-700 mb-1">Description</label>
          <Input
            placeholder="e.g. Supermarket, Client Retainer, Metro..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Date & Time</label>
          <Input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isPending}>
            Record Transaction
          </Button>
        </div>
      </form>
    </Modal>
  );
}
