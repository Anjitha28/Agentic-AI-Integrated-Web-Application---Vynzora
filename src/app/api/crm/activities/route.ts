import { NextResponse } from 'next/server';
import { getAllActivities } from '@/lib/db';

export async function GET() {
  try {
    const activities = await getAllActivities();
    return NextResponse.json({ success: true, data: activities });
  } catch (error: unknown) {
    console.error('Fetch activities error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to fetch activities';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

