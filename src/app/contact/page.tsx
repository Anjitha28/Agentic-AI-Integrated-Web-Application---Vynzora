import React from 'react';
import ContactForm from '@/components/ui/ContactForm';
import { Mail, Phone, MapPin, Clock, Sparkles } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="py-12 sm:py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-12">
      <div className="text-center max-w-2xl mx-auto space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-300 border border-brand-500/20">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span>Vynzora Client Inquiries</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight">
          Let&apos;s Build Your Next Chapter
        </h1>
        <p className="text-sm text-slate-300">
          Whether you need an iconic brand identity, a complete website overhaul, or rapid performance growth, our team is ready to deliver.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        {/* Contact Info Sidebar */}
        <div className="rounded-3xl glass-panel p-6 sm:p-8 border border-slate-800 space-y-6">
          <h3 className="text-lg font-bold text-white">Direct Communications</h3>
          <p className="text-xs text-slate-400">
            Enquiries are ingested directly into our central Supabase database and assigned to a Senior Strategist within 24 hours.
          </p>

          <div className="space-y-4 pt-2 text-xs">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <Mail className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Email</span>
                <a href="mailto:hello@vynzora.com" className="text-white hover:underline font-medium">
                  hello@vynzora.com
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <Phone className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Phone</span>
                <a href="tel:+1555019800" className="text-white hover:underline font-medium">
                  +1 (555) 019-8000
                </a>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <MapPin className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Headquarters</span>
                <span className="text-slate-200">
                  One Infinite Loop, Tech District, Suite 500, New York, NY
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800">
              <Clock className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Response Window</span>
                <span className="text-slate-200">Monday &ndash; Friday, 9:00 AM &ndash; 6:00 PM EST</span>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Form Container */}
        <div className="lg:col-span-2">
          <ContactForm />
        </div>
      </div>
    </div>
  );
}

