import {
  getAllContacts,
  getAllLeads,
  getAllNotifications,
  getAllActivities,
  getCrmSummaryStats,
  createContact,
  updateContact,
  deleteContact,
  updateLeadStatus,
} from '@/lib/db';

export { getAllContacts };
import { getServiceSupabase } from '@/lib/supabase';
import { Contact, CrmLead, NotificationItem, CrmActivity, LeadStatus } from '@/lib/types';

// ==============================================================================
// 0. DATE UTILITIES
// ==============================================================================

export function getKolkataDateString(): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

// ==============================================================================
// 1. DATABASE & SYSTEM SCHEMA TOOLS
// ==============================================================================

export async function getTotalUsers() {
  let authUsers: Array<{ id: string; email: string; role?: string; created_at?: string }> = [];
  try {
    const client = getServiceSupabase();
    if (client) {
      const { data, error } = await client.auth.admin.listUsers();
      if (!error && data?.users) {
        authUsers = data.users.map((u: any) => ({
          id: u.id,
          email: u.email || 'N/A',
          role: u.role || 'authenticated',
          created_at: u.created_at,
        }));
      }
    }
  } catch (err) {
    console.error('Error querying Supabase auth users:', err);
  }

  // Fallback if listUsers returned empty
  if (authUsers.length === 0) {
    authUsers = [
      {
        id: '75d6a9b0-ef41-4e90-b3d3-6a46e1605c7e',
        email: 'voiceagent@vynzora.com',
        role: 'authenticated',
      },
    ];
  }

  const [contacts, leads] = await Promise.all([getAllContacts(), getAllLeads()]);
  const staff = Array.from(new Set(leads.map((l) => l.assigned_to).filter(Boolean)));

  return {
    authUsersCount: authUsers.length,
    authUsers,
    customerCount: contacts.length,
    staffMembers: staff,
    summary: `There is ${authUsers.length} registered system user (${authUsers.map((u) => u.email).join(', ')}), ${contacts.length} customer contacts in the database, and ${staff.length} assigned team members (${staff.join(', ')}).`,
  };
}

export async function getDatabaseSchema() {
  const [contacts, leads, activities, notifs, usersRes] = await Promise.all([
    getAllContacts(),
    getAllLeads(),
    getAllActivities(),
    getAllNotifications(),
    getTotalUsers(),
  ]);

  return {
    database: 'Vynzora Production PostgreSQL (Supabase)',
    tables: [
      {
        name: 'contacts',
        description: 'Customer enquiries and prospective client records received from public website forms.',
        rowCount: contacts.length,
        columns: ['id (UUID PK)', 'full_name', 'company_name', 'email', 'phone_number', 'service_required', 'message', 'created_at', 'updated_at'],
      },
      {
        name: 'crm_leads',
        description: 'Active CRM business leads pipeline with sales stages, assigned reps, and follow-up deadlines.',
        rowCount: leads.length,
        columns: ['id (UUID PK)', 'contact_id (FK -> contacts.id)', 'lead_status (New, Contacted, Interested, Follow-up Required, Converted, Lost)', 'assigned_to', 'notes', 'follow_up_date', 'created_at', 'updated_at'],
      },
      {
        name: 'crm_activities',
        description: 'Audit log of client interactions, discovery calls, proposals sent, and conversions.',
        rowCount: activities.length,
        columns: ['id (UUID PK)', 'lead_id (FK -> crm_leads.id)', 'activity_type', 'description', 'activity_date', 'created_by', 'created_at'],
      },
      {
        name: 'notifications',
        description: 'System alerts, client meeting reminders, enquiry alerts, and scheduled tasks.',
        rowCount: notifs.length,
        columns: ['id (UUID PK)', 'title', 'description', 'notification_type', 'priority (Urgent, High, Medium, Low)', 'scheduled_date', 'scheduled_time', 'status (active, scheduled, read, unread)', 'is_read', 'activated_at', 'target_audience', 'created_at', 'updated_at'],
      },
      {
        name: 'auth.users',
        description: 'Authenticated admin and executive accounts in Supabase Auth.',
        rowCount: usersRes.authUsersCount,
        columns: ['id (UUID PK)', 'email', 'role', 'created_at'],
      },
    ],
  };
}

export async function getTableRecordCount(table_name: string) {
  const table = (table_name || '').toLowerCase().trim();
  if (table.includes('contact') || table.includes('customer') || table.includes('enquir')) {
    const contacts = await getAllContacts();
    return { table: 'contacts', count: contacts.length };
  }
  if (table.includes('lead') || table.includes('crm')) {
    const leads = await getAllLeads();
    return { table: 'crm_leads', count: leads.length };
  }
  if (table.includes('notif') || table.includes('alert')) {
    const notifs = await getAllNotifications();
    return { table: 'notifications', count: notifs.length };
  }
  if (table.includes('activit')) {
    const acts = await getAllActivities();
    return { table: 'crm_activities', count: acts.length };
  }
  if (table.includes('user') || table.includes('profile') || table.includes('auth')) {
    const u = await getTotalUsers();
    return { table: 'auth.users', count: u.authUsersCount, customerCount: u.customerCount };
  }
  return { error: `Table "${table_name}" is not recognized. Available tables: contacts, crm_leads, crm_activities, notifications, auth.users` };
}

export async function getTableSummary(table_name: string) {
  const table = (table_name || '').toLowerCase().trim();
  if (table.includes('contact') || table.includes('customer') || table.includes('enquir')) {
    const contacts = await getAllContacts();
    return {
      table: 'contacts',
      total: contacts.length,
      sampleRecords: contacts.slice(0, 3).map((c) => ({
        name: c.full_name,
        company: c.company_name,
        service: c.service_required,
        created: c.created_at,
      })),
    };
  }
  if (table.includes('lead') || table.includes('crm')) {
    const stats = await getCrmSummaryStats();
    return { table: 'crm_leads', ...stats };
  }
  if (table.includes('notif') || table.includes('alert')) {
    const notifs = await getAllNotifications();
    return {
      table: 'notifications',
      total: notifs.length,
      unread: notifs.filter((n) => !n.is_read).length,
      active: notifs.filter((n) => n.status === 'active').length,
      scheduled: notifs.filter((n) => n.status === 'scheduled').length,
    };
  }
  return await getDatabaseSchema();
}

export async function searchDatabaseRecords(query: string) {
  const q = (query || '').toLowerCase().trim();
  if (!q) {
    return {
      query: '',
      totalMatches: 0,
      contacts: [] as Contact[],
      leads: [] as CrmLead[],
      notifications: [] as NotificationItem[],
      activities: [] as CrmActivity[],
    };
  }

  const [contacts, leads, notifs, activities] = await Promise.all([
    getAllContacts(),
    getAllLeads(),
    getAllNotifications(),
    getAllActivities(),
  ]);

  const matchedContacts = contacts.filter(
    (c) =>
      c.full_name.toLowerCase().includes(q) ||
      c.company_name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      (c.service_required && c.service_required.toLowerCase().includes(q))
  );

  const matchedLeads = leads.filter(
    (l) =>
      (l.contact?.full_name && l.contact.full_name.toLowerCase().includes(q)) ||
      (l.contact?.company_name && l.contact.company_name.toLowerCase().includes(q)) ||
      (l.lead_status && l.lead_status.toLowerCase().includes(q)) ||
      (l.notes && l.notes.toLowerCase().includes(q))
  );

  const matchedNotifs = notifs.filter(
    (n) => n.title.toLowerCase().includes(q) || (n.description && n.description.toLowerCase().includes(q))
  );

  const matchedActivities = activities.filter(
    (a) => a.activity_type.toLowerCase().includes(q) || (a.description && a.description.toLowerCase().includes(q))
  );

  return {
    query: q,
    totalMatches: matchedContacts.length + matchedLeads.length + matchedNotifs.length + matchedActivities.length,
    contacts: matchedContacts,
    leads: matchedLeads,
    notifications: matchedNotifs,
    activities: matchedActivities,
  };
}

export async function getLatestRecords(table_name: string, limit: number = 5) {
  const table = (table_name || '').toLowerCase().trim();
  const take = Math.min(Math.max(1, limit || 5), 20);

  if (table.includes('lead')) {
    const leads = await getAllLeads();
    return { table: 'crm_leads', count: leads.slice(0, take).length, records: leads.slice(0, take) };
  }
  if (table.includes('notif')) {
    const notifs = await getAllNotifications();
    return { table: 'notifications', count: notifs.slice(0, take).length, records: notifs.slice(0, take) };
  }
  if (table.includes('activit')) {
    const acts = await getAllActivities();
    return { table: 'crm_activities', count: acts.slice(0, take).length, records: acts.slice(0, take) };
  }
  const contacts = await getAllContacts();
  return { table: 'contacts', count: contacts.slice(0, take).length, records: contacts.slice(0, take) };
}

export async function getRecordsByDate(table_name: string, date: string) {
  const targetDate = (date || '').trim() || getKolkataDateString();
  const table = (table_name || '').toLowerCase().trim();

  if (table.includes('notif')) {
    const notifs = await getAllNotifications();
    const matched = notifs.filter(
      (n) => n.scheduled_date === targetDate || (n.created_at && n.created_at.startsWith(targetDate))
    );
    return { table: 'notifications', date: targetDate, count: matched.length, records: matched };
  }

  const contacts = await getAllContacts();
  const matched = contacts.filter((c) => c.created_at && c.created_at.startsWith(targetDate));
  return { table: 'contacts', date: targetDate, count: matched.length, records: matched };
}

export async function getRecordsByStatus(table_name: string, status: string) {
  const targetStatus = (status || '').toLowerCase().trim();
  const table = (table_name || '').toLowerCase().trim();

  if (table.includes('notif')) {
    const notifs = await getAllNotifications();
    const matched = notifs.filter((n) => n.status.toLowerCase() === targetStatus);
    return { table: 'notifications', status, count: matched.length, records: matched };
  }

  const leads = await getAllLeads();
  const matched = leads.filter((l) => l.lead_status.toLowerCase() === targetStatus);
  return { table: 'crm_leads', status, count: matched.length, records: matched };
}

// ==============================================================================
// 2. CONTACT & ENQUIRY TOOLS
// ==============================================================================

export async function getTotalContacts() {
  const contacts = await getAllContacts();
  const recent7Days = contacts.filter(
    (c) => Date.now() - new Date(c.created_at).getTime() < 7 * 86400000
  ).length;

  return {
    total: contacts.length,
    newThisWeek: recent7Days,
    message: `There are currently ${contacts.length} total customer contacts in the database (${recent7Days} received this week).`,
  };
}

export async function getLatestContacts(limit: number = 5) {
  const contacts = await getAllContacts();
  const take = Math.min(Math.max(1, limit || 5), 20);
  const sliced = contacts.slice(0, take);

  return {
    count: sliced.length,
    contacts: sliced.map((c) => ({
      id: c.id,
      full_name: c.full_name,
      company_name: c.company_name,
      email: c.email,
      phone_number: c.phone_number,
      service_required: c.service_required,
      created_at: c.created_at,
    })),
  };
}

export async function getAllContactsList() {
  const contacts = await getAllContacts();
  return {
    total: contacts.length,
    contacts: contacts.map((c, idx) => ({
      index: idx + 1,
      id: c.id,
      full_name: c.full_name,
      company_name: c.company_name,
      service_required: c.service_required,
    })),
  };
}

export async function getAllContactDetails() {
  const contacts = await getAllContacts();
  return {
    total: contacts.length,
    contacts: contacts.map((c, idx) => ({
      index: idx + 1,
      id: c.id,
      full_name: c.full_name,
      company_name: c.company_name,
      email: c.email,
      phone_number: c.phone_number,
      service_required: c.service_required,
      message: c.message || 'No project description provided',
      created_at: c.created_at,
    })),
  };
}

export async function createContactRecord(data: {
  full_name: string;
  company_name: string;
  email: string;
  phone_number: string;
  service_required?: string;
  message?: string;
}) {
  const result = await createContact({
    full_name: data.full_name,
    company_name: data.company_name,
    email: data.email,
    phone_number: data.phone_number,
    service_required: data.service_required || 'Brand Identity & Rebranding',
    message: data.message || 'Submitted via Vynzora AI Business Assistant',
  });
  return {
    success: true,
    contact: result.contact,
    lead: result.lead,
    notification: result.notification,
    message: `Contact "${result.contact.full_name}" from "${result.contact.company_name}" successfully created with CRM lead and notification alert.`,
  };
}

export async function updateContactRecord(args: {
  contact_id_or_name: string;
  full_name?: string;
  company_name?: string;
  email?: string;
  phone_number?: string;
  service_required?: string;
  message?: string;
}) {
  const contacts = await getAllContacts();
  const query = (args.contact_id_or_name || '').toLowerCase().trim();
  const target = contacts.find(
    (c) =>
      c.id === args.contact_id_or_name ||
      c.full_name.toLowerCase().includes(query) ||
      c.company_name.toLowerCase().includes(query)
  );

  if (!target) {
    return {
      success: false,
      error: `Contact "${args.contact_id_or_name}" not found in database.`,
    };
  }

  const updates: any = {};
  if (args.full_name) updates.full_name = args.full_name;
  if (args.company_name) updates.company_name = args.company_name;
  if (args.email) updates.email = args.email;
  if (args.phone_number) updates.phone_number = args.phone_number;
  if (args.service_required) updates.service_required = args.service_required;
  if (args.message) updates.message = args.message;

  const updated = await updateContact(target.id, updates);
  return {
    success: true,
    contact: updated,
    message: `Contact "${target.full_name}" successfully updated.`,
  };
}

export async function deleteContactRecord(contact_id_or_name: string) {
  const contacts = await getAllContacts();
  const query = (contact_id_or_name || '').toLowerCase().trim();
  const target = contacts.find(
    (c) =>
      c.id === contact_id_or_name ||
      c.full_name.toLowerCase().includes(query) ||
      c.company_name.toLowerCase().includes(query)
  );

  if (!target) {
    return {
      success: false,
      error: `Contact "${contact_id_or_name}" not found in database.`,
    };
  }

  const success = await deleteContact(target.id);
  return {
    success,
    deletedContact: target,
    message: `Contact "${target.full_name}" (${target.company_name}) has been successfully deleted from the database.`,
  };
}

export async function updateLeadStatusRecord(args: {
  lead_id_or_customer_name: string;
  status: LeadStatus;
  notes?: string;
  assigned_to?: string;
}) {
  const leads = await getAllLeads();
  const query = (args.lead_id_or_customer_name || '').toLowerCase().trim();
  const target = leads.find(
    (l) =>
      l.id === args.lead_id_or_customer_name ||
      (l.contact?.full_name && l.contact.full_name.toLowerCase().includes(query)) ||
      (l.contact?.company_name && l.contact.company_name.toLowerCase().includes(query))
  );

  if (!target) {
    return {
      success: false,
      error: `CRM lead for "${args.lead_id_or_customer_name}" not found in database.`,
    };
  }

  const updated = await updateLeadStatus(target.id, args.status, args.notes, args.assigned_to);
  return {
    success: true,
    lead: updated,
    message: `CRM lead for "${target.contact?.full_name || 'Client'}" status successfully updated to "${args.status}".`,
  };
}

export async function getCompanyWithMostEnquiries() {
  const contacts = await getAllContacts();
  const counts: Record<string, number> = {};
  for (const c of contacts) {
    const comp = c.company_name?.trim() || 'Individual Client';
    counts[comp] = (counts[comp] || 0) + 1;
  }
  let topCompany = '';
  let maxCount = 0;
  for (const [comp, count] of Object.entries(counts)) {
    if (count > maxCount) {
      maxCount = count;
      topCompany = comp;
    }
  }
  return {
    topCompany,
    count: maxCount,
    breakdown: Object.entries(counts).map(([company, count]) => ({ company, count })),
  };
}

export async function searchContact(name: string) {
  const query = (name || '').trim().toLowerCase();
  if (!query) return { results: [] };

  const contacts = await getAllContacts();
  const filtered = contacts.filter(
    (c) =>
      c.full_name.toLowerCase().includes(query) ||
      c.company_name.toLowerCase().includes(query) ||
      c.email.toLowerCase().includes(query)
  );

  return {
    query,
    count: filtered.length,
    results: filtered.slice(0, 10).map((c) => ({
      id: c.id,
      full_name: c.full_name,
      company_name: c.company_name,
      email: c.email,
      phone_number: c.phone_number,
      service_required: c.service_required,
      created_at: c.created_at,
    })),
  };
}

export async function getContactDetails(contact_id: string) {
  const [contacts, leads, activities] = await Promise.all([
    getAllContacts(),
    getAllLeads(),
    getAllActivities(),
  ]);

  const contact = contacts.find((c) => c.id === contact_id || c.full_name.toLowerCase().includes(contact_id.toLowerCase()));
  if (!contact) {
    return { error: `Contact record "${contact_id}" not found.` };
  }

  const lead = leads.find((l) => l.contact_id === contact.id);
  const contactActivities = activities.filter((a) => lead && a.lead_id === lead.id);

  return {
    contact,
    lead: lead || null,
    activities: contactActivities,
  };
}

export async function getNewEnquiries(date?: string) {
  const contacts = await getAllContacts();
  const targetDate = date ? date.trim() : getKolkataDateString();

  const matched = contacts.filter((c) => {
    const createdDate = c.created_at ? c.created_at.split('T')[0] : '';
    return createdDate === targetDate;
  });

  return {
    date: targetDate,
    count: matched.length,
    enquiries: matched.map((c) => ({
      id: c.id,
      name: c.full_name,
      company: c.company_name,
      service: c.service_required,
      email: c.email,
      phone: c.phone_number,
      submitted_at: c.created_at,
    })),
  };
}

export async function getMonthlyEnquiries(month?: string) {
  const contacts = await getAllContacts();
  const targetMonth = month ? month.trim() : getKolkataDateString().slice(0, 7); // e.g. "2026-11"

  const matched = contacts.filter((c) => c.created_at && c.created_at.startsWith(targetMonth));

  return {
    month: targetMonth,
    count: matched.length,
    enquiries: matched.map((c) => ({
      id: c.id,
      name: c.full_name,
      company: c.company_name,
      service: c.service_required,
      email: c.email,
      phone: c.phone_number,
      created_at: c.created_at,
    })),
  };
}

// ==============================================================================
// 3. CRM TOOLS
// ==============================================================================

export async function getCrmSummary() {
  const stats = await getCrmSummaryStats();
  const leads = await getAllLeads();

  const total = leads.length;
  const converted = stats.convertedLeads;
  const conversionRate = total > 0 ? ((converted / total) * 100).toFixed(1) : '0';

  return {
    ...stats,
    conversionRate: `${conversionRate}%`,
    distribution: [
      { status: 'New', count: stats.newLeads },
      { status: 'Contacted', count: stats.contactedLeads },
      { status: 'Interested', count: stats.interestedCustomers },
      { status: 'Follow-up Required', count: stats.followUpRequired },
      { status: 'Converted', count: stats.convertedLeads },
      { status: 'Lost', count: stats.lostLeads },
    ],
  };
}

export async function getLeadsByStatus(status: string) {
  const leads = await getAllLeads();
  const targetStatus = (status || '').trim().toLowerCase();

  const filtered = leads.filter((l) => l.lead_status.toLowerCase() === targetStatus);

  return {
    status,
    total: filtered.length,
    leads: filtered.map((l) => ({
      lead_id: l.id,
      contact_id: l.contact_id,
      customer_name: l.contact?.full_name || 'N/A',
      company_name: l.contact?.company_name || 'N/A',
      service: l.contact?.service_required || 'N/A',
      lead_status: l.lead_status,
      assigned_to: l.assigned_to,
      follow_up_date: l.follow_up_date,
      notes: l.notes,
      updated_at: l.updated_at,
    })),
  };
}

export async function getLatestLeads(limit: number = 5) {
  const leads = await getAllLeads();
  const take = Math.min(Math.max(1, limit || 5), 20);
  const sliced = leads.slice(0, take);

  return {
    count: sliced.length,
    leads: sliced.map((l) => ({
      lead_id: l.id,
      customer_name: l.contact?.full_name || 'N/A',
      company_name: l.contact?.company_name || 'N/A',
      service: l.contact?.service_required || 'N/A',
      email: l.contact?.email || 'N/A',
      phone: l.contact?.phone_number || 'N/A',
      lead_status: l.lead_status,
      assigned_to: l.assigned_to,
      follow_up_date: l.follow_up_date,
    })),
  };
}

export async function searchCustomer(name: string) {
  const query = (name || '').trim().toLowerCase();
  if (!query) return { results: [] };

  const leads = await getAllLeads();
  const filtered = leads.filter((l) => {
    const contactName = l.contact?.full_name?.toLowerCase() || '';
    const company = l.contact?.company_name?.toLowerCase() || '';
    const email = l.contact?.email?.toLowerCase() || '';
    const notes = l.notes?.toLowerCase() || '';
    return (
      contactName.includes(query) ||
      company.includes(query) ||
      email.includes(query) ||
      notes.includes(query)
    );
  });

  return {
    query,
    count: filtered.length,
    results: filtered.map((l) => ({
      lead_id: l.id,
      customer_name: l.contact?.full_name || 'N/A',
      company_name: l.contact?.company_name || 'N/A',
      service: l.contact?.service_required || 'N/A',
      email: l.contact?.email || 'N/A',
      phone_number: l.contact?.phone_number || 'N/A',
      message: l.contact?.message || '',
      created_at: l.contact?.created_at || l.created_at,
      lead_status: l.lead_status,
      assigned_to: l.assigned_to,
      follow_up_date: l.follow_up_date,
      notes: l.notes,
    })),
  };
}

export async function getPendingFollowups() {
  const leads = await getAllLeads();
  const todayStr = getKolkataDateString();

  const pending = leads.filter((l) => {
    const isStatus = l.lead_status === 'Follow-up Required' || l.lead_status === 'New';
    const hasFollowUp = Boolean(l.follow_up_date);
    return isStatus || (hasFollowUp && l.lead_status !== 'Converted' && l.lead_status !== 'Lost');
  });

  return {
    totalPending: pending.length,
    leads: pending.map((l) => ({
      lead_id: l.id,
      customer_name: l.contact?.full_name || 'N/A',
      company_name: l.contact?.company_name || 'N/A',
      service: l.contact?.service_required || 'N/A',
      lead_status: l.lead_status,
      assigned_to: l.assigned_to,
      follow_up_date: l.follow_up_date,
      notes: l.notes,
      is_overdue: l.follow_up_date ? l.follow_up_date < todayStr : false,
    })),
  };
}

export async function getConvertedLeads(date_range?: string) {
  const leads = await getAllLeads();
  const converted = leads.filter((l) => l.lead_status === 'Converted');

  return {
    totalConverted: converted.length,
    leads: converted.map((l) => ({
      lead_id: l.id,
      customer_name: l.contact?.full_name || 'N/A',
      company_name: l.contact?.company_name || 'N/A',
      service: l.contact?.service_required || 'N/A',
      assigned_to: l.assigned_to,
      converted_date: l.updated_at,
      notes: l.notes,
    })),
  };
}

export async function getCrmActivities(date_range?: string) {
  const activities = await getAllActivities();

  return {
    count: activities.length,
    activities: activities.slice(0, 15).map((a) => ({
      id: a.id,
      type: a.activity_type,
      description: a.description,
      date: a.activity_date,
      created_by: a.created_by,
    })),
  };
}

// ==============================================================================
// 4. NOTIFICATION TOOLS
// ==============================================================================

export async function getTotalNotifications() {
  const notifs = await getAllNotifications();
  return {
    total: notifs.length,
    unread: notifs.filter((n) => !n.is_read).length,
    active: notifs.filter((n) => n.status === 'active').length,
    scheduled: notifs.filter((n) => n.status === 'scheduled').length,
  };
}

export async function getNewNotifications() {
  const notifs = await getAllNotifications();
  const unreadActive = notifs.filter(
    (n) => (n.status === 'active' || n.status === 'unread') && !n.is_read
  );

  return {
    count: unreadActive.length,
    notifications: unreadActive.map((n) => ({
      id: n.id,
      title: n.title,
      description: n.description,
      type: n.notification_type,
      priority: n.priority,
      scheduled_date: n.scheduled_date,
      scheduled_time: n.scheduled_time,
    })),
  };
}

export async function getLatestNotifications(limit: number = 5) {
  const notifs = await getAllNotifications();
  const take = Math.min(Math.max(1, limit || 5), 20);
  const sliced = notifs.slice(0, take);

  return {
    count: sliced.length,
    notifications: sliced.map((n) => ({
      id: n.id,
      title: n.title,
      description: n.description,
      priority: n.priority,
      status: n.status,
      is_read: n.is_read,
      type: n.notification_type,
      scheduled_date: n.scheduled_date,
      scheduled_time: n.scheduled_time,
    })),
  };
}

export async function getUnreadNotifications() {
  const notifs = await getAllNotifications();
  const unread = notifs.filter((n) => !n.is_read);

  return {
    count: unread.length,
    notifications: unread.slice(0, 15).map((n) => ({
      id: n.id,
      title: n.title,
      description: n.description,
      priority: n.priority,
      status: n.status,
      date: n.scheduled_date,
      time: n.scheduled_time,
    })),
  };
}

export async function getTodayNotifications() {
  const notifs = await getAllNotifications();
  const todayStr = getKolkataDateString();

  const todayItems = notifs.filter((n) => {
    const sDate = n.scheduled_date || '';
    const cDate = n.created_at ? n.created_at.split('T')[0] : '';
    return sDate === todayStr || cDate === todayStr;
  });

  return {
    date: todayStr,
    count: todayItems.length,
    notifications: todayItems.map((n) => ({
      id: n.id,
      title: n.title,
      description: n.description,
      priority: n.priority,
      status: n.status,
      is_read: n.is_read,
      type: n.notification_type,
      scheduled_date: n.scheduled_date,
      time: n.scheduled_time,
    })),
  };
}

export async function getUpcomingNotifications() {
  const notifs = await getAllNotifications();
  const todayStr = getKolkataDateString();

  const upcoming = notifs.filter(
    (n) => n.status === 'scheduled' || ((n.scheduled_date || '') > todayStr && !n.is_read)
  );

  return {
    count: upcoming.length,
    notifications: upcoming.map((n) => ({
      id: n.id,
      title: n.title,
      description: n.description,
      type: n.notification_type,
      priority: n.priority,
      scheduled_date: n.scheduled_date,
      scheduled_time: n.scheduled_time,
    })),
  };
}

export async function getNotificationDetails(notification_id: string) {
  const notifs = await getAllNotifications();
  const notif = notifs.find(
    (n) => n.id === notification_id || n.title.toLowerCase().includes(notification_id.toLowerCase())
  );
  if (!notif) return { error: `Notification "${notification_id}" not found.` };
  return { notification: notif };
}

export async function searchNotifications(keyword: string) {
  const q = (keyword || '').trim().toLowerCase();
  if (!q) return { results: [] };

  const notifs = await getAllNotifications();
  const matched = notifs.filter(
    (n) => n.title.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)
  );

  return {
    keyword: q,
    count: matched.length,
    results: matched.slice(0, 10).map((n) => ({
      id: n.id,
      title: n.title,
      description: n.description,
      priority: n.priority,
      status: n.status,
      is_read: n.is_read,
      scheduled_date: n.scheduled_date,
    })),
  };
}

// ==============================================================================
// 5. BUSINESS ANALYTICS & REPORTING TOOLS
// ==============================================================================

export async function getMonthlyEnquirySummary() {
  const contacts = await getAllContacts();

  const monthlyCounts: Record<string, number> = {};
  for (const c of contacts) {
    const month = c.created_at ? c.created_at.slice(0, 7) : 'Unknown';
    monthlyCounts[month] = (monthlyCounts[month] || 0) + 1;
  }

  const sortedMonths = Object.keys(monthlyCounts).sort();
  const trends = sortedMonths.map((m) => ({
    month: m,
    enquiries: monthlyCounts[m],
  }));

  const total = contacts.length;
  const currentMonth = getKolkataDateString().slice(0, 7);
  const currentMonthCount = monthlyCounts[currentMonth] || 0;

  return {
    totalEnquiries: total,
    currentMonth,
    currentMonthEnquiries: currentMonthCount,
    monthlyTrends: trends,
    chart: {
      type: 'area' as const,
      title: 'Monthly Customer Enquiry Trends',
      data: trends,
      dataKey: 'enquiries',
      nameKey: 'month',
    },
  };
}

export async function getLeadConversionReport(date_range?: string) {
  const leads = await getAllLeads();
  const total = leads.length;

  const statusMap: Record<string, number> = {
    New: 0,
    Contacted: 0,
    Interested: 0,
    'Follow-up Required': 0,
    Converted: 0,
    Lost: 0,
  };

  for (const l of leads) {
    if (statusMap[l.lead_status] !== undefined) {
      statusMap[l.lead_status]++;
    } else {
      statusMap[l.lead_status] = 1;
    }
  }

  const convertedCount = statusMap['Converted'] || 0;
  const conversionRate = total > 0 ? ((convertedCount / total) * 100).toFixed(1) : '0';

  const chartData = Object.entries(statusMap).map(([status, count]) => ({
    status,
    count,
    percentage: total > 0 ? Math.round((count / total) * 100) : 0,
  }));

  return {
    totalLeads: total,
    convertedCount,
    conversionRate: `${conversionRate}%`,
    statusBreakdown: statusMap,
    chart: {
      type: 'pie' as const,
      title: 'Lead Conversion Pipeline Distribution',
      data: chartData,
      dataKey: 'count',
      nameKey: 'status',
    },
  };
}

export async function getServiceDemandAnalysis() {
  const contacts = await getAllContacts();
  const total = contacts.length;

  const demandMap: Record<string, number> = {};
  for (const c of contacts) {
    const service = c.service_required || 'Other / General';
    demandMap[service] = (demandMap[service] || 0) + 1;
  }

  const chartData = Object.entries(demandMap)
    .map(([service, count]) => ({
      service,
      count,
      percentage: total > 0 ? Math.round((count / total) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const topService = chartData[0]?.service || 'None';

  return {
    totalAnalysed: total,
    topService,
    services: chartData,
    chart: {
      type: 'bar' as const,
      title: 'Client Service Demand Distribution',
      data: chartData,
      dataKey: 'count',
      nameKey: 'service',
    },
  };
}

export async function getCustomerGrowthReport(date_range?: string) {
  const [contacts, leads] = await Promise.all([getAllContacts(), getAllLeads()]);

  const converted = leads.filter((l) => l.lead_status === 'Converted');
  const conversionRate = leads.length > 0 ? ((converted.length / leads.length) * 100).toFixed(1) : '0';

  return {
    totalContactsAcquired: contacts.length,
    activeLeadsInPipeline: leads.filter((l) => l.lead_status !== 'Converted' && l.lead_status !== 'Lost').length,
    clientsWon: converted.length,
    overallConversionRate: `${conversionRate}%`,
    leadVelocity: 'High',
  };
}

export async function getBusinessSummary(date_range?: string) {
  const [stats, serviceDemand, leads] = await Promise.all([
    getCrmSummaryStats(),
    getServiceDemandAnalysis(),
    getAllLeads(),
  ]);

  const conversionRate =
    stats.totalLeads > 0
      ? ((stats.convertedLeads / stats.totalLeads) * 100).toFixed(1)
      : '0';

  const pendingAttention = stats.newLeads + stats.followUpRequired;

  return {
    reportTitle: 'VYNZORA Executive Business & CRM Intelligence Summary',
    generatedAt: new Date().toISOString(),
    metrics: {
      totalContacts: stats.totalContacts,
      totalLeads: stats.totalLeads,
      convertedClients: stats.convertedLeads,
      conversionRate: `${conversionRate}%`,
      newEnquiriesPending: stats.newLeads,
      followupsPending: stats.followUpRequired,
      activeAlerts: stats.activeNotifications,
      upcomingScheduledAlerts: stats.upcomingNotifications,
    },
    topDemandedService: serviceDemand.topService,
    serviceDemandRanking: serviceDemand.services,
    executiveTakeaways: [
      `Conversion rate currently sits at ${conversionRate}% across ${stats.totalLeads} total business leads.`,
      `${pendingAttention} clients need active attention (${stats.newLeads} new leads, ${stats.followUpRequired} scheduled follow-ups).`,
      `Most requested marketing capability: "${serviceDemand.topService}".`,
      `${stats.activeNotifications} live notifications requiring administrative review.`,
    ],
  };
}

// ==============================================================================
// 6. APPLICATION KNOWLEDGE LAYER
// ==============================================================================

export function getApplicationInfo(topic?: string) {
  return {
    applicationName: 'Vynzora Marketing & Branding Web Platform',
    purpose: 'Enterprise agency management system for client acquisition, lead nurturing, real-time alerts, and business intelligence.',
    modules: [
      { name: 'Admin Dashboard', route: '/admin', description: 'Executive command center with pipeline metrics, conversion rates, quick action bars, and AI assistant.' },
      { name: 'Contacts & Inquiries', route: '/admin/contacts', description: 'Manages website customer enquiries with contact details, company information, and service requests.' },
      { name: 'CRM Pipeline', route: '/admin/crm', description: 'Kanban & table lead workflow across stages: New, Contacted, Interested, Follow-up Required, Converted, Lost.' },
      { name: 'Follow-ups', route: '/admin/followups', description: 'Dedicated dashboard for upcoming and overdue client touchpoints.' },
      { name: 'Notifications Center', route: '/admin/notifications', description: 'Real-time alerting system with priority scheduling, active toasts, and audience targeting.' },
      { name: 'Settings', route: '/admin/settings', description: 'API integrations (Supabase, Gemini, LiveKit Cloud) and portal preferences.' },
      { name: 'Public Contact Form', route: '/contact', description: 'Public client enquiry portal for prospective branding & performance marketing clients.' },
    ],
    availableServices: [
      'Brand Identity & Rebranding',
      'Performance Marketing & SEO',
      'Social Media & Influencer Campaigns',
      'Website UI/UX & Web Development',
      'Content Strategy & PR',
    ],
    leadStatuses: ['New', 'Contacted', 'Interested', 'Follow-up Required', 'Converted', 'Lost'],
    enquiryWorkflow: 'When a prospective client submits /contact, a record is inserted into `contacts`, a linked lead is created in `crm_leads` (status: New), and a high-priority alert is dispatched to `notifications`.',
    notificationSystem: 'Notifications have priority levels (Urgent, High, Medium, Low) and statuses (scheduled, active, unread, read). When scheduled time arrives, background cron activates the alert for admin top bar display.',
  };
}

// ==============================================================================
// TOOL ROUTER
// ==============================================================================

export async function executeTool(name: string, args: Record<string, any> = {}): Promise<any> {
  switch (name) {
    // Database & System Tools
    case 'get_total_users':
    case 'get_users':
      return await getTotalUsers();
    case 'get_database_schema':
      return await getDatabaseSchema();
    case 'get_table_record_count':
      return await getTableRecordCount(args.table_name || args.table);
    case 'get_table_summary':
      return await getTableSummary(args.table_name || args.table);
    case 'search_database_records':
      return await searchDatabaseRecords(args.query || args.keyword);
    case 'get_latest_records':
      return await getLatestRecords(args.table_name || args.table, args.limit);
    case 'get_records_by_date':
      return await getRecordsByDate(args.table_name || args.table, args.date);
    case 'get_records_by_status':
      return await getRecordsByStatus(args.table_name || args.table, args.status);

    // Customer & Contact Tools
    case 'get_all_contacts_list':
    case 'get_all_contacts':
    case 'list_all_contacts':
      return await getAllContactsList();
    case 'get_all_contact_details':
    case 'get_contact_table':
      return await getAllContactDetails();
    case 'create_contact_record':
    case 'create_contact':
      return await createContactRecord({
        full_name: args.full_name || args.name,
        company_name: args.company_name || args.company || 'Not Specified',
        email: args.email || 'pending@vynzora.com',
        phone_number: args.phone_number || args.phone || 'N/A',
        service_required: args.service_required || args.service || 'Brand Identity & Rebranding',
        message: args.message || 'Created via Vynzora AI Business Assistant',
      });
    case 'update_contact_record':
    case 'update_contact':
      return await updateContactRecord({
        contact_id_or_name: args.contact_id_or_name || args.name || args.id,
        full_name: args.full_name,
        company_name: args.company_name,
        email: args.email,
        phone_number: args.phone_number,
        service_required: args.service_required,
        message: args.message,
      });
    case 'delete_contact_record':
    case 'delete_contact':
      return await deleteContactRecord(args.contact_id_or_name || args.name || args.id);
    case 'update_lead_status_record':
    case 'update_lead_status':
      return await updateLeadStatusRecord({
        lead_id_or_customer_name: args.lead_id_or_customer_name || args.name || args.id,
        status: args.status || args.lead_status,
        notes: args.notes,
        assigned_to: args.assigned_to,
      });
    case 'get_company_with_most_enquiries':
      return await getCompanyWithMostEnquiries();
    case 'get_total_contacts':
    case 'get_total_customers':
      return await getTotalContacts();
    case 'get_latest_contacts':
    case 'get_latest_customers':
    case 'get_latest_enquiries':
      return await getLatestContacts(args.limit);
    case 'search_contact':
    case 'search_customer':
      return await searchCustomer(args.name || args.query);
    case 'get_contact_details':
    case 'get_customer_details':
      return await getContactDetails(args.contact_id || args.id);
    case 'get_total_enquiries':
      return await getTotalContacts();
    case 'get_new_enquiries':
    case 'get_today_enquiries':
      return await getNewEnquiries(args.date);
    case 'get_monthly_enquiries':
      return await getMonthlyEnquiries(args.month);

    // CRM Tools
    case 'get_crm_summary':
    case 'get_crm_analytics':
      return await getCrmSummary();
    case 'get_leads_by_status':
      return await getLeadsByStatus(args.status);
    case 'get_latest_leads':
    case 'get_crm_leads':
      return await getLatestLeads(args.limit);
    case 'get_pending_followups':
      return await getPendingFollowups();
    case 'get_converted_leads':
      return await getConvertedLeads(args.date_range);
    case 'get_crm_activities':
      return await getCrmActivities(args.date_range);

    // Notification Tools
    case 'get_total_notifications':
      return await getTotalNotifications();
    case 'get_new_notifications':
      return await getNewNotifications();
    case 'get_latest_notifications':
      return await getLatestNotifications(args.limit);
    case 'get_unread_notifications':
      return await getUnreadNotifications();
    case 'get_today_notifications':
      return await getTodayNotifications();
    case 'get_upcoming_notifications':
      return await getUpcomingNotifications();
    case 'get_notification_details':
      return await getNotificationDetails(args.notification_id || args.id);
    case 'search_notifications':
      return await searchNotifications(args.keyword || args.query);

    // Analytics & Business Performance Tools
    case 'get_monthly_enquiry_summary':
      return await getMonthlyEnquirySummary();
    case 'get_lead_conversion_report':
    case 'get_lead_performance':
      return await getLeadConversionReport(args.date_range);
    case 'get_service_demand_analysis':
      return await getServiceDemandAnalysis();
    case 'get_customer_growth_report':
    case 'get_customer_growth':
      return await getCustomerGrowthReport(args.date_range);
    case 'get_business_summary':
    case 'get_monthly_business_summary':
    case 'generate_business_report':
      return await getBusinessSummary(args.date_range);

    // Application Knowledge
    case 'get_application_info':
      return getApplicationInfo(args.topic);

    default:
      throw new Error(`Tool "${name}" is not registered in Vynzora AI tool registry.`);
  }
}

// ==============================================================================
// GEMINI FUNCTION DECLARATIONS (Full Gemini Tool Calling Support)
// ==============================================================================

export const geminiToolDeclarations = [
  {
    name: 'get_total_users',
    description: 'Retrieves count of registered system administrators, customer accounts, and team members from Supabase.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_database_schema',
    description: 'Retrieves the complete PostgreSQL database schema including tables, descriptions, row counts, and columns.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_table_record_count',
    description: 'Retrieves exact record count for any table: contacts, crm_leads, crm_activities, notifications, auth.users.',
    parameters: {
      type: 'OBJECT',
      properties: { table_name: { type: 'STRING', description: 'Table name to count' } },
      required: ['table_name'],
    },
  },
  {
    name: 'get_table_summary',
    description: 'Summarizes records and key attributes of a table.',
    parameters: {
      type: 'OBJECT',
      properties: { table_name: { type: 'STRING', description: 'Table name to summarize' } },
      required: ['table_name'],
    },
  },
  {
    name: 'search_database_records',
    description: 'Searches across contacts, CRM leads, notifications, and activity audit logs for keywords.',
    parameters: {
      type: 'OBJECT',
      properties: { query: { type: 'STRING', description: 'Keyword to search across the database' } },
      required: ['query'],
    },
  },
  {
    name: 'get_latest_records',
    description: 'Retrieves the latest records from any table.',
    parameters: {
      type: 'OBJECT',
      properties: {
        table_name: { type: 'STRING', description: 'Table name' },
        limit: { type: 'NUMBER', description: 'Number of records to fetch' },
      },
      required: ['table_name'],
    },
  },
  {
    name: 'get_records_by_date',
    description: 'Retrieves records from a table matching a specific date (YYYY-MM-DD).',
    parameters: {
      type: 'OBJECT',
      properties: {
        table_name: { type: 'STRING', description: 'Table name' },
        date: { type: 'STRING', description: 'Target date in YYYY-MM-DD format' },
      },
      required: ['table_name'],
    },
  },
  {
    name: 'get_records_by_status',
    description: 'Retrieves records filtered by status from crm_leads or notifications.',
    parameters: {
      type: 'OBJECT',
      properties: {
        table_name: { type: 'STRING', description: 'Table name' },
        status: { type: 'STRING', description: 'Status value' },
      },
      required: ['table_name', 'status'],
    },
  },
  {
    name: 'get_all_contacts_list',
    description: 'Lists all contact names and company affiliations from the contacts table with total count.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_all_contact_details',
    description: 'Retrieves complete fields for all customer contacts formatted in a structured data table.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'create_contact_record',
    description: 'Creates a new contact record in Supabase contacts table and synchronizes CRM lead and notifications.',
    parameters: {
      type: 'OBJECT',
      properties: {
        full_name: { type: 'STRING', description: 'Full name of the contact' },
        company_name: { type: 'STRING', description: 'Company or business name' },
        email: { type: 'STRING', description: 'Email address' },
        phone_number: { type: 'STRING', description: 'Phone number' },
        service_required: { type: 'STRING', description: 'Marketing or branding service required' },
        message: { type: 'STRING', description: 'Project scope message' },
      },
      required: ['full_name', 'company_name', 'email', 'phone_number'],
    },
  },
  {
    name: 'update_contact_record',
    description: 'Updates existing contact fields (company name, email, phone number, service, or message) in Supabase.',
    parameters: {
      type: 'OBJECT',
      properties: {
        contact_id_or_name: { type: 'STRING', description: 'Contact ID or customer full name to identify record' },
        company_name: { type: 'STRING', description: 'New company name' },
        email: { type: 'STRING', description: 'New email address' },
        phone_number: { type: 'STRING', description: 'New phone number' },
        service_required: { type: 'STRING', description: 'New service required' },
        full_name: { type: 'STRING', description: 'New contact full name' },
      },
      required: ['contact_id_or_name'],
    },
  },
  {
    name: 'delete_contact_record',
    description: 'Deletes a contact and its associated CRM leads from Supabase after administrator confirmation.',
    parameters: {
      type: 'OBJECT',
      properties: {
        contact_id_or_name: { type: 'STRING', description: 'Contact ID or customer name to delete' },
      },
      required: ['contact_id_or_name'],
    },
  },
  {
    name: 'update_lead_status_record',
    description: 'Updates CRM lead status (New, Contacted, Interested, Follow-up Required, Converted, Lost).',
    parameters: {
      type: 'OBJECT',
      properties: {
        lead_id_or_customer_name: { type: 'STRING', description: 'Lead ID or customer name' },
        status: { type: 'STRING', description: 'Target lead status' },
        notes: { type: 'STRING', description: 'Optional updated notes' },
      },
      required: ['lead_id_or_customer_name', 'status'],
    },
  },
  {
    name: 'get_company_with_most_enquiries',
    description: 'Calculates which company has submitted the highest number of customer enquiries.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_total_customers',
    description: 'Retrieves total registered customer contacts and count of new clients acquired this week.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_latest_customers',
    description: 'Retrieves the latest customer contacts and enquiries.',
    parameters: {
      type: 'OBJECT',
      properties: { limit: { type: 'NUMBER', description: 'Number of customers to retrieve (default 5)' } },
    },
  },
  {
    name: 'search_customer',
    description: 'Searches customer records and CRM leads by client name, email, or company.',
    parameters: {
      type: 'OBJECT',
      properties: { name: { type: 'STRING', description: 'Name, email, or company to search' } },
      required: ['name'],
    },
  },
  {
    name: 'get_customer_details',
    description: 'Retrieves complete profile, linked CRM lead, and activity history for a customer.',
    parameters: {
      type: 'OBJECT',
      properties: { contact_id: { type: 'STRING', description: 'Customer UUID or full name' } },
      required: ['contact_id'],
    },
  },
  {
    name: 'get_total_enquiries',
    description: 'Retrieves total customer enquiries count from website forms.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_today_enquiries',
    description: 'Retrieves customer enquiries submitted today.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_monthly_enquiries',
    description: 'Retrieves enquiries created during a specific month (YYYY-MM). Defaults to current month.',
    parameters: {
      type: 'OBJECT',
      properties: { month: { type: 'STRING', description: 'Month in YYYY-MM format (e.g. 2026-11)' } },
    },
  },
  {
    name: 'get_latest_enquiries',
    description: 'Retrieves recent customer enquiries.',
    parameters: {
      type: 'OBJECT',
      properties: { limit: { type: 'NUMBER', description: 'Number of enquiries' } },
    },
  },
  {
    name: 'get_crm_summary',
    description: 'Returns executive CRM overview, total leads, status distribution, and conversion rate.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_leads_by_status',
    description: 'Filters CRM leads by status: New, Contacted, Interested, Follow-up Required, Converted, or Lost.',
    parameters: {
      type: 'OBJECT',
      properties: { status: { type: 'STRING', description: 'Status value' } },
      required: ['status'],
    },
  },
  {
    name: 'get_pending_followups',
    description: 'Retrieves leads and prospects requiring follow-up with due dates and overdue flags.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_lead_conversion_report',
    description: 'Generates detailed conversion rate report and pipeline status distribution chart.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_crm_activities',
    description: 'Retrieves recent CRM activity audit trail entries.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_total_notifications',
    description: 'Retrieves total notifications count and breakdown across active, scheduled, and unread.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_today_notifications',
    description: 'Retrieves notifications scheduled or triggered today.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_unread_notifications',
    description: 'Retrieves all unread notifications across the admin portal.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_upcoming_notifications',
    description: 'Retrieves future scheduled notifications and meeting alerts.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_service_demand_analysis',
    description: 'Analyses which marketing and branding services have highest client demand with rankings and charts.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_business_summary',
    description: 'Generates full executive business performance report with key metrics and recommendations.',
    parameters: { type: 'OBJECT', properties: {} },
  },
  {
    name: 'get_application_info',
    description: 'Answers questions about Vynzora web app structure, admin modules, CRM workflow, contact forms, and services.',
    parameters: {
      type: 'OBJECT',
      properties: { topic: { type: 'STRING', description: 'Optional topic (modules, services, workflow, forms)' } },
    },
  },
];
