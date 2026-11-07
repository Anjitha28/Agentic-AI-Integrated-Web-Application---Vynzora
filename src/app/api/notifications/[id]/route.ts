import { NextResponse } from 'next/server';
import { markNotificationAsRead } from '@/lib/db';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    if (body.action === 'mark_read' || body.is_read !== undefined) {
      const ok = await markNotificationAsRead(id);
      return NextResponse.json({ success: ok, message: 'Notification marked as read.' });
    }

    return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    console.error('Update notification error:', error);
    const msg = error instanceof Error ? error.message : 'Error updating notification';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

