# VYNZORA – CRM & Business Management Web Application

> Premium Marketing & Branding Web Platform with Supabase Database Architecture, Real-Time Notifications, and LiveKit Voice AI Agent Integration.

---

## 🌟 Key Features

1. **Brand Flagship Web Application**
   - High-impact branding for Vynzora with interactive services catalog and consultation request form.
   - Automatic Lead & Notification ingestion on contact submission.

2. **Supabase PostgreSQL Database**
   - Robust relational schema (`profiles`, `contacts`, `crm_leads`, `notifications`, `crm_activities`).
   - Row-Level Security (RLS) policies protecting customer data.
   - Real-time replication on `notifications`, `contacts`, and `crm_leads`.
   - Automatic trigger `handle_new_contact_submission()` creates a CRM lead and admin notification simultaneously.

3. **Real-Time Notification System**
   - Live popup toast alerts for newly active notifications.
   - Support for distinct statuses: `scheduled`, `active`, `read`, `unread`, and `expired`.
   - Independent server-side scheduled activation via `/api/cron/notifications` and `activate_scheduled_notifications()`.
   - Unread badge counter in the navigation bar.

4. **Dedicated Administrative Dashboard (`/admin`)**
   - Role-based access control protecting all `/admin/*` routes.
   - Comprehensive sidebar: Dashboard, Contacts, CRM, Notifications, Follow-ups, Settings, Logout.
   - Real-time visual analytics charts for Service Enquiries and Lead Pipeline stages.
   - Complete CRM management: Add, Edit, Delete, Search, Filter, Sort, and Status Tracking (`New`, `Contacted`, `Interested`, `Follow-up Required`, `Converted`, `Lost`).

5. **Future LiveKit Voice AI Agent Ready Architecture**
   - 7 dedicated secure voice API endpoints returning natural language `voice_summary` and structured JSON payloads:
     - `GET /api/voice/notifications/new`
     - `GET /api/voice/notifications/upcoming`
     - `GET /api/voice/notifications`
     - `GET /api/voice/crm/leads`
     - `GET /api/voice/crm/contacts`
     - `GET /api/voice/crm/summary`
     - `GET /api/voice/crm/followups`
   - Interactive in-browser Voice Agent Simulation Sandbox with browser Text-to-Speech audio feedback.

---

## 🚀 Quick Start (Local Development)

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```
Fill in your Supabase project keys:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-public-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret-key
```
*(Note: If left empty initially, Vynzora will run in a high-fidelity mock storage engine mode so you can test all UI, CRM, and voice endpoints immediately).*

### 3. Setup Supabase Database
Execute the SQL migration scripts in your Supabase SQL Editor:
1. `supabase/schema.sql` (Creates tables, indexes, triggers, functions, and RLS)
2. `supabase/seed.sql` (Inserts realistic sample marketing contacts and leads)

### 4. Run Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🔑 Admin Portal Credentials (Local Demo)
Navigate to `/admin`:
- **Email:** `admin@vynzora.com`
- **Password:** `admin123`
*(Or click the 1-Click Fast Login button)*

---

## ☁️ Deployment to Vercel

1. Push this repository to GitHub or GitLab.
2. Import the project in Vercel.
3. Configure the environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy! Vercel will automatically read `vercel.json` for scheduled cron notification activations.

