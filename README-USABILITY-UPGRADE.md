# RENOBVA usability upgrade

## Install

Replace your website files with the contents of MyWebsite in this ZIP. Keep your existing .env file and its private values. Run npm install, then npm start from the MyWebsite folder. Restart an existing Node process after replacing files. If you host the website elsewhere, upload or redeploy these files there too.

The connected Supabase database migrations and Stripe checkout function have already been updated. SQL setup files 09–12 document these changes; you do not need to run them again on the connected database.

## Project navigation

Manage project opens Overview, Chat, Files, Payments, Feedback and Handover tabs. Admins also have Activity. Notification links open the relevant tab.

## Archive and Trash

Use the project card menu or the admin project's Overview controls. Archived projects remain readable but cannot receive new work or payment requests. Use Unarchive to resume them. Trash hides a project from its client and keeps it recoverable in Admin dashboard → Trash. Restore returns it to its previous archived/current state.

Permanent deletion is available only in Trash and requires typing the project title. It removes the project and related records, then cleans up uploaded files. Projects with issued payment documents cannot be permanently deleted; retain them in Archive. An unresolved Stripe checkout also blocks permanent deletion. Resolve it first. Previously issued Stripe checkout URLs may still complete; valid Stripe callbacks retain their payment record.

## Messages

Project cards show incoming unread counts. Messages are marked read only when the recipient focuses the visible Chat tab and views its latest messages. Sent/Read indicators reflect that recorded viewing state, not proof that someone understood the message.

## Drafts and connection feedback

Supported forms and chat text save unfinished work on this browser, separately by account and project. Restore or discard the offered draft. General drafts expire after seven days and clear after successful submission or logout. Passwords, hidden payment totals and file inputs are excluded. The project brief uses its own local draft store for selected files. Drafts do not sync between devices.

Connection feedback shows loading, offline and retry states. Retry refreshes information; it does not automatically repeat an order, message or payment submission.

## Activity

The admin-only Activity tab records project status/lifecycle changes and related quotes, reviews, milestones, deliveries, handovers and payment changes from this upgrade onward. Earlier actions are not backfilled. Chat message contents are not copied into the activity log.

## Verification

13 automated JavaScript tests and 17 rollback database workflow checks passed. Checks cover permissions, quote acceptance, review approval, bank transfer submission, document creation, archive/restore and deletion protections. Database test records were rolled back. A visual browser walkthrough, real email delivery and an actual Stripe transaction were not performed.

Existing Supabase advisories remain: four intentionally callable permission/payment helper functions use SECURITY DEFINER, and leaked-password protection is disabled. Review the latter in Supabase Authentication settings if desired. No new advisory was introduced by this upgrade.
