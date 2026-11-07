'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Sparkles, Mail, Phone, MapPin, ArrowUpRight, Github, Twitter, Linkedin } from 'lucide-react';

export default function Footer() {
  const pathname = usePathname();

  // If inside the admin portal, completely hide the public website footer
  if (pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <footer className="border-t border-slate-800 bg-slate-950/80 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-12">
          {/* Brand presentation */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-brand-600 to-accent-400 flex items-center justify-center text-white shadow-lg shadow-brand-500/20">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="font-extrabold text-xl tracking-tight text-white">
                VYNZORA
              </span>
            </div>
            <p className="text-sm text-slate-300 leading-relaxed max-w-sm">
              Empowering forward-thinking enterprises with world-class marketing, high-impact brand identities, performance growth engines, and next-generation enterprise CRM architecture.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a href="#" className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-brand-500 transition-colors">
                <Linkedin className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-brand-500 transition-colors">
                <Twitter className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-white hover:border-brand-500 transition-colors">
                <Github className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Core Services */}
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">
              Our Services
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <a href="#services" className="hover:text-white transition-colors">
                  Brand Identity & Systems
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-white transition-colors">
                  Performance & Growth Marketing
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-white transition-colors">
                  Social & Influencer Campaigns
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-white transition-colors">
                  UI/UX & Web Development
                </a>
              </li>
              <li>
                <a href="#services" className="hover:text-white transition-colors">
                  Content Strategy & PR
                </a>
              </li>
            </ul>
          </div>

          {/* Platform & Portals */}
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">
              Platform & Portals
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/admin" className="hover:text-white transition-colors flex items-center gap-1 text-brand-300 font-medium">
                  <span>Admin Portal</span>
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </Link>
              </li>
              <li>
                <a href="#contact-section" className="hover:text-white transition-colors">
                  Request Strategy Call
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Direct */}
          <div>
            <h4 className="text-sm font-semibold text-white tracking-wider uppercase mb-4">
              Direct Contact
            </h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-4 h-4 text-brand-400 shrink-0 mt-0.5" />
                <span>One Infinite Loop, Tech District, Suite 500</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-brand-400 shrink-0" />
                <a href="mailto:hello@vynzora.com" className="hover:text-white transition-colors">
                  hello@vynzora.com
                </a>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-brand-400 shrink-0" />
                <a href="tel:+1555019800" className="hover:text-white transition-colors">
                  +1 (555) 019-8000
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright */}
        <div className="mt-12 pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© {new Date().getFullYear()} VYNZORA Marketing & Branding Inc. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <span>Powered by Supabase & Next.js</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            <span className="text-emerald-400 font-medium">Enterprise Cloud</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
