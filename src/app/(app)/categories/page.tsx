import { requireUser } from '@/server/auth/session';
import { CategoryService } from '@/server/services/category.service';
import { CategoriesView } from '@/components/categories/categories-view';

export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const user = await requireUser();
  const categories = await CategoryService.list(user.id);

  return <CategoriesView categories={categories} />;
}
