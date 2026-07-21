import { useState } from 'react';
import { Icon } from '../icons';

interface Props {
  email: string;
  onClose: () => void;
  // re-sync entitlement from Stripe after a cancel
  onCancelled: () => void;
}

const fmtDate = (unixSeconds: number | null) =>
  unixSeconds
    ? new Date(unixSeconds * 1000).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

export function CancelModal({ email, onClose, onCancelled }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneDate, setDoneDate] = useState<string | null | undefined>(undefined);

  const confirmCancel = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const { canceled, currentPeriodEnd } = await res.json();
      if (!canceled) throw new Error('not canceled');
      setDoneDate(fmtDate(currentPeriodEnd));
      onCancelled();
    } catch {
      setError("couldn't cancel right now — try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {doneDate !== undefined ? (
          <>
            <h2>you’re all set</h2>
            <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
              {doneDate
                ? `Aura+ stays active until ${doneDate}, then it won’t renew.`
                : 'Aura+ won’t renew — you keep it until the current period ends.'}
            </p>
            <p className="muted" style={{ fontSize: 13, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="heart" size={14} color="var(--a3)" />
              changed your mind? re-subscribe anytime.
            </p>
            <button className="btn" style={{ marginTop: 18 }} onClick={onClose}>
              done
            </button>
          </>
        ) : (
          <>
            <h2>cancel Aura+?</h2>
            <p className="muted" style={{ fontSize: 14, marginTop: 6 }}>
              you’ll keep Aura+ until the end of your current billing period —
              no refund needed, it just won’t renew.
            </p>
            {error && (
              <p style={{ color: '#C15B57', fontSize: 13, textAlign: 'center', marginTop: 12 }}>
                {error}
              </p>
            )}
            <button
              className="btn btn-danger"
              style={{ marginTop: 18 }}
              onClick={confirmCancel}
              disabled={busy}
            >
              {busy ? 'cancelling…' : 'cancel subscription'}
            </button>
            <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={onClose}>
              keep Aura+
            </button>
          </>
        )}
      </div>
    </div>
  );
}
