import { NextResponse } from 'next/server';
import { getCrmSummaryStats } from '@/lib/db';

export async function GET() {
  try {
    const stats = await getCrmSummaryStats();
    return NextResponse.json({ success: true, data: stats });
  } catch (error: unknown) {
    console.error('Fetch CRM summary error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to fetch summary stats';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

