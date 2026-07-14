import { useEffect, useState } from 'react';
import type { AppState, Habit, Log } from './types';
import { LEVELS } from './data';
import { isIconName, type IconName } from './icons';

const KEY = 'aura-state-v1';

/** Old builds stored an emoji per habit; map those to the new icon registry. */
const EMOJI_TO_ICON: Record<string, IconName> = {
  '🌱': 'sprout',
  '😴': 'moon',
  '📵': 'phone-off',
  '💧': 'droplet',
  '🏃': 'footprints',
  '📖': 'book-open',
  '✍️': 'notebook-pen',
  '🧴': 'spray-can',
  '🥗': 'salad',
  '📞': 'phone-call',
  '💸': 'piggy-bank',
  '🧘': 'flower-2',
  '✨': 'sparkles',
  '🔥': 'flame',
  '💪': 'dumbbell',
  '🎯': 'target',
  '🎨': 'palette',
  '🎧': 'headphones',
  '🧠': 'brain',
  '🚿': 'shower-head',
  '🌙': 'moon',
  '🐶': 'dog',
};

/** Backfill `icon` on habits persisted before the emoji→icon migration. */
function migrateHabits(habits: unknown): Habit[] {
  if (!Array.isArray(habits)) return [];
  return habits.map((h) => {
    const { emoji, ...rest } = h as Habit & { emoji?: string };
    const icon: IconName = isIconName(rest.icon)
      ? rest.icon
      : (emoji && EMOJI_TO_ICON[emoji]) || 'sparkles';
    return { ...rest, icon };
  });
}

const DEFAULT_STATE: AppState = {
  onboarded: false,
  name: '',
  habits: [],
  log: {},
  theme: 'midnight',
  pro: false,
  email: '',
  aiProfile: '',
  aiChat: [],
  aiNudge: null,
};

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_STATE, ...parsed, habits: migrateHabits(parsed.habits) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(loadState);
  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(state));
  }, [state]);
  return [state, setState] as const;
}

/* ---------- date helpers ---------- */

export function dateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const todayKey = () => dateKey(new Date());

/**
 * Fire a haptic buzz where the browser supports it (Android/Chrome). iOS Safari
 * has no Vibration API, so this is a no-op there — a progressive enhancement.
 */
export function vibrate(pattern: number | number[]): void {
  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      // some browsers throw if called outside a user gesture — ignore
    }
  }
}

export function lastNDays(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    out.push(dateKey(d));
    d.setDate(d.getDate() - 1);
  }
  return out.reverse();
}

/* ---------- aura math ---------- */

export function pointsForDay(log: Log, habits: Habit[], key: string): number {
  const done = log[key] ?? [];
  const base = habits
    .filter((h) => done.includes(h.id))
    .reduce((sum, h) => sum + h.points, 0);
  // perfect-day bonus
  const perfect = habits.length > 0 && habits.every((h) => done.includes(h.id));
  return base + (perfect ? 25 : 0);
}

export function totalAura(log: Log, habits: Habit[]): number {
  return Object.keys(log).reduce((sum, k) => sum + pointsForDay(log, habits, k), 0);
}

/** consecutive days (ending today or yesterday) with at least one habit done */
export function streak(log: Log): number {
  let count = 0;
  const d = new Date();
  // streak survives if today isn't logged yet
  if (!(log[dateKey(d)]?.length > 0)) d.setDate(d.getDate() - 1);
  while (log[dateKey(d)]?.length > 0) {
    count++;
    d.setDate(d.getDate() - 1);
  }
  return count;
}

export function levelFor(aura: number) {
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) {
    if (aura >= LEVELS[i].min) idx = i;
  }
  const level = LEVELS[idx];
  const next = LEVELS[idx + 1] ?? null;
  const progress = next
    ? (aura - level.min) / (next.min - level.min)
    : 1;
  return { level, next, progress: Math.min(1, Math.max(0, progress)) };
}

export interface WeekStats {
  aura: number;
  daysActive: number;
  perfectDays: number;
  bestDay: { key: string; points: number } | null;
  topHabit: { habit: Habit; count: number } | null;
  completions: number;
}

export function weekStats(log: Log, habits: Habit[]): WeekStats {
  const days = lastNDays(7);
  let aura = 0;
  let daysActive = 0;
  let perfectDays = 0;
  let completions = 0;
  let bestDay: WeekStats['bestDay'] = null;
  const habitCounts = new Map<string, number>();

  for (const key of days) {
    const done = log[key] ?? [];
    const pts = pointsForDay(log, habits, key);
    aura += pts;
    if (done.length > 0) daysActive++;
    if (habits.length > 0 && habits.every((h) => done.includes(h.id))) perfectDays++;
    completions += done.length;
    if (pts > 0 && (!bestDay || pts > bestDay.points)) bestDay = { key, points: pts };
    for (const id of done) habitCounts.set(id, (habitCounts.get(id) ?? 0) + 1);
  }

  let topHabit: WeekStats['topHabit'] = null;
  for (const [id, count] of habitCounts) {
    const habit = habits.find((h) => h.id === id);
    if (habit && (!topHabit || count > topHabit.count)) topHabit = { habit, count };
  }

  return { aura, daysActive, perfectDays, bestDay, topHabit, completions };
}
