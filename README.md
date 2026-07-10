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
- **Gamification** — XP, levels (with a "XP to next level" progress bar), streaks; progress persisted locally.
- **Restricted access with user accounts** — the app is locked behind email + password sign-in (Supabase free tier) **plus an admin-controlled approval flag** (server-enforced via RLS), the foundation for selling access: sign-up is open, access is granted per account (e.g. after payment, with an optional hosted-checkout link on the pending screen). Per-user progress buckets sync across devices with a grow-only merge. See `docs/ACCOUNTS.md`.
- **Progressive unlock** — within each category, medium exercises stay locked until all easy ones are solved, and hard until all medium are. Keeps the difficulty curve honest.
- **Shuffled quiz options** — the correct answer is randomized per attempt (no "always A"), with ✓/✗ marks on each option after grading.

> **151 exercises across 20 categories** (38 SQL · 47 Python · 66 quiz),
> bilingual ES/EN, with the category order prioritizing the highest-signal
> job-market tracks: Advanced SQL, Snowflake, dbt and Python.

## Documentation

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — full technical reference: tech stack & languages, repo structure, and **8 Mermaid diagrams** (execution model, exercise-grading flow, persistence & sync, auth/approval state machine, i18n remap, CI/CD). Start here to understand how it works.
- **[docs/ACCOUNTS.md](docs/ACCOUNTS.md)** — user accounts, the admin approval gate and billing (Supabase setup + SQL).
- **[docs/AUTHORING.md](docs/AUTHORING.md)** — how to add exercises to the `EX` array (no build step).
- **[workers/ai-tutor/README.md](workers/ai-tutor/README.md)** — the optional serverless AI-tutor proxy.

### Training modes
- **Practice** — guided navigation with progressive unlock, per-exercise countdown, instant grading and XP.
- **Exam** — timed assessment: random set filtered by category/difficulty, single global countdown, sequential submit, then a score report with per-topic and per-difficulty accuracy, detected weaknesses, and per-question timing.
- **Stats** — category mastery and a history of past exam attempts to track improvement over time.

## Exercise coverage

| Track | Examples |
|---|---|
| SQL (advanced) | 2nd-highest per group, idempotent dedup, running totals, sessionization (LAG), gap-and-island streaks, **SCD Type 2 build**, NTILE quartiles, percent-of-total window, LEAD gap-to-next, CDC final-state from a changelog |
| **Snowflake (advanced)** | Streams+Tasks CDC, QUALIFY, clustering keys & micro-partition pruning, multi-cluster vs scale-up, Time Travel + zero-copy clone, caching layers, Dynamic Tables, Snowpark, resource monitors, search optimization |
| **dbt (advanced)** | incremental models (`is_incremental` + `unique_key`), snapshots (SCD2), generic vs singular tests, materializations, `ref()`/lineage, source freshness, Jinja/macros, exposures, model contracts, incremental strategies |
| Python + Databases | idempotent upsert (`ON CONFLICT`/MERGE), parametrized queries (anti SQL-injection) |
| Logic / Algorithms | merge intervals, flatten nested JSON, top-K frequent, topological sort (DAG), running median, cosine similarity, text chunking |
| Data Quality / Stats | orphan rows, z-score & PSI drift, data-contract validation, anomaly detection |
| NoSQL | DynamoDB key design & single-table, Cassandra query-first, MongoDB embed-vs-reference, Redis, hot-partition sharding, TTL, consistency |
| Modeling / Architecture | grain, surrogate keys, fact types, conformed dimensions, factless facts, Medallion, CAP, exactly-once |
| **Trends 2025-2026** (guide) | Iceberg vs Delta/Hudi/Paimon + REST catalogs, DuckDB/Polars, Airflow 3/Dagster, data contracts, streaming lakehouse, OpenLineage, RAG/vector DBs |

## Resources & further reading

Curated official documentation and references that back the guide, the exercises
and the trend coverage. Use them to go deeper than the cards.

**SQL & query engines**
- [SQLite window functions](https://www.sqlite.org/windowfunctions.html) · [PostgreSQL docs](https://www.postgresql.org/docs/current/) · [DuckDB docs](https://duckdb.org/docs/) · [Use The Index, Luke](https://use-the-index-luke.com/) (indexing)

**Snowflake**
- [Snowflake Documentation](https://docs.snowflake.com/) · [Streams & Tasks (CDC)](https://docs.snowflake.com/en/user-guide/streams-intro) · [Micro-partitions & clustering](https://docs.snowflake.com/en/user-guide/tables-clustering-micropartitions) · [Dynamic Tables](https://docs.snowflake.com/en/user-guide/dynamic-tables-about) · [Snowpark](https://docs.snowflake.com/en/developer-guide/snowpark/index)

**dbt**
- [dbt Developer Hub](https://docs.getdbt.com/) · [Incremental models](https://docs.getdbt.com/docs/build/incremental-models) · [Snapshots](https://docs.getdbt.com/docs/build/snapshots) · [Tests](https://docs.getdbt.com/docs/build/data-tests) · [Model contracts](https://docs.getdbt.com/docs/collaborate/govern/model-contracts) · [dbt-utils](https://github.com/dbt-labs/dbt-utils)

**Python / dataframes**
- [pandas docs](https://pandas.pydata.org/docs/) · [Polars user guide](https://docs.pola.rs/) · [Pyodide](https://pyodide.org/)

**Open table formats & lakehouse**
- [Apache Iceberg](https://iceberg.apache.org/docs/latest/) · [Iceberg REST catalog spec](https://github.com/apache/iceberg/tree/main/open-api) · [Apache Polaris](https://polaris.apache.org/) · [Delta Lake](https://docs.delta.io/) · [Apache Hudi](https://hudi.apache.org/docs/overview) · [Apache Paimon](https://paimon.apache.org/)

**Streaming, orchestration & lineage**
- [Apache Flink](https://nightlies.apache.org/flink/flink-docs-stable/) · [Apache Kafka](https://kafka.apache.org/documentation/) · [Apache Airflow](https://airflow.apache.org/docs/) · [Dagster](https://docs.dagster.io/) · [OpenLineage](https://openlineage.io/docs/) · [Debezium (CDC)](https://debezium.io/documentation/)

**Data quality, contracts & governance**
- [Great Expectations](https://docs.greatexpectations.io/) · [Soda](https://docs.soda.io/) · [dbt-expectations](https://github.com/calogica/dbt-expectations) · [Data Contract Spec](https://datacontract.com/)

**NoSQL**
- [DynamoDB best practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html) · [Cassandra data modeling](https://cassandra.apache.org/doc/latest/cassandra/developing/data-modeling/index.html) · [MongoDB data modeling](https://www.mongodb.com/docs/manual/data-modeling/) · [Redis docs](https://redis.io/docs/latest/)

**AI / RAG for DE**
- [Anthropic docs](https://docs.anthropic.com/) · [LangChain](https://python.langchain.com/docs/) · [pgvector](https://github.com/pgvector/pgvector)

**Canonical books / references**
- Kimball — *The Data Warehouse Toolkit* (dimensional modeling) · Kleppmann — *Designing Data-Intensive Applications* · Reis & Housley — *Fundamentals of Data Engineering*

**Trend reading (2025–2026)** — [Where DE is heading (Joe Reis)](https://joereis.substack.com/p/where-data-engineering-is-heading) · [Single-node DE: DuckDB/Polars (Alex Merced)](https://iceberglakehouse.com/posts/2026-05-23-single-node-data-engineering-duckdb-datafusion-polars-lakesail/) · [2025/2026 Lakehouse guide](https://datalakehousehub.com/blog/2025-09-2026-guide-to-data-lakehouses/)

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
- **Thin backend.** Hosting stays free on Pages; accounts + cross-device sync run on a free Supabase project via its REST API (no SDK), with an offline guest mode when signed out — see `docs/ACCOUNTS.md`. Leaderboards and payments would still need a fuller backend.

## Roadmap

- Per-exercise **extra hidden datasets** for stronger grading.
- Author exercises from JSON files + a contribution flow (see `docs/AUTHORING.md`).
- Spaced-repetition: resurface weak categories automatically.
- Optional backend for leaderboards (AI-tutor proxy ✅ · accounts & cross-device sync ✅ — see `workers/ai-tutor/` and `docs/ACCOUNTS.md`).

## Tech

Vanilla JS · CodeMirror · sql.js (SQLite WASM) · Pyodide · GitHub Pages. No framework, no build step.

## License

MIT — see [LICENSE](LICENSE).
