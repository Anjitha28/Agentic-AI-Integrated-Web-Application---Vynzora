import React from 'react';
import Link from 'next/link';
import {
  Sparkles,
  ArrowRight,
  TrendingUp,
  Palette,
  Megaphone,
  Globe,
  Share2,
  CheckCircle2,
  Layers,
  ChevronRight,
  Zap,
} from 'lucide-react';
import ContactForm from '@/components/ui/ContactForm';

const SERVICES = [
  {
    icon: Palette,
    title: 'Brand Identity & Systems',
    desc: 'Bespoke corporate identities, typography systems, comprehensive brand guidelines, and high-fidelity design kits.',
    highlight: 'Visual Architecture',
  },
  {
    icon: TrendingUp,
    title: 'Performance Marketing & SEO',
    desc: 'Hyper-targeted Google, Meta, and LinkedIn ad campaigns combined with technical search optimization for maximal CAC/LTV efficiency.',
    highlight: 'Data-Driven Growth',
  },
  {
    icon: Share2,
    title: 'Social & Influencer Campaigns',
    desc: 'High-impact viral storytelling, creator partnerships, and community growth engines across TikTok, Instagram, and YouTube.',
    highlight: 'Cultural Resonance',
  },
  {
    icon: Globe,
    title: 'UI/UX & Web Development',
    desc: 'Ultra-fast Next.js digital platforms with 3D interactions, frictionless conversions, and integrated Supabase backend architecture.',
    highlight: 'Digital Flagships',
  },
  {
    icon: Megaphone,
    title: 'Content Strategy & PR',
    desc: 'Authoritative brand positioning, executive ghostwriting, national publication placement, and strategic media relations.',
    highlight: 'Brand Authority',
  },
  {
    icon: Zap,
    title: 'Full-Service Growth Retainer',
    desc: 'An embedded team of top-tier art directors, growth engineers, copywriters, and CRM specialists dedicated to scaling your business.',
    highlight: 'End-to-End Scale',
  },
];

const METRICS = [
  { value: '$45M+', label: 'Client Revenue Generated' },
  { value: '340%', label: 'Average Growth Rate' },
  { value: '98.6%', label: 'Client Retention Rate' },
  { value: '100%', label: 'Dedicated Brand Strategy' },
];

export default function HomePage() {
  return (
    <div className="space-y-24 sm:space-y-32 pb-24 overflow-hidden">
      {/* Hero Section */}
      <section className="relative pt-12 sm:pt-20 lg:pt-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
        {/* Ambient background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-gradient-to-r from-brand-600/20 via-indigo-500/20 to-accent-500/20 blur-[120px] rounded-full pointer-events-none -z-10" />

        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-300 border border-brand-500/20 mb-6 shadow-sm">
          <Sparkles className="w-3.5 h-3.5 text-brand-400" />
          <span>Next-Gen Marketing & Branding Powerhouse</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-white max-w-5xl mx-auto leading-[1.1]">
          Architecting Brands That <br className="hidden sm:inline" />
          <span className="gradient-text">Command Market Authority</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg lg:text-xl text-slate-300 max-w-2xl mx-auto mt-6 leading-relaxed">
          Vynzora blends elite creative brand identity with aggressive performance marketing, automated CRM intelligence, and high-impact digital experiences.
        </p>

        {/* CTA Button */}
        <div className="mt-8 flex items-center justify-center">
          <a
            href="#contact-section"
            className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-brand-600 via-indigo-600 to-accent-600 hover:from-brand-500 hover:to-accent-500 text-white font-semibold text-sm shadow-xl shadow-brand-500/25 transition-all flex items-center justify-center gap-2 group cursor-pointer"
          >
            <span>Start Your Project</span>
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </a>
        </div>

        {/* Metrics Counter Bar */}
        <div className="mt-16 sm:mt-20 grid grid-cols-2 lg:grid-cols-4 gap-4 p-6 rounded-3xl glass-panel border border-slate-800 shadow-2xl">
          {METRICS.map((m, idx) => (
            <div key={idx} className="p-4 text-center border-r border-slate-800/60 last:border-r-0">
              <span className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
                {m.value}
              </span>
              <p className="text-xs text-slate-400 mt-1 font-medium">{m.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-24">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-xs font-semibold bg-brand-500/10 text-brand-400 border border-brand-500/20 mb-3">
            <Layers className="w-3.5 h-3.5" />
            <span>Comprehensive Solutions</span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Marketing & Branding Services
          </h2>
          <p className="text-sm sm:text-base text-slate-300 mt-3">
            Engineered for high-growth startups, luxury brands, and enterprise market leaders.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SERVICES.map((srv, idx) => {
            const Icon = srv.icon;
            return (
              <div
                key={idx}
                className="rounded-3xl glass-panel p-7 border border-slate-800 hover:border-slate-700 hover:translate-y-[-4px] transition-all duration-200 shadow-xl flex flex-col justify-between group"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400 group-hover:scale-110 transition-transform">
                      <Icon className="w-6 h-6" />
                    </div>
                    <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 rounded-full bg-slate-800/80 text-brand-300 border border-slate-700/60">
                      {srv.highlight}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white group-hover:text-brand-300 transition-colors">
                    {srv.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300 mt-2.5 leading-relaxed">
                    {srv.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-800/80 flex items-center justify-between">
                  <a
                    href="#contact-section"
                    className="text-xs font-semibold text-brand-400 hover:text-brand-300 flex items-center gap-1 group-hover:translate-x-0.5 transition-transform"
                  >
                    <span>Request Proposal</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* About Vynzora Section */}
      <section className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="rounded-3xl glass-panel p-8 sm:p-12 lg:p-16 border border-slate-800 shadow-2xl relative overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-accent-500/10 text-accent-400 border border-accent-500/20">
                <Sparkles className="w-3.5 h-3.5" />
                <span>The Vynzora Standard</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight leading-tight">
                Where Creative Excellence Meets Relentless Growth Engineering
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Founded with a mission to eliminate disjointed marketing, Vynzora unites visionary designers, data scientists, and growth hackers under a unified banner. Every campaign is backed by clear ROI metrics and managed through our modern Supabase CRM backbone.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  'Integrated Supabase PostgreSQL database for zero-latency CRM pipelines.',
                  'Built-in real-time notification dispatch with automatic scheduled activation.',
                  'Integrated multi-channel campaign architectures with real-time attribution.',
                  'Bespoke creative direction customized to your industry vertical.',
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs sm:text-sm text-slate-200">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="pt-4">
                <a
                  href="#contact-section"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold transition-colors"
                >
                  <span>Request Strategy Consultation</span>
                  <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Right Feature Cards */}
            <div className="space-y-4">
              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-brand-400">
                    Platform Highlights
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    Active
                  </span>
                </div>
                <h4 className="text-base font-bold text-white">
                  Automated Contact & Lead Synchronization
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  When a client submits the contact form below, our database triggers instantly insert a new customer contact, create an active CRM pipeline lead, and dispatch an urgent notification alert to administrative consoles.
                </p>
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-400">
                  <span>Supabase Realtime:</span>
                  <span className="font-mono text-emerald-400">CONNECTED</span>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-900/90 border border-slate-800 p-6 space-y-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-accent-400">
                    Strategic Growth
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-accent-500/20 text-accent-300 border border-accent-500/30">
                    Advisory
                  </span>
                </div>
                <h4 className="text-base font-bold text-white">
                  Executive Brand & Growth Advisory
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Every brand partnership is steered by senior creative directors and performance analysts to ensure measurable market impact, sustainable scale, and high return on ad spend.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Us Section */}
      <section id="contact-section" className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-24">
        <ContactForm />
      </section>
    </div>
  );
}
