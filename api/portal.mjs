import Stripe from 'stripe';

/**
 * POST /api/portal  { email }
 * Opens a Stripe-hosted Billing Portal session so the customer can update their
 * card, view invoices, or cancel. On return, the app's load-time re-sync
 * downgrades them if they cancelled.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const email = String(req.body?.email || '').trim();
    if (!email) return res.status(400).json({ error: 'email required' });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const customers = await stripe.customers.list({ email, limit: 20 });
    if (!customers.data.length) {
      return res.status(404).json({ error: 'no customer found' });
    }

    // prefer the customer that actually holds an active subscription
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

    const proto = req.headers['x-forwarded-proto'] ?? 'https';
    const origin = process.env.APP_URL ?? `${proto}://${req.headers.host}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      return_url: origin,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('portal error:', err.message);
    return res.status(500).json({ error: 'Could not open billing portal' });
  }
}
