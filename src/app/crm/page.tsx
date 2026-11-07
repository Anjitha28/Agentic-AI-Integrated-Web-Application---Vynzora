'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Users,
  Briefcase,
  UserCheck,
  CheckCircle,
  Shield,
  ArrowRight,
  Sparkles,
  RefreshCw,
  Search,
} from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import LeadStatusBadge from '@/components/crm/LeadStatusBadge';
import { CrmLead, CrmSummaryStats } from '@/lib/types';
import { formatStandardDate, formatStandardDateTime } from '@/lib/dateUtils';

export default function PublicCrmPage() {
  const [stats, setStats] = useState<CrmSummaryStats | null>(null);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [sumRes, leadsRes] = await Promise.all([
        fetch('/api/crm/summary'),
        fetch('/api/crm/leads'),
      ]);

      if (sumRes.ok) {
        const sum = await sumRes.json();
        setStats(sum.data);
      }
      if (leadsRes.ok) {
        const lJson = await leadsRes.json();
        setLeads(lJson.data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = leads.filter(
    (l) =>
      l.contact?.company_name.toLowerCase().includes(search.toLowerCase()) ||
      l.contact?.service_required.toLowerCase().includes(search.toLowerCase()) ||
      l.lead_status.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="py-12 sm:py-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              CRM Intelligence Overview
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
              Supabase PostgreSQL
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-300 mt-1">
            Real-time pipeline transparency powered by Supabase PostgreSQL.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/admin/crm"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition-colors"
          >
            <Shield className="w-3.5 h-3.5" />
            <span>Admin Management Console</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Contacts"
          value={stats?.totalContacts ?? '—'}
          subtitle="Registered inquiries"
          icon={Users}
          color="brand"
        />
        <StatCard
          title="New Leads"
          value={stats?.newLeads ?? '—'}
          subtitle="Fresh submissions"
          icon={Sparkles}
          color="cyan"
        />
        <StatCard
          title="Active Opportunities"
          value={stats?.interestedCustomers ?? '—'}
          subtitle="Proposals active"
          icon={Briefcase}
          color="amber"
        />
        <StatCard
          title="Converted Clients"
          value={stats?.convertedLeads ?? '—'}
          subtitle="Successful partnerships"
          icon={CheckCircle}
          color="emerald"
        />
      </div>

      {/* Search Input */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by company, service, or status..."
          className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
        />
      </div>

      {/* Public Pipeline Table */}
      <div className="rounded-2xl glass-panel border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Client Company</th>
                <th className="py-3.5 px-4">Service Category</th>
                <th className="py-3.5 px-4">Pipeline Status</th>
                <th className="py-3.5 px-4">Created Date & Time</th>
                <th className="py-3.5 px-4 text-right">Access</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No matching pipeline entries.
                  </td>
                </tr>
              ) : (
                filtered.map((lead) => (
                  <tr key={lead.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {lead.contact?.company_name || 'Client Corporation'}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      {lead.contact?.service_required || 'Marketing Strategy'}
                    </td>
                    <td className="py-3.5 px-4">
                      <LeadStatusBadge status={lead.lead_status} />
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono">
                      {formatStandardDateTime(lead.created_at)}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <Link
                        href="/admin/crm"
                        className="text-[11px] font-semibold text-brand-400 hover:text-brand-300"
                      >
                        Admin Edit &rarr;
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

