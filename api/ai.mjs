import { runAI } from './_ai-core.mjs';

/**
 * POST /api/ai
 * Body: { mode: 'chat'|'nudge'|'suggest'|'profile', messages?, context?, profile? }
 * Proxies to the configured LLM provider (Groq by default) — the API key stays
 * server-side and never reaches the browser.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method not allowed' });
  }
  try {
    const out = await runAI(req.body || {});
    return res.status(200).json(out);
  } catch (err) {
    console.error('ai error:', err.message);
    if (err.code === 'NO_KEY') {
      return res.status(503).json({ error: 'AI not configured' });
    }
    return res.status(502).json({ error: 'ai request failed' });
  }
}
