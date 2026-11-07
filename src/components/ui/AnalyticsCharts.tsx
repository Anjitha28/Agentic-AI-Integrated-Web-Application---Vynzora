'use client';

import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { CrmLead, Contact } from '@/lib/types';

interface AnalyticsChartsProps {
  leads: CrmLead[];
  contacts: Contact[];
}

const COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#EF4444', '#10B981', '#64748B'];

export default function AnalyticsCharts({ leads, contacts }: AnalyticsChartsProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[300px]">
        <div className="rounded-2xl glass-panel p-6 animate-pulse bg-slate-900/60" />
        <div className="rounded-2xl glass-panel p-6 animate-pulse bg-slate-900/60" />
      </div>
    );
  }

  // 1. Lead Status Breakdown Data
  const statusCounts: Record<string, number> = {
    New: 0,
    Contacted: 0,
    Interested: 0,
    'Follow-up Required': 0,
    Converted: 0,
    Lost: 0,
  };

  leads.forEach((l) => {
    if (statusCounts[l.lead_status] !== undefined) {
      statusCounts[l.lead_status]++;
    }
  });

  const pieData = Object.entries(statusCounts)
    .filter(([_, value]) => value > 0)
    .map(([name, value]) => ({ name, value }));

  // 2. Service Demand Distribution Data
  const serviceCounts: Record<string, number> = {};
  contacts.forEach((c) => {
    const s = c.service_required || 'Other';
    serviceCounts[s] = (serviceCounts[s] || 0) + 1;
  });

  const barData = Object.entries(serviceCounts).map(([service, enquiries]) => ({
    service: service.length > 20 ? `${service.substring(0, 18)}...` : service,
    enquiries,
  }));

  // Fallback if data is sparse
  const displayBarData =
    barData.length > 0
      ? barData
      : [
          { service: 'Brand Identity', enquiries: 4 },
          { service: 'Performance SEO', enquiries: 3 },
          { service: 'UI/UX Web', enquiries: 5 },
          { service: 'Influencer PR', enquiries: 2 },
        ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Monthly/Service Enquiries Chart */}
      <div className="rounded-2xl glass-panel p-6 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Enquiries by Marketing Service</h3>
            <p className="text-xs text-slate-400">Demand breakdown from customer submissions</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/20">
            Realtime
          </span>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={displayBarData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
              <XAxis
                dataKey="service"
                stroke="#64748B"
                fontSize={11}
                tickLine={false}
                angle={-15}
                textAnchor="end"
              />
              <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  color: '#F8FAFC',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="enquiries" fill="#6366F1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Lead Pipeline Distribution Chart */}
      <div className="rounded-2xl glass-panel p-6 border border-slate-800 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white">Lead Status Distribution</h3>
            <p className="text-xs text-slate-400">Conversion funnel & active pipeline stages</p>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            {leads.length} Total Leads
          </span>
        </div>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData.length > 0 ? pieData : [{ name: 'New Leads', value: 1 }]}
                cx="50%"
                cy="50%"
                innerRadius={65}
                outerRadius={95}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0F172A',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  color: '#F8FAFC',
                  fontSize: '12px',
                }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', color: '#94A3B8' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

