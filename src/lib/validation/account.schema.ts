import { z } from 'zod';
import { AccountType } from '@prisma/client';

export const createAccountSchema = z
  .object({
    name: z.string().min(1, 'Account name is required').max(100),
    type: z.nativeEnum(AccountType),
    currency: z.string().length(3).default('INR'),
    openingBalance: z.coerce.number().default(0),
    creditLimit: z.coerce.number().optional().nullable(),
    color: z.string().max(7).optional().nullable(),
    icon: z.string().max(40).optional().nullable(),
  })
  .strict();

export type CreateAccountInput = z.infer<typeof createAccountSchema>;

export const updateAccountSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    color: z.string().max(7).optional().nullable(),
    icon: z.string().max(40).optional().nullable(),
    creditLimit: z.coerce.number().optional().nullable(),
  })
  .strict();

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
