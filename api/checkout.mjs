import Stripe from 'stripe';

/**
 * POST /api/checkout — create an *embedded* subscription Checkout Session for
 * Aura+. The client mounts it inside a modal (no full-page redirect), so we
 * return a client secret instead of a hosted URL and handle completion in-app
 * via /api/checkout/verify.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      ui_mode: 'embedded',
      mode: 'subscription',
      redirect_on_completion: 'never',
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
    });
    return res
      .status(200)
      .json({ clientSecret: session.client_secret, sessionId: session.id });
  } catch (err) {
    console.error('checkout error:', err.message);
    return res.status(500).json({ error: 'Could not start checkout' });
  }
}
