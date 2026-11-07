'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminFollowupsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/crm?view=followups');
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-medium text-slate-300">Opening Integrated CRM & Follow-ups...</p>
        <p className="text-xs text-slate-500">Redirecting to /admin/crm?view=followups</p>
      </div>
    </div>
  );
}
