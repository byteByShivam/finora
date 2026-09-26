import { z } from 'zod';
import { BudgetPeriod } from '@prisma/client';

export const createBudgetSchema = z
  .object({
    categoryId: z.string().uuid('Invalid category ID'),
    amount: z.coerce
      .number()
      .finite('Budget amount must be a finite number')
      .positive('Budget amount must be greater than zero'),
    period: z.nativeEnum(BudgetPeriod).default(BudgetPeriod.monthly),
    periodStart: z.coerce.date().default(() => new Date()),
    rolloverEnabled: z.boolean().default(false),
    alertThresholdPct: z.coerce.number().int().min(1, 'Threshold must be at least 1%').max(100, 'Threshold cannot exceed 100%').default(80),
  })
  .strict();

export const updateBudgetSchema = z
  .object({
    id: z.string().uuid('Invalid budget ID'),
    amount: z.coerce
      .number()
      .finite('Budget amount must be a finite number')
      .positive('Budget amount must be greater than zero')
      .optional(),
    rolloverEnabled: z.boolean().optional(),
    alertThresholdPct: z.coerce.number().int().min(1, 'Threshold must be at least 1%').max(100, 'Threshold cannot exceed 100%').optional(),
  })
  .strict();

export const upsertBudgetSchema = z
  .object({
    id: z.string().uuid('Invalid budget ID').optional(),
    categoryId: z.string().uuid('Invalid category ID'),
    amount: z.coerce
      .number()
      .finite('Budget amount must be a finite number')
      .positive('Budget amount must be greater than zero'),
    period: z.nativeEnum(BudgetPeriod).default(BudgetPeriod.monthly),
    periodStart: z.coerce.date().default(() => new Date()),
    rolloverEnabled: z.boolean().default(false),
    alertThresholdPct: z.coerce.number().int().min(1, 'Threshold must be at least 1%').max(100, 'Threshold cannot exceed 100%').default(80),
  })
  .strict();

export interface CreateBudgetInput {
  categoryId: string;
  amount: number;
  period?: BudgetPeriod;
  periodStart?: Date | string;
  rolloverEnabled?: boolean;
  alertThresholdPct?: number;
}

export interface UpdateBudgetInput {
  id: string;
  amount?: number;
  rolloverEnabled?: boolean;
  alertThresholdPct?: number;
}

export interface UpsertBudgetInput {
  id?: string;
  categoryId: string;
  amount: number;
  period?: BudgetPeriod;
  periodStart?: Date | string;
  rolloverEnabled?: boolean;
  alertThresholdPct?: number;
}
