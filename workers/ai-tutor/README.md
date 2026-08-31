# AI Proxy (Cloudflare Worker)

The browser app must never embed an API key. This Worker proxies all AI
requests, injecting keys from server-side secrets, and adds CORS + a light
per-IP rate limit. One endpoint, routed by an `action` field in the POST
body — each action is independently optional and degrades to a graceful
`503 server_not_configured` (the app keeps working without it) until you set
its key.

| action | Powers | Upstream | Secret |
|---|---|---|---|
| `tutor` (default) | Exercise hint / review | Anthropic | `ANTHROPIC_API_KEY` |
| `grade` | AI-grading of free-text interview answers | Gemini (Google AI Studio) | `GEMINI_API_KEY` |
| `recommend` | Post-exam personalized study recommendation | Gemini (Google AI Studio) | `GEMINI_API_KEY` |

## Cost

- **Hosting: free.** Cloudflare Workers free tier = 100,000 requests/day.
- **Anthropic usage** (tutor) billed per token once `ANTHROPIC_API_KEY` is set.
- **Gemini usage** (grade/recommend) needs a key from
  **[Google AI Studio](https://aistudio.google.com/apikey)** — this is
  *separate* from a consumer Gemini Pro/Advanced app subscription (Google
  One), which does not grant API access. The AI Studio key has its own usage
  tier; check current pricing/free-tier limits at
  https://ai.google.dev/gemini-api/docs/pricing before relying on it being
  $0 — model availability and pricing change over time.
- Until a given secret is set, its action returns `503` and the app falls back
  to a non-AI behavior for that feature — nothing else breaks.

## Deploy

```bash
npm i -g wrangler                       # one-time
cd workers/ai-tutor
wrangler secret put ANTHROPIC_API_KEY   # optional — enables the hint/review tutor
wrangler secret put GEMINI_API_KEY      # optional — enables AI grading + recommendations
wrangler deploy                          # prints https://<name>.<acct>.workers.dev
```

Optionally lock CORS to your site by uncommenting `ALLOW_ORIGIN` in
`wrangler.toml` (already set to the GitHub Pages origin by default).

## Point the app at it

In the deployed app's browser console, once:

```js
localStorage.setItem('ai_endpoint', 'https://<your-worker>.workers.dev')
```

One endpoint serves all three actions. With no `ai_endpoint` set, or if a
given secret isn't configured, the corresponding feature (tutor hint/review,
AI-graded interview questions, post-exam recommendation) falls back to a
local, non-AI behavior — the app never breaks or hangs waiting on the network.

## Request/response shapes

```
POST { action:'tutor', prompt }
  -> { text }

POST { action:'grade', question, rubric, answer, lang }
  -> { score, pass, covered:[...], missed:[...], feedback }

POST { action:'recommend', byCat:{label:{p,t}}, pct, lang }
  -> { text }
```
