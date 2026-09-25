'use client';

import { useState, useTransition } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createAccountAction } from '@/app/actions/account.actions';
import { AccountType } from '@prisma/client';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency?: string;
}

export function AccountModal({ isOpen, onClose, currency = 'INR' }: AccountModalProps) {
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>(AccountType.bank);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [creditLimit, setCreditLimit] = useState('');
  const [color, setColor] = useState('#3b82f6');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await createAccountAction({
        name,
        type,
        currency,
        openingBalance: parseFloat(openingBalance) || 0,
        creditLimit: type === AccountType.credit_card && creditLimit ? parseFloat(creditLimit) : null,
        color,
        icon: type === AccountType.bank ? 'Building' : type === AccountType.cash ? 'Wallet' : 'CreditCard',
      });

      if (!res.success) {
        setError(res.error);
      } else {
        setName('');
        setOpeningBalance('0');
        setCreditLimit('');
        onClose();
      }
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add Financial Account" description="Create a bank, cash, card or investment account">
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-slate-700 mb-1">Account Name</label>
          <Input
            required
            placeholder="e.g. HDFC Savings, ICICI Platinum..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Account Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as AccountType)}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-sm bg-white"
          >
            <option value={AccountType.bank}>Bank Account</option>
            <option value={AccountType.cash}>Cash Wallet</option>
            <option value={AccountType.credit_card}>Credit Card</option>
            <option value={AccountType.investment}>Investment Portfolio</option>
            <option value={AccountType.wallet}>Digital Wallet</option>
            <option value={AccountType.other}>Other Asset</option>
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Opening Balance ({currency})</label>
          <Input
            type="number"
            step="0.01"
            value={openingBalance}
            onChange={(e) => setOpeningBalance(e.target.value)}
          />
        </div>

        {type === AccountType.credit_card && (
          <div>
            <label className="block font-medium text-slate-700 mb-1">Credit Limit ({currency})</label>
            <Input
              type="number"
              step="0.01"
              placeholder="e.g. 150000"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="block font-medium text-slate-700 mb-1">Account Color Accent</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-14 rounded-lg cursor-pointer border border-slate-300 bg-white"
            />
            <span className="text-slate-500 font-mono text-xs">{color}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isPending}>
            Create Account
          </Button>
        </div>
      </form>
    </Modal>
  );
}
