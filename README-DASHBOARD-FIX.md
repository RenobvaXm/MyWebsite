# Dashboard loading fix

This full package includes the previous client experience features and branded invoice design.

Fixed:
- Admin project loading now explicitly uses the projects_user_id_fkey relationship to fetch the client's profile. The owner field is user_id, not client_id.
- Client dashboard handover loading now sorts by updated_at. Handover records do not have a created_at column.
- Workspace search uses a dark field, readable text, and responsive controls.

Installation: replace the website files in your existing project, keeping your own .env and settings. Push the updated files to GitHub and wait for Cloudflare to finish deploying, then refresh the website. No database migration is needed for these fixes.

Verification: automated dashboard loading regressions and the existing test suite. Database columns and the project-owner foreign key checked against the connected database. A signed-in browser walkthrough has not been performed.
