import { NextResponse } from 'next/server';
import { activateDueNotifications } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // Check optional authorization header if deployed with CRON_SECRET
    const authHeader = request.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized cron invocation' }, { status: 401 });
    }

    const activated = await activateDueNotifications();
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      activatedCount: activated.length,
      activated,
    });
  } catch (error: unknown) {
    console.error('Cron notification error:', error);
    const msg = error instanceof Error ? error.message : 'Cron execution failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

