'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Briefcase,
  Bell,
  CalendarCheck,
  Settings,
  LogOut,
  Sparkles,
  Globe,
  ChevronRight,
  ArrowLeft,
} from 'lucide-react';
import { logoutAdmin } from '@/lib/auth';

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    await logoutAdmin();
    router.push('/admin');
  };

  const menuItems = [
    {
      label: 'Dashboard',
      href: '/admin/dashboard',
      icon: LayoutDashboard,
    },
    {
      label: 'Contacts',
      href: '/admin/contacts',
      icon: Users,
    },
    {
      label: 'CRM & Follow-ups',
      href: '/admin/crm',
      icon: Briefcase,
    },
    {
      label: 'Notifications',
      href: '/admin/notifications',
      icon: Bell,
    },
    {
      label: 'Settings',
      href: '/admin/settings',
      icon: Settings,
    },
  ];

  return (
    <aside className="w-64 bg-slate-950 border-r border-slate-800 flex flex-col justify-between h-screen sticky top-0 shrink-0 z-30">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800/80 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-accent-400 flex items-center justify-center text-white shadow-lg shadow-brand-500/25">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-lg tracking-tight text-white block leading-none">
                VYNZORA
              </span>
              <span className="text-[10px] uppercase font-bold tracking-widest text-brand-400">
                Admin Console
              </span>
            </div>
          </div>

          {/* Prominent "Go to Website" button */}
          <Link
            href="/"
            className="flex items-center justify-center gap-2 w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-brand-600/20 border border-slate-700/80 hover:border-brand-500/50 text-xs font-semibold text-slate-200 hover:text-white transition-all shadow-sm group"
          >
            <Globe className="w-3.5 h-3.5 text-brand-400 group-hover:scale-110 transition-transform" />
            <span>Go to Website</span>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="p-3.5 space-y-1.5">
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Administrative Menu
          </div>
          {menuItems.map((item) => {
            const isActive = item.href === '/admin/crm' ? pathname.startsWith('/admin/crm') : pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={`w-4 h-4 transition-colors ${
                      isActive ? 'text-white' : 'text-slate-400 group-hover:text-brand-300'
                    }`}
                  />
                  <span>{item.label}</span>
                </div>
                {isActive && <ChevronRight className="w-3.5 h-3.5 text-brand-200" />}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer controls & Go to Website / Logout */}
      <div className="p-4 border-t border-slate-800/80 space-y-2">
        <Link
          href="/"
          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-900 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5 text-brand-400" />
          <span>Go to Website</span>
        </Link>

        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 transition-colors text-left"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
