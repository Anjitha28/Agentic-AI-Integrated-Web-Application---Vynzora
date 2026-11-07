import React from 'react';
import { LeadStatus } from '@/lib/types';

interface LeadStatusBadgeProps {
  status: LeadStatus;
  size?: 'sm' | 'md';
}

const statusStyles: Record<LeadStatus, { bg: string; text: string; dot: string; border: string }> = {
  New: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
    border: 'border-blue-500/20',
  },
  Contacted: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    dot: 'bg-purple-400',
    border: 'border-purple-500/20',
  },
  Interested: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
    border: 'border-amber-500/20',
  },
  'Follow-up Required': {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
    border: 'border-rose-500/20',
  },
  Converted: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
    border: 'border-emerald-500/20',
  },
  Lost: {
    bg: 'bg-slate-500/10',
    text: 'text-slate-400',
    dot: 'bg-slate-400',
    border: 'border-slate-500/20',
  },
};

export default function LeadStatusBadge({ status, size = 'sm' }: LeadStatusBadgeProps) {
  const style = statusStyles[status] || statusStyles.New;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${style.bg} ${
        style.text
      } ${style.border} ${size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm'}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      <span>{status}</span>
    </span>
  );
}

