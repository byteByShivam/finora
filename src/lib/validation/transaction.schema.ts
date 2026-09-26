import { z } from 'zod';
import { TxnType } from '@prisma/client';

export const createTransactionSchema = z
  .object({
    accountId: z.string().trim().min(1, 'Account is required'),
    transferAccountId: z.string().trim().optional().nullable(),
    categoryId: z.string().trim().optional().nullable(),
    type: z.nativeEnum(TxnType),
    amount: z.coerce
      .number()
      .finite('Amount must be a finite number')
      .positive('Amount must be greater than zero'),
    currency: z.string().trim().length(3, 'Currency must be 3 characters').optional().default('INR'),
    description: z.string().trim().max(255, 'Description cannot exceed 255 characters').optional().nullable(),
    notes: z.string().trim().optional().nullable(),
    occurredAt: z.coerce.date().optional().default(() => new Date()),
    recurringTransactionId: z.string().uuid().optional().nullable(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.type === TxnType.transfer) {
        return !!data.transferAccountId && data.transferAccountId !== data.accountId;
      }
      return true;
    },
    {
      message: 'Transfer requires a distinct destination account',
      path: ['transferAccountId'],
    }
  );

export interface CreateTransactionInput {
  accountId: string;
  transferAccountId?: string | null;
  categoryId?: string | null;
  type: TxnType;
  amount: number | string;
  currency?: string;
  description?: string | null;
  notes?: string | null;
  occurredAt?: Date | string;
  recurringTransactionId?: string | null;
}

export const updateTransactionSchema = z
  .object({
    accountId: z.string().trim().min(1).optional(),
    transferAccountId: z.string().trim().optional().nullable(),
    categoryId: z.string().trim().optional().nullable(),
    type: z.nativeEnum(TxnType).optional(),
    amount: z.coerce
      .number()
      .finite('Amount must be a finite number')
      .positive('Amount must be greater than zero')
      .optional(),
    currency: z.string().trim().length(3).optional(),
    description: z.string().trim().max(255).optional().nullable(),
    notes: z.string().trim().optional().nullable(),
    occurredAt: z.coerce.date().optional(),
  })
  .strict();

export interface UpdateTransactionInput {
  accountId?: string;
  transferAccountId?: string | null;
  categoryId?: string | null;
  type?: TxnType;
  amount?: number | string;
  currency?: string;
  description?: string | null;
  notes?: string | null;
  occurredAt?: Date | string;
}

export const transactionFilterSchema = z
  .object({
    accountId: z.string().trim().optional(),
    categoryId: z.string().trim().optional(),
    type: z.nativeEnum(TxnType).optional(),
    search: z.string().trim().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    sortBy: z
      .enum(['newest', 'oldest', 'highest_amount', 'lowest_amount'])
      .optional()
      .default('newest'),
    page: z.coerce.number().int().positive().optional().default(1),
    pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
  })
  .strict();

export interface TransactionFilterInput {
  accountId?: string;
  categoryId?: string;
  type?: TxnType;
  search?: string;
  startDate?: Date;
  endDate?: Date;
  sortBy?: 'newest' | 'oldest' | 'highest_amount' | 'lowest_amount';
  page?: number;
  pageSize?: number;
}
