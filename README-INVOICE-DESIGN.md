# RENOBVA invoice and receipt design

The Print / Save PDF action in project Payments now uses a RENOBVA design: your logo, a dark header, red-to-orange accent strip, clear billing columns, payment details and a highlighted paid total. Payment receipts share the same style.

Replace the website files with this updated folder, preserve your existing .env, and restart Node or redeploy your hosted website. Open a project → Payments → Invoices & payment receipts → Print / Save PDF. Choose Save as PDF in the print dialog. Keep A4 paper size, use the document's default scaling, and disable the browser's optional headers/footers if they duplicate the document's numbering. Enable background graphics if your browser omits the colored panels.

The displayed seller/buyer information, reference, issue date, tax wording and payment amount still come from the stored payment document. The template does not calculate new taxes, change discounts, or modify previously issued billing data.

A sample-data preview is included in docs/Invoice-Design-Preview.pdf. It is a visual example, not an issued invoice.

Verification: the exact HTML template was rendered to PDF and visually inspected for a normal invoice, a receipt and a four-page stress case. Full descriptions and tax notes survived pagination. The website's existing JavaScript tests passed. Browser-specific print settings may affect the final PDF's margins and background colors.
