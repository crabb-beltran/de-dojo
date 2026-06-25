/**
 * Exercise validator — content integrity gate for DE Dojo.
 *
 * Extracts the EX (exercises), EN (English overlay), CAT and CATMAP literals
 * straight out of index.html and checks, with NO running browser:
 *   - every exercise has the fields its kind needs to render and grade
 *   - every quiz has exactly one correct option
 *   - every exercise category maps to a known CAT key
 *   - every exercise has an EN translation overlay (so EN mode is complete)
 *   - every SQL reference query executes on each of its datasets (via sql.js)
 *
 * Run:  node test/validate.mjs
 * Exits non-zero on any failure (used by CI).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(root, 'index.html'), 'utf8');

// --- pull the data literals out of the single-file app -------------------
function slice(from, toMarker) {
  const a = html.indexOf(from);
  const b = html.indexOf(toMarker, a);
  if (a < 0 || b < 0) throw new Error(`could not locate ${from} .. ${toMarker}`);
  return html.slice(a, b);
}
// S(), EX, EN, CATMAP, CAT all live between `function S(` and `function fld(`.
const src = slice('function S(', 'function fld(');
const sandbox = { document: {}, window: {}, console, Array, Object, JSON };
vm.createContext(sandbox);
vm.runInContext(src + '\n;Object.assign(globalThis,{EX,EN,CATMAP,CAT,S});', sandbox);
const { EX, EN, CATMAP, CAT } = sandbox;
const catKeys = new Set(CAT.map(c => c.k));

const errors = [];
const warns = [];
const fail = (id, m) => errors.push(`✗ [${id}] ${m}`);
const warn = (id, m) => warns.push(`! [${id}] ${m}`);

// --- structural checks ---------------------------------------------------
const seen = new Set();
for (const e of EX) {
  const id = e.id || '(no id)';
  if (!e.id) fail(id, 'missing id');
  if (seen.has(e.id)) fail(id, 'duplicate id');
  seen.add(e.id);
  for (const f of ['cat', 'kind', 'title', 'diff', 'xp']) if (e[f] == null) fail(id, `missing field "${f}"`);
  if (!['e', 'm', 'h'].includes(e.diff)) fail(id, `diff must be e|m|h, got "${e.diff}"`);
  if (e.cat == null) { /* already reported */ }
  else {
    // mirrors app catKey(): CATMAP label -> key, else cat is itself a key
    const key = CATMAP[e.cat] || e.cat;
    if (!catKeys.has(key)) fail(id, `cat "${e.cat}" resolves to unknown key "${key}"`);
  }

  if (e.kind === 'sql') {
    if (!e.ref) fail(id, 'sql exercise missing ref query');
    if (!Array.isArray(e.datasets) || !e.datasets.length) fail(id, 'sql exercise needs datasets[]');
    if (!e.starter) warn(id, 'sql exercise has no starter');
  } else if (e.kind === 'python') {
    if (!e.pytests) fail(id, 'python exercise missing pytests');
    else if (!/cases\s*=/.test(e.pytests)) fail(id, 'pytests must define a `cases` list');
    if (!e.starter) fail(id, 'python exercise missing starter');
  } else if (e.kind === 'quiz') {
    if (!Array.isArray(e.options) || e.options.length < 2) fail(id, 'quiz needs >=2 options');
    else {
      const ok = e.options.filter(o => o.ok).length;
      if (ok !== 1) fail(id, `quiz must have exactly one correct option, has ${ok}`);
    }
    if (!e.explain) warn(id, 'quiz has no explain text');
  } else {
    fail(id, `unknown kind "${e.kind}"`);
  }

  // translation completeness: either an EN overlay or inline {es,en} title
  const inlineBilingual = e.title && typeof e.title === 'object' && 'en' in e.title;
  if (!EN[e.id] && !inlineBilingual) warn(id, 'no EN translation (overlay or inline {es,en})');
  else if (EN[e.id] && e.kind === 'quiz' && !EN[e.id].options) warn(id, 'EN overlay missing quiz options');
}

// --- live SQL check: every ref must execute on every dataset -------------
const sqlEx = EX.filter(e => e.kind === 'sql' && e.ref && Array.isArray(e.datasets));
const initSqlJs = require(join(root, 'test', 'node_modules', 'sql.js'));
const SQL = await initSqlJs();
for (const e of sqlEx) {
  e.datasets.forEach((ds, i) => {
    const db = new SQL.Database();
    try {
      db.run(ds);
      db.exec(e.ref); // throws if the reference query is invalid
    } catch (err) {
      fail(e.id, `ref failed on dataset ${i + 1}: ${err.message}`);
    } finally {
      db.close();
    }
  });
}

// --- report --------------------------------------------------------------
const kinds = EX.reduce((a, e) => ((a[e.kind] = (a[e.kind] || 0) + 1), a), {});
console.log(`Validated ${EX.length} exercises:`, JSON.stringify(kinds));
console.log(`SQL refs executed: ${sqlEx.length} × datasets`);
if (warns.length) { console.log(`\n${warns.length} warning(s):`); warns.forEach(w => console.log('  ' + w)); }
if (errors.length) {
  console.error(`\n${errors.length} error(s):`);
  errors.forEach(e => console.error('  ' + e));
  process.exit(1);
}
console.log('\n✓ All exercises valid.');
