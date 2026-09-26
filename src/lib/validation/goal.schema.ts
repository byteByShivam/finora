import { z } from 'zod';
import { GoalStatus } from '@prisma/client';

export const createGoalSchema = z
  .object({
    name: z.string().trim().min(1, 'Goal name is required').max(120, 'Goal name cannot exceed 120 characters'),
    description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
    targetAmount: z.coerce
      .number()
      .finite('Target amount must be a finite number')
      .positive('Target amount must be greater than zero'),
    targetDate: z.coerce.date().optional().nullable(),
    accountId: z.string().uuid('Invalid account ID').optional().nullable(),
    icon: z.string().trim().max(40).optional().nullable(),
    color: z.string().trim().max(7).optional().nullable(),
  })
  .strict();

export interface CreateGoalInput {
  name: string;
  description?: string | null;
  targetAmount: number;
  targetDate?: Date | string | null;
  accountId?: string | null;
  icon?: string | null;
  color?: string | null;
}

export const updateGoalSchema = z
  .object({
    name: z.string().trim().min(1, 'Goal name is required').max(120, 'Goal name cannot exceed 120 characters').optional(),
    description: z.string().trim().max(500, 'Description cannot exceed 500 characters').optional().nullable(),
    targetAmount: z.coerce
      .number()
      .finite('Target amount must be a finite number')
      .positive('Target amount must be greater than zero')
      .optional(),
    targetDate: z.coerce.date().optional().nullable(),
    accountId: z.string().uuid('Invalid account ID').optional().nullable(),
    icon: z.string().trim().max(40).optional().nullable(),
    color: z.string().trim().max(7).optional().nullable(),
    status: z.nativeEnum(GoalStatus).optional(),
  })
  .strict();

export interface UpdateGoalInput {
  name?: string;
  description?: string | null;
  targetAmount?: number;
  targetDate?: Date | string | null;
  accountId?: string | null;
  icon?: string | null;
  color?: string | null;
  status?: GoalStatus;
}

export const addContributionSchema = z
  .object({
    goalId: z.string().uuid('Invalid goal ID'),
    amount: z.coerce
      .number()
      .finite('Contribution amount must be a finite number')
      .positive('Contribution amount must be greater than zero'),
    date: z.coerce.date().optional().default(() => new Date()),
    note: z.string().trim().max(255, 'Note cannot exceed 255 characters').optional().nullable(),
    sourceAccountId: z.string().uuid('Invalid source account ID').optional().nullable(),
    transactionId: z.string().uuid('Invalid transaction ID').optional().nullable(),
  })
  .strict();

export interface AddContributionInput {
  goalId: string;
  amount: number;
  date?: Date | string;
  note?: string | null;
  sourceAccountId?: string | null;
  transactionId?: string | null;
}

// Backward-compatible alias for existing imports
export const contributeGoalSchema = addContributionSchema;
export type ContributeGoalInput = AddContributionInput;

export const updateContributionSchema = z
  .object({
    id: z.string().uuid('Invalid contribution ID'),
    amount: z.coerce
      .number()
      .finite('Amount must be a finite number')
      .positive('Amount must be greater than zero')
      .optional(),
    note: z.string().trim().max(255).optional().nullable(),
    date: z.coerce.date().optional(),
  })
  .strict();

export interface UpdateContributionInput {
  id: string;
  amount?: number;
  note?: string | null;
  date?: Date | string;
}
