import Stripe from 'stripe';

/** GET /api/checkout/verify?session_id=… — confirm a session is paid */
export default async function handler(req, res) {
  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(
      String(req.query.session_id),
    );
    return res.status(200).json({
      paid: session.payment_status === 'paid',
      // stored client-side so entitlement can be re-synced / restored later
      email: session.customer_details?.email ?? null,
    });
  } catch (err) {
    console.error('verify error:', err.message);
    return res.status(400).json({ paid: false });
  }
}
