import Stripe from 'stripe';

/**
 * GET /api/subscription-status?email=…
 * Stripe is the source of truth: is there an active/trialing Aura+ subscription
 * for this email? Lets a user restore Aura+ on a fresh browser or new device,
 * and lets the app re-sync (catching renewals & cancellations) on load.
 */
export default async function handler(req, res) {
  try {
    const email = String(req.query.email || '').trim();
    if (!email) return res.status(400).json({ pro: false, error: 'email required' });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const pro = await hasActiveSub(stripe, email);
    return res.status(200).json({ pro });
  } catch (err) {
    console.error('subscription-status error:', err.message);
    return res.status(500).json({ pro: false, error: 'lookup failed' });
  }
}

async function hasActiveSub(stripe, email) {
  const customers = await stripe.customers.list({ email, limit: 20 });
  for (const cust of customers.data) {
    const subs = await stripe.subscriptions.list({
      customer: cust.id,
      status: 'all',
      limit: 20,
    });
    if (subs.data.some((s) => s.status === 'active' || s.status === 'trialing')) {
      return true;
    }
  }
  return false;
}
