import { NextResponse } from 'next/server';
import { getAllContacts, deleteContact, createContact } from '@/lib/db';

export async function GET() {
  try {
    const contacts = await getAllContacts();
    return NextResponse.json({ success: true, data: contacts });
  } catch (error: unknown) {
    console.error('Fetch contacts error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to fetch contacts';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const result = await createContact(body);
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: unknown) {
    console.error('Create contact error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to create contact';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Contact ID required' }, { status: 400 });
    }
    const success = await deleteContact(id);
    return NextResponse.json({ success, message: success ? 'Contact deleted.' : 'Contact not found' });
  } catch (error: unknown) {
    console.error('Delete contact error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to delete contact';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

