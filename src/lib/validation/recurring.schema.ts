import { z } from 'zod';
import { TxnType, RecurFrequency } from '@prisma/client';

export const createRecurringSchema = z
  .object({
    accountId: z.string().trim().min(1, 'Account is required'),
    transferAccountId: z.string().trim().optional().nullable(),
    categoryId: z.string().trim().optional().nullable(),
    type: z.nativeEnum(TxnType),
    amount: z.coerce
      .number()
      .finite('Amount must be a finite number')
      .positive('Amount must be greater than zero'),
    description: z.string().trim().max(255, 'Description cannot exceed 255 characters').optional().nullable(),
    notes: z.string().trim().optional().nullable(),
    frequency: z.nativeEnum(RecurFrequency),
    interval: z.coerce.number().int().min(1, 'Interval must be at least 1').default(1),
    startDate: z.coerce.date().default(() => new Date()),
    endDate: z.coerce.date().optional().nullable(),
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
  )
  .refine(
    (data) => {
      if (data.endDate && data.startDate) {
        return new Date(data.endDate) >= new Date(data.startDate);
      }
      return true;
    },
    {
      message: 'End date must be on or after start date',
      path: ['endDate'],
    }
  );

export interface CreateRecurringInput {
  accountId: string;
  transferAccountId?: string | null;
  categoryId?: string | null;
  type: TxnType;
  amount: number | string;
  description?: string | null;
  notes?: string | null;
  frequency: RecurFrequency;
  interval?: number;
  startDate?: Date | string;
  endDate?: Date | string | null;
}

export const updateRecurringSchema = z
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
    description: z.string().trim().max(255).optional().nullable(),
    notes: z.string().trim().optional().nullable(),
    frequency: z.nativeEnum(RecurFrequency).optional(),
    interval: z.coerce.number().int().min(1).optional(),
    nextRunAt: z.coerce.date().optional(),
    endDate: z.coerce.date().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.type === TxnType.transfer && data.transferAccountId && data.accountId) {
        return data.transferAccountId !== data.accountId;
      }
      return true;
    },
    {
      message: 'Source and destination accounts cannot be identical',
      path: ['transferAccountId'],
    }
  );

export interface UpdateRecurringInput {
  accountId?: string;
  transferAccountId?: string | null;
  categoryId?: string | null;
  type?: TxnType;
  amount?: number | string;
  description?: string | null;
  notes?: string | null;
  frequency?: RecurFrequency;
  interval?: number;
  nextRunAt?: Date | string;
  endDate?: Date | string | null;
  isActive?: boolean;
}
