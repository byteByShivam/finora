'use server';

import { requireUser } from '@/server/auth/session';
import { createCategorySchema, updateCategorySchema, CreateCategoryInput, UpdateCategoryInput } from '@/lib/validation/category.schema';
import { CategoryService } from '@/server/services/category.service';
import { revalidatePath } from 'next/cache';
import { ActionResult } from '@/types/actions';
import { Category } from '@prisma/client';

export async function createCategoryAction(rawInput: CreateCategoryInput): Promise<ActionResult<Category>> {
  try {
    const user = await requireUser();
    const parsed = createCategorySchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid category data.' };
    }

    const category = await CategoryService.create(user.id, parsed.data);
    revalidatePath('/categories');
    revalidatePath('/transactions');
    return { success: true, data: category };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create category.';
    return { success: false, error: message };
  }
}

export async function updateCategoryAction(
  categoryId: string,
  rawInput: UpdateCategoryInput
): Promise<ActionResult<Category>> {
  try {
    const user = await requireUser();
    const parsed = updateCategorySchema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0]?.message || 'Invalid category data.' };
    }

    const updated = await CategoryService.update(user.id, categoryId, parsed.data);
    revalidatePath('/categories');
    revalidatePath('/transactions');
    return { success: true, data: updated };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to update category.';
    return { success: false, error: message };
  }
}

export async function deleteCategoryAction(categoryId: string): Promise<ActionResult<void>> {
  try {
    const user = await requireUser();
    await CategoryService.delete(user.id, categoryId);
    revalidatePath('/categories');
    revalidatePath('/transactions');
    return { success: true, data: undefined };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to delete category.';
    return { success: false, error: message };
  }
}
