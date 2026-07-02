// SPDX-License-Identifier: MPL-2.0
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

/** The flat integer counters bumpMetric can touch. */
export type MetricCounter =
  | 'filesRendered' | 'linksCopied' | 'imagesCopied'
  | 'batchRuns' | 'batchFiles' | 'biggestBatch';

export interface MetricsData {
  v: 1;
  since: number;
  /** { toolId: openCount } — bounded by the catalog */
  tools: Record<string, number>;
  /** { png: n, jpg: n, … } — bounded set of formats */
  formats: Record<string, number>;
  filesRendered: number;
  linksCopied: number;
  imagesCopied: number;
  batchRuns: number;
  batchFiles: number;
  biggestBatch: number;
}

export interface MetricsSnapshot extends MetricsData {
  toolOpens: number;
  uniqueTools: number;
  favTool: string | null;
  favCount: number;
}

let data: MetricsData | null = null;
let dirty = false;
let timer: ReturnType<typeof setTimeout> | 0 = 0;

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// Narrow the untrusted localStorage JSON at the boundary.
function normalize(raw: unknown): MetricsData {
  const d: Record<string, unknown> = isRecord(raw) ? raw : {};
  const num = (v: unknown): number => (typeof v === 'number' ? v | 0 : 0);
  const counts = (o: unknown): Record<string, number> => {
    if (!isRecord(o)) return {};
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) out[k] = num(v);
    return out;
  };
  return {
    v: 1,
    since: typeof d.since === 'number' && Number.isFinite(d.since) ? d.since : Date.now(),
    tools: counts(d.tools),
    formats: counts(d.formats),
    filesRendered: num(d.filesRendered),
    linksCopied: num(d.linksCopied),
    imagesCopied: num(d.imagesCopied),
    batchRuns: num(d.batchRuns),
    batchFiles: num(d.batchFiles),
    biggestBatch: num(d.biggestBatch),
  };
}

function load(): MetricsData {
  if (data) return data;
  let parsed: unknown = null;
  try { parsed = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { /* ignore */ }
  data = normalize(parsed);
  return data;
}

function flush(): void {
  timer = 0;
  if (!dirty || !data) return;
  dirty = false;
  try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* quota / disabled */ }
}

function schedule(): void {
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
export function bumpMetric(key: MetricCounter, n = 1): void {
  const d = load();
  if (typeof d[key] === 'number') { d[key] += n; schedule(); }
}

/** Record one (or n) exports of a given format for the leaderboard. */
export function recordFormat(fmt: string | null | undefined, n = 1): void {
  if (!fmt) return;
  const d = load();
  const k = String(fmt).toLowerCase();
  d.formats[k] = (d.formats[k] ?? 0) + n;
  schedule();
}

/** Record a tool being opened (powers total opens, unique tools, favourite). */
export function recordTool(id: string | null | undefined): void {
  if (!id) return;
  const d = load();
  d.tools[id] = (d.tools[id] ?? 0) + 1;
  schedule();
}

/** Record one finished batch of `count` files (run count, total, record size). */
export function recordBatch(count: number): void {
  const d = load();
  const n = count | 0;
  d.batchRuns += 1;
  d.batchFiles += n;
  if (n > d.biggestBatch) d.biggestBatch = n;
  schedule();
}

/** Snapshot for the profile view, with a few derived fields. */
export function getMetrics(): MetricsSnapshot {
  const d = load();
  const toolOpens = Object.values(d.tools).reduce((s, n) => s + n, 0);
  let favTool: string | null = null, favCount = 0;
  for (const [id, c] of Object.entries(d.tools)) if (c > favCount) { favTool = id; favCount = c; }
  return { ...d, toolOpens, uniqueTools: Object.keys(d.tools).length, favTool, favCount };
}
