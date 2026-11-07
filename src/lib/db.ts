import { supabase, getServiceSupabase, isSupabaseConfigured } from './supabase';
import {
  Contact,
  CrmLead,
  NotificationItem,
  CrmActivity,
  CrmSummaryStats,
  LeadStatus,
  NotificationPriority,
  NotificationType,
} from './types';

// In-memory / persistent mock fallback store seeded with realistic data for Vynzora
// Used if Supabase credentials are not yet configured in .env.local
let mockContacts: Contact[] = [
  {
    id: 'c0000000-0000-4000-a000-000000000001',
    full_name: 'Sophia Reynolds',
    company_name: 'Nexus Tech Innovations',
    email: 'sophia.reynolds@nexustech.io',
    phone_number: '+1 (555) 234-5678',
    service_required: 'Brand Identity & Rebranding',
    message: 'We are expanding to the US market and need a total brand identity refresh, design system, and new marketing strategy.',
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: 'c0000000-0000-4000-a000-000000000002',
    full_name: 'Marcus Vance',
    company_name: 'Vance Capital & Growth',
    email: 'marcus@vancecapital.com',
    phone_number: '+1 (555) 345-6789',
    service_required: 'Performance Marketing & SEO',
    message: 'Looking for aggressive ROI-driven Google/LinkedIn ad campaigns for our B2B fintech solution.',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'c0000000-0000-4000-a000-000000000003',
    full_name: 'Elena Rostova',
    company_name: 'Lumina Cosmetics',
    email: 'elena@luminacosmetics.eu',
    phone_number: '+1 (555) 456-7890',
    service_required: 'Social Media & Influencer Campaigns',
    message: 'Preparing our Spring product launch across Instagram and TikTok. Seeking end-to-end creative direction.',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'c0000000-0000-4000-a000-000000000004',
    full_name: 'David Chen',
    company_name: 'AeroDrive Autonomous',
    email: 'd.chen@aerodrive.co',
    phone_number: '+1 (555) 567-8901',
    service_required: 'Website UI/UX & Web Development',
    message: 'Need a high-converting, sleek corporate website with 3D product visualizer and enterprise investor portal.',
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'c0000000-0000-4000-a000-000000000005',
    full_name: 'Amara Okafor',
    company_name: 'EcoSustain Goods',
    email: 'amara@ecosustain.org',
    phone_number: '+1 (555) 678-9012',
    service_required: 'Content Strategy & PR',
    message: 'Seeking corporate sustainability storytelling and national media placement for our carbon-neutral packaging.',
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
];

let mockLeads: CrmLead[] = [
  {
    id: 'b0000000-0000-4000-a000-000000000001',
    contact_id: 'c0000000-0000-4000-a000-000000000001',
    lead_status: 'Interested',
    assigned_to: 'Alex Morgan (Senior Director)',
    notes: 'Had introductory discovery call. Very interested in full enterprise tier rebrand. Proposal sent.',
    follow_up_date: new Date(Date.now() + 2 * 86400000).toISOString().split('T')[0],
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'b0000000-0000-4000-a000-000000000002',
    contact_id: 'c0000000-0000-4000-a000-000000000002',
    lead_status: 'Follow-up Required',
    assigned_to: 'Sarah Jenkins (Growth Lead)',
    notes: 'Needs custom ad budget projection before committing to 6-month retainer.',
    follow_up_date: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'b0000000-0000-4000-a000-000000000003',
    contact_id: 'c0000000-0000-4000-a000-000000000003',
    lead_status: 'New',
    assigned_to: 'Unassigned',
    notes: 'Fresh inquiry from web contact form. High potential cosmetics client.',
    follow_up_date: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'b0000000-0000-4000-a000-000000000004',
    contact_id: 'c0000000-0000-4000-a000-000000000004',
    lead_status: 'Converted',
    assigned_to: 'Alex Morgan (Senior Director)',
    notes: 'Contract signed! $45,000 corporate website development & 3D visualization project kicked off.',
    follow_up_date: null,
    created_at: new Date(Date.now() - 5 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'b0000000-0000-4000-a000-000000000005',
    contact_id: 'c0000000-0000-4000-a000-000000000005',
    lead_status: 'Contacted',
    assigned_to: 'Michael Scott',
    notes: 'Initial outreach sent via email and phone. Awaiting response on deck.',
    follow_up_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
];

let mockNotifications: NotificationItem[] = [
  {
    id: 'f0000000-0000-4000-a000-000000000001',
    title: 'New Customer Enquiry Received',
    description: 'Elena Rostova from Lumina Cosmetics submitted an enquiry for Social Media & Influencer Campaigns.',
    notification_type: 'Customer Enquiry',
    priority: 'High',
    scheduled_date: new Date(Date.now() - 1 * 86400000).toISOString().split('T')[0],
    scheduled_time: '09:00',
    status: 'active',
    is_read: false,
    activated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    target_audience: 'Admins & Sales Team',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
    updated_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
  {
    id: 'f0000000-0000-4000-a000-000000000002',
    title: 'Client Meeting Reminder: Nexus Tech',
    description: 'Upcoming presentation with Sophia Reynolds regarding Vynzora Branding & Identity deliverables.',
    notification_type: 'Meeting Reminder',
    priority: 'Urgent',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '14:30',
    status: 'active',
    is_read: false,
    activated_at: new Date().toISOString(),
    target_audience: 'Strategy Team',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'f0000000-0000-4000-a000-000000000003',
    title: 'CRM Follow-up Required: Vance Capital',
    description: 'Marcus Vance requested custom ROI projections for ad campaigns. Call scheduled for tomorrow.',
    notification_type: 'CRM Follow-up',
    priority: 'Medium',
    scheduled_date: new Date(Date.now() + 1 * 86400000).toISOString().split('T')[0],
    scheduled_time: '11:00',
    status: 'scheduled',
    is_read: false,
    activated_at: null,
    target_audience: 'Account Managers',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'f0000000-0000-4000-a000-000000000004',
    title: 'Quarterly Marketing Strategy Briefing',
    description: 'All-hands Vynzora quarterly review and Q4 campaign roadmap alignment.',
    notification_type: 'General Announcement',
    priority: 'Medium',
    scheduled_date: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
    scheduled_time: '10:00',
    status: 'scheduled',
    is_read: false,
    activated_at: null,
    target_audience: 'All Staff',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let mockActivities: CrmActivity[] = [
  {
    id: 'a0000000-0000-4000-a000-000000000001',
    lead_id: 'b0000000-0000-4000-a000-000000000001',
    activity_type: 'Meeting Held',
    description: 'Conducted 45-min Zoom discovery session with Sophia Reynolds. Sent branding proposal.',
    activity_date: new Date(Date.now() - 2 * 86400000).toISOString(),
    created_by: 'Alex Morgan',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'a0000000-0000-4000-a000-000000000002',
    lead_id: 'b0000000-0000-4000-a000-000000000004',
    activity_type: 'Deal Converted',
    description: 'Signed MSA and received initial retainer payment for AeroDrive Autonomous web overhaul.',
    activity_date: new Date(Date.now() - 2 * 86400000).toISOString(),
    created_by: 'Alex Morgan',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'a0000000-0000-4000-a000-000000000003',
    lead_id: 'b0000000-0000-4000-a000-000000000002',
    activity_type: 'Email Sent',
    description: 'Delivered customized performance marketing proposal with CPA breakdown.',
    activity_date: new Date(Date.now() - 1 * 86400000).toISOString(),
    created_by: 'Sarah Jenkins',
    created_at: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

// In-memory subscribers for real-time notifications popup fallback
type NotificationCallback = (notification: NotificationItem) => void;
const notificationSubscribers: Set<NotificationCallback> = new Set();

export const subscribeToNewNotifications = (callback: NotificationCallback) => {
  notificationSubscribers.add(callback);
  return () => {
    notificationSubscribers.delete(callback);
  };
};

const notifySubscribers = (notification: NotificationItem) => {
  notificationSubscribers.forEach((cb) => {
    try {
      cb(notification);
    } catch (e) {
      console.error('Error notifying subscriber:', e);
    }
  });
};

/**
 * Checks scheduled notifications and activates any whose scheduled time has arrived.
 * Can be called via cron API, background job, or whenever notifications are fetched.
 */
export async function activateDueNotifications(): Promise<NotificationItem[]> {
  const now = new Date();
  const activated: NotificationItem[] = [];

  if (isSupabaseConfigured) {
    const client = getServiceSupabase() || supabase;
    if (client) {
      try {
        // Query scheduled notifications
        const { data, error } = await client
          .from('notifications')
          .select('*')
          .eq('status', 'scheduled');

        if (!error && data) {
          for (const item of data) {
            const scheduledDateTime = new Date(`${item.scheduled_date}T${item.scheduled_time || '00:00:00'}`);
            if (scheduledDateTime <= now) {
              const { data: updated, error: updateErr } = await client
                .from('notifications')
                .update({
                  status: 'active',
                  activated_at: now.toISOString(),
                  updated_at: now.toISOString(),
                })
                .eq('id', item.id)
                .select()
                .single();

              if (!updateErr && updated) {
                activated.push(updated as NotificationItem);
                notifySubscribers(updated as NotificationItem);
              }
            }
          }
          return activated;
        }
      } catch (err) {
        console.error('Supabase activateDueNotifications failed:', err);
      }
    }
  }

  // Fallback in-memory check
  mockNotifications = mockNotifications.map((n) => {
    if (n.status === 'scheduled') {
      const scheduledDateTime = new Date(`${n.scheduled_date}T${n.scheduled_time || '00:00:00'}`);
      if (scheduledDateTime <= now) {
        const updated: NotificationItem = {
          ...n,
          status: 'active',
          activated_at: now.toISOString(),
          updated_at: now.toISOString(),
        };
        activated.push(updated);
        notifySubscribers(updated);
        return updated;
      }
    }
    return n;
  });

  return activated;
}

// ==========================================
// CONTACT OPERATIONS
// ==========================================

export async function createContact(contactData: {
  full_name: string;
  company_name: string;
  email: string;
  phone_number: string;
  service_required: string;
  message: string;
}): Promise<{ contact: Contact; lead: CrmLead; notification: NotificationItem }> {
  const now = new Date().toISOString();
  const contactId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `c0000000-0000-4000-a000-${Date.now().toString(16).padStart(12, '0')}`;

  if (isSupabaseConfigured) {
    const client = getServiceSupabase() || supabase;
    if (client) {
      try {
        // 1. Insert Contact
        const { data: contactRow, error: cErr } = await client
          .from('contacts')
          .insert({
            full_name: contactData.full_name,
            company_name: contactData.company_name,
            email: contactData.email,
            phone_number: contactData.phone_number,
            service_required: contactData.service_required,
            message: contactData.message,
          })
          .select()
          .single();

        if (cErr) throw cErr;

        // 2. Fetch Lead if already generated by PostgreSQL trigger, or insert if not present
        let leadRow: CrmLead | null = null;
        const { data: existingLead } = await client
          .from('crm_leads')
          .select('*')
          .eq('contact_id', contactRow.id)
          .maybeSingle();

        if (existingLead) {
          leadRow = existingLead as CrmLead;
        } else {
          const { data: insertedLead, error: lErr } = await client
            .from('crm_leads')
            .insert({
              contact_id: contactRow.id,
              lead_status: 'New',
              assigned_to: 'Unassigned',
              notes: `Auto-generated from website contact form for service: ${contactData.service_required}`,
              follow_up_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
            })
            .select()
            .single();

          if (lErr && !lErr.message?.includes('duplicate') && !lErr.message?.includes('unique')) {
            throw lErr;
          }
          leadRow = (insertedLead || existingLead) as CrmLead;
        }

        // 3. Fetch Notification if generated by trigger, or insert if not present
        let notifRow: NotificationItem | null = null;
        const { data: existingNotifs } = await client
          .from('notifications')
          .select('*')
          .ilike('title', `%${contactData.full_name}%`)
          .order('created_at', { ascending: false })
          .limit(1);

        if (
          existingNotifs &&
          existingNotifs.length > 0 &&
          Math.abs(Date.now() - new Date(existingNotifs[0].created_at).getTime()) < 15000
        ) {
          notifRow = existingNotifs[0] as NotificationItem;
        } else {
          const { data: insertedNotif, error: nErr } = await client
            .from('notifications')
            .insert({
              title: `New Customer Enquiry: ${contactData.full_name}`,
              description: `${contactData.full_name} from ${contactData.company_name} enquired about ${contactData.service_required}.`,
              notification_type: 'Customer Enquiry',
              priority: 'High',
              scheduled_date: new Date().toISOString().split('T')[0],
              scheduled_time: new Date().toTimeString().slice(0, 5),
              status: 'active',
              is_read: false,
              activated_at: now,
              target_audience: 'Admin & Sales',
            })
            .select()
            .single();

          if (nErr && !nErr.message?.includes('duplicate')) throw nErr;
          notifRow = (insertedNotif || existingNotifs?.[0]) as NotificationItem;
        }

        // 4. Log Activity only if not already logged by trigger
        if (leadRow?.id) {
          const { data: existingActivities } = await client
            .from('crm_activities')
            .select('id')
            .eq('lead_id', leadRow.id)
            .limit(1);

          if (!existingActivities || existingActivities.length === 0) {
            await client.from('crm_activities').insert({
              lead_id: leadRow.id,
              activity_type: 'Enquiry Received',
              description: `Initial enquiry submitted via website contact form by ${contactData.full_name}.`,
              activity_date: now,
              created_by: 'Website Contact Form',
            });
          }
        }

        if (notifRow) {
          notifySubscribers(notifRow as NotificationItem);
        }

        return {
          contact: contactRow as Contact,
          lead: leadRow as CrmLead,
          notification: notifRow as NotificationItem,
        };
      } catch (err) {
        console.error('Supabase createContact error, falling back to mock:', err);
      }
    }
  }

  // Fallback local memory store
  const newContact: Contact = {
    id: contactId,
    ...contactData,
    created_at: now,
    updated_at: now,
  };
  mockContacts.unshift(newContact);

  const newLead: CrmLead = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `b0000000-0000-4000-a000-${Date.now().toString(16).padStart(12, '0')}`,
    contact_id: newContact.id,
    lead_status: 'New',
    assigned_to: 'Unassigned',
    notes: `Enquiry submitted for ${newContact.service_required}`,
    follow_up_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    created_at: now,
    updated_at: now,
  };
  mockLeads.unshift(newLead);

  const newNotif: NotificationItem = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `f0000000-0000-4000-a000-${Date.now().toString(16).padStart(12, '0')}`,
    title: `New Customer Enquiry: ${newContact.full_name}`,
    description: `${newContact.full_name} from ${newContact.company_name} enquired about ${newContact.service_required}.`,
    notification_type: 'Customer Enquiry',
    priority: 'High',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: new Date().toTimeString().slice(0, 5),
    status: 'active',
    is_read: false,
    activated_at: now,
    target_audience: 'Admin & Sales',
    created_at: now,
    updated_at: now,
  };
  mockNotifications.unshift(newNotif);

  mockActivities.unshift({
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `a0000000-0000-4000-a000-${Date.now().toString(16).padStart(12, '0')}`,
    lead_id: newLead.id,
    activity_type: 'Enquiry Received',
    description: `Initial enquiry submitted via website contact form by ${newContact.full_name}.`,
    activity_date: now,
    created_by: 'Website Contact Form',
    created_at: now,
  });

  notifySubscribers(newNotif);

  return {
    contact: newContact,
    lead: newLead,
    notification: newNotif,
  };
}

export async function getAllContacts(): Promise<Contact[]> {
  if (isSupabaseConfigured) {
    const client = getServiceSupabase() || supabase;
    if (client) {
      try {
        const { data, error } = await client
          .from('contacts')
          .select('*')
          .order('created_at', { ascending: false });
        if (!error && data) return data as Contact[];
      } catch (err) {
        console.error('Supabase getAllContacts error:', err);
      }
    }
  }
  return [...mockContacts];
}

export async function updateContact(
  contactId: string,
  updates: Partial<{
    full_name: string;
    company_name: string;
    email: string;
    phone_number: string;
    service_required: string;
    message: string;
  }>
): Promise<Contact | null> {
  const now = new Date().toISOString();
  if (isSupabaseConfigured) {
    const client = getServiceSupabase() || supabase;
    if (client) {
      try {
        const { data, error } = await client
          .from('contacts')
          .update({ ...updates, updated_at: now })
          .eq('id', contactId)
          .select()
          .single();
        if (!error && data) return data as Contact;
      } catch (err) {
        console.error('Supabase updateContact error:', err);
      }
    }
  }
  const idx = mockContacts.findIndex((c) => c.id === contactId);
  if (idx !== -1) {
    mockContacts[idx] = { ...mockContacts[idx], ...updates, updated_at: now };
    return mockContacts[idx];
  }
  return null;
}

export async function deleteContact(id: string): Promise<boolean> {
  if (isSupabaseConfigured) {
    const client = getServiceSupabase() || supabase;
    if (client) {
      try {
        // Delete referencing crm_leads to respect foreign key constraint
        await client.from('crm_leads').delete().eq('contact_id', id);
        const { error } = await client.from('contacts').delete().eq('id', id);
        if (!error) return true;
      } catch (err) {
        console.error('Supabase deleteContact error:', err);
      }
    }
  }
  const initialLen = mockContacts.length;
  mockContacts = mockContacts.filter((c) => c.id !== id);
  // Also delete associated leads
  mockLeads = mockLeads.filter((l) => l.contact_id !== id);
  return mockContacts.length < initialLen;
}

// ==========================================
// CRM LEADS OPERATIONS
// ==========================================

export async function getAllLeads(): Promise<CrmLead[]> {
  if (isSupabaseConfigured) {
    const client = getServiceSupabase() || supabase;
    if (client) {
      try {
        const { data, error } = await client
          .from('crm_leads')
          .select(`
            *,
            contact:contacts(*)
          `)
          .order('created_at', { ascending: false });

        if (!error && data) {
          // Strictly deduplicate by contact_id so that duplicate leads for the same contact never appear
          const seenContactIds = new Set<string>();
          const uniqueLeads: CrmLead[] = [];
          for (const item of data as CrmLead[]) {
            const key = item.contact_id || item.id;
            if (!seenContactIds.has(key)) {
              seenContactIds.add(key);
              uniqueLeads.push(item);
            }
          }
          return uniqueLeads;
        }
      } catch (err) {
        console.error('Supabase getAllLeads error:', err);
      }
    }
  }

  // Populate mock contacts for mock leads with deduplication
  const seenContactIds = new Set<string>();
  const uniqueMockLeads: CrmLead[] = [];
  for (const lead of mockLeads) {
    const key = lead.contact_id || lead.id;
    if (!seenContactIds.has(key)) {
      seenContactIds.add(key);
      uniqueMockLeads.push({
        ...lead,
        contact: mockContacts.find((c) => c.id === lead.contact_id),
      });
    }
  }
  return uniqueMockLeads;
}

export async function updateLeadStatus(
  leadId: string,
  newStatus: LeadStatus,
  notes?: string,
  assignedTo?: string,
  followUpDate?: string | null
): Promise<CrmLead | null> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured) {
    const client = getServiceSupabase() || supabase;
    if (client) {
      try {
        const updatePayload: Record<string, unknown> = {
          lead_status: newStatus,
          updated_at: now,
        };
        if (notes !== undefined) updatePayload.notes = notes;
        if (assignedTo !== undefined) updatePayload.assigned_to = assignedTo;
        if (followUpDate !== undefined) updatePayload.follow_up_date = followUpDate;

        const { data, error } = await client
          .from('crm_leads')
          .update(updatePayload)
          .eq('id', leadId)
          .select(`*, contact:contacts(*)`)
          .single();

        if (!error && data) {
          // Log activity
          await client.from('crm_activities').insert({
            lead_id: leadId,
            activity_type: 'Status Updated',
            description: `Lead status changed to "${newStatus}".`,
            activity_date: now,
            created_by: 'Admin',
          });

          return data as CrmLead;
        }
      } catch (err) {
        console.error('Supabase updateLeadStatus error:', err);
      }
    }
  }

  const index = mockLeads.findIndex((l) => l.id === leadId);
  if (index === -1) return null;

  mockLeads[index] = {
    ...mockLeads[index],
    lead_status: newStatus,
    notes: notes !== undefined ? notes : mockLeads[index].notes,
    assigned_to: assignedTo !== undefined ? assignedTo : mockLeads[index].assigned_to,
    follow_up_date: followUpDate !== undefined ? followUpDate : mockLeads[index].follow_up_date,
    updated_at: now,
  };

  mockActivities.unshift({
    id: `a-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    lead_id: leadId,
    activity_type: 'Status Updated',
    description: `Lead status changed to "${newStatus}".`,
    activity_date: now,
    created_by: 'Admin',
    created_at: now,
  });

  return {
    ...mockLeads[index],
    contact: mockContacts.find((c) => c.id === mockLeads[index].contact_id),
  };
}

// ==========================================
// NOTIFICATIONS OPERATIONS
// ==========================================

export async function getAllNotifications(): Promise<NotificationItem[]> {
  await activateDueNotifications();

  if (isSupabaseConfigured) {
    const client = getServiceSupabase() || supabase;
    if (client) {
      try {
        const { data, error } = await client
          .from('notifications')
          .select('*')
          .order('created_at', { ascending: false });

        if (!error && data) {
          // Deduplicate notifications with identical title & description created in the same minute
          const seen = new Set<string>();
          const uniqueNotifs: NotificationItem[] = [];
          for (const item of data as NotificationItem[]) {
            const dateStr = item.created_at ? item.created_at.slice(0, 16) : '';
            const key = `${item.title}_${item.description}_${dateStr}`;
            if (!seen.has(key)) {
              seen.add(key);
              uniqueNotifs.push(item);
            }
          }
          return uniqueNotifs;
        }
      } catch (err) {
        console.error('Supabase getAllNotifications error:', err);
      }
    }
  }

  return [...mockNotifications];
}

export async function createNotification(data: {
  title: string;
  description: string;
  notification_type: NotificationType;
  priority: NotificationPriority;
  scheduled_date: string;
  scheduled_time: string;
  target_audience?: string;
}): Promise<NotificationItem> {
  const now = new Date();
  const scheduledDateTime = new Date(`${data.scheduled_date}T${data.scheduled_time || '00:00:00'}`);
  const isDueNow = scheduledDateTime <= now;
  const status = isDueNow ? 'active' : 'scheduled';
  const activated_at = isDueNow ? now.toISOString() : null;

  if (isSupabaseConfigured) {
    const client = getServiceSupabase() || supabase;
    if (client) {
      try {
        const { data: inserted, error } = await client
          .from('notifications')
          .insert({
            title: data.title,
            description: data.description,
            notification_type: data.notification_type,
            priority: data.priority,
            scheduled_date: data.scheduled_date,
            scheduled_time: data.scheduled_time,
            status,
            is_read: false,
            activated_at,
            target_audience: data.target_audience || 'All Admins',
          })
          .select()
          .single();

        if (!error && inserted) {
          if (status === 'active') {
            notifySubscribers(inserted as NotificationItem);
          }
          return inserted as NotificationItem;
        }
      } catch (err) {
        console.error('Supabase createNotification error:', err);
      }
    }
  }

  const newNotif: NotificationItem = {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `f0000000-0000-4000-a000-${Date.now().toString(16).padStart(12, '0')}`,
    title: data.title,
    description: data.description,
    notification_type: data.notification_type,
    priority: data.priority,
    scheduled_date: data.scheduled_date,
    scheduled_time: data.scheduled_time,
    status,
    is_read: false,
    activated_at,
    target_audience: data.target_audience || 'All Admins',
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  mockNotifications.unshift(newNotif);

  if (status === 'active') {
    notifySubscribers(newNotif);
  }

  return newNotif;
}

export async function markNotificationAsRead(id: string): Promise<boolean> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured) {
    const client = getServiceSupabase() || supabase;
    if (client) {
      try {
        // Fetch target notification to also mark any identical duplicates as read
        const { data: target } = await client
          .from('notifications')
          .select('title, description')
          .eq('id', id)
          .maybeSingle();

        if (target?.title) {
          await client
            .from('notifications')
            .update({ is_read: true, status: 'read', updated_at: now })
            .eq('title', target.title)
            .eq('description', target.description);
        } else {
          await client
            .from('notifications')
            .update({ is_read: true, status: 'read', updated_at: now })
            .eq('id', id);
        }
        return true;
      } catch (err) {
        console.error('Supabase markNotificationAsRead error:', err);
      }
    }
  }

  const notif = mockNotifications.find((n) => n.id === id);
  if (notif) {
    mockNotifications.forEach((n) => {
      if (n.id === id || (n.title === notif.title && n.description === notif.description)) {
        n.is_read = true;
        n.status = 'read';
        n.updated_at = now;
      }
    });
    return true;
  }
  return false;
}

export async function markAllNotificationsAsRead(): Promise<boolean> {
  const now = new Date().toISOString();

  if (isSupabaseConfigured) {
    const client = getServiceSupabase() || supabase;
    if (client) {
      try {
        const { error } = await client
          .from('notifications')
          .update({ is_read: true, status: 'read', updated_at: now })
          .eq('is_read', false);
        if (!error) return true;
      } catch (err) {
        console.error('Supabase markAllNotificationsAsRead error:', err);
      }
    }
  }

  mockNotifications.forEach((n) => {
    n.is_read = true;
    if (n.status === 'active' || n.status === 'unread') {
      n.status = 'read';
    }
    n.updated_at = now;
  });

  return true;
}

// ==========================================
// ACTIVITIES OPERATIONS
// ==========================================

export async function getAllActivities(): Promise<CrmActivity[]> {
  if (isSupabaseConfigured) {
    const client = getServiceSupabase() || supabase;
    if (client) {
      try {
        const { data, error } = await client
          .from('crm_activities')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(20);
        if (!error && data) return data as CrmActivity[];
      } catch (err) {
        console.error('Supabase getAllActivities error:', err);
      }
    }
  }
  return [...mockActivities];
}

// ==========================================
// SUMMARY METRICS & STATS
// ==========================================

export async function getCrmSummaryStats(): Promise<CrmSummaryStats> {
  const [contacts, leads, notifications] = await Promise.all([
    getAllContacts(),
    getAllLeads(),
    getAllNotifications(),
  ]);

  const newLeads = leads.filter((l) => l.lead_status === 'New').length;
  const contactedLeads = leads.filter((l) => l.lead_status === 'Contacted').length;
  const interestedCustomers = leads.filter((l) => l.lead_status === 'Interested').length;
  const convertedLeads = leads.filter((l) => l.lead_status === 'Converted').length;
  const lostLeads = leads.filter((l) => l.lead_status === 'Lost').length;
  const followUpRequired = leads.filter((l) => l.lead_status === 'Follow-up Required').length;

  const activeNotifications = notifications.filter(
    (n) => (n.status === 'active' || n.status === 'unread') && !n.is_read
  ).length;

  const upcomingNotifications = notifications.filter((n) => n.status === 'scheduled').length;

  return {
    totalContacts: contacts.length,
    totalLeads: leads.length,
    newLeads,
    contactedLeads,
    interestedCustomers,
    convertedLeads,
    lostLeads,
    followUpRequired,
    activeNotifications,
    upcomingNotifications,
  };
}

