-- ==============================================================================
-- VYNZORA CRM & BUSINESS MANAGEMENT - SUPABASE DATABASE SCHEMA
-- PostgreSQL schema for marketing & branding CRM, pipelines & real-time notifications
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- If profiles was previously created, safely drop it
DROP TABLE IF EXISTS public.profiles CASCADE;

-- Deduplicate any existing duplicate leads by keeping only the single earliest lead per contact
DELETE FROM public.crm_leads a
WHERE a.id NOT IN (
    SELECT DISTINCT ON (contact_id) id
    FROM public.crm_leads
    ORDER BY contact_id, created_at ASC
);

-- -----------------------------------------------------------------------------
-- 1. CONTACTS TABLE (Customer enquiries submitted from web)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name TEXT NOT NULL,
    company_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_number TEXT NOT NULL,
    service_required TEXT NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. CRM LEADS TABLE (Pipeline & business lead tracking)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_id UUID NOT NULL UNIQUE REFERENCES public.contacts(id) ON DELETE CASCADE,
    lead_status TEXT NOT NULL DEFAULT 'New' CHECK (
        lead_status IN ('New', 'Contacted', 'Interested', 'Follow-up Required', 'Converted', 'Lost')
    ),
    assigned_to TEXT DEFAULT 'Unassigned',
    notes TEXT,
    follow_up_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. NOTIFICATIONS TABLE (Real-time and scheduled notifications)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    notification_type TEXT NOT NULL CHECK (
        notification_type IN (
            'General Announcement',
            'Customer Enquiry',
            'CRM Follow-up',
            'Meeting Reminder',
            'Task Reminder',
            'Important Alert'
        )
    ),
    priority TEXT NOT NULL DEFAULT 'Medium' CHECK (
        priority IN ('Low', 'Medium', 'High', 'Urgent')
    ),
    scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
    scheduled_time TIME NOT NULL DEFAULT CURRENT_TIME,
    status TEXT NOT NULL DEFAULT 'scheduled' CHECK (
        status IN ('scheduled', 'active', 'read', 'unread', 'expired')
    ),
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    activated_at TIMESTAMP WITH TIME ZONE,
    target_audience TEXT DEFAULT 'All Admins',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 4. CRM ACTIVITIES TABLE (Activity logs & audit trail)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.crm_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
    activity_type TEXT NOT NULL,
    description TEXT NOT NULL,
    activity_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by TEXT DEFAULT 'System',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- INDEXES FOR OPTIMAL QUERY PERFORMANCE
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_contacts_email ON public.contacts(email);
CREATE INDEX IF NOT EXISTS idx_contacts_created_at ON public.contacts(created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_leads_contact_unique ON public.crm_leads(contact_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.crm_leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_follow_up ON public.crm_leads(follow_up_date);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_sched ON public.notifications(scheduled_date, scheduled_time);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_activities_lead ON public.crm_activities(lead_id);

-- -----------------------------------------------------------------------------
-- REALTIME REPLICATION CONFIGURATION
-- -----------------------------------------------------------------------------
-- Enable Supabase Realtime for instant notification popups
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.contacts;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crm_leads;

-- -----------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- -----------------------------------------------------------------------------
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_activities ENABLE ROW LEVEL SECURITY;

-- 1. Contacts Policies:
-- Public visitors can submit contact enquiries (INSERT)
CREATE POLICY "Public can insert contacts" ON public.contacts
    FOR INSERT WITH CHECK (true);

-- Authenticated admins can view, update and delete contacts
CREATE POLICY "Admins full access to contacts" ON public.contacts
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 2. CRM Leads Policies:
CREATE POLICY "Admins full access to leads" ON public.crm_leads
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 3. Notifications Policies:
-- Allow viewing active notifications
CREATE POLICY "View active or public notifications" ON public.notifications
    FOR SELECT USING (true);

-- Allow admins/service role to create and update notifications
CREATE POLICY "Full access to notifications for admin" ON public.notifications
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- 4. CRM Activities Policies:
CREATE POLICY "Admins full access to activities" ON public.crm_activities
    FOR ALL USING (auth.role() = 'authenticated' OR auth.role() = 'service_role');

-- -----------------------------------------------------------------------------
-- AUTOMATED FUNCTION: AUTO-CREATE CRM LEAD & NOTIFICATION ON CONTACT SUBMISSION
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_contact_submission()
RETURNS TRIGGER AS $$
DECLARE
    new_lead_id UUID;
BEGIN
    -- Only auto-create lead & notification if not already present
    IF NOT EXISTS (SELECT 1 FROM public.crm_leads WHERE contact_id = NEW.id) THEN
        -- 1. Automatically create a CRM Lead with 'New' status
        INSERT INTO public.crm_leads (contact_id, lead_status, assigned_to, notes, follow_up_date)
        VALUES (
            NEW.id,
            'New',
            'Unassigned',
            'Submitted via website contact form. Service: ' || NEW.service_required,
            CURRENT_DATE + INTERVAL '1 day'
        )
        RETURNING id INTO new_lead_id;

        -- 2. Automatically generate an active notification for admins
        INSERT INTO public.notifications (
            title,
            description,
            notification_type,
            priority,
            scheduled_date,
            scheduled_time,
            status,
            is_read,
            activated_at,
            target_audience
        ) VALUES (
            'New Customer Enquiry: ' || NEW.full_name,
            NEW.full_name || ' from ' || NEW.company_name || ' enquired about ' || NEW.service_required || '.',
            'Customer Enquiry',
            'High',
            CURRENT_DATE,
            CURRENT_TIME,
            'active',
            FALSE,
            NOW(),
            'Admins & Sales Team'
        );

        -- 3. Log initial activity
        INSERT INTO public.crm_activities (lead_id, activity_type, description, created_by)
        VALUES (
            new_lead_id,
            'Enquiry Received',
            'New enquiry received from web form: ' || NEW.full_name || ' (' || NEW.company_name || ')',
            'Website Contact Form'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_contact_created ON public.contacts;
CREATE TRIGGER on_contact_created
    AFTER INSERT ON public.contacts
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_contact_submission();

-- -----------------------------------------------------------------------------
-- AUTOMATED FUNCTION: ACTIVATE DUE SCHEDULED NOTIFICATIONS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.activate_scheduled_notifications()
RETURNS TABLE (
    activated_count INTEGER
) AS $$
DECLARE
    updated_rows INTEGER;
BEGIN
    UPDATE public.notifications
    SET 
        status = 'active',
        activated_at = NOW(),
        updated_at = NOW()
    WHERE 
        status = 'scheduled'
        AND (
            scheduled_date < CURRENT_DATE
            OR (scheduled_date = CURRENT_DATE AND scheduled_time <= CURRENT_TIME)
        );

    GET DIAGNOSTICS updated_rows = ROW_COUNT;
    RETURN QUERY SELECT updated_rows;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Optional pg_cron job (if pg_cron extension is enabled in Supabase project)
-- SELECT cron.schedule('activate-vynzora-notifications', '* * * * *', 'SELECT public.activate_scheduled_notifications();');
