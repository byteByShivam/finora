'use client';

import { useState, useEffect, useTransition } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createTransactionAction, updateTransactionAction } from '@/app/actions/transaction.actions';
import { TxnType } from '@prisma/client';
import { TrendingUp, TrendingDown, ArrowLeftRight, AlertCircle } from 'lucide-react';

export interface EditableTransaction {
  id: string;
  type: TxnType;
  accountId: string;
  transferAccountId?: string | null;
  categoryId?: string | null;
  amount: number | string;
  currency?: string;
  description?: string | null;
  notes?: string | null;
  occurredAt?: Date | string;
}

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: { id: string; name: string; currency?: string }[];
  categories: { id: string; name: string; type: string; color?: string | null }[];
  transaction?: EditableTransaction | null;
  onSuccess?: () => void;
}

export function TransactionModal({
  isOpen,
  onClose,
  accounts,
  categories,
  transaction = null,
  onSuccess,
}: TransactionModalProps) {
  const isEditing = Boolean(transaction);
  const [isPending, startTransition] = useTransition();

  const [type, setType] = useState<TxnType>(TxnType.expense);
  const [accountId, setAccountId] = useState(accounts[0]?.id || '');
  const [transferAccountId, setTransferAccountId] = useState(accounts[1]?.id || '');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [occurredAt, setOccurredAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Sync state on open/edit
  useEffect(() => {
    if (transaction) {
      setType(transaction.type);
      setAccountId(transaction.accountId);
      setTransferAccountId(transaction.transferAccountId || accounts.find((a) => a.id !== transaction.accountId)?.id || '');
      setCategoryId(transaction.categoryId || '');
      setAmount(String(transaction.amount));
      setDescription(transaction.description || '');
      setNotes(transaction.notes || '');

      const d = transaction.occurredAt ? new Date(transaction.occurredAt) : new Date();
      // Format to YYYY-MM-DDTHH:mm for datetime-local
      const pad = (n: number) => n.toString().padStart(2, '0');
      const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      setOccurredAt(formatted);
    } else {
      setType(TxnType.expense);
      const defaultAcc = accounts[0]?.id || '';
      setAccountId(defaultAcc);
      setTransferAccountId(accounts.find((a) => a.id !== defaultAcc)?.id || '');
      setCategoryId('');
      setAmount('');
      setDescription('');
      setNotes('');

      const now = new Date();
      const pad = (n: number) => n.toString().padStart(2, '0');
      const formatted = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
      setOccurredAt(formatted);
    }
    setError(null);
  }, [transaction, isOpen, accounts]);

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

    if (!accountId) {
      setError('Please select an account.');
      return;
    }

    if (type === TxnType.transfer) {
      if (!transferAccountId) {
        setError('Please select a destination account for the transfer.');
        return;
      }
      if (transferAccountId === accountId) {
        setError('Source and destination accounts cannot be identical.');
        return;
      }
    }

    startTransition(async () => {
      if (isEditing && transaction) {
        const res = await updateTransactionAction(transaction.id, {
          type,
          accountId,
          transferAccountId: type === TxnType.transfer ? transferAccountId : null,
          categoryId: type === TxnType.transfer ? null : categoryId || null,
          amount: numAmount,
          description: description || null,
          notes: notes || null,
          occurredAt: new Date(occurredAt),
        });

        if (!res.success) {
          setError(res.error);
        } else {
          onSuccess?.();
          onClose();
        }
      } else {
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
          onSuccess?.();
          onClose();
        }
      }
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Transaction' : 'Record Transaction'}
      description={
        isEditing
          ? 'Modify transaction details, reassign accounts, or adjust amount'
          : 'Record new income, expense, or an account transfer in your ledger'
      }
    >
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      {/* Transaction Type Selector */}
      <div className="grid grid-cols-3 gap-2 mb-4 bg-slate-100 p-1 rounded-xl">
        <button
          type="button"
          onClick={() => {
            setType(TxnType.expense);
            setCategoryId('');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
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
          onClick={() => {
            setType(TxnType.income);
            setCategoryId('');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
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
          onClick={() => {
            setType(TxnType.transfer);
            setCategoryId('');
          }}
          className={`flex items-center justify-center gap-1.5 py-2 text-xs font-semibold rounded-lg transition-all ${
            type === TxnType.transfer
              ? 'bg-white text-sky-700 shadow-sm'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <ArrowLeftRight className="h-3.5 w-3.5" />
          <span>Transfer</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        {/* Amount */}
        <div>
          <label className="block font-medium text-slate-700 mb-1">
            Amount (₹) <span className="text-rose-500">*</span>
          </label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="text-base font-mono font-semibold"
          />
        </div>

        {/* Source Account */}
        <div>
          <label className="block font-medium text-slate-700 mb-1">
            {type === TxnType.transfer ? 'Source Account' : 'Account'}{' '}
            <span className="text-rose-500">*</span>
          </label>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            required
            className="w-full rounded-xl border border-slate-300 p-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="" disabled>
              Select account
            </option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
              </option>
            ))}
          </select>
        </div>

        {/* Destination Account (Only for Transfers) */}
        {type === TxnType.transfer && (
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Destination Account <span className="text-rose-500">*</span>
            </label>
            <select
              value={transferAccountId}
              onChange={(e) => setTransferAccountId(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="" disabled>
                Select destination account
              </option>
              {accounts
                .filter((acc) => acc.id !== accountId)
                .map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Funds will be moved from source to destination without impacting income/expense.
            </p>
          </div>
        )}

        {/* Category (Only for Income & Expense) */}
        {type !== TxnType.transfer && (
          <div>
            <label className="block font-medium text-slate-700 mb-1">Category</label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Uncategorized</option>
              {availableCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Date & Time */}
        <div>
          <label className="block font-medium text-slate-700 mb-1">Date & Time</label>
          <Input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
            className="text-xs"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block font-medium text-slate-700 mb-1">Description</label>
          <Input
            placeholder="e.g. Swiggy, Netflix, Client Retainer, ATM Withdrawal..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={255}
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block font-medium text-slate-700 mb-1">Notes (Optional)</label>
          <textarea
            rows={2}
            placeholder="Additional context or invoice reference..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-xl border border-slate-300 p-2 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isPending}
          >
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isPending}>
            {isEditing ? 'Save Changes' : 'Record Transaction'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
