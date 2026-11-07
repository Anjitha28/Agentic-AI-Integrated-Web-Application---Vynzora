import { NextResponse } from 'next/server';
import { createContact } from '@/lib/db';

// Cache to prevent rapid duplicate clicks (within 5 seconds)
const recentSubmissions = new Map<string, { time: number; response: Record<string, unknown> }>();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { full_name, company_name, email, phone_number, service_required, message } = body;

    // Field Validation
    if (!full_name || !company_name || !email || !phone_number || !service_required || !message) {
      return NextResponse.json(
        {
          success: false,
          error: 'All fields are required (Full Name, Company, Email, Phone, Service, Message).',
        },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid email address.' },
        { status: 400 }
      );
    }

    // Rapid duplicate prevention (debounce double clicks on submit)
    const normEmail = email.trim().toLowerCase();
    const normCompany = company_name.trim().toLowerCase();
    const submissionKey = `${normEmail}_${normCompany}_${service_required.trim()}`;
    const now = Date.now();
    const cached = recentSubmissions.get(submissionKey);

    if (cached && now - cached.time < 5000) {
      return NextResponse.json(cached.response, { status: 200 });
    }

    const result = await createContact({
      full_name: full_name.trim(),
      company_name: company_name.trim(),
      email: normEmail,
      phone_number: phone_number.trim(),
      service_required: service_required.trim(),
      message: message.trim(),
    });

    const responsePayload = {
      success: true,
      message: 'Thank you! Your enquiry has been received. Our branding strategists will contact you shortly.',
      data: {
        contact_id: result.contact.id,
        lead_id: result.lead.id,
        notification_id: result.notification.id,
        contact: result.contact,
      },
    };

    recentSubmissions.set(submissionKey, { time: now, response: responsePayload });
    if (recentSubmissions.size > 100) {
      for (const [k, v] of recentSubmissions.entries()) {
        if (now - v.time > 60000) recentSubmissions.delete(k);
      }
    }

    return NextResponse.json(responsePayload, { status: 201 });
  } catch (error: unknown) {
    console.error('Contact submission error:', error);
    const msg = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

