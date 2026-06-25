# DE Dojo — Data Engineering practice with real test cases

A browser-based training platform to **practice and self-assess Data Engineering skills** with executable exercises and per-test-case grading — a mix of HackerRank/Coderbyte rigor and an interview-prep roadmap. No backend, no install: it runs as a single static page and deploys to GitHub Pages.

> Built as a portfolio + skill-sharpening tool covering the topics that show up in senior DE interviews: advanced SQL, dbt/data-quality patterns, dataframe wrangling, database access patterns, statistics for DE, modeling (SCD/Medallion), and architecture trade-offs.

## What it does

- **Executable SQL** — your query runs in a real SQLite engine (`sql.js`, WASM) against seeded tables. Output is graded against a reference solution over one or more hidden datasets (set-based comparison, order-aware when the task requires `ORDER BY`).
- **Executable Python** — runs in-browser via Pyodide. Exercises ship a hidden test harness (asserts) and report pass/fail per case. Covers stdlib logic, `pandas` dataframes, and `sqlite3` database access.
- **Concept drills** — multiple-choice trade-off questions (Kafka vs Kinesis, SCD types, CAP/NoSQL, skew vs compute) graded against an answer key with explanations.
- **Countdown timer** per exercise (interview pressure). Solving after time-up yields ½ XP.
- **Visible sources** — every exercise shows the table schemas and sample rows so you reason from the actual data.
- **AI tutor** — optional hint / senior-level code review. Ships with a free serverless proxy (Cloudflare Worker, see `workers/ai-tutor/`) so the key stays server-side; falls back gracefully when no endpoint is configured.
- **Gamification** — XP, levels, streaks; progress persisted locally.

### Training modes
- **Practice** — free navigation, per-exercise countdown, instant grading and XP.
- **Exam** — timed assessment: random set filtered by category/difficulty, single global countdown, sequential submit, then a score report with per-topic and per-difficulty accuracy, detected weaknesses, and per-question timing.
- **Stats** — category mastery and a history of past exam attempts to track improvement over time.

## Exercise coverage

| Track | Examples |
|---|---|
| SQL (advanced) | 2nd-highest per group, idempotent dedup, running totals, sessionization (LAG), gap-and-island streaks, **SCD Type 2 build**, funnel conversion, median without `PERCENTILE_CONT`, pivot |
| Data Quality | referential-integrity (orphan rows), z-score anomaly detection, data-contract validation |
| pandas / DataFrames | cleaning (dedupe + fillna + cast), groupby aggregation, source-to-target reconciliation |
| Python + Databases | idempotent upsert (`ON CONFLICT`), parametrized queries (anti SQL-injection) |
| Logic / Algorithms | merge overlapping intervals, flatten nested JSON, top-K frequent (heavy hitters) |
| Architecture / Stats | Medallion layers, skew vs compute, broadcast joins, NoSQL/CAP, SCD 1 vs 2 |

## Run locally

It's a single static file. Any static server works:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Opening `index.html` via `file://` also works, except the AI tutor and (in some browsers) the Python runtime, which need an `http(s)` origin.

## Testing / content validation

Exercise content is gated by a validator that runs in CI on every push
(`.github/workflows/validate.yml`, free GitHub Actions):

```bash
cd test && npm install && node validate.mjs
```

It extracts the `EX`/`EN` data straight from `index.html` and checks: required
fields per kind, exactly one correct answer per quiz, valid category mapping,
translation completeness, and — using `sql.js` — that **every SQL reference
query actually executes** on each of its datasets. Broken content fails the
build instead of shipping.

## AI tutor proxy (optional, free to host)

`workers/ai-tutor/` is a Cloudflare Worker (free tier) that proxies the tutor to
the Anthropic API with a server-side key. Hosting is free; the only cost is
Anthropic usage, and only once you add a key. See `workers/ai-tutor/README.md`.
Point the app at it with `localStorage.setItem('ai_endpoint', '<worker-url>')`.

## Deploy (GitHub Pages)

Pushing to `main` triggers `.github/workflows/pages.yml`, which publishes the site. Then enable Pages in **Settings → Pages → Source: GitHub Actions**. Live URL: `https://<user>.github.io/<repo>/`.

## Architecture notes (trade-offs)

- **SQLite dialect for SQL.** Window functions, CTEs, `LAG/LEAD`, anti-joins and the islands trick all work. Engine-specific syntax (`QUALIFY`, `MERGE`, Snowflake time-travel) is intentionally taught via concept drills instead of execution. Trade-off: real execution vs. dialect portability in the browser.
- **Pyodide loads from a CDN (~6 MB, lazy).** If the host sandbox blocks it, Python exercises degrade gracefully to "reveal solution / AI review" without breaking the app.
- **No backend by design.** Keeps it free to host on Pages. Multi-user accounts, leaderboards and payments would require a real backend (Supabase/Postgres + auth) — see roadmap.

## Roadmap

- Per-exercise **extra hidden datasets** for stronger grading.
- Author exercises from JSON files + a contribution flow (see `docs/AUTHORING.md`).
- Spaced-repetition: resurface weak categories automatically.
- Optional backend for accounts/leaderboards (AI-tutor proxy ✅ done — see `workers/ai-tutor/`).

## Tech

Vanilla JS · CodeMirror · sql.js (SQLite WASM) · Pyodide · GitHub Pages. No framework, no build step.

## License

MIT — see [LICENSE](LICENSE).
