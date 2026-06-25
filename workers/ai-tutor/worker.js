/**
 * DE Dojo — AI tutor proxy (Cloudflare Worker, free tier).
 *
 * The browser app must NEVER hold an Anthropic API key. This Worker sits in
 * front of the Anthropic Messages API, injects the key from a server-side
 * secret, enforces CORS + a light per-IP rate limit, and returns plain text.
 *
 * Deploy (all free):
 *   1. npm i -g wrangler        # one-time
 *   2. cd workers/ai-tutor
 *   3. wrangler secret put ANTHROPIC_API_KEY     # paste your key (only cost: usage)
 *   4. wrangler deploy
 *   5. In the app, set the endpoint once (browser console):
 *        localStorage.setItem('ai_endpoint','https://<your-worker>.workers.dev')
 *
 * Env:
 *   ANTHROPIC_API_KEY  (secret, required)
 *   ALLOW_ORIGIN       (optional, defaults to "*"; set to your site origin to lock down)
 *   MODEL              (optional, defaults to claude-sonnet-4-6)
 */

const RATE = { windowMs: 60_000, max: 20 }; // 20 tutor calls per IP per minute
const hits = new Map(); // ip -> { count, resetAt }  (per-isolate, best-effort)

function rateLimited(ip) {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now > h.resetAt) { hits.set(ip, { count: 1, resetAt: now + RATE.windowMs }); return false; }
  h.count++;
  return h.count > RATE.max;
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || '*';
    const headers = cors(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return new Response('POST only', { status: 405, headers });

    const ip = request.headers.get('CF-Connecting-IP') || 'anon';
    if (rateLimited(ip)) return new Response(JSON.stringify({ error: 'rate_limited' }), { status: 429, headers: { ...headers, 'Content-Type': 'application/json' } });

    if (!env.ANTHROPIC_API_KEY) return new Response(JSON.stringify({ error: 'server_not_configured' }), { status: 503, headers: { ...headers, 'Content-Type': 'application/json' } });

    let body;
    try { body = await request.json(); } catch { return new Response(JSON.stringify({ error: 'bad_json' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }); }

    const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 8000) : '';
    if (!prompt) return new Response(JSON.stringify({ error: 'missing_prompt' }), { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } });

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: env.MODEL || 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text();
      return new Response(JSON.stringify({ error: 'upstream', status: upstream.status, detail: detail.slice(0, 500) }), { status: 502, headers: { ...headers, 'Content-Type': 'application/json' } });
    }

    const data = await upstream.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
    return new Response(JSON.stringify({ text }), { headers: { ...headers, 'Content-Type': 'application/json' } });
  },
};
