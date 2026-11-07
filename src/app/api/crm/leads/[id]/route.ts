import { NextResponse } from 'next/server';
import { updateLeadStatus } from '@/lib/db';
import { LeadStatus } from '@/lib/types';

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { lead_status, notes, assigned_to, follow_up_date } = body;

    const updated = await updateLeadStatus(
      id,
      lead_status as LeadStatus,
      notes,
      assigned_to,
      follow_up_date
    );

    if (!updated) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Lead updated successfully',
      data: updated,
    });
  } catch (error: unknown) {
    console.error('Update lead error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to update lead';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

