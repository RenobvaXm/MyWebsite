# RENOBVA — client experience and notifications

## Install this update

Replace the website files with the MyWebsite folder in this ZIP. Keep your existing .env and its private values. Run npm install and npm start from the website folder; restart an existing Node process after replacing the files. If you use GitHub/Cloudflare or another host, push/upload these files and redeploy the website.

The connected Supabase database is already updated, including the new tables, ownership policies, event triggers, notification Realtime publication and daily maintenance reminder schedule. Do not run the numbered setup SQL again on that database. The SQL files are included as references for a fresh installation.

## What changed and where to find it

1. **Client home:** the dashboard highlights the next action, upcoming milestone, pending payment totals, progress, delivery date and remaining revision rounds. Pending totals exclude submitted bank transfers, which await confirmation. Currency totals remain separate.
2. **Proposal approval:** Admin → Manage project → Payments → Send proposal. Set pages/features/exclusions, price, percentage discount, agreed delivery date, deposit and revision allowance. The client accepts or declines in Payments. The database records the decision time. Acceptance does not take payment.
3. **Revision tracking:** Feedback → Revision rounds. Clients submit an organized request; design-review and final-delivery change requests also appear here automatically. Included requests use one round. Declined requests release that round. Once the allowance is exhausted, a request needs an extra quote. Admins can grant additional rounds in Overview → Edit preview & rounds, then handle the request. New accepted proposals have their own allowance; older requests retain their original proposal reference. Earlier design-change decisions are not backfilled into revision counts.
4. **Final delivery approval:** Handover → Delivery approval. The client accepts the latest delivery or requests changes. Decisions are permanent records. For a delivery needing changes, publish an updated delivery so it can receive a fresh decision. After acceptance, mark the project completed when appropriate. Acceptance does not itself settle payments.
5. **Maintenance plans:** edit a project's handover to offer a plan, price and scope. Clients can request it in Handover → Ongoing support. Handle the request as admin, then set the active plan and renewal date. One reminder per date appears for client and admin seven days before renewal, or at the next daily run if already due. The daily run is at 07:00 UTC. Email follows the existing opt-in preference and sender configuration. Renewal dates and invoices remain under your control; they do not advance or charge a card automatically.
6. **Preview links:** Overview → Edit preview & rounds. The client sees a prominent Preview website button on their dashboard and project. If no dedicated link is set, a safe HTTPS design/delivery/handover link is used when available. A private preview still requires appropriate access protection on its host.
7. **Admin command search:** Search everything in the top bar, or Ctrl+K / Cmd+K. Find clients, projects, messages, shared files and payment requests. Results open the relevant project tab. A client result opens the client directory. Search uses the signed-in admin's existing permissions.
8. **Accessibility:** skip-to-content links, visible keyboard focus, labeled dialogs, keyboard navigation, mobile controls, contrast improvements and reduced-motion styles. These improvements do not represent a formal accessibility certification.
9. **First-login guide:** a five-step guide on the client dashboard explains files, chat, proposals, payments and delivery. Completion is saved to the account; Quick portal guide reopens it. Admin accounts do not receive the client onboarding popup.
10. **Completion follow-up:** after delivery acceptance or project completion, Handover → What's next invites the client to leave a testimonial or order another project. Testimonials remain private unless the client grants public-display consent and the admin approves them. The client can withdraw a review later. Approved reviews appear on the homepage; no example/fake client reviews are added.
11. **Notification bell:** signed-in users see a bell in the main website navigation and portal top bar. It shows unread counts, recent updates, relevant project links, Mark all read and notification preferences. Read state is stored per account across devices. Realtime changes update it promptly, with a ten-second refresh fallback. The new event history begins with this update; recent existing messages and pending proposals/payments are also included. Notification read state is separate from chat's message-read indicators. Guests do not see private notifications.

Archive and Trash controls remain available. Archived/trashed projects cannot receive new revision requests, maintenance requests or delivery decisions. Issued payment documents and active Stripe checkouts still protect against permanent deletion.

## Verification and limits

- 20 JavaScript tests passed.
- 24 new rollback database checks passed, including ownership, allowance enforcement, immutable decisions, public testimonial privacy, renewal deduplication and notification read permissions.
- 17 existing rollback workflow checks also passed after the schema update.
- JavaScript syntax, local asset links and script dependency order passed.
- All test project data was rolled back. No real payment or email was sent by these tests.
- A rendered browser walkthrough and actual email/Stripe delivery were not performed in this environment.

The existing email worker remains unchanged. Automatic approval review rejected publishing a proposed worker change because that worker can send private project titles and workspace links to external recipients. The existing worker already handles opted-in updates, including renewal reminders. Email links keep their existing behavior; the notification bell links directly to the appropriate tab.

Existing Supabase security advisories remain: four intentionally callable permission/payment helper functions use SECURITY DEFINER, and leaked-password protection is disabled. No new security advisory was introduced. Details: https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable and https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.
