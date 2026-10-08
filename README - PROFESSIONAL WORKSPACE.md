# RENOBVA professional workspace

Replace your site files and restart Node, or publish the updated public folder. Preserve your existing environment configuration. The new protected Supabase tables are already configured in your connected project.

## Client dashboard
Each project shows its next action: quote decision, design review, payment, delivery, questions, or conversation. The dashboard updates automatically while visible. Cancelled projects remain accessible as saved history.

## Admin inbox
The working inbox groups new requests/replies, feedback, payments, missing deliveries and tasks due today or overdue. Project cards, filters, sorting and the client directory remain available. Incoming-versus-outgoing message timestamps determine whether a reply is needed; this is a helpful queue, not a formal unread-message receipt system. Recent design feedback remains in its queue until a newer review is published.

## Detailed quotes
Open a project chat, expand Quotes & scope, and click Send quote. Specify included pages/features and exclusions, original EUR price, discount percentage, revision rounds and deposit percentage. The total preview updates while typing; the database calculates the final stored amount. Clients accept or decline the exact quote. Price and scope cannot be changed by clients. Accepted or declined quotes retain their decision timestamp. Send a new quote for a changed scope.

Quote acceptance does not charge a customer or create payment requests automatically. Use Request payment to ask for the agreed deposit or balance. A quote describes the commercial scope; hosting, domain, maintenance and additional costs should be explicitly included or excluded.

## Design approvals and revisions
Expand Design approvals & revisions, then Request design review. Publish an HTTPS preview link and instructions. The client can approve it or request changes with written feedback. Decisions and feedback are retained. Publish another review when the revised version is ready.

## Private admin tasks
Expand Private admin tasks & notes in the project. Add a task, optional date and private notes. Edit, complete or delete tasks. Tasks and notes are protected in the database and never visible to clients.

## Delivery
Publish a title, HTTPS website link, instructions and one optional file up to 15 MB. For multiple files use a ZIP. Publishing does not close the chat automatically; mark completed when the handover is finished.

## Onboarding and public pages
Contact and Pricing explain the process and answer common questions. The client dashboard includes a preparation checklist. Eight portfolio case study pages link from Work, use existing artwork, and are explicitly labelled concepts. No client outcomes, timings or costs have been invented.

## Recovery, errors and mobile
Password-reset emails now lead to a real password-update page. Existing Supabase email delivery and allowed redirect URLs still apply: your hosting origin/reset page must be allowed in Auth URL configuration. Login, registration and reset forms display inline outcomes and avoid repeated submission while busy. Expired protected sessions preserve a safe return destination. Completed upload queue entries are skipped when retrying. Shared styles cover forms, buttons, focus states, mobile navigation, portal cards and chat.

## Notifications
In-site updates refresh every five seconds while a page is visible. Read state is per account in this browser. Notifications include messages/files, payments, deliveries, quotes and design decisions. These are not browser push notifications or new automatic emails.

## Verification
All JavaScript syntax and local HTML links/assets were checked. Next-action priority and discount calculation tests passed. Database tests confirmed quote acceptance, revision requests, discount calculation, cross-client isolation, private-task isolation and restricted price editing. Test records were rolled back. Visual browser and real-email/payment testing have not been completed.
