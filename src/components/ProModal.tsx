import { useState } from 'react';
import { PRO_PRICE } from '../data';
import { Icon, type IconName } from '../icons';
import { EmbeddedCheckout } from './EmbeddedCheckout';

const FEATURES: Array<{ icon: IconName; label: string }> = [
  { icon: 'infinity', label: 'unlimited quests (free caps at 5)' },
  { icon: 'palette', label: 'all exclusive themes' },
  { icon: 'chart-column', label: 'deep stats & monthly recaps' },
  { icon: 'image', label: 'no watermark on share cards' },
  { icon: 'heart', label: 'support my work' },
];

interface Props {
  onClose: () => void;
  onRestore: (email: string) => Promise<boolean>;
  // verify the completed session, flip Aura+ on, and close the modal
  onComplete: (sessionId: string) => Promise<void>;
}

export function ProModal({ onClose, onRestore, onComplete }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // once set, the embedded Stripe Checkout takes over the modal body
  const [checkout, setCheckout] = useState<{ clientSecret: string; sessionId: string } | null>(null);

  const [showRestore, setShowRestore] = useState(false);
  const [restoreEmail, setRestoreEmail] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [restoreErr, setRestoreErr] = useState<string | null>(null);

  const startCheckout = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/checkout', { method: 'POST' });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const { clientSecret, sessionId } = await res.json();
      if (!clientSecret) throw new Error('no client secret');
      setCheckout({ clientSecret, sessionId });
    } catch {
      setError("couldn't reach checkout — try again in a sec");
    } finally {
      setLoading(false);
    }
  };

  const doRestore = async () => {
    const email = restoreEmail.trim();
    if (!email) return;
    setRestoring(true);
    setRestoreErr(null);
    try {
      const ok = await onRestore(email);
      if (ok) onClose();
      else setRestoreErr('no active Aura+ found for that email');
    } catch {
      setRestoreErr("couldn't check right now — try again");
    } finally {
      setRestoring(false);
    }
  };

  // once checkout is live, the modal becomes the payment sheet — clicking the
  // backdrop still drops the user straight back into the app
  if (checkout) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal modal-checkout" onClick={(e) => e.stopPropagation()}>
          <h2>
            get <span className="grad-text">Aura+</span>
          </h2>
          <p className="muted" style={{ fontSize: 13, marginBottom: 4 }}>
            tap outside anytime to head back.
          </p>
          <EmbeddedCheckout
            clientSecret={checkout.clientSecret}
            onComplete={() => onComplete(checkout.sessionId)}
          />
          <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={onClose}>
            back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>
          upgrade to <span className="grad-text">Aura+</span>
        </h2>
        <p className="muted" style={{ fontSize: 14 }}>
          main character energy, unlocked.
        </p>
        <ul className="feature-list">
          {FEATURES.map((f) => (
            <li key={f.icon}>
              <Icon name={f.icon} size={18} color="var(--a1)" />
              {f.label}
            </li>
          ))}
        </ul>
        <button className="btn" onClick={startCheckout} disabled={loading}>
          {loading ? 'opening checkout…' : `get Aura+ · ${PRO_PRICE}`}
        </button>
        {error && (
          <p style={{ color: '#C15B57', fontSize: 13, textAlign: 'center', marginTop: 10 }}>
            {error}
          </p>
        )}
        <button className="btn btn-ghost" style={{ marginTop: 10 }} onClick={onClose}>
          maybe later
        </button>

        {showRestore ? (
          <div className="restore-box">
            <input
              className="name-input"
              type="email"
              inputMode="email"
              placeholder="email you paid with"
              value={restoreEmail}
              autoFocus
              onChange={(e) => setRestoreEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && doRestore()}
              style={{ marginBottom: 10 }}
            />
            <button
              className="btn btn-ghost"
              onClick={doRestore}
              disabled={restoring || !restoreEmail.trim()}
            >
              {restoring ? 'checking…' : 'restore purchase'}
            </button>
            {restoreErr && (
              <p style={{ color: '#C15B57', fontSize: 13, textAlign: 'center', marginTop: 10 }}>
                {restoreErr}
              </p>
            )}
          </div>
        ) : (
          <button className="link-btn" onClick={() => setShowRestore(true)}>
            already have Aura+? restore
          </button>
        )}

        <p className="price" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          cancel anytime · cheaper than one matcha
          <Icon name="leaf" size={15} color="var(--a3)" />
        </p>
      </div>
    </div>
  );
}
