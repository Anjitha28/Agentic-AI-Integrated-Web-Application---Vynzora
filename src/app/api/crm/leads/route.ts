import { NextResponse } from 'next/server';
import { getAllLeads } from '@/lib/db';

export async function GET() {
  try {
    const leads = await getAllLeads();
    return NextResponse.json({ success: true, data: leads });
  } catch (error: unknown) {
    console.error('Fetch leads error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to fetch leads';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

