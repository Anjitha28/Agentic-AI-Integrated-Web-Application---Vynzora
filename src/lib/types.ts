export type UserRole = 'admin' | 'user';

export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'Follow-up Required'
  | 'Converted'
  | 'Lost';

export type NotificationType =
  | 'General Announcement'
  | 'Customer Enquiry'
  | 'CRM Follow-up'
  | 'Meeting Reminder'
  | 'Task Reminder'
  | 'Important Alert';

export type NotificationPriority = 'Low' | 'Medium' | 'High' | 'Urgent';

export type NotificationStatus = 'scheduled' | 'active' | 'read' | 'unread' | 'expired';

export interface Contact {
  id: string;
  full_name: string;
  company_name: string;
  email: string;
  phone_number: string;
  service_required: string;
  message: string;
  created_at: string;
  updated_at: string;
}

export interface CrmLead {
  id: string;
  contact_id: string;
  lead_status: LeadStatus;
  assigned_to?: string;
  notes?: string;
  follow_up_date?: string | null;
  created_at: string;
  updated_at: string;
  // Joined contact information for display convenience
  contact?: Contact;
}

export interface NotificationItem {
  id: string;
  title: string;
  description: string;
  notification_type: NotificationType;
  priority: NotificationPriority;
  scheduled_date: string; // YYYY-MM-DD
  scheduled_time: string; // HH:MM or HH:MM:SS
  status: NotificationStatus;
  is_read: boolean;
  activated_at?: string | null;
  target_audience?: string;
  created_at: string;
  updated_at: string;
}

export interface CrmActivity {
  id: string;
  lead_id: string;
  activity_type: string;
  description: string;
  activity_date: string;
  created_by?: string;
  created_at: string;
}

export interface CrmSummaryStats {
  totalContacts: number;
  totalLeads: number;
  newLeads: number;
  contactedLeads: number;
  interestedCustomers: number;
  convertedLeads: number;
  lostLeads: number;
  followUpRequired: number;
  activeNotifications: number;
  upcomingNotifications: number;
}

