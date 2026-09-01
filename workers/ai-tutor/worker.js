/**
 * DE Dojo — AI proxy (Cloudflare Worker, free tier).
 *
 * The browser app must NEVER hold an API key. This Worker sits in front of
 * two upstream LLM APIs, injects keys from server-side secrets, enforces
 * CORS + a light per-IP rate limit, and returns plain JSON. One endpoint,
 * routed by `action` in the POST body:
 *
 *   action:'tutor'     (default if omitted, for backward compat) — hint/review
 *                       on an exercise. Uses Anthropic. Body: { prompt }
 *   action:'grade'     — AI-grades a free-text interview answer against a
 *                       rubric. Uses Gemini (Google AI Studio). Body:
 *                       { question, rubric, answer, lang }
 *   action:'recommend' — after an exam/practice session, turns the
 *                       per-category score breakdown into a short natural-
 *                       language study recommendation. Uses Gemini. Body:
 *                       { byCat, pct, lang }
 *
 * NOTE on Gemini access: a consumer "Gemini Pro/Advanced" app subscription
 * (Google One) does NOT include API access. You need a separate API key from
 * Google AI Studio: https://aistudio.google.com/apikey — it has its own
 * (often free) usage tier, billed independently from any app subscription.
 *
 * NOTE on the Gemini endpoint: grade/recommend call the Interactions API
 * (POST /v1beta/interactions), which became the primary Gemini interface in
 * June 2026. The older generateContent endpoint is legacy and 404s for some
 * models/accounts — if Google changes the wire format again, see
 * https://ai.google.dev/gemini-api/docs/migrate-to-interactions for the
 * current request/response shape before editing callGemini() below.
 *
 * Deploy (all free):
 *   1. npm i -g wrangler                # one-time
 *   2. cd workers/ai-tutor
 *   3. wrangler secret put ANTHROPIC_API_KEY   # for action:'tutor' (optional)
 *   4. wrangler secret put GEMINI_API_KEY      # for action:'grade'/'recommend' (optional)
 *   5. wrangler deploy
 *   6. In the app (browser console, once):
 *        localStorage.setItem('ai_endpoint','https://<your-worker>.workers.dev')
 *
 * Each action degrades independently: if its key isn't set, that action
 * returns 503 server_not_configured and the app falls back to a local
 * (non-AI) behavior — nothing else breaks.
 *
 * Env:
 *   ANTHROPIC_API_KEY  (secret, optional — powers action:'tutor')
 *   GEMINI_API_KEY     (secret, optional — powers action:'grade'/'recommend')
 *   ALLOW_ORIGIN       (optional, defaults to "*"; set to your site origin to lock down)
 *   MODEL              (optional, Anthropic model, defaults to claude-sonnet-4-6)
 *   GEMINI_MODEL       (optional, defaults to gemini-2.5-flash — confirmed against
 *                      the live model catalog Aug 2026. Newer "Gemini 3.x Flash"
 *                      endpoints exist too (gemini-3.5-flash, -3.6-flash, -3.7-flash)
 *                      if you want a newer generation; see
 *                      https://ai.google.dev/gemini-api/docs/pricing for the full list.)
 */

const RATE = { windowMs: 60_000, max: 20 };       // 20 tutor calls per IP per minute
const RATE_GRADE = { windowMs: 60_000, max: 12 };  // grading/recommend are cheaper but still capped
const hits = new Map();      // ip -> { count, resetAt }  (per-isolate, best-effort)
const hitsGrade = new Map();

function limited(map, ip, rate) {
  const now = Date.now();
  const h = map.get(ip);
  if (!h || now > h.resetAt) { map.set(ip, { count: 1, resetAt: now + rate.windowMs }); return false; }
  h.count++;
  return h.count > rate.max;
}

function cors(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  };
}

function json(obj, status, headers) {
  return new Response(JSON.stringify(obj), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
}

// Best-effort: pull the first {...} block out of a model response that may
// wrap JSON in prose or a ```json fence despite being asked not to.
function extractJson(text) {
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf('{'); const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

// jsonSchema, if given (standard JSON Schema, lowercase types), is passed via
// response_format so the model is constrained to emit that exact shape (more
// reliable than prompting alone). Uses the Interactions API (generateContent
// is legacy as of mid-2026 and 404s for some models/accounts).
async function callGemini(env, system, user, maxTokens, jsonSchema) {
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const body = {
    model,
    system_instruction: system,
    input: user,
    generation_config: { temperature: 0.2, max_output_tokens: maxTokens },
  };
  if (jsonSchema) body.response_format = [{ type: 'text', mime_type: 'application/json', schema: jsonSchema }];
  const upstream = await fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify(body),
  });
  if (!upstream.ok) { const detail = await upstream.text(); throw Object.assign(new Error('upstream'), { status: 502, detail: detail.slice(0, 500) }); }
  const data = await upstream.json();
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const text = steps.filter(s => s.type === 'model_output')
    .flatMap(s => (s.content || []).map(c => c.text || ''))
    .join('').trim();
  // Fallback in case the response shape differs from what we expect (SDK
  // convenience getters like output_text aren't guaranteed to mirror the raw
  // REST JSON) — try a couple of other plausible top-level fields.
  return text || (typeof data.output_text === 'string' ? data.output_text.trim() : '') || (typeof data.output === 'string' ? data.output.trim() : '');
}

async function handleTutor(body, env, headers) {
  if (!env.ANTHROPIC_API_KEY) return json({ error: 'server_not_configured' }, 503, headers);
  const prompt = typeof body.prompt === 'string' ? body.prompt.slice(0, 8000) : '';
  if (!prompt) return json({ error: 'missing_prompt' }, 400, headers);

  const upstream = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: env.MODEL || 'claude-sonnet-4-6', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!upstream.ok) { const detail = await upstream.text(); return json({ error: 'upstream', status: upstream.status, detail: detail.slice(0, 500) }, 502, headers); }
  const data = await upstream.json();
  const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
  return json({ text }, 200, headers);
}

const GRADE_SCHEMA = {
  type: 'object',
  properties: {
    score: { type: 'integer' },
    pass: { type: 'boolean' },
    covered: { type: 'array', items: { type: 'string' } },
    missed: { type: 'array', items: { type: 'string' } },
    feedback: { type: 'string' },
  },
  required: ['score', 'pass', 'covered', 'missed', 'feedback'],
};

async function handleGrade(body, env, headers) {
  if (!env.GEMINI_API_KEY) return json({ error: 'server_not_configured' }, 503, headers);
  const question = typeof body.question === 'string' ? body.question.slice(0, 2000) : '';
  const rubric = typeof body.rubric === 'string' ? body.rubric.slice(0, 2000) : '';
  const answer = typeof body.answer === 'string' ? body.answer.slice(0, 6000) : '';
  const lang = body.lang === 'en' ? 'en' : 'es';
  if (!question || !answer) return json({ error: 'missing_fields' }, 400, headers);

  const system = lang === 'en'
    ? 'You are a strict but fair senior Data Engineering interviewer grading a candidate\'s spoken/written answer to an interview question. Compare the answer against the rubric (the key points a strong answer should cover). score is 0-100; pass is true if score>=65. covered lists points the answer got right; missed lists key rubric points it missed or got wrong; feedback is 2-4 sentences of direct, actionable feedback in the tone of a senior interviewer. Be concrete: reference what was actually said. A short but correct answer can still score well; a long answer that misses the key trade-off should not.'
    : 'Eres un entrevistador senior de Data Engineering, estricto pero justo, calificando la respuesta (escrita) de un candidato a una pregunta de entrevista. Compara la respuesta contra la rúbrica (los puntos clave que debería cubrir una buena respuesta). score es 0-100; pass es true si score>=65. covered son los puntos que la respuesta cubrió bien; missed son puntos clave de la rúbrica que faltaron o estuvieron mal; feedback son 2-4 frases de feedback directo y accionable, en tono de entrevistador senior, en español. Sé concreto: referencia lo que realmente se dijo. Una respuesta corta pero correcta puede calificar bien; una respuesta larga que se salta el trade-off clave no debería.';
  const user = `${lang === 'en' ? 'Question' : 'Pregunta'}: ${question}\n\n${lang === 'en' ? 'Rubric (key points)' : 'Rúbrica (puntos clave)'}: ${rubric}\n\n${lang === 'en' ? 'Candidate answer' : 'Respuesta del candidato'}:\n${answer}`;

  const raw = await callGemini(env, system, user, 700, GRADE_SCHEMA);
  const parsed = extractJson(raw);
  if (!parsed || typeof parsed.score !== 'number') return json({ error: 'bad_model_output', raw: raw.slice(0, 300) }, 502, headers);
  parsed.score = Math.max(0, Math.min(100, Math.round(parsed.score)));
  parsed.pass = typeof parsed.pass === 'boolean' ? parsed.pass : parsed.score >= 65;
  return json(parsed, 200, headers);
}

async function handleRecommend(body, env, headers) {
  if (!env.GEMINI_API_KEY) return json({ error: 'server_not_configured' }, 503, headers);
  const byCat = body.byCat && typeof body.byCat === 'object' ? body.byCat : null;
  const lang = body.lang === 'en' ? 'en' : 'es';
  if (!byCat) return json({ error: 'missing_fields' }, 400, headers);

  const lines = Object.entries(byCat).slice(0, 30).map(([label, o]) => {
    const t = Number(o && o.t) || 0, p = Number(o && o.p) || 0;
    const pct = t ? Math.round((p / t) * 100) : 0;
    return `- ${String(label).slice(0, 80)}: ${p}/${t} (${pct}%)`;
  }).join('\n');
  const pct = typeof body.pct === 'number' ? body.pct : null;

  const system = lang === 'en'
    ? 'You are a Data Engineering interview coach. Given a student\'s per-topic score breakdown from a practice exam, write a short, specific, motivating study recommendation (plain text, no markdown headers, max ~120 words). Name the 2-3 weakest topics by their exact label, say briefly WHY they likely matter in a real DE interview, and suggest a concrete next action (e.g. "redo the Snowflake category at hard difficulty" or "review the Databricks Deep Dive guide section"). If everything is strong, say so and suggest raising difficulty.'
    : 'Eres un coach de entrevistas de Data Engineering. Con el desglose de puntaje por tema de un examen de práctica, escribe una recomendación de estudio corta, específica y motivadora (texto plano, sin encabezados markdown, máx ~120 palabras). Nombra los 2-3 temas más débiles por su etiqueta exacta, di brevemente POR QUÉ suelen importar en una entrevista real de DE, y sugiere una acción concreta siguiente (p.ej. "repite la categoría Snowflake en dificultad difícil" o "repasa la sección Databricks Deep Dive de la guía"). Si todo está sólido, dilo y sugiere subir la dificultad.';
  const user = `${lang === 'en' ? 'Overall score' : 'Puntaje general'}: ${pct != null ? pct + '%' : 'n/a'}\n\n${lang === 'en' ? 'By topic' : 'Por tema'}:\n${lines}`;

  const text = await callGemini(env, system, user, 400);
  return json({ text: text.slice(0, 1200) }, 200, headers);
}

export default {
  async fetch(request, env) {
    const origin = env.ALLOW_ORIGIN || '*';
    const headers = cors(origin);

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return new Response('POST only', { status: 405, headers });

    const ip = request.headers.get('CF-Connecting-IP') || 'anon';

    const clen = Number(request.headers.get('Content-Length') || 0);
    if (clen > 32_000) return json({ error: 'payload_too_large' }, 413, headers);

    let body;
    try { body = await request.json(); } catch { return json({ error: 'bad_json' }, 400, headers); }

    const action = typeof body.action === 'string' ? body.action : 'tutor';

    try {
      if (action === 'tutor') {
        // NOTE: this in-memory limiter is per-isolate and best-effort (it resets
        // when the isolate recycles). For a hard limit across the edge, add a
        // Cloudflare Rate Limiting Rule or a Durable Object / KV counter.
        if (limited(hits, ip, RATE)) return json({ error: 'rate_limited' }, 429, headers);
        return await handleTutor(body, env, headers);
      }
      if (action === 'grade') {
        if (limited(hitsGrade, ip, RATE_GRADE)) return json({ error: 'rate_limited' }, 429, headers);
        return await handleGrade(body, env, headers);
      }
      if (action === 'recommend') {
        if (limited(hitsGrade, ip, RATE_GRADE)) return json({ error: 'rate_limited' }, 429, headers);
        return await handleRecommend(body, env, headers);
      }
      return json({ error: 'unknown_action' }, 400, headers);
    } catch (err) {
      return json({ error: 'upstream', status: err.status || 500, detail: err.detail || String(err.message || err) }, 502, headers);
    }
  },
};
