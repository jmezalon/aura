import 'dotenv/config';
import express from 'express';
import Stripe from 'stripe';
import { runAI } from '../api/_ai-core.mjs';

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error('Missing STRIPE_SECRET_KEY in .env');
  process.exit(1);
}

const stripe = new Stripe(key);
const app = express();
app.use(express.json());

const PORT = process.env.API_PORT ?? 4242;
const APP_URL = process.env.APP_URL ?? 'http://localhost:5173';

/** Create a subscription Checkout Session for Aura+ */
app.post('/api/checkout', async (_req, res) => {
  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            recurring: { interval: 'month' },
            unit_amount: 249,
            product_data: {
              name: 'Aura+',
              description:
                'Unlimited quests, exclusive themes, no watermark on share cards.',
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${APP_URL}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/?upgrade=cancelled`,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('checkout error:', err.message);
    res.status(500).json({ error: 'Could not start checkout' });
  }
});

/** Verify a session after redirect — the app only flips pro on a paid session */
app.get('/api/checkout/verify', async (req, res) => {
  try {
    const session = await stripe.checkout.sessions.retrieve(
      String(req.query.session_id),
    );
    res.json({
      paid: session.payment_status === 'paid',
      email: session.customer_details?.email ?? null,
    });
  } catch (err) {
    console.error('verify error:', err.message);
    res.status(400).json({ paid: false });
  }
});

/** Restore / re-sync Aura+ from Stripe by email (Stripe is the source of truth) */
app.get('/api/subscription-status', async (req, res) => {
  try {
    const email = String(req.query.email || '').trim();
    if (!email) return res.status(400).json({ pro: false, error: 'email required' });

    const customers = await stripe.customers.list({ email, limit: 20 });
    let pro = false;
    for (const cust of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: cust.id,
        status: 'all',
        limit: 20,
      });
      if (subs.data.some((s) => s.status === 'active' || s.status === 'trialing')) {
        pro = true;
        break;
      }
    }
    res.json({ pro });
  } catch (err) {
    console.error('subscription-status error:', err.message);
    res.status(500).json({ pro: false });
  }
});

/** Open a Stripe Billing Portal session so the customer can update/cancel */
app.post('/api/portal', async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim();
    if (!email) return res.status(400).json({ error: 'email required' });

    const customers = await stripe.customers.list({ email, limit: 20 });
    if (!customers.data.length) {
      return res.status(404).json({ error: 'no customer found' });
    }
    let customer = customers.data[0];
    for (const cust of customers.data) {
      const subs = await stripe.subscriptions.list({
        customer: cust.id,
        status: 'active',
        limit: 1,
      });
      if (subs.data.length) {
        customer = cust;
        break;
      }
    }
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: APP_URL,
    });
    res.json({ url: session.url });
  } catch (err) {
    console.error('portal error:', err.message);
    res.status(500).json({ error: 'Could not open billing portal' });
  }
});

/** AI coach proxy (Groq by default) — mirrors api/ai.mjs for local dev */
app.post('/api/ai', async (req, res) => {
  try {
    res.json(await runAI(req.body || {}));
  } catch (err) {
    console.error('ai error:', err.message);
    if (err.code === 'NO_KEY') return res.status(503).json({ error: 'AI not configured' });
    res.status(502).json({ error: 'ai request failed' });
  }
});

app.listen(PORT, () => {
  const ai = process.env.AI_API_KEY || process.env.GROQ_API_KEY ? 'AI on' : 'AI off (no key)';
  console.log(`aura api listening on :${PORT} (stripe ${key.startsWith('sk_test') ? 'TEST' : 'LIVE'} mode, ${ai})`);
});
