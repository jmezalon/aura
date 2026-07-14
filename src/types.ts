import type { IconName } from './icons';

export interface Habit {
  id: string;
  name: string;
  icon: IconName;
  points: number;
}

/** map of date key (YYYY-MM-DD) -> array of completed habit ids */
export type Log = Record<string, string[]>;

/** one turn in the AI coach conversation */
export interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
}

/** a cached proactive nudge, so we only generate one per day */
export interface AiNudge {
  text: string;
  date: string;
}

export interface AppState {
  onboarded: boolean;
  name: string;
  habits: Habit[];
  log: Log;
  theme: ThemeId;
  pro: boolean;
  /** email Aura+ was purchased with — used to re-sync/restore entitlement from Stripe */
  email: string;
  /** AI coach: evolving on-device memory + recent conversation + today's nudge */
  aiProfile: string;
  aiChat: ChatMsg[];
  aiNudge: AiNudge | null;
}

export type ThemeId = 'midnight' | 'sunset' | 'matcha' | 'cherry' | 'vapor';

/** Optional action button shown inside a toast (e.g. Undo). */
export interface ToastAction {
  label: string;
  fn: () => void;
}

export type Toast = (msg: string, action?: ToastAction) => void;

export interface Level {
  name: string;
  icon: IconName;
  min: number;
}
