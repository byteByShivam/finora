import { z } from 'zod';
import { CategoryType } from '@prisma/client';

export const createCategorySchema = z
  .object({
    name: z.string().min(1, 'Category name is required').max(60),
    type: z.nativeEnum(CategoryType),
    icon: z.string().max(40).optional().nullable(),
    color: z.string().max(7).optional().nullable(),
    parentId: z.string().uuid().optional().nullable(),
  })
  .strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z
  .object({
    name: z.string().min(1).max(60).optional(),
    icon: z.string().max(40).optional().nullable(),
    color: z.string().max(7).optional().nullable(),
    parentId: z.string().uuid().optional().nullable(),
  })
  .strict();

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
