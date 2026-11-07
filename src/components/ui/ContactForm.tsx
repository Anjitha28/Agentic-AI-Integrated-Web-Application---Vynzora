'use client';

import React, { useState, useRef } from 'react';
import {
  Send,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Building2,
  User,
  Mail,
  Phone,
  MessageSquare,
  Layers,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { formatStandardDateTime } from '@/lib/dateUtils';

const MARKETING_SERVICES = [
  'Brand Identity & Rebranding',
  'Performance Marketing & SEO',
  'Social Media & Influencer Campaigns',
  'Website UI/UX & Web Development',
  'Content Strategy & PR',
  'Full-Service Growth Retainer',
];

export default function ContactForm() {
  const [formData, setFormData] = useState({
    full_name: '',
    company_name: '',
    email: '',
    phone_number: '',
    service_required: MARKETING_SERVICES[0],
    message: '',
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionSuccess, setSubmissionSuccess] = useState<{
    contact_id: string;
    message: string;
    timestamp: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
    if (errorMessage) setErrorMessage(null);
  };

  const isSubmittingRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to submit enquiry.');
      }

      setSubmissionSuccess({
        contact_id: data.data.contact_id,
        message: data.message,
        timestamp: formatStandardDateTime(new Date()),
      });

      // Reset form
      setFormData({
        full_name: '',
        company_name: '',
        email: '',
        phone_number: '',
        service_required: MARKETING_SERVICES[0],
        message: '',
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setErrorMessage(msg);
    } finally {
      setIsSubmitting(false);
      setTimeout(() => {
        isSubmittingRef.current = false;
      }, 1500);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto rounded-3xl glass-panel p-6 sm:p-10 border border-slate-700/80 shadow-2xl relative">
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Connect With Our Team</span>
        </div>
        <h3 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Request a Strategy Consultation
        </h3>
        <p className="text-sm text-slate-300 mt-2">
          Tell us about your brand vision, target outcomes, or marketing goals. Our team will review your enquiry and respond within 24 hours.
        </p>
      </div>

      {submissionSuccess ? (
        <div className="p-8 rounded-2xl bg-emerald-950/40 border border-emerald-500/50 text-center animate-in zoom-in-95 duration-200">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mb-4 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="text-xl font-bold text-white mb-2">Enquiry Successfully Dispatched!</h4>
          <p className="text-sm text-emerald-200 leading-relaxed max-w-md mx-auto mb-4">
            {submissionSuccess.message}
          </p>
          <div className="p-3.5 bg-slate-900/90 rounded-xl border border-slate-800 text-xs font-mono text-slate-400 max-w-sm mx-auto mb-6 space-y-1 text-left">
            <div>Reference Contact ID: <span className="text-brand-300 font-bold">{submissionSuccess.contact_id}</span></div>
            <div className="text-[11px] text-slate-400">Submission Timestamp: <span className="text-white font-semibold">{submissionSuccess.timestamp}</span></div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => setSubmissionSuccess(null)}
              className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold transition-colors"
            >
              Submit Another Enquiry
            </button>
            <a
              href="/admin/crm"
              className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-brand-600 hover:bg-brand-500 text-white text-xs font-semibold transition-colors shadow-md shadow-brand-600/30"
            >
              <span>View in Admin CRM</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          {errorMessage && (
            <div className="p-4 rounded-xl bg-rose-950/50 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Full Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Full Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  name="full_name"
                  required
                  placeholder="e.g. Jordan Hayes"
                  value={formData.full_name}
                  onChange={handleChange}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Company Name */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Company Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Building2 className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  name="company_name"
                  required
                  placeholder="e.g. Acme Global Inc."
                  value={formData.company_name}
                  onChange={handleChange}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="jordan@acme.com"
                  value={formData.email}
                  onChange={handleChange}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>

            {/* Phone Number */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Phone Number <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  name="phone_number"
                  required
                  placeholder="+1 (555) 000-0000"
                  value={formData.phone_number}
                  onChange={handleChange}
                  className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
                />
              </div>
            </div>
          </div>

          {/* Service Required */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Service Required <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Layers className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <select
                name="service_required"
                value={formData.service_required}
                onChange={handleChange}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
              >
                {MARKETING_SERVICES.map((srv) => (
                  <option key={srv} value={srv} className="bg-slate-900 text-white">
                    {srv}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Message / Enquiry Details */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Message / Project Details <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <MessageSquare className="w-4 h-4 text-slate-500 absolute left-3.5 top-3.5" />
              <textarea
                name="message"
                rows={4}
                required
                placeholder="Describe your project, objectives, expected timeline, and budget..."
                value={formData.message}
                onChange={handleChange}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500 transition-colors"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-accent-600 hover:from-brand-500 hover:to-accent-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-xl shadow-brand-500/20 flex items-center justify-center gap-2 group cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Submitting to Database & Generating Lead...</span>
                </>
              ) : (
                <>
                  <span>Submit Consultation Request</span>
                  <Send className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-slate-400 mt-2.5">
              Automatically creates a CRM Lead, logs activity, and triggers real-time admin alert.
            </p>
          </div>
        </form>
      )}
    </div>
  );
}

