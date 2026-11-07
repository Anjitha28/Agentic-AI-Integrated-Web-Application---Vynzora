'use client';

import React, { useState, useEffect } from 'react';
import {
  Bell,
  Calendar,
  Clock,
  Plus,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Filter,
  Send,
  Zap,
} from 'lucide-react';
import { NotificationItem, NotificationType, NotificationPriority, NotificationStatus } from '@/lib/types';
import { formatStandardDate, formatStandardTime } from '@/lib/dateUtils';

const NOTIFICATION_TYPES: NotificationType[] = [
  'General Announcement',
  'Customer Enquiry',
  'CRM Follow-up',
  'Meeting Reminder',
  'Task Reminder',
  'Important Alert',
];

const PRIORITIES: NotificationPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isActivating, setIsActivating] = useState(false);
  const [activationResult, setActivationResult] = useState<string | null>(null);

  // Status Filter
  const [statusFilter, setStatusFilter] = useState<'ALL' | NotificationStatus>('ALL');

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    notification_type: NOTIFICATION_TYPES[0],
    priority: 'Medium' as NotificationPriority,
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: new Date().toTimeString().slice(0, 5),
    target_audience: 'Admins & Sales Team',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const triggerActivation = async () => {
    setIsActivating(true);
    setActivationResult(null);
    try {
      const res = await fetch('/api/notifications/activate', { method: 'POST' });
      const data = await res.json();
      setActivationResult(`Checked scheduled jobs: ${data.activatedCount} notification(s) activated.`);
      fetchNotifications();
      setTimeout(() => setActivationResult(null), 4000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsActivating(false);
    }
  };

  const markAsRead = async (id: string, title?: string, description?: string) => {
    try {
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem('vynzora_read_notifications');
          const arr: string[] = raw ? JSON.parse(raw) : [];
          if (!arr.includes(id)) {
            arr.push(id);
            localStorage.setItem('vynzora_read_notifications', JSON.stringify(arr.slice(-300)));
          }
          if (title && description) {
            const rawSigs = localStorage.getItem('vynzora_read_signatures');
            const sigs: string[] = rawSigs ? JSON.parse(rawSigs) : [];
            const sig = `${title.trim()}_${description.trim()}`;
            if (!sigs.includes(sig)) {
              sigs.push(sig);
              localStorage.setItem('vynzora_read_signatures', JSON.stringify(sigs.slice(-300)));
            }
          }
        } catch {
          // Ignore storage errors
        }
        window.dispatchEvent(new CustomEvent('vynzora:notification-updated'));
      }

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

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (res.ok) {
        setIsCreateOpen(false);
        setFormData({
          title: '',
          description: '',
          notification_type: NOTIFICATION_TYPES[0],
          priority: 'Medium',
          scheduled_date: new Date().toISOString().split('T')[0],
          scheduled_time: new Date().toTimeString().slice(0, 5),
          target_audience: 'Admins & Sales Team',
        });
        fetchNotifications();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (statusFilter === 'ALL') return true;
    return n.status === statusFilter;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Notification Management System
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
              {notifications.length} Total
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Create, schedule, monitor real-time alerts, and trigger automated activations.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={triggerActivation}
            disabled={isActivating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-semibold transition-colors disabled:opacity-50"
            title="Checks if any scheduled notifications are due and activates them"
          >
            <Zap className={`w-3.5 h-3.5 ${isActivating ? 'animate-bounce' : ''}`} />
            <span>Check Scheduled Activations</span>
          </button>

          <button
            onClick={fetchNotifications}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Create Notification</span>
          </button>
        </div>
      </div>

      {activationResult && (
        <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{activationResult}</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {(['ALL', 'active', 'scheduled', 'read', 'expired'] as const).map((st) => (
          <button
            key={st}
            onClick={() => setStatusFilter(st)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-medium capitalize transition-all ${
              statusFilter === st
                ? 'bg-brand-600 text-white shadow-md shadow-brand-600/30'
                : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            {st === 'ALL' ? `All Notifications (${notifications.length})` : st}
          </button>
        ))}
      </div>

      {/* Notifications Table */}
      <div className="rounded-2xl glass-panel border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Notification ID & Title</th>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Priority</th>
                <th className="py-3.5 px-4">Scheduled For</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Read/Unread</th>
                <th className="py-3.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredNotifications.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    No notifications in this status view.
                  </td>
                </tr>
              ) : (
                filteredNotifications.map((notif) => (
                  <tr key={notif.id} className="hover:bg-slate-800/40 transition-colors">
                    {/* ID & Title */}
                    <td className="py-4 px-4 max-w-xs">
                      <span className="font-semibold text-white block leading-snug">
                        {notif.title}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                        {notif.description}
                      </p>
                      <span className="text-[10px] font-mono text-slate-500 block mt-1">
                        ID: {notif.id.slice(0, 10)}...
                      </span>
                    </td>

                    {/* Type */}
                    <td className="py-4 px-4 text-slate-300">
                      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium bg-slate-800 text-brand-300 border border-slate-700">
                        {notif.notification_type}
                      </span>
                    </td>

                    {/* Priority */}
                    <td className="py-4 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider ${
                          notif.priority === 'Urgent'
                            ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            : notif.priority === 'High'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {notif.priority}
                      </span>
                    </td>

                    {/* Scheduled Date & Time */}
                    <td className="py-4 px-4 text-slate-300">
                      <div className="flex items-center gap-1.5 text-[11px]">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <span>{formatStandardDate(notif.scheduled_date)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3 text-slate-500" />
                        <span>{formatStandardTime(notif.scheduled_time)}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                          notif.status === 'active'
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : notif.status === 'scheduled'
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30'
                            : notif.status === 'read'
                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            notif.status === 'active' ? 'bg-emerald-400 animate-pulse' : 'bg-current'
                          }`}
                        />
                        <span>{notif.status}</span>
                      </span>
                    </td>

                    {/* Read / Unread */}
                    <td className="py-4 px-4">
                      {notif.is_read ? (
                        <span className="text-[11px] text-slate-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> Read
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-rose-400 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-rose-500" /> Unread
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-4 px-4 text-right">
                      {!notif.is_read && (
                        <button
                          onClick={() => markAsRead(notif.id, notif.title, notif.description)}
                          className="text-[11px] font-semibold text-accent-400 hover:text-accent-300"
                        >
                          Mark Read
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Notification Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-1">Create / Schedule Notification</h3>
            <p className="text-xs text-slate-400 mb-5">
              Set priority, message, and target scheduling time for automatic activation.
            </p>

            <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                  Notification Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Client Meeting Reminder: Brand Presentation"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                  Full Description *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Provide complete details, scope, or action items..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                    Notification Type
                  </label>
                  <select
                    value={formData.notification_type}
                    onChange={(e) =>
                      setFormData({ ...formData, notification_type: e.target.value as any })
                    }
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-brand-500"
                  >
                    {NOTIFICATION_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-brand-500"
                  >
                    {PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.scheduled_date}
                    onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                    Scheduled Time *
                  </label>
                  <input
                    type="time"
                    required
                    value={formData.scheduled_time}
                    onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-brand-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase text-slate-300 mb-1">
                  Target Audience
                </label>
                <input
                  type="text"
                  value={formData.target_audience}
                  onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                  placeholder="e.g. All Staff, Account Managers, Strategy Team"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white font-semibold shadow-md shadow-brand-600/30 disabled:opacity-50"
                >
                  {isSubmitting ? 'Scheduling...' : 'Create / Schedule Alert'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

