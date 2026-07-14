/**
 * Provider-agnostic AI core, shared by the Vercel function (api/ai.mjs) and the
 * local dev server (server/index.mjs). Talks the OpenAI chat-completions format,
 * so switching away from Groq later is purely an env change:
 *   AI_BASE_URL   (default https://api.groq.com/openai/v1)
 *   AI_MODEL      (default llama-3.3-70b-versatile)
 *   AI_API_KEY    (falls back to GROQ_API_KEY)
 */

const BRAND = `You are "Aura", the in-app AI coach inside a Gen Z habit-tracking app of the same name. The app gamifies self-improvement: users complete daily "quests" (habits) to earn "aura" points, level up (NPC → Side Quest → Main Character → Certified Icon…), and keep daily streaks. Your vibe: warm, encouraging bestie energy with a light Gen Z tone — genuine, never cringe, never over-the-top. Keep replies short and skimmable. No markdown headings; use short paragraphs or tight lists. You can reference their real data below.`;

const sys = (content) => ({ role: 'system', content });

function contextBlock(context = {}, profile = '') {
  const lines = [];
  if (context.name) lines.push(`Name: ${context.name}`);
  lines.push(`Aura: ${context.aura ?? 0} · Level: ${context.level ?? 'NPC'} · Streak: ${context.streak ?? 0} day(s)`);
  if (Array.isArray(context.quests) && context.quests.length) {
    lines.push(
      'Today’s quests: ' +
        context.quests.map((q) => `${q.name}${q.doneToday ? ' (done)' : ''}`).join(', '),
    );
  } else {
    lines.push('They have no quests set up yet.');
  }
  let block = `CONTEXT ABOUT THE USER RIGHT NOW:\n${lines.join('\n')}`;
  if (profile && profile.trim()) {
    block += `\n\nWHAT YOU’VE LEARNED ABOUT THEM OVER TIME:\n${profile.trim()}`;
  }
  return block;
}

function buildPayload(model, mode, messages, context, profile) {
  const history = (Array.isArray(messages) ? messages : [])
    .slice(-16)
    .map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 2000) }));

  if (mode === 'nudge') {
    return {
      model, temperature: 0.85, max_tokens: 90,
      messages: [
        sys(BRAND),
        sys(contextBlock(context, profile)),
        { role: 'user', content: 'Give me ONE short, personalized hype line for right now (max ~20 words), grounded in my data above. No greeting, no quotes — just the line.' },
      ],
    };
  }

  if (mode === 'suggest') {
    const icons = (context.allowedIcons || []).join(', ');
    return {
      model, temperature: 0.7, max_tokens: 320,
      response_format: { type: 'json_object' },
      messages: [
        sys(BRAND),
        sys(contextBlock(context, profile)),
        sys(`Return ONLY JSON of the form {"suggestions":[{"name":"...","icon":"..."}]} with exactly 3 fresh quest ideas tailored to this user. "name" must be <= 30 chars, casual and lowercase-ish. "icon" MUST be exactly one of: ${icons}. Do not suggest quests they already have.`),
        { role: 'user', content: 'suggest 3 new quests for me' },
      ],
    };
  }

  if (mode === 'profile') {
    return {
      model, temperature: 0.3, max_tokens: 220,
      messages: [
        sys('You maintain a concise, evolving profile of a habit-app user for future personalization. Merge the prior profile with anything new and durable from the conversation — goals, motivations, struggles, preferences, wins. Keep 4–6 short sentences max. Drop anything trivial. Return ONLY the updated profile text.'),
        sys(`PRIOR PROFILE:\n${profile || '(none yet)'}`),
        { role: 'user', content: `Recent conversation:\n${history.map((m) => `${m.role}: ${m.content}`).join('\n')}` },
      ],
    };
  }

  // default: chat
  return {
    model, temperature: 0.7, max_tokens: 500,
    messages: [sys(BRAND), sys(contextBlock(context, profile)), ...history],
  };
}

function parseByMode(mode, content) {
  const text = (content || '').trim();
  if (mode === 'nudge') return { nudge: text.replace(/^["']|["']$/g, '') };
  if (mode === 'profile') return { profile: text };
  if (mode === 'suggest') {
    try {
      const j = JSON.parse(text);
      return { suggestions: Array.isArray(j.suggestions) ? j.suggestions : [] };
    } catch {
      return { suggestions: [] };
    }
  }
  return { reply: text };
}

/** Run one AI request. Throws Error with `.code` of NO_KEY or UPSTREAM on failure. */
export async function runAI({ mode = 'chat', messages = [], context = {}, profile = '' } = {}) {
  const apiKey = process.env.AI_API_KEY || process.env.GROQ_API_KEY;
  if (!apiKey) {
    const err = new Error('AI not configured (missing GROQ_API_KEY)');
    err.code = 'NO_KEY';
    throw err;
  }
  const baseUrl = process.env.AI_BASE_URL || 'https://api.groq.com/openai/v1';
  const model = process.env.AI_MODEL || 'llama-3.3-70b-versatile';

  const payload = buildPayload(model, mode, messages, context, profile);
  const r = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const body = await r.text();
    const err = new Error(`upstream ${r.status}: ${body.slice(0, 300)}`);
    err.code = 'UPSTREAM';
    throw err;
  }
  const data = await r.json();
  const content = data.choices?.[0]?.message?.content ?? '';
  return parseByMode(mode, content);
}
