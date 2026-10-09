# RENOBVA professional design refresh

This is the complete website, including the dashboard fixes and branded invoice design.

- Homepage: clearer headline, two primary navigation choices, collaboration details, and your original portrait in a branded frame in the requested hero position.
- Shared styling: consistent type, spacing, dark surfaces, buttons, borders, and red/orange accents across all pages.
- Portfolio: large previews, visible concept labels, role summaries, and real keyboard-accessible case study links.
- Navigation: current-page indicators, polished account menus and notifications, and outside-click closing on mobile.
- Client portal: clear next-action panel, readable progress and project cards, compact metrics, and loading feedback.
- Admin: shorter introduction, compact workload metrics and expandable tools, clear project statuses, and action menus that close with Escape or outside-click.
- Forms: consistent light text on dark fields, inline native validation messages, and accessible error descriptions. Existing submission handlers remain responsible for saving and reporting success.
- Mobile: responsive portrait, cards, forms, scrolling project tabs and filter queues, comfortable buttons, and compact portal navigation.
- Motion: short hover transitions and one subtle portrait entrance, with reduced-motion support.

Your photo is stored at public/assets/images/people/renobva-portrait.png. Its original image bytes have been preserved; the frame and presentation use CSS.

Replace your existing website files, keeping your .env and deployment settings. Push to GitHub and wait for Cloudflare to finish deploying, then reload with Ctrl+F5. No new database migration or API key is required.

Validation: existing automated tests, JavaScript syntax, CSS parsing, local HTML asset/link checks, and original portrait integrity. Browser visual QA and signed-in walkthrough were unavailable in this environment; verify the desktop and mobile appearance after deployment.
