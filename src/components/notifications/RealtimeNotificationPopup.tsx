'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { NotificationItem } from '@/lib/types';
import { formatStandardDate, formatStandardTime } from '@/lib/dateUtils';
import {
  Bell,
  X,
  CheckCircle,
  ExternalLink,
  Clock,
  Calendar,
  AlertTriangle,
  Info,
  Sparkles,
} from 'lucide-react';

const STORAGE_KEY_READ_IDS = 'vynzora_read_notifications';
const STORAGE_KEY_READ_SIGS = 'vynzora_read_signatures';

function getStoredArray(key: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function storeInArray(key: string, value: string) {
  if (typeof window === 'undefined' || !value) return;
  try {
    const arr = getStoredArray(key);
    if (!arr.includes(value)) {
      arr.push(value);
      localStorage.setItem(key, JSON.stringify(arr.slice(-300)));
    }
  } catch {
    // Ignore storage errors
  }
}

export default function RealtimeNotificationPopup() {
  const [activePopup, setActivePopup] = useState<NotificationItem | null>(null);
  const [detailModalItem, setDetailModalItem] = useState<NotificationItem | null>(null);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Check if a notification is marked as read either in memory or persistently in localStorage
  const isNotificationDismissedOrRead = useCallback((n: NotificationItem): boolean => {
    if (n.is_read || n.status === 'read') return true;
    if (seenIdsRef.current.has(n.id)) return true;

    const readIds = getStoredArray(STORAGE_KEY_READ_IDS);
    if (readIds.includes(n.id)) return true;

    if (n.title && n.description) {
      const readSigs = getStoredArray(STORAGE_KEY_READ_SIGS);
      const sig = `${n.title.trim()}_${n.description.trim()}`;
      if (readSigs.includes(sig)) return true;
    }

    return false;
  }, []);

  // Check and trigger scheduled activation, then look for any newly active unread notification
  const checkForNewActiveNotifications = useCallback(async () => {
    try {
      // 1. Trigger background activation check
      await fetch('/api/notifications/activate', { method: 'POST' });

      // 2. Fetch latest notifications
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const json = await res.json();
        const items: NotificationItem[] = json.data || [];

        // Find active and unread notifications that haven't been marked as read
        const freshActive = items.filter(
          (n) =>
            (n.status === 'active' || n.status === 'unread') &&
            !n.is_read &&
            !isNotificationDismissedOrRead(n)
        );

        if (freshActive.length > 0) {
          const newest = freshActive[0];
          seenIdsRef.current.add(newest.id);
          setActivePopup(newest);
        }
      }
    } catch (e) {
      console.warn('Realtime check error:', e);
    }
  }, [isNotificationDismissedOrRead]);

  // Mark notification as read both locally and in the database
  const handleMarkAsRead = async (id: string, title?: string, description?: string) => {
    // 1. Immediately register in in-memory and persistent storage so it never shows again
    seenIdsRef.current.add(id);
    storeInArray(STORAGE_KEY_READ_IDS, id);

    const targetTitle = title || activePopup?.title || detailModalItem?.title;
    const targetDesc = description || activePopup?.description || detailModalItem?.description;
    if (targetTitle && targetDesc) {
      storeInArray(STORAGE_KEY_READ_SIGS, `${targetTitle.trim()}_${targetDesc.trim()}`);
    }

    // 2. Close active popup immediately
    if (activePopup?.id === id) {
      setActivePopup(null);
    }
    if (detailModalItem?.id === id) {
      setDetailModalItem((prev) => (prev ? { ...prev, is_read: true, status: 'read' } : null));
    }

    // 3. Notify other components on the page
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('vynzora:notification-updated'));
    }

    // 4. Update in backend database (also marks identical duplicate notifications as read)
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_read' }),
      });
    } catch (err) {
      console.error('Error marking notification as read in database:', err);
    }
  };

  // When Dismiss or X is clicked, mark as read so it never pops up again
  const handleClose = () => {
    if (activePopup) {
      handleMarkAsRead(activePopup.id, activePopup.title, activePopup.description);
    }
    setActivePopup(null);
  };

  const handleViewDetails = (notif: NotificationItem) => {
    setDetailModalItem(notif);
    setActivePopup(null);
  };

  useEffect(() => {
    // Initial check on mount
    checkForNewActiveNotifications();

    // Periodic evaluation (every 10 seconds)
    const interval = setInterval(checkForNewActiveNotifications, 10000);

    // Listen to local window updates and storage changes
    const handleUpdate = () => {
      setActivePopup((curr) => {
        if (!curr) return null;
        if (isNotificationDismissedOrRead(curr)) {
          return null;
        }
        return curr;
      });
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('vynzora:notification-updated', handleUpdate);
      window.addEventListener('storage', handleUpdate);
    }

    // Listen to Supabase Realtime channel
    let subscription: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    if (isSupabaseConfigured && supabase) {
      try {
        subscription = supabase
          .channel('public:notifications')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'notifications' },
            (payload) => {
              const newRow = payload.new as NotificationItem;
              if (
                newRow &&
                (newRow.status === 'active' || newRow.status === 'unread') &&
                !newRow.is_read &&
                !isNotificationDismissedOrRead(newRow)
              ) {
                seenIdsRef.current.add(newRow.id);
                setActivePopup(newRow);
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.warn('Supabase realtime subscription error:', err);
      }
    }

    return () => {
      clearInterval(interval);
      if (typeof window !== 'undefined') {
        window.removeEventListener('vynzora:notification-updated', handleUpdate);
        window.removeEventListener('storage', handleUpdate);
      }
      if (subscription && supabase) {
        supabase.removeChannel(subscription);
      }
    };
  }, [checkForNewActiveNotifications, isNotificationDismissedOrRead]);

  return (
    <>
      {/* Real-time Pop-up Toast */}
      {activePopup && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-slate-900/95 backdrop-blur-xl border-2 border-brand-500/80 shadow-2xl shadow-brand-500/20 rounded-2xl p-4 sm:p-5 text-white">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-brand-600/30 border border-brand-500/50 flex items-center justify-center text-brand-400">
                  <Bell className="w-5 h-5 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-brand-300">
                      Active Notification
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      LIVE
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                    <Calendar className="w-3 h-3 text-slate-500" />
                    {formatStandardDate(activePopup.scheduled_date)} at {formatStandardTime(activePopup.scheduled_time)}
                  </span>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
                title="Dismiss and mark as read"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3">
              <h4 className="text-sm font-semibold text-white leading-snug">
                {activePopup.title}
              </h4>
              <p className="text-xs text-slate-300 mt-1 line-clamp-3 leading-relaxed">
                {activePopup.description}
              </p>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
              <button
                onClick={() => handleMarkAsRead(activePopup.id, activePopup.title, activePopup.description)}
                className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 font-medium px-2 py-1 rounded hover:bg-emerald-500/10 transition-colors"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                Mark as Read
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleViewDetails(activePopup)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-md shadow-brand-600/30"
                >
                  <span>View Details</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={handleClose}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Complete Notification Details Modal */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-2xl p-6 text-white shadow-2xl relative">
            <button
              onClick={() => setDetailModalItem(null)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-brand-600/20 border border-brand-500/40 flex items-center justify-center text-brand-400">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-mono text-slate-400">ID: {detailModalItem.id}</span>
                <h3 className="text-lg font-bold text-white">{detailModalItem.title}</h3>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs mb-4">
              <div>
                <span className="text-slate-400 block">Notification Type</span>
                <span className="font-semibold text-brand-300">
                  {detailModalItem.notification_type}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Priority Level</span>
                <span
                  className={`font-semibold ${
                    detailModalItem.priority === 'Urgent'
                      ? 'text-rose-400'
                      : detailModalItem.priority === 'High'
                      ? 'text-amber-400'
                      : 'text-slate-200'
                  }`}
                >
                  {detailModalItem.priority}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Scheduled Date & Time</span>
                <span className="text-slate-200">
                  {formatStandardDate(detailModalItem.scheduled_date)} at {formatStandardTime(detailModalItem.scheduled_time)}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block">Current Status</span>
                <span className="font-semibold uppercase tracking-wider text-emerald-400">
                  {detailModalItem.status}
                </span>
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Full Description
              </h4>
              <p className="text-sm text-slate-200 bg-slate-800/40 p-4 rounded-xl border border-slate-800 leading-relaxed">
                {detailModalItem.description}
              </p>
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              {!detailModalItem.is_read ? (
                <button
                  onClick={() => handleMarkAsRead(detailModalItem.id, detailModalItem.title, detailModalItem.description)}
                  className="inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-lg bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark as Read
                </button>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                  <CheckCircle className="w-4 h-4 text-emerald-400" /> Read
                </span>
              )}

              <button
                onClick={() => setDetailModalItem(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
              >
                Close Details
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
