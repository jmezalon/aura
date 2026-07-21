import Stripe from 'stripe';

/**
 * POST /api/cancel  { email }
 * Cancels the customer's active Aura+ subscription in-app (no Billing Portal
 * redirect). Uses cancel_at_period_end so the user keeps what they paid for
 * until the period ends, then it won't renew. Returns the end date so the modal
 * can tell them when access lapses. The app's load-time re-sync flips them back
 * to free once Stripe reports the subscription inactive.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const email = String(req.body?.email || '').trim();
    if (!email) return res.status(400).json({ error: 'email required' });

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const sub = await findActiveSub(stripe, email);
    if (!sub) return res.status(404).json({ error: 'no active subscription' });

    if (sub.cancel_at_period_end) {
      return res.status(200).json({
        canceled: true,
        alreadyCanceled: true,
        currentPeriodEnd: periodEnd(sub),
      });
    }

    const updated = await stripe.subscriptions.update(sub.id, {
      cancel_at_period_end: true,
    });
    return res
      .status(200)
      .json({ canceled: true, currentPeriodEnd: periodEnd(updated) });
  } catch (err) {
    console.error('cancel error:', err.message);
    return res.status(500).json({ error: 'Could not cancel subscription' });
  }
}

async function findActiveSub(stripe, email) {
  const customers = await stripe.customers.list({ email, limit: 20 });
  for (const cust of customers.data) {
    const subs = await stripe.subscriptions.list({
      customer: cust.id,
      status: 'active',
      limit: 1,
    });
    if (subs.data.length) return subs.data[0];
  }
  return null;
}

// current_period_end lives on the subscription item in recent API versions,
// with the top-level field kept for older ones — read whichever is present.
function periodEnd(sub) {
  return sub.items?.data?.[0]?.current_period_end ?? sub.current_period_end ?? null;
}
