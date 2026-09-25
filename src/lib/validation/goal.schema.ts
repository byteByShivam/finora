import { z } from 'zod';
import { GoalStatus } from '@prisma/client';

export const createGoalSchema = z
  .object({
    name: z.string().min(1, 'Goal name is required').max(120),
    targetAmount: z.coerce.number().positive('Target amount must be greater than zero'),
    targetDate: z.coerce.date().optional().nullable(),
    accountId: z.string().uuid().optional().nullable(),
    icon: z.string().max(40).optional().nullable(),
    color: z.string().max(7).optional().nullable(),
  })
  .strict();

export type CreateGoalInput = z.infer<typeof createGoalSchema>;

export const updateGoalSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    targetAmount: z.coerce.number().positive().optional(),
    targetDate: z.coerce.date().optional().nullable(),
    accountId: z.string().uuid().optional().nullable(),
    icon: z.string().max(40).optional().nullable(),
    color: z.string().max(7).optional().nullable(),
    status: z.nativeEnum(GoalStatus).optional(),
  })
  .strict();

export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

export const contributeGoalSchema = z
  .object({
    goalId: z.string().min(1, 'Goal is required'),
    transactionId: z.string().min(1, 'Transaction reference is required'),
    amount: z.coerce.number().positive('Contribution amount must be greater than zero'),
  })
  .strict();

export type ContributeGoalInput = z.infer<typeof contributeGoalSchema>;
