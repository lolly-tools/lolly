/**
 * Local usage metrics — tiny vanity counters for the profile page.
 *
 * Deliberately the cheapest thing that tells a story:
 *   • a single bounded JSON blob (a handful of ints + two small maps), never a
 *     growing log, so it can't bloat over time;
 *   • kept in localStorage (NOT the profile record) — synchronous, no IndexedDB
 *     churn, and no profile-subscriber notifications firing on every increment;
 *   • mutated in memory and flushed *debounced* + on tab-hide, so even a
 *     per-keystroke caller would cost one write per burst, not per event.
 *
 * Everything is local-only — nothing here is ever sent anywhere, which is also
 * the nicest line on the profile card. Delete this file + its call sites to
 * remove the feature entirely.
 */

const KEY = 'ct-metrics';
const FLUSH_MS = 4000;

let data = null;
let dirty = false;
let timer = 0;

function normalize(d) {
  d = d && typeof d === 'object' ? d : {};
  const obj = (o) => (o && typeof o === 'object' ? o : {});
  return {
    v: 1,
    since: Number.isFinite(d.since) ? d.since : Date.now(),
    tools: obj(d.tools),         // { toolId: openCount } — bounded by the catalog
    formats: obj(d.formats),     // { png: n, jpg: n, … } — bounded set of formats
    filesRendered: d.filesRendered | 0,
    linksCopied: d.linksCopied | 0,
    imagesCopied: d.imagesCopied | 0,
    batchRuns: d.batchRuns | 0,
    batchFiles: d.batchFiles | 0,
    biggestBatch: d.biggestBatch | 0,
  };
}

function load() {
  if (data) return data;
  let parsed = null;
  try { parsed = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* ignore */ }
  data = normalize(parsed);
  return data;
}

function flush() {
  timer = 0;
  if (!dirty || !data) return;
  dirty = false;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota / disabled */ }
}

function schedule() {
  dirty = true;
  if (!timer) timer = setTimeout(flush, FLUSH_MS);
}

// Persist promptly when the tab is backgrounded or closed so nothing is lost.
if (typeof window !== 'undefined') {
  const flushNow = () => { if (timer) { clearTimeout(timer); timer = 0; } flush(); };
  window.addEventListener('pagehide', flushNow);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flushNow(); });
}

/** Increment a flat integer counter (filesRendered, linksCopied, …). */
export function bumpMetric(key, n = 1) {
  const d = load();
  if (typeof d[key] === 'number') { d[key] += n; schedule(); }
}

/** Record one (or n) exports of a given format for the leaderboard. */
export function recordFormat(fmt, n = 1) {
  if (!fmt) return;
  const d = load();
  const k = String(fmt).toLowerCase();
  d.formats[k] = (d.formats[k] | 0) + n;
  schedule();
}

/** Record a tool being opened (powers total opens, unique tools, favourite). */
export function recordTool(id) {
  if (!id) return;
  const d = load();
  d.tools[id] = (d.tools[id] | 0) + 1;
  schedule();
}

/** Record one finished batch of `count` files (run count, total, record size). */
export function recordBatch(count) {
  const d = load();
  const n = count | 0;
  d.batchRuns += 1;
  d.batchFiles += n;
  if (n > d.biggestBatch) d.biggestBatch = n;
  schedule();
}

/** Snapshot for the profile view, with a few derived fields. */
export function getMetrics() {
  const d = load();
  const toolOpens = Object.values(d.tools).reduce((s, n) => s + n, 0);
  let favTool = null, favCount = 0;
  for (const [id, c] of Object.entries(d.tools)) if (c > favCount) { favTool = id; favCount = c; }
  return { ...d, toolOpens, uniqueTools: Object.keys(d.tools).length, favTool, favCount };
}
