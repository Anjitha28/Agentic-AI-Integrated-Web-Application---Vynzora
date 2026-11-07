-- ==============================================================================
-- VYNZORA CRM & BUSINESS MANAGEMENT - SEED DATA
-- Strictly valid RFC 4122 hexadecimal UUIDs
-- ==============================================================================

-- Temporarily disable auto-generation trigger during seeding to prevent duplicate leads
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'on_contact_created'
    ) THEN
        ALTER TABLE public.contacts DISABLE TRIGGER on_contact_created;
    END IF;
END $$;

-- 1. Insert Sample Contacts (Hex UUIDs starting with c000...)
INSERT INTO public.contacts (id, full_name, company_name, email, phone_number, service_required, message, created_at)
VALUES
    ('c0000000-0000-4000-a000-000000000001', 'Sophia Reynolds', 'Nexus Tech Innovations', 'sophia.reynolds@nexustech.io', '+1 (555) 234-5678', 'Brand Identity & Rebranding', 'We are expanding to the US market and need a total brand identity refresh, design system, and new marketing strategy.', NOW() - INTERVAL '3 days'),
    ('c0000000-0000-4000-a000-000000000002', 'Marcus Vance', 'Vance Capital & Growth', 'marcus@vancecapital.com', '+1 (555) 345-6789', 'Performance Marketing & SEO', 'Looking for aggressive ROI-driven Google/LinkedIn ad campaigns for our B2B fintech solution.', NOW() - INTERVAL '2 days'),
    ('c0000000-0000-4000-a000-000000000003', 'Elena Rostova', 'Lumina Cosmetics', 'elena@luminacosmetics.eu', '+1 (555) 456-7890', 'Social Media & Influencer Campaigns', 'Preparing our Spring product launch across Instagram and TikTok. Seeking end-to-end creative direction.', NOW() - INTERVAL '1 day'),
    ('c0000000-0000-4000-a000-000000000004', 'David Chen', 'AeroDrive Autonomous', 'd.chen@aerodrive.co', '+1 (555) 567-8901', 'Website UI/UX & Web Development', 'Need a high-converting, sleek corporate website with 3D product visualizer and enterprise investor portal.', NOW() - INTERVAL '5 days'),
    ('c0000000-0000-4000-a000-000000000005', 'Amara Okafor', 'EcoSustain Goods', 'amara@ecosustain.org', '+1 (555) 678-9012', 'Content Strategy & PR', 'Seeking corporate sustainability storytelling and national media placement for our carbon-neutral packaging.', NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

-- 2. Insert Sample Leads (Hex UUIDs starting with b000...)
INSERT INTO public.crm_leads (id, contact_id, lead_status, assigned_to, notes, follow_up_date, created_at)
VALUES
    ('b0000000-0000-4000-a000-000000000001', 'c0000000-0000-4000-a000-000000000001', 'Interested', 'Alex Morgan (Senior Director)', 'Had introductory discovery call. Very interested in full enterprise tier rebrand. Proposal sent.', CURRENT_DATE + INTERVAL '2 days', NOW() - INTERVAL '3 days'),
    ('b0000000-0000-4000-a000-000000000002', 'c0000000-0000-4000-a000-000000000002', 'Follow-up Required', 'Sarah Jenkins (Growth Lead)', 'Needs custom ad budget projection before committing to 6-month retainer.', CURRENT_DATE + INTERVAL '1 day', NOW() - INTERVAL '2 days'),
    ('b0000000-0000-4000-a000-000000000003', 'c0000000-0000-4000-a000-000000000003', 'New', 'Unassigned', 'Fresh inquiry from web contact form. High potential cosmetics client.', CURRENT_DATE + INTERVAL '1 day', NOW() - INTERVAL '1 day'),
    ('b0000000-0000-4000-a000-000000000004', 'c0000000-0000-4000-a000-000000000004', 'Converted', 'Alex Morgan (Senior Director)', 'Contract signed! $45,000 corporate website development & 3D visualization project kicked off.', NULL, NOW() - INTERVAL '5 days'),
    ('b0000000-0000-4000-a000-000000000005', 'c0000000-0000-4000-a000-000000000005', 'Contacted', 'Michael Scott', 'Initial outreach sent via email and phone. Awaiting response on deck.', CURRENT_DATE + INTERVAL '3 days', NOW() - INTERVAL '6 days')
ON CONFLICT (id) DO NOTHING;

-- 3. Insert Sample Notifications (Hex UUIDs starting with f000...)
INSERT INTO public.notifications (id, title, description, notification_type, priority, scheduled_date, scheduled_time, status, is_read, activated_at, target_audience)
VALUES
    ('f0000000-0000-4000-a000-000000000001', 'New Customer Enquiry Received', 'Elena Rostova from Lumina Cosmetics submitted an enquiry for Social Media & Influencer Campaigns.', 'Customer Enquiry', 'High', CURRENT_DATE - INTERVAL '1 day', '09:00:00', 'active', FALSE, NOW() - INTERVAL '1 day', 'Admins & Sales Team'),
    ('f0000000-0000-4000-a000-000000000002', 'Client Meeting Reminder: Nexus Tech', 'Upcoming presentation with Sophia Reynolds regarding Vynzora Branding & Identity deliverables.', 'Meeting Reminder', 'Urgent', CURRENT_DATE, '14:30:00', 'active', FALSE, NOW(), 'Strategy Team'),
    ('f0000000-0000-4000-a000-000000000003', 'CRM Follow-up Required: Vance Capital', 'Marcus Vance requested custom ROI projections for ad campaigns. Call scheduled for tomorrow.', 'CRM Follow-up', 'Medium', CURRENT_DATE + INTERVAL '1 day', '11:00:00', 'scheduled', FALSE, NULL, 'Account Managers'),
    ('f0000000-0000-4000-a000-000000000004', 'Quarterly Marketing Strategy Briefing', 'All-hands Vynzora quarterly review and Q4 campaign roadmap alignment.', 'General Announcement', 'Medium', CURRENT_DATE + INTERVAL '3 days', '10:00:00', 'scheduled', FALSE, NULL, 'All Staff')
ON CONFLICT (id) DO NOTHING;

-- 4. Insert Sample CRM Activities (Hex UUIDs starting with a000...)
INSERT INTO public.crm_activities (id, lead_id, activity_type, description, activity_date, created_by)
VALUES
    ('a0000000-0000-4000-a000-000000000001', 'b0000000-0000-4000-a000-000000000001', 'Meeting Held', 'Conducted 45-min Zoom discovery session with Sophia Reynolds. Sent branding proposal.', NOW() - INTERVAL '2 days', 'Alex Morgan'),
    ('a0000000-0000-4000-a000-000000000002', 'b0000000-0000-4000-a000-000000000004', 'Deal Converted', 'Signed MSA and received initial retainer payment for AeroDrive Autonomous web overhaul.', NOW() - INTERVAL '2 days', 'Alex Morgan'),
    ('a0000000-0000-4000-a000-000000000003', 'b0000000-0000-4000-a000-000000000002', 'Email Sent', 'Delivered customized performance marketing proposal with CPA breakdown.', NOW() - INTERVAL '1 day', 'Sarah Jenkins')
ON CONFLICT (id) DO NOTHING;

-- Re-enable the trigger for future web submissions
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger WHERE tgname = 'on_contact_created'
    ) THEN
        ALTER TABLE public.contacts ENABLE TRIGGER on_contact_created;
    END IF;
END $$;
