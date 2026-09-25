import { z } from 'zod';
import { BudgetPeriod } from '@prisma/client';

export const upsertBudgetSchema = z
  .object({
    id: z.string().optional(),
    categoryId: z.string().min(1, 'Category is required'),
    amount: z.coerce.number().positive('Budget amount must be greater than zero'),
    period: z.nativeEnum(BudgetPeriod).default(BudgetPeriod.monthly),
    periodStart: z.coerce.date().default(() => new Date()),
    rolloverEnabled: z.boolean().default(false),
    alertThresholdPct: z.coerce.number().int().min(1).max(100).default(80),
  })
  .strict();

export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>;
