import { loadStripe, type Stripe } from '@stripe/stripe-js';

// Publishable key for the in-modal embedded Checkout. Set it in .env / Vercel as
// VITE_STRIPE_PUBLISHABLE_KEY=pk_test_… (or pk_live_…). NOTE: this is inlined
// into the browser bundle at build time, so changing it in Vercel requires a
// fresh (cache-free) redeploy to take effect. Without it, the upgrade button
// surfaces a friendly error instead of a blank modal.
const KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;

let promise: Promise<Stripe | null> | null = null;

export function getStripe(): Promise<Stripe | null> {
  if (!KEY) return Promise.resolve(null);
  if (!promise) promise = loadStripe(KEY);
  return promise;
}
