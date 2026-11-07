'use client';

import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Filter,
  ArrowUpDown,
  Plus,
  Trash2,
  ExternalLink,
  Mail,
  Phone,
  RefreshCw,
  Building2,
  FileSpreadsheet,
} from 'lucide-react';
import { Contact, CrmLead } from '@/lib/types';
import CreateContactModal from '@/components/crm/CreateContactModal';
import ContactDetailsModal from '@/components/crm/ContactDetailsModal';
import { formatStandardDate, formatStandardDateTime } from '@/lib/dateUtils';

export default function AdminContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceFilter, setServiceFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'company'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<CrmLead | null>(null);

  const fetchContactsAndLeads = async () => {
    setIsLoading(true);
    try {
      const [cRes, lRes] = await Promise.all([
        fetch('/api/crm/contacts'),
        fetch('/api/crm/leads'),
      ]);

      if (cRes.ok) {
        const cJson = await cRes.json();
        setContacts(cJson.data || []);
      }
      if (lRes.ok) {
        const lJson = await lRes.json();
        setLeads(lJson.data || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContactsAndLeads();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this contact and its associated CRM lead?')) return;
    try {
      await fetch(`/api/crm/contacts?id=${id}`, { method: 'DELETE' });
      fetchContactsAndLeads();
    } catch (e) {
      console.error(e);
    }
  };

  const handleOpenDetails = (contact: Contact) => {
    const matchedLead = leads.find((l) => l.contact_id === contact.id) || {
      id: `fallback-${contact.id}`,
      contact_id: contact.id,
      lead_status: 'New',
      assigned_to: 'Unassigned',
      notes: '',
      follow_up_date: null,
      created_at: contact.created_at,
      updated_at: contact.updated_at,
      contact,
    };
    setSelectedLead({ ...matchedLead, contact });
  };

  // Search, filter, and sort logic
  const filteredContacts = contacts
    .filter((c) => {
      const matchesSearch =
        c.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone_number.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesService =
        serviceFilter === 'ALL' || c.service_required === serviceFilter;

      return matchesSearch && matchesService;
    })
    .sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === 'name') {
        comparison = a.full_name.localeCompare(b.full_name);
      } else if (sortBy === 'company') {
        comparison = a.company_name.localeCompare(b.company_name);
      }
      return sortOrder === 'asc' ? -comparison : comparison;
    });

  const uniqueServices = Array.from(new Set(contacts.map((c) => c.service_required)));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Customer Contacts Directory
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20">
              {contacts.length} Records
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Complete database of inbound enquiries and corporate client records.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={fetchContactsAndLeads}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white"
            title="Refresh"
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

      {/* Filter and Search Controls */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by name, company, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
          />
        </div>

        {/* Service Filter */}
        <div className="relative">
          <Filter className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
          >
            <option value="ALL">All Services ({contacts.length})</option>
            {uniqueServices.map((srv) => (
              <option key={srv} value={srv}>
                {srv}
              </option>
            ))}
          </select>
        </div>

        {/* Sort selector */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <ArrowUpDown className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
            >
              <option value="date">Sort by Date</option>
              <option value="name">Sort by Name</option>
              <option value="company">Sort by Company</option>
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

      {/* Contacts Table */}
      <div className="rounded-2xl glass-panel border border-slate-800 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3.5 px-4">Contact / Company</th>
                <th className="py-3.5 px-4">Direct Contact</th>
                <th className="py-3.5 px-4">Service Required</th>
                <th className="py-3.5 px-4">Created Date & Time</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400">
                    No contacts found matching the search criteria.
                  </td>
                </tr>
              ) : (
                filteredContacts.map((contact) => (
                  <tr
                    key={contact.id}
                    onClick={() => handleOpenDetails(contact)}
                    className="hover:bg-slate-800/40 transition-colors cursor-pointer group"
                  >
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 shrink-0 font-bold">
                          {contact.full_name[0]?.toUpperCase() || 'C'}
                        </div>
                        <div>
                          <span className="font-semibold text-white group-hover:text-brand-300 transition-colors block">
                            {contact.full_name}
                          </span>
                          <span className="text-[11px] text-slate-400 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-slate-500" />
                            {contact.company_name}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-slate-300 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <Mail className="w-3 h-3 text-slate-500" />
                        <span>{contact.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Phone className="w-3 h-3 text-slate-500" />
                        <span>{contact.phone_number}</span>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className="inline-block px-2.5 py-1 rounded-md bg-slate-800/80 text-brand-300 font-medium border border-slate-700/60">
                        {contact.service_required}
                      </span>
                    </td>
                    <td className="py-4 px-4 text-slate-400 font-mono">
                      {formatStandardDateTime(contact.created_at)}
                    </td>
                    <td className="py-4 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenDetails(contact)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                          title="View Details"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(contact.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-950/30 transition-colors"
                          title="Delete Contact"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <CreateContactModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={fetchContactsAndLeads}
      />

      <ContactDetailsModal
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onUpdate={fetchContactsAndLeads}
        onDelete={handleDelete}
      />
    </div>
  );
}

