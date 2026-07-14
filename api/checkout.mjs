import Stripe from 'stripe';

/** POST /api/checkout — create a subscription Checkout Session for Aura+ */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const proto = req.headers['x-forwarded-proto'] ?? 'https';
    const origin = process.env.APP_URL ?? `${proto}://${req.headers.host}`;

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
      success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?upgrade=cancelled`,
    });
    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('checkout error:', err.message);
    return res.status(500).json({ error: 'Could not start checkout' });
  }
}
