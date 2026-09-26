import Link from 'next/link';
import { Landmark, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AccountNotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 mb-4">
        <Landmark className="h-8 w-8" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 mb-2">Account Not Found</h1>
      <p className="text-sm text-slate-500 max-w-md mb-6">
        The account you are looking for does not exist, has been removed, or you do not have permission to access it.
      </p>
      <Link href="/accounts">
        <Button variant="outline" size="sm" className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Accounts</span>
        </Button>
      </Link>
    </div>
  );
}
