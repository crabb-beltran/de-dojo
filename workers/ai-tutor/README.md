# AI Tutor Proxy (Cloudflare Worker)

The browser app must never embed an Anthropic API key. This Worker proxies the
tutor's requests, injecting the key from a server-side secret, and adds CORS +
a light per-IP rate limit.

## Cost

- **Hosting: free.** Cloudflare Workers free tier = 100,000 requests/day.
- **Only cost = Anthropic usage**, billed per token *when you add a key*. Until
  you set `ANTHROPIC_API_KEY`, the Worker returns `503 server_not_configured`
  and the app keeps working without the tutor.

## Deploy

```bash
npm i -g wrangler            # one-time
cd workers/ai-tutor
wrangler secret put ANTHROPIC_API_KEY   # paste your key
wrangler deploy                          # prints https://<name>.<acct>.workers.dev
```

Optionally lock CORS to your site by uncommenting `ALLOW_ORIGIN` in
`wrangler.toml`.

## Point the app at it

In the deployed app's browser console, once:

```js
localStorage.setItem('ai_endpoint', 'https://<your-worker>.workers.dev')
```

The app posts `{ prompt }`; the Worker returns `{ text }`. With no
`ai_endpoint` set, the app falls back to a direct call (works only inside hosts
that inject auth, e.g. the Claude preview) — so nothing breaks before you deploy.
