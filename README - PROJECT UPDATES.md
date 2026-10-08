# Project updates

Progress: project statuses map to Request received, Clarifying details, Development, Client review and Delivered. Cancelled projects show Project closed. Admin changes the status from the existing dashboard or chat controls.

Delivery: open a project as admin, expand Project delivery, click Publish delivery. Add a title, optional HTTPS website link, instructions, and one optional file up to 15 MB. Use a ZIP to deliver multiple files. Publishing a delivery does not automatically close the conversation; mark the project completed when ready. Clients see deliveries only for their projects. Delivery uploads stay in private project storage.

Notifications: dashboard and project pages show an in-site notification dropdown for incoming messages/files, payment requests/statuses, and published deliveries. Checks run every five seconds while the page is visible. The dropdown shows the latest 30 updates and saves read state per account in this browser. It does not send browser push or email notifications.

The project_deliveries table and access policies have already been added to your connected Supabase database. Replace the website files, preserve your environment configuration, then restart Node or publish the updated public folder. Existing Stripe discounts are included.
