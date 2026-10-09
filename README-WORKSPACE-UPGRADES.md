# RENOBVA — Workspace upgrades

## Install this update

1. Replace the website files with this package. Keep your existing `.env` and your own local edits to any credentials/configuration.
2. Restart Node.js with `npm.cmd start`, or publish the updated `public` folder using your existing hosting workflow.
3. Hard-refresh the browser with Ctrl + F5.

The new database tables, access rules, email worker and scheduled queue are already installed in your connected Supabase project. Do not run the SQL files again on that project. Files 06–08 document the new setup for a separate installation; use the final corrected SQL included in this package.

## Where to find everything

| Feature | Location | What it does |
| --- | --- | --- |
| Milestones | Open a project → Milestones & delivery dates | Admin adds titles, descriptions, dates, order and status. Clients see progress and expected dates. |
| File manager | Open a project → File manager | Logos, Content, Designs and Final Files. Upload privately, move your uploads between categories, preview common images, download individual files or all files in a ZIP. Existing chat uploads appear under Content; delivery files under Final Files. |
| Focused feedback | Open a project → Page & section feedback | Add an HTTPS page URL, section name and requested change. Admin resolves or reopens feedback. This is structured feedback alongside a preview in another tab, not annotations injected into third-party websites. |
| Payment documents | Open a project → Invoices & payment receipts | A confirmed payment creates one immutable document from the amount and payment note saved in the database. Print / Save PDF opens the browser print dialog. Pending and submitted bank transfers do not create a document. |
| Admin command center | Admin dashboard | Active projects, unpaid requests, outstanding amounts by currency, due tasks, pending reviews and milestones requiring attention. |
| Project templates | Admin dashboard → Reusable project templates | Business, restaurant and birthday presets. Create/edit your own. Apply from a project’s Milestones panel. The operation adds milestones and private tasks together; briefing questions become a private task to discuss with the client. |
| Search | Client or admin dashboard | Search project titles, message text and filenames. Admin can also search clients by name or email. Up to 30 results per category, newest matching messages first. |
| Preferences | Client portal → Settings | Choose messages, payments, approvals and delivery updates; opt in to email alerts. |
| Handover | Open a project → Open handover page | A dedicated page with final URL, files, payment documents, instructions and support information. Admin edits these from the project workspace. |
| Maintenance | Project → Handover & maintenance | Publish a named plan, monthly amount and scope. Client can request terms in chat. This does not start automatic recurring billing. Admin marks a plan active after separately agreeing terms. |
| Public improvements | Pricing, case studies and mobile pages | Clear package comparison, visitor-journey concept walkthroughs and a mobile contact button. Portfolio concepts remain labelled; no invented client testimonials or results. |

## Invoice setup

In your admin account, open **Client portal → Settings → Business invoice details** and enter your actual seller details and tax wording. Clients enter their billing name/address in the same Settings page.

Complete seller and buyer name/address before payment confirmation to generate a document labelled Invoice. When those details are incomplete, the payment produces a Payment receipt. Earlier confirmed payments are backfilled as receipts. Already issued documents retain their original billing details; editing Settings does not rewrite them.

Documents use the final agreed amount, plus the stored payment note (including the discount breakdown when your existing payment request includes one). The application does not calculate VAT or generate structured electronic invoice formats. Sequential document identifiers are unique; test transactions can leave unused sequence numbers.

## Email updates

Each account starts with email alerts off. Enable **Also send email updates** in Settings to receive future project updates. Category switches also apply to email. Existing order confirmation emails continue using their previous behavior.

The scheduled worker checks the queue every minute, even when the website is closed. It uses your existing Supabase secrets: `RESEND_API_KEY`, `EMAIL_FROM` and `SITE_URL`. No new browser API key is needed. Delivery still depends on your sender being accepted by Resend. If email secrets are missing, updates stay pending. Transient errors retry automatically up to six times. The admin dashboard shows recent delivery status and can retry recent failed deliveries.

Email includes a project title and secure project link, not uploaded files or chat contents. Updates in the same category/project within a minute are grouped to avoid repeated alerts. Updates older than 24 hours are skipped. No old message history is emailed when you turn alerts on.

## Files

Uploads: 20 files per operation; 15 MB per file. ZIP downloads: maximum 250 MB assembled in the browser. Common PNG/JPEG/WEBP/GIF images have previews; other formats can be downloaded. Browser download settings choose the save location. Existing chat folders retain their original folder ZIP behavior.

If an upload partially fails, retrying the same dialog skips successful files. Clearing/changing the selected files begins a different selection. File categories organize metadata; they do not publish files publicly.

## Access and verification

Admin access still uses the existing protected Supabase profile role. No new admins were created. All ten new tables have RLS. Clients see only their own project data. Admin tasks, project templates, business billing and email delivery status remain restricted to admin. Clients cannot change milestones, mark payments paid or edit issued documents.

Verified:
- Seven Node tests for HTML escaping, safe preview URLs, worker authentication, opt-out, missing email settings, delivery recording and retry behavior (`npm.cmd test`). Email-provider calls are mocked in these tests.
- Ten rollback-only database checks for template application, email queueing, document generation, own-project access, private task isolation, client write restrictions and cross-client isolation.
- JavaScript syntax, relative HTML links/assets and local HTTP routes.
- New functions do not add publicly callable privileged RPCs. Existing advisor warnings for four prior helper functions and leaked-password protection were unchanged.

Not verified here: visual browser layouts, an actual Resend delivery, real Stripe transactions or a real file upload/download through a signed-in browser. The test database records were rolled back; no test messages were sent to clients.
