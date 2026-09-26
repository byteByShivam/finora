'use client';

import { TransactionModal } from './transaction-modal';

interface QuickTransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: { id: string; name: string; currency?: string }[];
  categories: { id: string; name: string; type: string; color?: string | null }[];
}

export function QuickTransactionModal(props: QuickTransactionModalProps) {
  return <TransactionModal {...props} />;
}
