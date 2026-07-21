import { useEffect, useRef, useState } from 'react';
import type { AppState, ToastAction } from './types';
import { THEMES } from './data';
import { loadState, useAppState } from './store';
import { Onboarding } from './components/Onboarding';
import { Today } from './components/Today';
import { Stats } from './components/Stats';
import { Recap } from './components/Recap';
import { ProModal } from './components/ProModal';
import { CancelModal } from './components/CancelModal';
import { Coach, CoachLocked } from './components/Coach';
import { Icon, type IconName } from './icons';

type Tab = 'today' | 'stats' | 'coach' | 'recap';

const TABS: Array<{ id: Tab; label: string; icon: IconName }> = [
  { id: 'today', label: 'today', icon: 'zap' },
  { id: 'stats', label: 'stats', icon: 'chart-column' },
  { id: 'coach', label: 'coach', icon: 'message-circle' },
  { id: 'recap', label: 'recap', icon: 'camera' },
];

export default function App() {
  const [state, setState] = useAppState();
  const [tab, setTab] = useState<Tab>('today');
  const [proOpen, setProOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [toastState, setToastState] = useState<{ msg: string; action?: ToastAction } | null>(null);
  const toastTimer = useRef<number | undefined>(undefined);

  const update = (fn: (s: AppState) => AppState) => setState(fn);

  // apply theme vars to :root
  useEffect(() => {
    const theme = THEMES.find((t) => t.id === state.theme) ?? THEMES[0];
    for (const [k, val] of Object.entries(theme.vars)) {
      document.documentElement.style.setProperty(k, val);
    }
    // only gradient-opted themes (e.g. Midnight) get the vibrant treatment back
    document.documentElement.classList.toggle('theme-gradient', Boolean(theme.gradient));
    document
      .querySelector('meta[name=theme-color]')
      ?.setAttribute('content', theme.vars['--bg']);
  }, [state.theme]);

  const toast = (msg: string, action?: ToastAction) => {
    window.clearTimeout(toastTimer.current);
    setToastState({ msg, action });
    // linger longer when there's something to act on (e.g. Undo)
    toastTimer.current = window.setTimeout(() => setToastState(null), action ? 5000 : 1800);
  };

  // handle Stripe Checkout redirects + the ?pro dev toggle
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const clean = () => history.replaceState(null, '', location.pathname);

    const pro = params.get('pro');
    if (pro !== null) {
      setState((s) => ({ ...s, pro: pro === '1' }));
      clean();
      return;
    }
    if (params.get('upgrade') === 'cancelled') {
      toast('no stress — Aura+ will be here');
      clean();
      return;
    }
    const sessionId = params.get('session_id');
    if (sessionId) {
      clean();
      fetch(`/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`)
        .then((r) => r.json())
        .then(({ paid, email }) => {
          if (paid) {
            setState((s) => ({ ...s, pro: true, email: email || s.email }));
            toast('welcome to Aura+ ✦');
          } else {
            toast("payment didn't go through");
          }
        })
        .catch(() => toast("couldn't verify payment"));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setState]);

  // re-sync Aura+ from Stripe on load (source of truth) — catches renewals &
  // cancellations, and keeps entitlement correct across sessions
  useEffect(() => {
    const email = loadState().email;
    if (!email) return;
    fetch(`/api/subscription-status?email=${encodeURIComponent(email)}`)
      .then((r) => r.json())
      .then(({ pro }) => {
        if (typeof pro === 'boolean') {
          setState((s) => (s.pro === pro ? s : { ...s, pro }));
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // open the Stripe billing portal to update payment or cancel
  const manageSubscription = async () => {
    if (!state.email) {
      toast('no billing email on file');
      return;
    }
    try {
      const res = await fetch('/api/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: state.email }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const { url } = await res.json();
      window.location.href = url;
    } catch {
      toast("couldn't open billing portal");
    }
  };

  // embedded checkout finished in-modal — verify the session, flip Aura+ on
  const completeCheckout = async (sessionId: string) => {
    try {
      const res = await fetch(
        `/api/checkout/verify?session_id=${encodeURIComponent(sessionId)}`,
      );
      const { paid, email } = await res.json();
      if (paid) {
        setState((s) => ({ ...s, pro: true, email: email || s.email }));
        setProOpen(false);
        toast('welcome to Aura+ ✦');
      } else {
        toast("payment didn't go through");
      }
    } catch {
      toast("couldn't verify payment");
    }
  };

  // after an in-app cancel, re-sync entitlement from Stripe (source of truth)
  const syncSubscription = () => {
    if (!state.email) return;
    fetch(`/api/subscription-status?email=${encodeURIComponent(state.email)}`)
      .then((r) => r.json())
      .then(({ pro }) => {
        if (typeof pro === 'boolean') setState((s) => (s.pro === pro ? s : { ...s, pro }));
      })
      .catch(() => {});
  };

  // restore Aura+ on a fresh browser / new device by looking up the email
  const restorePurchase = async (email: string): Promise<boolean> => {
    const res = await fetch(
      `/api/subscription-status?email=${encodeURIComponent(email)}`,
    );
    if (!res.ok) throw new Error('lookup failed');
    const { pro } = await res.json();
    if (pro) {
      setState((s) => ({ ...s, pro: true, email }));
      toast('Aura+ restored ✦');
    }
    return Boolean(pro);
  };

  if (!state.onboarded) {
    return <Onboarding onDone={(patch) => setState((s) => ({ ...s, ...patch }))} />;
  }

  const proPill = state.pro ? (
    <span className="pro-pill owned">AURA+ ✦</span>
  ) : (
    <button className="pro-pill" onClick={() => setProOpen(true)}>
      get Aura+
    </button>
  );

  return (
    <>
      <nav className="sidenav">
        <span className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          aura <Icon name="gem" size={20} color="var(--a1)" />
        </span>
        <div className="sidenav-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              <span className="tab-emoji"><Icon name={t.icon} size={19} /></span>
              {t.label}
            </button>
          ))}
        </div>
        <div className="sidenav-foot">{proPill}</div>
      </nav>

      <div className="main">
        <header className="header">
          <span className="logo" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            aura <Icon name="gem" size={17} color="var(--a1)" />
          </span>
          {proPill}
        </header>

        {tab === 'today' && (
          <Today state={state} update={update} openPro={() => setProOpen(true)} toast={toast} />
        )}
        {tab === 'stats' && (
          <Stats
            state={state}
            update={update}
            openPro={() => setProOpen(true)}
            onManage={manageSubscription}
            onCancel={() => setCancelOpen(true)}
          />
        )}
        {tab === 'coach' && (
          state.pro
            ? <Coach state={state} update={update} toast={toast} />
            : <CoachLocked openPro={() => setProOpen(true)} />
        )}
        {tab === 'recap' && <Recap state={state} toast={toast} />}
      </div>

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'active' : ''}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-emoji"><Icon name={t.icon} size={20} /></span>
            {t.label}
          </button>
        ))}
      </nav>

      {proOpen && (
        <ProModal
          onClose={() => setProOpen(false)}
          onRestore={restorePurchase}
          onComplete={completeCheckout}
        />
      )}
      {cancelOpen && state.email && (
        <CancelModal
          email={state.email}
          onClose={() => setCancelOpen(false)}
          onCancelled={syncSubscription}
        />
      )}
      {toastState && (
        <div className="toast">
          <span>{toastState.msg}</span>
          {toastState.action && (
            <button
              className="toast-action"
              onClick={() => {
                toastState.action!.fn();
                window.clearTimeout(toastTimer.current);
                setToastState(null);
              }}
            >
              {toastState.action.label}
            </button>
          )}
        </div>
      )}
    </>
  );
}
