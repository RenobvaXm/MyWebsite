# Project requests, login and live chat

The current Supabase project has already been updated and the project-submission function is deployed. Do not rerun the old 01-setup.sql on the existing project.

## Client flow

1. The visitor selects a service and budget and writes a message on Contact.
2. If signed out, the request is kept for up to 24 hours and the visitor goes to Login. Register preserves the same return destination.
3. After login (and email verification if required), the saved request is submitted once. Its confirmation goes to the verified account email when email sending is activated, even if the form contained a different contact email.
4. A project is created with the selected information. The client opens its project details and chat. The administrator sees it in Admin Dashboard.
5. Messages use Supabase Realtime and a five-second reconnect fallback. Reply, edit, delete, attachments, search and closed-project states remain available.

## Current email status: approved and deployed; sender setup required

The deployed `supabase/functions/project-submission/index.js` creates projects and sends the owner notification and customer acknowledgement through Resend when its server-side secrets are configured. This workflow was approved on October 6, 2026. The live readiness check currently reports email_configured=false and site_url_configured=false; notifications therefore remain pending. No real email has been sent during verification.

Owner notifications go to alexander.haeussler01@gmail.com. The automatic acknowledgement goes to the customer's verified Supabase account email. Messages contain the project name, service, budget, deadline, brief, selected answers and portal link. Resend receives those fields to deliver the messages. No passwords or session tokens are emailed.

In Supabase Dashboard → project bdpfqjzxrbvhcztqqjsf → Edge Functions → Secrets, add:

- RESEND_API_KEY: your Resend API credential with sending permission.
- EMAIL_FROM: your approved sender, such as RENOBVA <orders@your-verified-domain.example>. Verify your sender domain in Resend before using it for customer delivery.
- SITE_URL: your final website origin, such as https://your-site.example, without a trailing slash.

Never put a mail credential into public JavaScript or GitHub. No function redeployment is needed after setting secrets. New project requests will attempt both emails. For a pending existing project, call project-submission with the authenticated owner's or administrator's session and body {"action":"retry","project_id":"the-project-uuid"}.

Provider acceptance is tracked independently for the owner notification and acknowledgement. Retries use stable idempotency keys and skip already sent messages. Provider acceptance is not proof of inbox delivery; inspect Resend delivery events if mail is missing.

## Run and publish

Run `npm ci` and `npm start` inside this website folder. Open http://localhost:3000. The Node server now serves public/ correctly.

For the existing Cloudflare assets deployment, publish this updated public/ folder. Project submissions still run through the deployed Supabase function; a Node runtime is not required on Cloudflare for this flow.

Validation completed: JavaScript parsing; submission service guards, validation and idempotency using controlled fixtures; live endpoint rejects signed-out requests; database role/ownership permissions. No real customer or owner notification was sent. A signed-in browser test with your own account is still needed after replacing your website files.
