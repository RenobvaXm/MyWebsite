# Dynamic Stripe checkout

The admin sends a payment request in chat. When the client chooses Stripe Checkout, the backend reads that request's saved amount and creates a Stripe checkout. EUR 1 becomes 100 cents; EUR 160 becomes 16000 cents. Browser-supplied prices are ignored. Methods shown in Stripe depend on account settings and customer eligibility; the Stripe Checkout button opens that checkout.

## Required setup

The Supabase SQL and functions are deployed to your connected project. Replace your website files with this package and publish them.

In Supabase > Edge Functions > Secrets, add:
- STRIPE_SECRET_KEY: your Stripe secret key. Start with a test key from Stripe Developers / API keys.
- SITE_URL: your website origin (https://your-site.workers.dev). For local testing it can be http://localhost:3000; change it back before publishing.
- STRIPE_WEBHOOK_SECRET: the signing secret from the webhook destination below (whsec_...).

In Stripe Workbench / Webhooks, create a destination for:
https://bdpfqjzxrbvhcztqqjsf.supabase.co/functions/v1/stripe-webhook
Select checkout.session.completed and checkout.session.async_payment_succeeded. Copy its signing secret into STRIPE_WEBHOOK_SECRET. Use matching test/live keys and webhook destinations.

You do not need to manually create Payment Links for card/wallet quotes. Enable eligible payment methods in Stripe Settings > Payment methods. Bank Transfer retains its separate manual confirmation flow.

## Verification

Send a EUR 1 test quote, sign in as that client, open checkout, and check that Stripe shows EUR 1. Use Stripe test card 4242 4242 4242 4242 with a future expiry and any valid test CVC. Do not use real card details in test mode. After payment, the signed webhook sets the quote to Paid and Realtime updates chat. Repeat with EUR 160. Returning to the website alone never marks a request paid.

Quotes lock when online checkout starts so the amount cannot change while a checkout is open. Manual confirmation/cancellation is blocked for locked quotes. An expired checkout requires a new quote; handle refunds in Stripe. Stripe verifies the amount, currency, quote and session before automatic confirmation. Existing manual methods remain manual. This integration does not implement refunds or automatic invoice/tax calculation.

No real payment was made during development. Credentials and webhook configuration are required before end-to-end testing.
