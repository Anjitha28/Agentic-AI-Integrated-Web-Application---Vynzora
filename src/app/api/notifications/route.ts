import { NextResponse } from 'next/server';
import { getAllNotifications, createNotification } from '@/lib/db';
import { NotificationType, NotificationPriority } from '@/lib/types';

export async function GET() {
  try {
    const notifications = await getAllNotifications();
    return NextResponse.json({
      success: true,
      data: notifications,
      unreadCount: notifications.filter((n) => !n.is_read && n.status === 'active').length,
    });
  } catch (error: unknown) {
    console.error('Fetch notifications error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to fetch notifications';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      title,
      description,
      notification_type,
      priority,
      scheduled_date,
      scheduled_time,
      target_audience,
    } = body;

    if (!title || !description || !notification_type || !scheduled_date || !scheduled_time) {
      return NextResponse.json(
        { success: false, error: 'Missing required notification fields.' },
        { status: 400 }
      );
    }

    const created = await createNotification({
      title: title.trim(),
      description: description.trim(),
      notification_type: notification_type as NotificationType,
      priority: (priority as NotificationPriority) || 'Medium',
      scheduled_date,
      scheduled_time,
      target_audience: target_audience || 'All Admins',
    });

    return NextResponse.json({
      success: true,
      message: 'Notification created successfully.',
      data: created,
    });
  } catch (error: unknown) {
    console.error('Create notification error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to create notification';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

