# Authoring exercises

All exercises live in the `EX` array inside `index.html` (`<script>` block). Adding one = appending one object. No build step.

Three `kind`s: `sql`, `python`, `quiz`. Shared fields:

```js
{
  id:'unique_id',                 // stable, used for progress
  cat:'D · SQL avanzado',         // grouping label in the left rail
  kind:'sql',                     // 'sql' | 'python' | 'quiz'
  diff:'m',                       // 'e' easy | 'm' medium | 'h' hard
  xp:20,                          // points awarded
  timer:900,                      // optional; default by diff (e:480, m:900, h:1500)
  title:'…', tags:'window · LAG',
  context:'business framing (HTML ok)',
  task:'precise instruction (HTML ok)',
  bullets:['requirement 1','requirement 2'],
  sources:[ S('table', ['col1','col2'], [[1,'a'],[2,'b']], 'optional note') ],
  expected:'sample of expected output (plain text)',
}
```

`S(name, cols, rows, note?)` is a helper that renders a sample-data table in the problem panel. Keep it to ~3–5 rows.

## SQL exercises

```js
datasets:[ `CREATE TABLE t(...); INSERT INTO t VALUES (...);`,  /* dataset 2 (hidden) */ ],
ref:`SELECT ...`,        // reference solution; grading compares user output to this
starter:`SELECT ... ;`   // pre-filled editor
```

Grading runs `ref` and the user's query on **each** dataset and compares result sets. Comparison is order-insensitive **unless** `ref` contains `ORDER BY` (then order matters). Add extra datasets to harden against hardcoding. Dialect = SQLite (window functions, CTEs, `LAG/LEAD`, `julianday`, `ON CONFLICT` available; no `QUALIFY`/`MERGE`).

## Python exercises

```js
pyPackages:['pandas'],   // optional; loaded via pyodide.loadPackage before run
starter:`def solve(...):\n    ...\n`,
pytests:`
cases=[]
def chk(n,got,exp): cases.append({"name":n,"ok":got==exp,"got":repr(got),"expected":repr(exp)})
chk("case 1", solve(...), expected)
`
```

The harness must build a `cases` list of `{name, ok, got, expected}`. The engine appends `print("__RESULTS__"+json.dumps(cases))` and parses it. For pandas, normalize before comparing, e.g. `json.loads(df.to_json(orient="records"))`. For `sqlite3`, create the connection/tables inside `pytests`, call the user's function, then assert on a `SELECT`.

## Quiz exercises

```js
options:[ {t:'option A', ok:false}, {t:'correct one', ok:true}, ... ],
explain:'why the right answer is right (shown after answering)',
```

## Conventions

- Spanish in `context`/`task`/`bullets`; English in code/identifiers.
- One concept per exercise; name the trade-off when there is one.
- Validate reference solutions before committing (run them in a local Python/SQLite to confirm expected values).
