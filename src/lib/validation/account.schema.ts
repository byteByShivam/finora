import { z } from 'zod';
import { AccountType } from '@prisma/client';

export const createAccountSchema = z
  .object({
    name: z.string().trim().min(1, 'Account name is required').max(100, 'Account name cannot exceed 100 characters'),
    type: z.nativeEnum(AccountType),
    currency: z.string().trim().length(3, 'Currency must be a 3-letter ISO code').optional().default('INR'),
    openingBalance: z.coerce.number().default(0),
    creditLimit: z.coerce.number().min(0, 'Credit limit must be positive or zero').optional().nullable(),
    color: z.string().trim().max(7).optional().nullable(),
    icon: z.string().trim().max(40).optional().nullable(),
  })
  .strict();

export interface CreateAccountInput {
  name: string;
  type: AccountType;
  currency?: string;
  openingBalance?: number | string;
  creditLimit?: number | string | null;
  color?: string | null;
  icon?: string | null;
}

export const updateAccountSchema = z
  .object({
    name: z.string().trim().min(1, 'Account name cannot be empty').max(100, 'Account name cannot exceed 100 characters').optional(),
    color: z.string().trim().max(7).optional().nullable(),
    icon: z.string().trim().max(40).optional().nullable(),
    creditLimit: z.coerce.number().min(0, 'Credit limit must be positive or zero').optional().nullable(),
  })
  .strict();

export interface UpdateAccountInput {
  name?: string;
  color?: string | null;
  icon?: string | null;
  creditLimit?: number | string | null;
}
