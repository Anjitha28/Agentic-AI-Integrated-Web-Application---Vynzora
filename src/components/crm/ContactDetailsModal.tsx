'use client';

import React, { useState } from 'react';
import {
  X,
  Building2,
  Mail,
  Phone,
  Calendar,
  User,
  Layers,
  Save,
  Trash2,
  FileText,
  Clock,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { CrmLead, LeadStatus } from '@/lib/types';
import LeadStatusBadge from './LeadStatusBadge';
import { formatStandardDate, formatStandardDateTime, formatStandardDateWithTime } from '@/lib/dateUtils';

interface ContactDetailsModalProps {
  lead: CrmLead | null;
  onClose: () => void;
  onUpdate: () => void;
  onDelete?: (contactId: string) => void;
}

const ALL_STATUSES: LeadStatus[] = [
  'New',
  'Contacted',
  'Interested',
  'Follow-up Required',
  'Converted',
  'Lost',
];

export default function ContactDetailsModal({
  lead,
  onClose,
  onUpdate,
  onDelete,
}: ContactDetailsModalProps) {
  if (!lead) return null;

  const contact = lead.contact;
  const [currentStatus, setCurrentStatus] = useState<LeadStatus>(lead.lead_status);
  const [notes, setNotes] = useState(lead.notes || '');
  const [assignedTo, setAssignedTo] = useState(lead.assigned_to || 'Unassigned');
  const [followUpDate, setFollowUpDate] = useState(lead.follow_up_date || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/crm/leads/${lead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_status: currentStatus,
          notes,
          assigned_to: assignedTo,
          follow_up_date: followUpDate || null,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
        onUpdate();
      }
    } catch (e) {
      console.error('Update lead error:', e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-2xl rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative max-h-[90vh] overflow-y-auto">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-6 right-6 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 rounded-2xl bg-brand-600/20 border border-brand-500/40 flex items-center justify-center text-brand-400 shrink-0">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-mono text-slate-400">LEAD ID: {lead.id.slice(0, 8)}...</span>
              <LeadStatusBadge status={currentStatus} />
            </div>
            <h3 className="text-xl font-bold text-white">{contact?.full_name || 'Customer Profile'}</h3>
            <p className="text-sm text-slate-300 font-medium">{contact?.company_name}</p>
          </div>
        </div>

        {/* Contact Info Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 bg-slate-950/70 rounded-2xl border border-slate-800 text-xs mb-6">
          <div className="flex items-center gap-2.5">
            <Mail className="w-4 h-4 text-brand-400 shrink-0" />
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Email</span>
              <a href={`mailto:${contact?.email}`} className="text-slate-200 hover:underline">
                {contact?.email}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Phone className="w-4 h-4 text-brand-400 shrink-0" />
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Phone</span>
              <a href={`tel:${contact?.phone_number}`} className="text-slate-200 hover:underline">
                {contact?.phone_number}
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Layers className="w-4 h-4 text-brand-400 shrink-0" />
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Service Required</span>
              <span className="text-slate-200 font-medium">{contact?.service_required}</span>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <Calendar className="w-4 h-4 text-brand-400 shrink-0" />
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Submission Date & Time</span>
              <span className="text-slate-200 font-mono">
                {formatStandardDateTime(contact?.created_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Customer Enquiry Message */}
        <div className="mb-6">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            <span>Customer Message / Scope</span>
          </label>
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-200 leading-relaxed">
            {contact?.message || 'No additional message provided.'}
          </div>
        </div>

        {/* CRM Lead Editable Management Controls */}
        <div className="p-5 rounded-2xl bg-brand-950/20 border border-brand-500/30 space-y-4 mb-6">
          <h4 className="text-xs font-bold uppercase tracking-wider text-brand-300 flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            <span>CRM Pipeline & Follow-up Controls</span>
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Status Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                Lead Status
              </label>
              <select
                value={currentStatus}
                onChange={(e) => setCurrentStatus(e.target.value as LeadStatus)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              >
                {ALL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>

            {/* Assigned Strategist */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                Assigned Strategist
              </label>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            {/* Next Follow-up Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                Follow-up Date
              </label>
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Internal Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
              Internal Team Notes & Next Steps
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes, budget considerations, or follow-up summary..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between pt-2">
          {onDelete && contact?.id ? (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this customer record?')) {
                  onDelete(contact.id);
                  onClose();
                }
              }}
              className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 px-3 py-2 rounded-lg hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Contact</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-semibold bg-brand-600 hover:bg-brand-500 text-white transition-all shadow-md shadow-brand-600/30 disabled:opacity-50"
            >
              {isSaving ? (
                <span>Saving...</span>
              ) : saveSuccess ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Saved!</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Update CRM Lead</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

