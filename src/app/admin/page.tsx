'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { loginAdmin, getStoredAdmin } from '@/lib/auth';
import { Shield, Lock, Mail, Sparkles, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('admin@vynzora.com');
  const [password, setPassword] = useState('admin123');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const existing = getStoredAdmin();
    if (existing && existing.role === 'admin') {
      router.push('/admin/dashboard');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const res = await loginAdmin(email, password);
    if (res.success) {
      router.push('/admin/dashboard');
    } else {
      setError(res.error || 'Authentication failed. Please verify credentials.');
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = async () => {
    setIsLoading(true);
    setError(null);
    const res = await loginAdmin('admin@vynzora.com', 'admin123');
    if (res.success) {
      router.push('/admin/dashboard');
    } else {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Top right Go to Website button */}
      <div className="absolute top-6 right-6 z-20">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-semibold text-slate-300 hover:text-white transition-all shadow-sm"
        >
          <span>Go to Website</span>
          <ArrowRight className="w-3.5 h-3.5 text-brand-400" />
        </Link>
      </div>

      {/* Decorative background glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Branding header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-brand-600 via-indigo-600 to-accent-400 flex items-center justify-center text-white shadow-xl shadow-brand-500/30 group-hover:scale-105 transition-transform">
              <Sparkles className="w-6 h-6" />
            </div>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            VYNZORA ADMIN
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Enterprise CRM & Notification Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-2xl">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-300 text-xs font-semibold w-fit mb-5">
            <Shield className="w-3.5 h-3.5" />
            <span>Role-Based Access Protected</span>
          </div>

          {error && (
            <div className="p-3 mb-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Admin Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@vynzora.com"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white font-semibold text-xs transition-all shadow-lg shadow-brand-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <span>Authenticating Admin...</span>
              ) : (
                <>
                  <span>Enter Admin Console</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          {/* Quick 1-Click Demo Login */}
          <div className="mt-6 pt-5 border-t border-slate-800/80">
            <button
              onClick={handleQuickDemoLogin}
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-slate-200 text-xs font-medium transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>1-Click Fast Login (Demo Admin)</span>
            </button>
            <p className="text-[11px] text-slate-500 text-center mt-2">
              Default credentials: <code className="text-slate-400">admin@vynzora.com</code> / <code className="text-slate-400">admin123</code>
            </p>
          </div>
        </div>

        {/* Back to public website */}
        <div className="text-center mt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors shadow-sm"
          >
            <ArrowRight className="w-3.5 h-3.5 rotate-180 text-brand-400" />
            <span>Go to Website</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

