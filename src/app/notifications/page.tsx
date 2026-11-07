'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Bell,
  Calendar,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  Filter,
  Shield,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { NotificationItem } from '@/lib/types';
import { formatStandardDate, formatStandardTime } from '@/lib/dateUtils';

export default function PublicNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const json = await res.json();
        setNotifications(json.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read' }),
      });
      fetchNotifications();
    } catch (e) {
      console.error(e);
    }
  };

  const filtered = notifications.filter((n) => {
    const matchesSearch =
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.description.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === 'ALL' || n.notification_type === filterType;
    return matchesSearch && matchesType;
  });

  const uniqueTypes = Array.from(new Set(notifications.map((n) => n.notification_type)));

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              Notification & Broadcast Center
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
              Realtime Active
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Browse company announcements, meeting alerts, customer enquiry notifications, and scheduled events.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchNotifications}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/admin/notifications"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition-colors"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Scheduling Hub</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Filter and Search */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notification title or content..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        <div className="relative">
          <Filter className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Categories ({notifications.length})</option>
            {uniqueTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3.5">
        {filtered.length === 0 ? (
          <div className="p-8 text-center glass-panel rounded-2xl text-slate-400 text-xs">
            No notifications found matching your search.
          </div>
        ) : (
          filtered.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl glass-panel p-5 border transition-all ${
                !item.is_read
                  ? 'border-brand-500/50 bg-slate-900/90 shadow-lg shadow-brand-500/5'
                  : 'border-slate-800 bg-slate-900/50'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        item.priority === 'Urgent'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                          : item.priority === 'High'
                          ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          : 'bg-brand-500/20 text-brand-300 border border-brand-500/30'
                      }`}
                    >
                      {item.notification_type}
                    </span>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {formatStandardDate(item.scheduled_date)} at {formatStandardTime(item.scheduled_time)}
                    </span>
                    <span
                      className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                        item.status === 'active'
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : item.status === 'scheduled'
                          ? 'bg-purple-500/20 text-purple-400'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.status}
                    </span>
                  </div>

                  <h3 className="text-sm sm:text-base font-bold text-white pt-1">{item.title}</h3>
                  <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-0.5">
                    {item.description}
                  </p>
                </div>

                <div className="flex sm:flex-col items-center sm:items-end justify-between gap-2 shrink-0 pt-2 sm:pt-0">
                  {!item.is_read ? (
                    <button
                      onClick={() => markAsRead(item.id)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 text-xs font-semibold transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Mark Read</span>
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> Read
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

