import { z } from 'zod';
import { TxnType, RecurFrequency } from '@prisma/client';

export const createRecurringSchema = z
  .object({
    accountId: z.string().min(1, 'Account is required'),
    categoryId: z.string().optional().nullable(),
    type: z.nativeEnum(TxnType),
    amount: z.coerce.number().positive('Amount must be greater than zero'),
    description: z.string().max(255).optional().nullable(),
    frequency: z.nativeEnum(RecurFrequency),
    interval: z.coerce.number().int().min(1).default(1),
    startDate: z.coerce.date().default(() => new Date()),
    endDate: z.coerce.date().optional().nullable(),
  })
  .strict();

export type CreateRecurringInput = z.infer<typeof createRecurringSchema>;

export const updateRecurringSchema = z
  .object({
    accountId: z.string().min(1).optional(),
    categoryId: z.string().optional().nullable(),
    type: z.nativeEnum(TxnType).optional(),
    amount: z.coerce.number().positive().optional(),
    description: z.string().max(255).optional().nullable(),
    frequency: z.nativeEnum(RecurFrequency).optional(),
    interval: z.coerce.number().int().min(1).optional(),
    endDate: z.coerce.date().optional().nullable(),
    isActive: z.boolean().optional(),
  })
  .strict();

export type UpdateRecurringInput = z.infer<typeof updateRecurringSchema>;
