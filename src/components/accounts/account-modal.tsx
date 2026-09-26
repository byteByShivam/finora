'use client';

import { useState, useEffect, useTransition } from 'react';
import { Modal } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { createAccountAction, updateAccountAction } from '@/app/actions/account.actions';
import { AccountType } from '@prisma/client';
import { Building, Wallet, CreditCard, TrendingUp, Landmark, ShieldAlert } from 'lucide-react';

export interface EditableAccount {
  id: string;
  name: string;
  type: AccountType;
  currency: string;
  openingBalance?: number | string;
  creditLimit?: number | string | null;
  color?: string | null;
  icon?: string | null;
}

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  currency?: string;
  account?: EditableAccount | null;
  onSuccess?: () => void;
}

const PRESET_COLORS = [
  '#059669', // Emerald
  '#2563eb', // Blue
  '#7c3aed', // Purple
  '#d97706', // Amber
  '#dc2626', // Rose
  '#0d9488', // Teal
  '#4f46e5', // Indigo
  '#475569', // Slate
];

export function AccountModal({
  isOpen,
  onClose,
  currency = 'INR',
  account = null,
  onSuccess,
}: AccountModalProps) {
  const isEditing = Boolean(account);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>(AccountType.bank);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [creditLimit, setCreditLimit] = useState('');
  const [color, setColor] = useState('#2563eb');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (account) {
      setName(account.name);
      setType(account.type);
      setColor(account.color || '#2563eb');
      setCreditLimit(account.creditLimit ? String(account.creditLimit) : '');
      setOpeningBalance(account.openingBalance ? String(account.openingBalance) : '0');
    } else {
      setName('');
      setType(AccountType.bank);
      setColor('#2563eb');
      setCreditLimit('');
      setOpeningBalance('0');
    }
    setError(null);
  }, [account, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      if (isEditing && account) {
        const res = await updateAccountAction(account.id, {
          name,
          color,
          creditLimit:
            type === AccountType.credit_card && creditLimit !== ''
              ? parseFloat(creditLimit)
              : null,
          icon:
            type === AccountType.bank
              ? 'Building'
              : type === AccountType.credit_card
                ? 'CreditCard'
                : type === AccountType.investment
                  ? 'TrendingUp'
                  : 'Wallet',
        });

        if (!res.success) {
          setError(res.error);
        } else {
          onSuccess?.();
          onClose();
        }
      } else {
        const res = await createAccountAction({
          name,
          type,
          currency,
          openingBalance: parseFloat(openingBalance) || 0,
          creditLimit:
            type === AccountType.credit_card && creditLimit !== ''
              ? parseFloat(creditLimit)
              : null,
          color,
          icon:
            type === AccountType.bank
              ? 'Building'
              : type === AccountType.credit_card
                ? 'CreditCard'
                : type === AccountType.investment
                  ? 'TrendingUp'
                  : 'Wallet',
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
      title={isEditing ? 'Edit Account' : 'Add Financial Account'}
      description={
        isEditing
          ? 'Update account details, color accent, or credit terms'
          : 'Create a new bank, card, wallet, or investment account'
      }
    >
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs text-rose-800 flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-rose-500" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4 text-xs">
        <div>
          <label className="block font-medium text-slate-700 mb-1">
            Account Name <span className="text-rose-500">*</span>
          </label>
          <Input
            required
            placeholder="e.g. HDFC Salary, ICICI Platinum, Cash Wallet..."
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div>
          <label className="block font-medium text-slate-700 mb-1">Account Type</label>
          {isEditing ? (
            <div className="flex items-center gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
              <Badge variant="outline" className="font-mono text-[11px] uppercase">
                {type}
              </Badge>
              <span className="text-slate-500 text-xs">
                (Account type cannot be changed after creation)
              </span>
            </div>
          ) : (
            <select
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              className="w-full rounded-xl border border-slate-300 p-2.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value={AccountType.bank}>Bank Account (Checking / Savings)</option>
              <option value={AccountType.cash}>Physical Cash</option>
              <option value={AccountType.credit_card}>Credit Card</option>
              <option value={AccountType.wallet}>Digital Wallet</option>
              <option value={AccountType.investment}>Investment Portfolio</option>
              <option value={AccountType.other}>Other Liability or Asset</option>
            </select>
          )}
        </div>

        {!isEditing && (
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Opening Balance ({currency})
            </label>
            <Input
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Initial ledger balance at the time of account creation.
            </p>
          </div>
        )}

        {type === AccountType.credit_card && (
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Credit Limit ({currency})
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="e.g. 150000"
              value={creditLimit}
              onChange={(e) => setCreditLimit(e.target.value)}
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Used to calculate credit card limit utilization.
            </p>
          </div>
        )}

        <div>
          <label className="block font-medium text-slate-700 mb-1.5">Color Accent</label>
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {PRESET_COLORS.map((preset) => (
              <button
                key={preset}
                type="button"
                onClick={() => setColor(preset)}
                className={`h-6 w-6 rounded-full transition-transform ${
                  color === preset ? 'ring-2 ring-offset-2 ring-slate-700 scale-110' : 'hover:scale-105'
                }`}
                style={{ backgroundColor: preset }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-7 w-9 rounded cursor-pointer border border-slate-300 bg-white"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" size="sm" isLoading={isPending}>
            {isEditing ? 'Save Changes' : 'Create Account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
