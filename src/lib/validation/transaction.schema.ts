import { z } from 'zod';
import { TxnType } from '@prisma/client';

export const createTransactionSchema = z
  .object({
    accountId: z.string().min(1, 'Account is required'),
    transferAccountId: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
    type: z.nativeEnum(TxnType),
    amount: z.number().positive('Amount must be greater than zero'),
    currency: z.string().length(3).optional().default('INR'),
    description: z.string().max(255).optional().nullable(),
    notes: z.string().optional().nullable(),
    occurredAt: z.date().optional().default(() => new Date()),
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

export type CreateTransactionInput = z.input<typeof createTransactionSchema>;

export const updateTransactionSchema = z
  .object({
    accountId: z.string().min(1).optional(),
    transferAccountId: z.string().optional().nullable(),
    categoryId: z.string().optional().nullable(),
    type: z.nativeEnum(TxnType).optional(),
    amount: z.number().positive().optional(),
    currency: z.string().length(3).optional(),
    description: z.string().max(255).optional().nullable(),
    notes: z.string().optional().nullable(),
    occurredAt: z.date().optional(),
  })
  .strict();

export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>;

export const transactionFilterSchema = z.object({
  accountId: z.string().optional(),
  categoryId: z.string().optional(),
  type: z.nativeEnum(TxnType).optional(),
  search: z.string().optional(),
  startDate: z.date().optional(),
  endDate: z.date().optional(),
  page: z.number().int().positive().optional().default(1),
  pageSize: z.number().int().positive().max(100).optional().default(20),
});

export type TransactionFilterInput = Partial<z.input<typeof transactionFilterSchema>>;
