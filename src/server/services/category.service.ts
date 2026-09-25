import prisma from '@/server/db/prisma';
import { CreateCategoryInput, UpdateCategoryInput } from '@/lib/validation/category.schema';

export class CategoryService {
  /**
   * Lists all categories accessible by the user (system defaults + user custom).
   */
  static async list(userId: string) {
    return prisma.category.findMany({
      where: {
        OR: [{ userId: null }, { userId }],
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    });
  }

  /**
   * Retrieves category by ID if accessible by the user.
   */
  static async getById(userId: string, categoryId: string) {
    return prisma.category.findFirst({
      where: {
        id: categoryId,
        OR: [{ userId: null }, { userId }],
      },
    });
  }

  /**
   * Creates a user-defined custom category.
   */
  static async create(userId: string, input: CreateCategoryInput) {
    return prisma.category.create({
      data: {
        userId,
        name: input.name,
        type: input.type,
        icon: input.icon || null,
        color: input.color || null,
        parentId: input.parentId || null,
        isSystem: false,
      },
    });
  }

  /**
   * Updates a user-defined category. System categories cannot be modified.
   */
  static async update(userId: string, categoryId: string, input: UpdateCategoryInput) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });

    if (!category) {
      throw new Error('Category not found or cannot be modified.');
    }

    if (category.isSystem) {
      throw new Error('System categories cannot be modified.');
    }

    return prisma.category.update({
      where: { id: categoryId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.icon !== undefined && { icon: input.icon }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.parentId !== undefined && { parentId: input.parentId }),
      },
    });
  }

  /**
   * Deletes a user category. System categories and categories with transactions cannot be deleted.
   */
  static async delete(userId: string, categoryId: string) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, userId },
    });

    if (!category) {
      throw new Error('Category not found.');
    }

    if (category.isSystem) {
      throw new Error('System categories cannot be deleted.');
    }

    const txnCount = await prisma.transaction.count({
      where: { categoryId, userId },
    });

    if (txnCount > 0) {
      throw new Error(
        `Cannot delete category "${category.name}" because ${txnCount} transaction(s) belong to it. Please reassign them first.`
      );
    }

    return prisma.category.delete({
      where: { id: categoryId },
    });
  }
}
