'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import AdminSidebar from '@/components/layout/AdminSidebar';
import { getStoredAdmin } from '@/lib/auth';
import RealtimeNotificationPopup from '@/components/notifications/RealtimeNotificationPopup';
import VynzoraFloatingAssistant from '@/components/ai/VynzoraFloatingAssistant';
import { Sparkles, Globe, ArrowLeft, Shield, Bell } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  const isLoginPage = pathname === '/admin';

  useEffect(() => {
    if (isLoginPage) {
      setAuthorized(true);
      return;
    }

    const admin = getStoredAdmin();
    if (!admin || admin.role !== 'admin') {
      router.push('/admin');
    } else {
      setAuthorized(true);
    }
  }, [pathname, isLoginPage, router]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  if (authorized === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-brand-600 flex items-center justify-center animate-spin">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <p className="text-xs text-slate-400">Verifying administrative credentials...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row text-slate-100">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-x-hidden">
        {/* Top Bar for Admin Header */}
        <header className="h-14 px-4 sm:px-8 border-b border-slate-800/80 bg-slate-950/70 backdrop-blur-md flex items-center justify-between sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Admin Portal
            </span>
            <span className="text-slate-600">/</span>
            <span className="text-xs font-bold text-white capitalize">
              {pathname.replace('/admin/', '').replace('/admin', 'Dashboard')}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/notifications"
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 text-xs"
              title="Admin Notifications"
            >
              <Bell className="w-4 h-4 text-brand-400" />
              <span className="hidden sm:inline">Alerts</span>
            </Link>

            <Link
              href="/"
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-sm"
            >
              <Globe className="w-3.5 h-3.5 text-brand-400" />
              <span>Go to Website</span>
            </Link>
          </div>
        </header>

        {/* Admin Content Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-8 lg:p-10">
          <RealtimeNotificationPopup />
          {children}
          <VynzoraFloatingAssistant />
        </main>
      </div>
    </div>
  );
}
