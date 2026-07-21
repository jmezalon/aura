import { useEffect, useRef, useState } from 'react';
import type { StripeEmbeddedCheckout } from '@stripe/stripe-js';
import { getStripe } from '../stripe';

interface Props {
  clientSecret: string;
  onComplete: () => void;
}

/**
 * Mounts Stripe's embedded Checkout inside our own modal so the user never
 * leaves the app. When the payment completes, Stripe fires onComplete (no
 * redirect) and the caller verifies + flips Aura+ on.
 */
export function EmbeddedCheckout({ clientSecret, onComplete }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let checkout: StripeEmbeddedCheckout | undefined;
    let cancelled = false;

    (async () => {
      const stripe = await getStripe();
      if (cancelled) return;
      if (!stripe) {
        setError('payments aren’t configured — missing publishable key');
        return;
      }
      if (!ref.current) return;
      const instance = await stripe.createEmbeddedCheckoutPage({
        fetchClientSecret: () => Promise.resolve(clientSecret),
        onComplete: () => onCompleteRef.current(),
      });
      checkout = instance;
      if (cancelled) {
        instance.destroy();
        return;
      }
      instance.mount(ref.current);
    })();

    return () => {
      cancelled = true;
      checkout?.destroy();
    };
  }, [clientSecret]);

  if (error) {
    return (
      <p style={{ color: '#C15B57', fontSize: 13, textAlign: 'center', margin: '20px 0' }}>
        {error}
      </p>
    );
  }
  return <div ref={ref} className="embedded-checkout" />;
}
