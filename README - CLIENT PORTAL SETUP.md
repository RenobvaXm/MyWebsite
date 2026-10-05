# RENOBVA CLIENT PORTAL — SETUP

The website now includes a real Supabase-ready client portal.

## Included
- Login
- Registration
- Forgot password
- Client dashboard
- Adaptive project order questionnaire
- Business + RENOBVA Special orders
- Project status
- Realtime project chat
- Account settings
- Admin-only dashboard
- Admin project status controls
- Admin ↔ client chat
- Row Level Security so clients can only access their own projects/messages

## 1. Connect Supabase
Open:
`assets/js/supabase-config.js`

Paste:
- Project URL
- PUBLIC anon key

Never put a service_role key in frontend code.

## 2. Create database
Open Supabase SQL Editor and run:
`supabase/01-setup.sql`

## 3. Create your admin
Register your own account through:
`pages/auth/register.html`

Then in Supabase SQL Editor run:
`update public.profiles set role='admin' where email='YOUR_EMAIL';`

Only accounts whose `role` is `admin` can open:
`pages/admin/dashboard.html`

## 4. Authentication settings
In Supabase Authentication settings, add your local/live site URL to allowed redirect URLs.
For local Live Server this is normally your current 127.0.0.1 / localhost URL.

## Important
The frontend uses only the public anon key. Security is enforced by Supabase RLS policies.

## Session persistence
Login now persists when navigating between the public RENOBVA website and the client portal. The public navbar changes Client Portal to the signed-in user's display name and links directly back to the dashboard.
