import { NextResponse } from 'next/server';
import { activateDueNotifications } from '@/lib/db';

export async function POST() {
  try {
    const activated = await activateDueNotifications();
    return NextResponse.json({
      success: true,
      message: `Activated ${activated.length} scheduled notifications.`,
      activatedCount: activated.length,
      data: activated,
    });
  } catch (error: unknown) {
    console.error('Activate notifications error:', error);
    const msg = error instanceof Error ? error.message : 'Activation failed';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}

