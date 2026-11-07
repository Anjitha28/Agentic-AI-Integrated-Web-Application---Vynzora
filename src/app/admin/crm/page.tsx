'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Users,
  Briefcase,
  UserCheck,
  CheckCircle,
  XCircle,
  CalendarCheck,
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  RefreshCw,
  Edit,
  Trash2,
  Calendar,
  Sparkles,
  Building2,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import LeadStatusBadge from '@/components/crm/LeadStatusBadge';
import ContactDetailsModal from '@/components/crm/ContactDetailsModal';
import CreateContactModal from '@/components/crm/CreateContactModal';
import { CrmLead, LeadStatus, CrmSummaryStats } from '@/lib/types';
import { formatStandardDate, formatStandardTime, formatStandardDateTime, formatStandardDateWithTime } from '@/lib/dateUtils';

const LEAD_STATUS_OPTIONS: (LeadStatus | 'ALL')[] = [
  'ALL',
  'New',
  'Contacted',
  'Interested',
  'Follow-up Required',
  'Converted',
  'Lost',
];

function AdminCrmContent() {
  const searchParams = useSearchParams();
  const initialView = searchParams.get('view') === 'followups' ? 'followups' : 'pipeline';

  const [activeTab, setActiveTab] = useState<'pipeline' | 'followups'>(initialView);

  useEffect(() => {
    const view = searchParams.get('view');
    if (view === 'followups') {
      setActiveTab('followups');
    } else if (view === 'pipeline') {
      setActiveTab('pipeline');
    }
  }, [searchParams]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [stats, setStats] = useState<CrmSummaryStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters and sorting
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'ALL'>('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'company' | 'status'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Modals
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  const fetchCrmData = async () => {
    setIsLoading(true);
    try {
      const [leadsRes, sumRes] = await Promise.all([
        fetch('/api/crm/leads'),
        fetch('/api/crm/summary'),
      ]);

      if (leadsRes.ok) {
        const json = await leadsRes.json();
        setLeads(json.data || []);
      }
      if (sumRes.ok) {
        const sumJson = await sumRes.json();
        setStats(sumJson.data);
      }
    } catch (err) {
      console.error('Fetch CRM error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCrmData();
  }, []);

  const handleQuickStatusChange = async (leadId: string, newStatus: LeadStatus, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/crm/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead_status: newStatus }),
      });
      if (res.ok) {
        fetchCrmData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Are you sure you want to delete this contact and lead?')) return;
    try {
      await fetch(`/api/crm/contacts?id=${contactId}`, { method: 'DELETE' });
      fetchCrmData();
    } catch (e) {
      console.error(e);
    }
  };

  // Follow-up leads list
  const followUpLeads = leads.filter(
    (l) => l.lead_status === 'Follow-up Required' || Boolean(l.follow_up_date)
  );

  // Filter and sort for the Pipeline table
  const filteredLeads = leads
    .filter((l) => {
      const contact = l.contact;
      const matchesSearch =
        contact?.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact?.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact?.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        contact?.phone_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        l.assigned_to?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus = statusFilter === 'ALL' || l.lead_status === statusFilter;

      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'name') {
        comparison = (a.contact?.full_name || '').localeCompare(b.contact?.full_name || '');
      } else if (sortBy === 'company') {
        comparison = (a.contact?.company_name || '').localeCompare(b.contact?.company_name || '');
      } else if (sortBy === 'status') {
        comparison = a.lead_status.localeCompare(b.lead_status);
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              CRM & Follow-ups Management
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {leads.length} Total Leads
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Integrated customer pipeline, stage transitions, and scheduled follow-up reminders.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchCrmData}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            title="Refresh CRM Data"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold shadow-md shadow-brand-600/30 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add New Contact</span>
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <StatCard
          title="Total Contacts"
          value={stats?.totalContacts ?? '—'}
          subtitle="All inquiries"
          icon={Users}
          color="brand"
        />
        <StatCard
          title="New Leads"
          value={stats?.newLeads ?? '—'}
          subtitle="Unassigned / fresh"
          icon={Sparkles}
          color="cyan"
        />
        <StatCard
          title="Contacted"
          value={stats?.contactedLeads ?? '—'}
          subtitle="Outreach initiated"
          icon={UserCheck}
          color="purple"
        />
        <StatCard
          title="Interested"
          value={stats?.interestedCustomers ?? '—'}
          subtitle="Proposal stage"
          icon={Briefcase}
          color="amber"
        />
        <div
          onClick={() => setActiveTab('followups')}
          className="cursor-pointer transition-transform hover:scale-[1.02]"
        >
          <StatCard
            title="Follow-ups Due"
            value={stats?.followUpRequired ?? followUpLeads.length}
            subtitle="Requires touchpoint"
            icon={CalendarCheck}
            color="rose"
          />
        </div>
        <StatCard
          title="Converted"
          value={stats?.convertedLeads ?? '—'}
          subtitle="Clients closed"
          icon={CheckCircle}
          color="emerald"
        />
      </div>

      {/* Integrated View Switcher Tabs */}
      <div className="flex items-center gap-3 border-b border-slate-800 pb-2">
        <button
          onClick={() => setActiveTab('pipeline')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'pipeline'
              ? 'bg-brand-600 text-white shadow-lg shadow-brand-600/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          <span>Pipeline & Leads Table</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-800/80 text-brand-200">
            {leads.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('followups')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all ${
            activeTab === 'followups'
              ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30'
              : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <CalendarCheck className="w-4 h-4" />
          <span>Customer Follow-ups Tracker</span>
          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500/20 text-amber-300 font-bold">
            {followUpLeads.length} Action Items
          </span>
        </button>
      </div>

      {/* TAB 1: PIPELINE & LEADS TABLE */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Search, Filter, Sort Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by customer, company, strategist, email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Lead Status Filter */}
            <div className="relative">
              <Filter className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                {LEAD_STATUS_OPTIONS.map((st) => (
                  <option key={st} value={st}>
                    {st === 'ALL' ? `All Lead Statuses (${leads.length})` : st}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <ArrowUpDown className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="date">Sort by Date</option>
                  <option value="name">Sort by Customer Name</option>
                  <option value="company">Sort by Company</option>
                  <option value="status">Sort by Status</option>
                </select>
              </div>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-300 hover:text-white"
              >
                {sortOrder.toUpperCase()}
              </button>
            </div>
          </div>

          {/* CRM Contact Table */}
          <div className="rounded-2xl glass-panel border border-slate-800 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                  <tr>
                    <th className="py-3.5 px-4">Contact ID & Name</th>
                    <th className="py-3.5 px-4">Company & Service</th>
                    <th className="py-3.5 px-4">Direct Contact</th>
                    <th className="py-3.5 px-4">Lead Status</th>
                    <th className="py-3.5 px-4">Follow-up Due</th>
                    <th className="py-3.5 px-4">Date & Time Updated</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredLeads.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No CRM records found matching the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredLeads.map((lead) => {
                      const contact = lead.contact;
                      return (
                        <tr
                          key={lead.id}
                          onClick={() => setSelectedLead(lead)}
                          className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                        >
                          {/* Contact ID & Name */}
                          <td className="py-4 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-300 font-bold text-xs shrink-0">
                                {contact?.full_name[0]?.toUpperCase() || 'L'}
                              </div>
                              <div>
                                <span className="font-semibold text-white group-hover:text-brand-300 transition-colors block leading-tight">
                                  {contact?.full_name || 'Enquiry Client'}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  {contact?.id ? contact.id.slice(0, 10) : lead.id.slice(0, 10)}...
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* Company & Service */}
                          <td className="py-4 px-4">
                            <span className="font-medium text-slate-200 block">
                              {contact?.company_name}
                            </span>
                            <span className="text-[11px] text-brand-300">
                              {contact?.service_required}
                            </span>
                          </td>

                          {/* Contact Email & Phone */}
                          <td className="py-4 px-4 text-slate-300 space-y-0.5">
                            <span className="block text-slate-200">{contact?.email}</span>
                            <span className="text-[11px] text-slate-400 block">{contact?.phone_number}</span>
                          </td>

                          {/* Lead Status Badge */}
                          <td className="py-4 px-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1.5">
                              <LeadStatusBadge status={lead.lead_status} />
                              <select
                                value={lead.lead_status}
                                onChange={(e) =>
                                  handleQuickStatusChange(
                                    lead.id,
                                    e.target.value as LeadStatus,
                                    e as any
                                  )
                                }
                                className="bg-transparent text-[11px] text-slate-400 hover:text-white border-0 cursor-pointer focus:outline-none"
                                title="Quick Update Status"
                              >
                                <option value="New" className="bg-slate-900 text-white">New</option>
                                <option value="Contacted" className="bg-slate-900 text-white">Contacted</option>
                                <option value="Interested" className="bg-slate-900 text-white">Interested</option>
                                <option value="Follow-up Required" className="bg-slate-900 text-white">Follow-up Required</option>
                                <option value="Converted" className="bg-slate-900 text-white">Converted</option>
                                <option value="Lost" className="bg-slate-900 text-white">Lost</option>
                              </select>
                            </div>
                          </td>

                          {/* Follow-up Date & Time */}
                          <td className="py-4 px-4 text-slate-300">
                            {lead.follow_up_date ? (
                              <span className="flex items-center gap-1 text-[11px] text-amber-300 font-mono">
                                <Calendar className="w-3 h-3 text-amber-400" />
                                {formatStandardDateWithTime(lead.follow_up_date)}
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[11px]">None set</span>
                            )}
                          </td>

                          {/* Date & Time Last Updated */}
                          <td className="py-4 px-4 text-slate-400 text-[11px] font-mono">
                            {formatStandardDateTime(lead.updated_at || lead.created_at)}
                          </td>

                          {/* Actions */}
                          <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => setSelectedLead(lead)}
                                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                                title="Open Customer Profile & Notes"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              {contact?.id && (
                                <button
                                  onClick={() => handleDeleteContact(contact.id)}
                                  className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/30 transition-colors"
                                  title="Delete Contact"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INTEGRATED FOLLOW-UPS TRACKER */}
      {activeTab === 'followups' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-1">
            <div>
              <h3 className="text-sm font-bold text-white">Pending Customer Follow-ups</h3>
              <p className="text-xs text-slate-400">Scheduled calls, presentation deadlines, and proposal reviews</p>
            </div>
            <span className="text-xs font-semibold px-3 py-1 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {followUpLeads.length} Pending Actions
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {followUpLeads.length === 0 ? (
              <div className="col-span-full py-12 text-center text-slate-400 glass-panel rounded-2xl p-8">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                <h4 className="text-sm font-semibold text-white">All Follow-ups Complete!</h4>
                <p className="text-xs text-slate-400 mt-1">
                  There are no pending follow-up deadlines currently due.
                </p>
              </div>
            ) : (
              followUpLeads.map((lead) => {
                const contact = lead.contact;
                const isOverdue =
                  lead.follow_up_date && new Date(lead.follow_up_date) < new Date();

                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className="rounded-2xl glass-panel p-5 border border-slate-800 hover:border-slate-700 transition-all hover:translate-y-[-2px] shadow-lg cursor-pointer flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <LeadStatusBadge status={lead.lead_status} />
                        {lead.follow_up_date ? (
                          <span
                            className={`text-[11px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded font-mono ${
                              isOverdue
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            <Calendar className="w-3 h-3" />
                            {formatStandardDateWithTime(lead.follow_up_date)}
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">Date pending</span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-white group-hover:text-brand-300 transition-colors">
                        {contact?.full_name || 'Enquiry Lead'}
                      </h3>
                      <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
                        <Building2 className="w-3.5 h-3.5 text-slate-500" />
                        <span>{contact?.company_name}</span>
                      </p>

                      <div className="mt-4 p-3 bg-slate-950/70 rounded-xl border border-slate-800/80 text-xs text-slate-300 line-clamp-3">
                        {lead.notes || contact?.message || 'No specific notes logged yet.'}
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                      <span className="text-[11px]">
                        Strategist: <span className="text-slate-200">{lead.assigned_to || 'Unassigned'}</span>
                      </span>
                      <span className="text-brand-400 font-semibold group-hover:translate-x-0.5 transition-transform">
                        Update &rarr;
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      <CreateContactModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchCrmData}
      />

      <ContactDetailsModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdate={fetchCrmData}
        onDelete={handleDeleteContact}
      />
    </div>
  );
}

export default function AdminCrmPage() {
  return (
    <React.Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <AdminCrmContent />
    </React.Suspense>
  );
}
