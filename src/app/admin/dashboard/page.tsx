'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Briefcase,
  UserCheck,
  CheckCircle,
  Bell,
  Clock,
  ArrowUpRight,
  Sparkles,
  RefreshCw,
  Plus,
  Send,
} from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import AnalyticsCharts from '@/components/ui/AnalyticsCharts';
import { CrmSummaryStats, CrmLead, Contact, CrmActivity } from '@/lib/types';
import CreateContactModal from '@/components/crm/CreateContactModal';
import { formatStandardDate, formatStandardDateTime } from '@/lib/dateUtils';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<CrmSummaryStats | null>(null);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [sumRes, leadsRes, contactsRes, actRes] = await Promise.all([
        fetch('/api/crm/summary'),
        fetch('/api/crm/leads'),
        fetch('/api/crm/contacts'),
        fetch('/api/crm/activities'),
      ]);

      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setStats(sumData.data);
      }
      if (leadsRes.ok) {
        const leadsData = await leadsRes.json();
        setLeads(leadsData.data || []);
      }
      if (contactsRes.ok) {
        const cData = await contactsRes.json();
        setContacts(cData.data || []);
      }
      if (actRes.ok) {
        const actData = await actRes.json();
        setActivities(actData.data || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Top Welcome & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Executive Dashboard
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Live Database Connected
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Real-time business performance, client enquiries, notifications, and CRM pipeline.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchDashboardData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 transition-colors"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-lg shadow-brand-600/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Contact</span>
          </button>

          <Link
            href="/admin/notifications"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-all border border-slate-700"
          >
            <Bell className="w-4 h-4 text-brand-400" />
            <span>Schedule Alert</span>
          </Link>
        </div>
      </div>

      {/* 6 Key Overview Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard
          title="Total Contacts"
          value={stats?.totalContacts ?? '—'}
          subtitle="Registered clients"
          icon={Users}
          color="brand"
        />
        <StatCard
          title="Total Leads"
          value={stats?.totalLeads ?? '—'}
          subtitle="Pipeline entries"
          icon={Briefcase}
          color="cyan"
        />
        <StatCard
          title="New Enquiries"
          value={stats?.newLeads ?? '—'}
          subtitle="Awaiting first touch"
          icon={UserCheck}
          color="amber"
        />
        <StatCard
          title="Converted"
          value={stats?.convertedLeads ?? '—'}
          subtitle="Signed contracts"
          icon={CheckCircle}
          color="emerald"
        />
        <StatCard
          title="Active Alerts"
          value={stats?.activeNotifications ?? '—'}
          subtitle="Unread notifications"
          icon={Bell}
          color="rose"
        />
        <StatCard
          title="Upcoming Alerts"
          value={stats?.upcomingNotifications ?? '—'}
          subtitle="Scheduled events"
          icon={Clock}
          color="purple"
        />
      </div>

      {/* Visual Analytics Charts */}
      <AnalyticsCharts leads={leads} contacts={contacts} />

      {/* Recent CRM Activities Feed & Quick Navigation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Activities */}
        <div className="lg:col-span-2 rounded-2xl glass-panel p-6 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Recent CRM Activities</h3>
              <p className="text-xs text-slate-400">Audit trail of lead updates and form submissions</p>
            </div>
            <Link
              href="/admin/crm"
              className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-3">
            {activities.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">No recent activities logged.</p>
            ) : (
              activities.slice(0, 5).map((act) => (
                <div
                  key={act.id}
                  className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-brand-400 mt-2 shrink-0" />
                    <div>
                      <h4 className="text-xs font-semibold text-white">{act.activity_type}</h4>
                      <p className="text-xs text-slate-300 mt-0.5">{act.description}</p>
                      <span className="text-[10px] text-slate-500 mt-1 block">
                        Logged by: {act.created_by || 'System'}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 whitespace-nowrap font-mono">
                    {formatStandardDateTime(act.activity_date)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Management Shortcuts */}
        <div className="rounded-2xl glass-panel p-6 border border-slate-800 shadow-xl space-y-4">
          <h3 className="text-base font-bold text-white">Administrative Shortcuts</h3>
          <p className="text-xs text-slate-400">Direct links to CRM & notification functions</p>

          <div className="space-y-2.5">
            <Link
              href="/admin/crm"
              className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-brand-500/50 flex items-center justify-between text-xs font-semibold text-slate-200 hover:text-white transition-all group"
            >
              <span>Manage CRM Pipeline & Statuses</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-brand-400 transition-colors" />
            </Link>

            <Link
              href="/admin/contacts"
              className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-brand-500/50 flex items-center justify-between text-xs font-semibold text-slate-200 hover:text-white transition-all group"
            >
              <span>Customer Contact Directory</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-brand-400 transition-colors" />
            </Link>

            <Link
              href="/admin/notifications"
              className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-brand-500/50 flex items-center justify-between text-xs font-semibold text-slate-200 hover:text-white transition-all group"
            >
              <span>Schedule Notifications & Alerts</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-brand-400 transition-colors" />
            </Link>

            <Link
              href="/admin/crm?view=followups"
              className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-brand-500/50 flex items-center justify-between text-xs font-semibold text-slate-200 hover:text-white transition-all group"
            >
              <span>Pending Customer Follow-ups</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-brand-400 transition-colors" />
            </Link>

            <Link
              href="/admin/settings"
              className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-brand-500/50 flex items-center justify-between text-xs font-semibold text-slate-200 hover:text-white transition-all group"
            >
              <span>Supabase Database Credentials</span>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-brand-400 transition-colors" />
            </Link>
          </div>
        </div>
      </div>

      <CreateContactModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchDashboardData}
      />
    </div>
  );
}

