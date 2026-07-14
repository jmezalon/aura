import type { AppState, ChatMsg } from './types';
import { levelFor, streak, todayKey, totalAura } from './store';
import { isIconName, type IconName } from './icons';

export type { ChatMsg };

/** Icons the AI is allowed to pick for suggested quests (validated on return). */
export const SUGGESTABLE_ICONS: IconName[] = [
  'sparkles', 'flame', 'dumbbell', 'target', 'palette', 'headphones', 'brain',
  'shower-head', 'moon', 'dog', 'sprout', 'droplet', 'footprints', 'book-open',
  'notebook-pen', 'salad', 'phone-call', 'piggy-bank', 'flower-2', 'heart', 'leaf',
];

export interface QuestSuggestion {
  name: string;
  icon: IconName;
}

/** Compact snapshot of the user's state that we hand to the model each call. */
export function buildContext(state: AppState) {
  const key = todayKey();
  const done = state.log[key] ?? [];
  const aura = totalAura(state.log, state.habits);
  const { level } = levelFor(aura);
  return {
    name: state.name,
    aura,
    level: level.name,
    streak: streak(state.log),
    quests: state.habits.map((h) => ({ name: h.name, doneToday: done.includes(h.id) })),
    allowedIcons: SUGGESTABLE_ICONS,
  };
}

class AiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function callAI<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch('/api/ai', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new AiError(res.status, `ai ${res.status}`);
  return res.json() as Promise<T>;
}

/** Friendly, on-brand copy for whatever went wrong. */
export function aiErrorMessage(err: unknown): string {
  if (err instanceof AiError && err.status === 503) {
    return "my brain isn't switched on yet — looks like the AI key hasn't been set up. tell the dev 👀";
  }
  return 'i glitched for a sec — try me again?';
}

type Ctx = ReturnType<typeof buildContext>;

export async function chatWithAI(messages: ChatMsg[], context: Ctx, profile: string): Promise<string> {
  const { reply } = await callAI<{ reply: string }>({ mode: 'chat', messages, context, profile });
  return reply;
}

export async function getNudge(context: Ctx, profile: string): Promise<string> {
  const { nudge } = await callAI<{ nudge: string }>({ mode: 'nudge', context, profile });
  return nudge;
}

export async function getSuggestions(context: Ctx, profile: string): Promise<QuestSuggestion[]> {
  const { suggestions } = await callAI<{ suggestions: Array<{ name?: unknown; icon?: unknown }> }>({
    mode: 'suggest', context, profile,
  });
  return (suggestions ?? [])
    .filter((s) => s && typeof s.name === 'string')
    .slice(0, 3)
    .map((s) => ({
      name: String(s.name).slice(0, 30),
      icon: isIconName(s.icon) ? s.icon : 'sparkles',
    }));
}

export async function updateProfile(messages: ChatMsg[], profile: string): Promise<string> {
  const { profile: updated } = await callAI<{ profile: string }>({ mode: 'profile', messages, profile });
  return updated;
}
