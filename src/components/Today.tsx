import { useEffect, useRef, useState } from 'react';
import type { AppState, Habit, Toast } from '../types';
import { FREE_HABIT_LIMIT } from '../data';
import { levelFor, todayKey, totalAura, streak, vibrate } from '../store';
import { Icon, type IconName } from '../icons';
import { buildContext, getNudge } from '../ai';

interface Props {
  state: AppState;
  update: (fn: (s: AppState) => AppState) => void;
  openPro: () => void;
  toast: Toast;
}

const ICON_CHOICES: IconName[] = [
  'sparkles', 'flame', 'dumbbell', 'target', 'palette',
  'headphones', 'brain', 'shower-head', 'moon', 'dog',
];

const REVEAL = 140; // width of the swipe action tray
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

interface HabitRowProps {
  habit: Habit;
  isDone: boolean;
  isOpen: boolean;
  isDragging: boolean;
  residual: number;
  setOpen: (open: boolean) => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onGripDown: (e: React.PointerEvent) => void;
}

function HabitRow({
  habit, isDone, isOpen, isDragging, residual, setOpen, onToggle, onEdit, onDelete, onGripDown,
}: HabitRowProps) {
  const [offset, setOffset] = useState(0);
  const [swiping, setSwiping] = useState(false);
  const offsetRef = useRef(0); // latest offset — read synchronously on pointerup
  const down = useRef<{ x: number; y: number; base: number } | null>(null);
  const axis = useRef<null | 'h' | 'v'>(null);
  const swiped = useRef(false);

  const applyOffset = (v: number) => {
    offsetRef.current = v;
    setOffset(v);
  };

  // keep the visual offset in sync when open state is driven from outside
  // (e.g. another row opening closes this one)
  useEffect(() => {
    if (!isDragging) applyOffset(isOpen ? -REVEAL : 0);
  }, [isOpen, isDragging]);

  // swipe is a touch-only gesture; desktop reveals actions on hover instead
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch') return;
    down.current = { x: e.clientX, y: e.clientY, base: isOpen ? -REVEAL : 0 };
    axis.current = null;
    swiped.current = false;
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!down.current) return;
    const dx = e.clientX - down.current.x;
    const dy = e.clientY - down.current.y;
    if (axis.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      axis.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      if (axis.current === 'h') {
        setSwiping(true);
        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* ignore */ }
      }
    }
    if (axis.current === 'h') {
      swiped.current = true;
      applyOffset(clamp(down.current.base + dx, -REVEAL, 0));
    }
  };
  const onPointerUp = () => {
    if (axis.current === 'h') {
      const shouldOpen = offsetRef.current < -REVEAL / 2;
      applyOffset(shouldOpen ? -REVEAL : 0);
      setOpen(shouldOpen);
      setSwiping(false);
    }
    down.current = null;
    axis.current = null;
  };

  const handleClick = () => {
    // a swipe shouldn't also register as a tap
    if (swiped.current) { swiped.current = false; return; }
    if (isOpen) { setOpen(false); return; }
    onToggle();
  };

  const transform = isDragging
    ? `translateY(${residual}px) scale(1.02)`
    : offset ? `translateX(${offset}px)` : undefined;

  const stop = (e: React.SyntheticEvent) => e.stopPropagation();

  return (
    <div className={`habit-swipe ${isDragging ? 'dragging' : ''}`}>
      <div className="habit-tray" aria-hidden={!isOpen}>
        <button className="tray-btn edit" onClick={onEdit} tabIndex={isOpen ? 0 : -1}>
          <Icon name="pencil" size={18} />
          edit
        </button>
        <button className="tray-btn delete" onClick={onDelete} tabIndex={isOpen ? 0 : -1}>
          <Icon name="trash-2" size={18} />
          delete
        </button>
      </div>

      <div
        className={`habit-row ${isDone ? 'done' : ''} ${swiping || isDragging ? 'no-anim' : ''}`}
        style={{ transform, ...(isDragging ? { zIndex: 30 } : null) }}
        role="button"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onClick={handleClick}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle(); }
        }}
      >
        <span
          className="grip"
          aria-label="drag to reorder"
          onPointerDown={onGripDown}
          onClick={stop}
        >
          <Icon name="grip-vertical" size={18} />
        </span>
        <span className="e"><Icon name={habit.icon} size={24} /></span>
        <span className="info">
          <span className="name" style={isDone ? { textDecoration: 'line-through' } : undefined}>
            {habit.name}
          </span>
          <div className="pts">+{habit.points} aura</div>
        </span>
        <div className="row-hover-actions">
          <button aria-label="edit quest" onClick={(e) => { stop(e); onEdit(); }}>
            <Icon name="pencil" size={16} />
          </button>
          <button className="del" aria-label="delete quest" onClick={(e) => { stop(e); onDelete(); }}>
            <Icon name="trash-2" size={16} />
          </button>
        </div>
        <span className="check"><Icon name="check" size={16} strokeWidth={3} /></span>
      </div>
    </div>
  );
}

export function Today({ state, update, openPro, toast }: Props) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newIcon, setNewIcon] = useState<IconName>('sparkles');
  const [openId, setOpenId] = useState<string | null>(null);

  // live reorder state
  const [previewOrder, setPreviewOrder] = useState<Habit[] | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragResidual, setDragResidual] = useState(0);

  const key = todayKey();
  const done = state.log[key] ?? [];
  const aura = totalAura(state.log, state.habits);
  const { level, next, progress } = levelFor(aura);
  const currentStreak = streak(state.log);
  const perfect = state.habits.length > 0 && state.habits.every((h) => done.includes(h.id));

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'gm';
    if (h < 18) return 'good afternoon';
    return 'gn soon';
  })();

  // Aura+ proactive nudge — generated once a day, cached in state
  const [nudgeLoading, setNudgeLoading] = useState(false);
  const nudge = state.aiNudge && state.aiNudge.date === key ? state.aiNudge.text : null;

  const fetchNudge = () => {
    if (nudgeLoading) return;
    setNudgeLoading(true);
    getNudge(buildContext(state), state.aiProfile)
      .then((text) => {
        if (text) update((s) => ({ ...s, aiNudge: { text, date: key } }));
      })
      .catch(() => {})
      .finally(() => setNudgeLoading(false));
  };

  useEffect(() => {
    if (state.pro && !nudge && state.habits.length > 0) fetchNudge();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.pro]);

  const toggleHabit = (habit: Habit) => {
    const wasDone = done.includes(habit.id);
    update((s) => {
      const cur = s.log[key] ?? [];
      const isDone = cur.includes(habit.id);
      const nextDone = isDone ? cur.filter((id) => id !== habit.id) : [...cur, habit.id];
      return { ...s, log: { ...s.log, [key]: nextDone } };
    });
    if (!wasDone) {
      vibrate(15);
      toast(`+${habit.points} aura`);
    }
  };

  const resetForm = () => {
    setNewName('');
    setNewIcon('sparkles');
    setEditingId(null);
    setAdding(false);
  };

  const saveHabit = () => {
    const name = newName.trim();
    if (!name) return;
    if (editingId) {
      update((s) => ({
        ...s,
        habits: s.habits.map((h) => (h.id === editingId ? { ...h, name, icon: newIcon } : h)),
      }));
    } else {
      update((s) => ({
        ...s,
        habits: [...s.habits, { id: `c${Date.now()}`, name, icon: newIcon, points: 15 }],
      }));
    }
    resetForm();
  };

  const tryAdd = () => {
    if (!state.pro && state.habits.length >= FREE_HABIT_LIMIT) {
      openPro();
      return;
    }
    setEditingId(null);
    setNewName('');
    setNewIcon('sparkles');
    setAdding(true);
  };

  const startEdit = (habit: Habit) => {
    setOpenId(null);
    setEditingId(habit.id);
    setNewName(habit.name);
    setNewIcon(habit.icon);
    setAdding(true);
  };

  const deleteHabit = (habit: Habit) => {
    const index = state.habits.findIndex((h) => h.id === habit.id);
    setOpenId(null);
    update((s) => ({ ...s, habits: s.habits.filter((h) => h.id !== habit.id) }));
    vibrate(30);
    // non-destructive: the habit's log entries are left untouched, so undo
    // restores it (and its aura) exactly
    toast('quest deleted', {
      label: 'undo',
      fn: () => {
        update((s) => {
          if (s.habits.some((h) => h.id === habit.id)) return s;
          const habits = s.habits.slice();
          habits.splice(Math.min(index, habits.length), 0, habit);
          return { ...s, habits };
        });
      },
    });
  };

  // drag-to-reorder, driven from a row's grip handle
  const startReorder = (e: React.PointerEvent, habit: Habit) => {
    e.stopPropagation();
    e.preventDefault();
    const swipeEl = (e.currentTarget as HTMLElement).closest('.habit-swipe') as HTMLElement | null;
    const height = (swipeEl?.offsetHeight ?? 72) + 10; // + list gap
    const baseOrder = state.habits;
    const index = baseOrder.findIndex((h) => h.id === habit.id);
    if (index < 0) return;

    let currentOrder = baseOrder;
    setOpenId(null);
    setPreviewOrder(baseOrder);
    setDragId(habit.id);
    setDragResidual(0);
    vibrate(15);

    const move = (ev: PointerEvent) => {
      const delta = ev.clientY - e.clientY;
      const steps = Math.round(delta / height);
      const target = clamp(index + steps, 0, baseOrder.length - 1);
      const arr = baseOrder.slice();
      const [item] = arr.splice(index, 1);
      arr.splice(target, 0, item);
      currentOrder = arr;
      setPreviewOrder(arr);
      setDragResidual(delta - (target - index) * height);
    };
    const up = () => {
      update((s) => ({ ...s, habits: currentOrder }));
      setPreviewOrder(null);
      setDragId(null);
      setDragResidual(0);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };

  const habits = previewOrder ?? state.habits;

  return (
    <div className="screen">
      <p className="muted" style={{ fontWeight: 600, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
        {greeting}, {state.name}
        <Icon name="hand" size={16} />
      </p>

      <div className="card aura-hero">
        <div className="streak-chip">
          <Icon name="flame" size={15} color="var(--a2)" /> {currentStreak}
        </div>
        <div className="label">your aura</div>
        <div className="amount grad-text">{aura.toLocaleString()}</div>
        <div className="level-row">
          <Icon name={level.icon} size={18} color="var(--a1)" />
          <span>{level.name}</span>
        </div>
        <div className="progress-track">
          <div className="progress-fill" style={{ width: `${progress * 100}%` }} />
        </div>
        <div className="next-level" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          {next ? (
            <>
              {(next.min - aura).toLocaleString()} aura to {next.name}
              <Icon name={next.icon} size={13} />
            </>
          ) : (
            'max level. you are him/her.'
          )}
        </div>
      </div>

      {state.pro && (nudge || nudgeLoading) && (
        <div className="nudge-card">
          <span className="nudge-icon"><Icon name="sparkle" size={16} /></span>
          {nudge ? (
            <span className="nudge-text">{nudge}</span>
          ) : (
            <span className="nudge-text loading">coaching you up…</span>
          )}
          {nudge && (
            <button
              className="nudge-refresh"
              aria-label="new nudge"
              disabled={nudgeLoading}
              onClick={() => { update((s) => ({ ...s, aiNudge: null })); fetchNudge(); }}
            >
              <Icon name="refresh-cw" size={14} />
            </button>
          )}
        </div>
      )}

      <div className="section-title">
        <h2>today's quests</h2>
        <span className="count">
          {done.filter((id) => state.habits.some((h) => h.id === id)).length}/{state.habits.length}
        </span>
      </div>

      {habits.length === 0 ? (
        <div className="empty-quests">
          <Icon name="sparkles" size={22} />
          <p>no quests yet</p>
          <span>add one below to start farming aura</span>
        </div>
      ) : (
        <div className={`habit-list ${previewOrder ? 'reordering' : ''}`}>
          {habits.map((h) => (
            <HabitRow
              key={h.id}
              habit={h}
              isDone={done.includes(h.id)}
              isOpen={openId === h.id}
              isDragging={dragId === h.id}
              residual={dragResidual}
              setOpen={(open) => setOpenId(open ? h.id : null)}
              onToggle={() => toggleHabit(h)}
              onEdit={() => startEdit(h)}
              onDelete={() => deleteHabit(h)}
              onGripDown={(e) => startReorder(e, h)}
            />
          ))}
        </div>
      )}

      {perfect && (
        <div className="perfect-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          perfect day · +25 bonus aura
          <Icon name="sparkles" size={15} />
        </div>
      )}

      {adding ? (
        <div className="card" style={{ marginTop: 12 }}>
          <input
            className="name-input"
            placeholder="new quest (e.g. practice guitar)"
            value={newName}
            maxLength={30}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveHabit()}
          />
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {ICON_CHOICES.map((name) => (
              <button
                key={name}
                onClick={() => setNewIcon(name)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 9,
                  borderRadius: 10,
                  color: name === newIcon ? 'var(--a1)' : 'var(--muted)',
                  background: name === newIcon ? 'var(--card2)' : 'transparent',
                  border: `1px solid ${name === newIcon ? 'var(--a1)' : 'transparent'}`,
                }}
              >
                <Icon name={name} size={20} />
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" onClick={resetForm}>
              cancel
            </button>
            <button className="btn" onClick={saveHabit} disabled={!newName.trim()}>
              {editingId ? 'save' : 'add quest'}
            </button>
          </div>
        </div>
      ) : (
        <button className="add-habit-btn" onClick={tryAdd}>
          + add a quest
          {!state.pro && state.habits.length >= FREE_HABIT_LIMIT ? ' (Aura+)' : ''}
        </button>
      )}
    </div>
  );
}
