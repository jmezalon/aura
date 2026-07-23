import { useEffect, useRef, useState } from 'react';
import type { AppState, ThemeId } from '../types';
import { THEMES } from '../data';
import { lastNDays, pointsForDay, streak, totalAura, todayKey, weekStats } from '../store';
import { Icon } from '../icons';

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  openPro: () => void;
  onManage: () => Promise<void>;
  onCancel: () => void;
  previewTheme: ThemeId | null;
  onPreviewTheme: (id: ThemeId | null) => void;
}

const DAY_LETTERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export function Stats({
  state,
  update,
  openPro,
  onManage,
  onCancel,
  previewTheme,
  onPreviewTheme,
}: Props) {
  const [managing, setManaging] = useState(false);
  const themeGrid = useRef<HTMLDivElement>(null);

  // the preview bar floats over the bottom of the screen — lift the swatches
  // clear of it so the row stays visible while they're trying themes on
  useEffect(() => {
    if (previewTheme) {
      themeGrid.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [previewTheme]);

  const manage = async () => {
    setManaging(true);
    try {
      await onManage();
    } finally {
      setManaging(false);
    }
  };

  const days = lastNDays(7);
  const points = days.map((k) => pointsForDay(state.log, state.habits, k));
  const max = Math.max(...points, 1);
  const week = weekStats(state.log, state.habits);
  const aura = totalAura(state.log, state.habits);
  const currentStreak = streak(state.log);

  // locked themes are try-before-you-buy: the first tap wears the theme for
  // real, tapping the one you're already wearing is what opens the paywall.
  const pickTheme = (id: ThemeId, locked: boolean) => {
    if (locked) {
      if (previewTheme === id) openPro();
      else onPreviewTheme(id);
      return;
    }
    onPreviewTheme(null);
    update((s) => ({ ...s, theme: id }));
  };

  return (
    <div className="screen">
      <h1 style={{ fontSize: 28, marginBottom: 18 }}>your stats</h1>

      <div className="stat-grid">
        <div className="stat-tile">
          <div className="v grad-text">{aura.toLocaleString()}</div>
          <div className="k">lifetime aura</div>
        </div>
        <div className="stat-tile">
          <div className="v" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Icon name="flame" size={24} color="var(--a2)" /> {currentStreak}
          </div>
          <div className="k">day streak</div>
        </div>
        <div className="stat-tile">
          <div className="v">{week.completions}</div>
          <div className="k">quests done this week</div>
        </div>
        <div className="stat-tile">
          <div className="v">{week.perfectDays}</div>
          <div className="k">perfect days this week</div>
        </div>
      </div>

      <div className="section-title">
        <h2>last 7 days</h2>
        <span className="count">{week.aura.toLocaleString()} aura</span>
      </div>

      <div className="card week-bars">
        {days.map((k, i) => {
          const pts = points[i];
          const dow = new Date(`${k}T12:00:00`).getDay();
          return (
            <div className="col" key={k}>
              <div className="bar-track">
                <div
                  className={`bar ${pts === 0 ? 'empty' : ''}`}
                  style={{ height: `${Math.max((pts / max) * 100, 4)}%` }}
                  title={`${pts} aura`}
                />
              </div>
              <span className={`day ${k === todayKey() ? 'today' : ''}`}>
                {DAY_LETTERS[dow]}
              </span>
            </div>
          );
        })}
      </div>

      <div className="section-title">
        <h2>vibes</h2>
        <span className="count">theme</span>
      </div>

      <div className="theme-grid" ref={themeGrid}>
        {THEMES.map((t) => {
          const locked = t.pro && !state.pro;
          const previewing = previewTheme === t.id;
          const active = previewing || (!previewTheme && state.theme === t.id);
          return (
            <button
              key={t.id}
              className={`theme-dot ${active ? 'active' : ''} ${previewing ? 'previewing' : ''}`}
              style={{
                background: `linear-gradient(135deg, ${t.vars['--a1']}, ${t.vars['--a2']})`,
              }}
              title={locked ? `${t.name} — tap to preview` : t.name}
              onClick={() => pickTheme(t.id, locked)}
            >
              {locked && (
                <span className="lock">
                  <Icon name={previewing ? 'eye' : 'lock'} size={15} />
                </span>
              )}
            </button>
          );
        })}
      </div>
      {!state.pro && (
        <p className="muted" style={{ fontSize: 12, marginTop: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
          <Icon name="lock" size={12} />
          {previewTheme
            ? 'tap it again to keep this vibe with Aura+'
            : 'tap a locked theme to try it on — Aura+ makes it yours'}
        </p>
      )}

      {state.pro && (
        <>
          <div className="section-title">
            <h2>subscription</h2>
            <span className="count">Aura+ ✦</span>
          </div>
          <button className="btn btn-ghost" onClick={onCancel}>
            cancel subscription
          </button>
          <button
            className="link-btn"
            onClick={manage}
            disabled={managing}
            style={{ marginTop: 12 }}
          >
            {managing ? 'opening billing…' : 'update card or view invoices on Stripe →'}
          </button>
        </>
      )}
    </div>
  );
}
