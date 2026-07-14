import { useEffect, useRef, useState } from 'react';
import type { AppState, ChatMsg, Toast } from '../types';
import { Icon } from '../icons';
import {
  aiErrorMessage,
  buildContext,
  chatWithAI,
  getSuggestions,
  updateProfile,
  type QuestSuggestion,
} from '../ai';

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  toast: Toast;
}

const QUICK_PROMPTS = [
  'how am I doing?',
  "I'm not feeling motivated",
  'help me plan my day',
];

export function Coach({ state, update, toast }: Props) {
  const [messages, setMessages] = useState<ChatMsg[]>(state.aiChat);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggestions, setSuggestions] = useState<QuestSuggestion[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const msgsRef = useRef(messages);
  msgsRef.current = messages;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy, suggestions]);

  // when leaving the coach, fold the conversation into the durable profile
  useEffect(() => {
    return () => {
      const m = msgsRef.current;
      if (m.length < 2) return;
      updateProfile(m.slice(-16), state.aiProfile)
        .then((p) => { if (p) update((s) => ({ ...s, aiProfile: p })); })
        .catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (m: ChatMsg[]) => {
    setMessages(m);
    update((s) => ({ ...s, aiChat: m.slice(-30) }));
  };

  const send = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || busy) return;
    const next: ChatMsg[] = [...messages, { role: 'user', content }];
    persist(next);
    setInput('');
    setSuggestions([]);
    setBusy(true);
    try {
      const reply = await chatWithAI(next.slice(-16), buildContext(state), state.aiProfile);
      persist([...next, { role: 'assistant', content: reply }]);
    } catch (err) {
      persist([...next, { role: 'assistant', content: aiErrorMessage(err) }]);
    } finally {
      setBusy(false);
    }
  };

  const suggest = async () => {
    if (busy) return;
    setBusy(true);
    setSuggestions([]);
    try {
      const s = await getSuggestions(buildContext(state), state.aiProfile);
      if (s.length === 0) toast("couldn't think of any right now");
      setSuggestions(s);
    } catch (err) {
      toast(aiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const addSuggestion = (s: QuestSuggestion) => {
    update((st) => ({
      ...st,
      habits: [...st.habits, { id: `c${Date.now()}`, name: s.name, icon: s.icon, points: 15 }],
    }));
    setSuggestions((prev) => prev.filter((x) => x !== s));
    toast(`added "${s.name}"`);
  };

  const clearChat = () => {
    setSuggestions([]);
    persist([]);
  };

  return (
    <div className="screen coach">
      <div className="coach-head">
        <div>
          <h1>aura coach</h1>
          <p className="muted" style={{ fontSize: 13 }}>your hype bestie — gets to know you over time</p>
        </div>
        {messages.length > 0 && (
          <button className="coach-clear" onClick={clearChat} aria-label="clear chat">
            <Icon name="refresh-cw" size={16} />
          </button>
        )}
      </div>

      <div className="coach-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="coach-welcome">
            <div className="coach-orb"><Icon name="sparkle" size={22} color="#fff" /></div>
            <p className="hi">hey {state.name || 'bestie'} 👋</p>
            <p className="muted">ask me anything — how you're doing, what to work on, or just vent. i've got your stats and i'll remember what matters.</p>
            <div className="coach-quick">
              {QUICK_PROMPTS.map((q) => (
                <button key={q} onClick={() => send(q)} disabled={busy}>{q}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`bubble ${m.role}`}>{m.content}</div>
        ))}

        {busy && (
          <div className="bubble assistant typing">
            <span></span><span></span><span></span>
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="coach-suggestions">
            <div className="cs-label">tap to add a quest</div>
            {suggestions.map((s) => (
              <button key={s.name} className="cs-item" onClick={() => addSuggestion(s)}>
                <span className="cs-icon"><Icon name={s.icon} size={20} /></span>
                <span className="cs-name">{s.name}</span>
                <span className="cs-plus"><Icon name="plus" size={18} /></span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="coach-composer">
        <button className="coach-suggest" onClick={suggest} disabled={busy}>
          <Icon name="sparkle" size={16} />
          suggest quests
        </button>
        <div className="coach-input-row">
          <input
            className="coach-input"
            placeholder="message your coach…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
            disabled={busy}
          />
          <button className="coach-send" onClick={() => send()} disabled={busy || !input.trim()} aria-label="send">
            <Icon name="send" size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Upsell shown when a non-Aura+ user opens the coach tab. */
export function CoachLocked({ openPro }: { openPro: () => void }) {
  return (
    <div className="screen coach-locked">
      <div className="coach-orb big"><Icon name="sparkle" size={30} color="#fff" /></div>
      <h1>meet your <span className="grad-text">aura coach</span></h1>
      <p className="muted">
        a personal AI hype-bestie that knows your streaks, spots your patterns, suggests quests,
        and remembers what matters to you. part of Aura+.
      </p>
      <button className="btn" onClick={openPro}>unlock with Aura+</button>
    </div>
  );
}
