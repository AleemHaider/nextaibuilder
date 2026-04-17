# Stripe Webhook Registration

**FIR-85**

## Steps

1. Log into the [Stripe Dashboard](https://dashboard.stripe.com) → Developers → Webhooks
2. Click **"Add endpoint"**
3. Endpoint URL: `https://nextaibuilder.com/api/v1/webhook/stripe`
4. Select events to listen to:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
5. Click **"Add endpoint"**
6. On the webhook detail page, reveal the **"Signing secret"** (starts with `whsec_`)
7. Copy the signing secret → set as `STRIPE_WEBHOOK_SECRET` in `/opt/nab/.env` on EC2

## Verification

After deployment, trigger a test event from the Stripe Dashboard:

1. Webhooks → select your endpoint → **"Send test webhook"**
2. Select `payment_intent.succeeded`
3. Check PM2 logs: `pm2 logs nab-api --lines 20` (or `docker logs nab-api`)
4. Expect log line: `Stripe webhook received: payment_intent.succeeded`

## Notes

- Use a separate webhook endpoint for the test environment pointing at the staging URL
- The `STRIPE_WEBHOOK_SECRET` in test mode starts with `whsec_test_`
- Never share or log the webhook signing secret — it validates Stripe's signature on every event
