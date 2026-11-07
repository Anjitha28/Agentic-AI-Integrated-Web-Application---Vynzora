'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Shield, ArrowRight } from 'lucide-react';

export default function Navbar() {
  const pathname = usePathname();

  // If currently inside the admin portal, completely hide the public website navbar
  if (pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 w-full glass-panel border-b border-slate-800/80 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-accent-400 flex items-center justify-center text-white shadow-lg shadow-brand-500/25 group-hover:scale-105 transition-transform">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-white via-slate-100 to-brand-300 bg-clip-text text-transparent">
              VYNZORA
            </span>
            <span className="text-[10px] uppercase tracking-widest text-brand-400 font-semibold -mt-1">
              Marketing & Branding
            </span>
          </div>
        </Link>

        {/* Action Buttons on Public Website */}
        <div className="flex items-center gap-3 sm:gap-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-slate-900 border border-slate-700/80 hover:border-brand-500 text-slate-200 hover:text-white hover:bg-slate-800 transition-all shadow-sm"
          >
            <Shield className="w-4 h-4 text-brand-400" />
            <span>Admin Portal</span>
          </Link>

          <a
            href="#contact-section"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-gradient-to-r from-brand-600 to-indigo-600 text-white hover:from-brand-500 hover:to-indigo-500 shadow-md shadow-brand-600/20 transition-all cursor-pointer"
          >
            <span>Get in Touch</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </header>
  );
}
