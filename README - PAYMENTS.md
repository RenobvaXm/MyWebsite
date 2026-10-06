# RENOBVA Chat Payments

## 1. Create the database table
Open your Supabase SQL Editor and run `supabase/04-payments.sql` once.

## 2. Configure payment destinations
Open `public/assets/js/payment-config.js`.

Add your PUBLIC PayPal payment link, PUBLIC Revolut payment link, and the bank details you want authenticated clients to see when they choose Bank Transfer.

Never add passwords, API secrets, private keys, card details, or a Supabase service_role key to this file.

## 3. How it works
- Admin opens a client's project chat and clicks **Request payment**.
- Admin enters an amount, title and optional note.
- Client sees the request directly above the message composer.
- Client clicks **Pay** and chooses PayPal, Bank Transfer, or Revolut.
- PayPal/Revolut open your configured public payment link.
- Bank Transfer shows your configured transfer details and a unique REN-XXXXXXXX reference.
- Client marks the payment as sent/completed.
- Status becomes **Awaiting confirmation**.
- Only an admin can press **Confirm paid**.

## Important
This version deliberately does not collect or store card numbers. PayPal/Revolut payment data stays with those providers. Bank transfers are confirmed manually by the admin.

If you later want automatic payment verification, use a payment provider's server-side API/webhooks rather than trusting browser-side status changes.


## Payment methods (v3)
The client payment chooser now supports Credit / Debit Card, Apple Pay, Google Pay, PayPal, Klarna, Revolut, Bank Transfer, and Wise.

Configure public checkout/payment destinations in `public/assets/js/payment-config.js`. Card, Apple Pay, Google Pay and Klarna can share `checkout.paymentLink` when your hosted payment provider exposes those methods on one checkout page. Individual `paymentLink` values override the shared checkout link. Set `enabled: false` to hide a method you do not want to offer.

Important: this frontend does not process card details itself. Use a hosted payment processor checkout for card/wallet methods. A static payment link may not enforce the exact admin-requested amount unless your provider creates a price-specific checkout; the admin confirmation remains the final status control in this build.
