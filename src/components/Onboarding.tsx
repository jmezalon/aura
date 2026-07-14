import { useState } from 'react';
import type { AppState, Habit } from '../types';
import { FREE_HABIT_LIMIT, PRESET_HABITS } from '../data';
import { Icon } from '../icons';

interface Props {
  onDone: (patch: Pick<AppState, 'name' | 'habits' | 'onboarded'>) => void;
}

export function Onboarding({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < FREE_HABIT_LIMIT) next.add(id);
      return next;
    });
  };

  const finish = () => {
    const habits: Habit[] = PRESET_HABITS.filter((h) => picked.has(h.id));
    onDone({ name: name.trim() || 'bestie', habits, onboarded: true });
  };

  if (step === 0) {
    return (
      <div className="onboard">
        <div className="orb" />
        <h1>
          farm aura,
          <br />
          not <span className="grad-text">brainrot</span>.
        </h1>
        <p className="sub">
          Aura turns your glow-up into a game. Check off tiny daily wins, grow
          your aura, keep the streak alive, and flex your weekly recap.
        </p>
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => setStep(1)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
          start my glow-up
          <Icon name="sparkles" size={17} />
        </button>
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="onboard">
        <h1>what do we call you?</h1>
        <p className="sub">First name, alias, gamer tag — dealer's choice.</p>
        <input
          className="name-input"
          placeholder="your name"
          value={name}
          maxLength={20}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && setStep(2)}
        />
        <div style={{ flex: 1 }} />
        <button className="btn" onClick={() => setStep(2)}>
          next
        </button>
      </div>
    );
  }

  return (
    <div className="onboard">
      <h1>pick your daily quests</h1>
      <p className="sub">
        Choose up to {FREE_HABIT_LIMIT} to start — you can add your own later.
      </p>
      <div className="habit-pick-grid">
        {PRESET_HABITS.map((h) => (
          <button
            key={h.id}
            className={`habit-pick ${picked.has(h.id) ? 'on' : ''}`}
            onClick={() => toggle(h.id)}
          >
            <span className="e"><Icon name={h.icon} size={20} /></span>
            {h.name}
          </button>
        ))}
      </div>
      <button className="btn" disabled={picked.size === 0} onClick={finish}>
        let's go ({picked.size}/{FREE_HABIT_LIMIT})
      </button>
    </div>
  );
}
