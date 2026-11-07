'use client';

import React, { useState } from 'react';
import {
  Settings,
  Database,
  Sliders,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  Copy,
  Layers,
  Clock,
} from 'lucide-react';

export default function AdminSettingsPage() {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyToClipboard = (text: string, keyName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(keyName);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="pb-2 border-b border-slate-800">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Application Settings & System Preferences
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Database configurations, data formats, and administrative CRM preferences.
        </p>
      </div>

      {/* Database Connection & Cloud Architecture */}
      <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-slate-800 shadow-xl space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
            <Database className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">Supabase PostgreSQL Architecture</h3>
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Connected & Healthy</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">Primary relational database engine and real-time replication service</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 pt-2">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-slate-400 block text-[11px] uppercase font-semibold">Engine</span>
            <span className="font-semibold text-white text-sm">PostgreSQL 15+</span>
            <p className="text-slate-500 text-[11px] mt-0.5">Managed cloud database cluster</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-slate-400 block text-[11px] uppercase font-semibold">Realtime Engine</span>
            <span className="font-semibold text-emerald-400 text-sm">WebSocket Pub/Sub</span>
            <p className="text-slate-500 text-[11px] mt-0.5">Instant browser notification sync</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800">
            <span className="text-slate-400 block text-[11px] uppercase font-semibold">Security & Access</span>
            <span className="font-semibold text-brand-300 text-sm">Service Role & RLS</span>
            <p className="text-slate-500 text-[11px] mt-0.5">Strict database row policies</p>
          </div>
        </div>
      </div>

      {/* Agency & CRM Preferences */}
      <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
            <Sliders className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Standard Formats & Preferences</h3>
            <p className="text-xs text-slate-400">Global formatting standards applied across all CRM and notification modules</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs pt-2">
          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-400 block text-[11px] uppercase font-semibold">Standard Date Format</span>
            <span className="font-mono text-brand-300 font-semibold text-sm">YYYY-MM-DD</span>
            <p className="text-slate-500 text-[11px]">Enforced across all customer tables, leads, and database queries.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-400 block text-[11px] uppercase font-semibold">Standard Time Format</span>
            <span className="font-mono text-brand-300 font-semibold text-sm">HH:mm (24-Hour)</span>
            <p className="text-slate-500 text-[11px]">Used for scheduled notifications, timestamps, and activity logs.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-400 block text-[11px] uppercase font-semibold">Lead Deduplication</span>
            <span className="font-mono text-emerald-400 font-semibold text-sm">Active & Enforced</span>
            <p className="text-slate-500 text-[11px]">Prevents duplicate pipeline rows and twin notification alerts on submission.</p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-slate-400 block text-[11px] uppercase font-semibold">Scheduled Activation</span>
            <span className="font-mono text-indigo-400 font-semibold text-sm">Automatic CRON & Polling</span>
            <p className="text-slate-500 text-[11px]">Background activation evaluates scheduled alerts every 10 seconds.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
