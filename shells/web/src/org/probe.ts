// SPDX-License-Identifier: MPL-2.0
/**
 * The control-plane PROBE, and the boot entry point that stands in front of the
 * rest of org/.
 *
 * `org/index.ts` documents the seam; this file is the first two steps of it, split
 * out so a deployment with no control plane - which is every public one - never
 * loads the other 47 KB. Boot calls {@link initOrgProbeFirst}, which answers the
 * dormant case from a localStorage negative cache or one tolerant 404 and returns
 * `null` without ever importing the rest; only a deployment that actually
 * answers `/api/auth/config` pays for the session/gate/policy/injectable code
 * (plans/155 WP-3).
 *
 * WHY THE PROBE ITSELF STAYS EAGER. It has to run during boot - the gate decides
 * whether a view mounts at all - so making the fetch lazy would only move the cost
 * to a chunk request in front of first paint, which is the opposite of the point.
 * What is deferred is the code that INTERPRETS a control plane's answer.
 *
 * The tolerance contract is unchanged, and everything depends on it: nothing throws to
 * boot, every failure reads as dormancy, and the negative cache is an acceleration
 * only - never a source of truth, and self-healing once its TTL expires.
 *
 * WHAT GETS REMEMBERED. Dormancy for this boot and dormancy for the next six hours
 * are different claims. Any failure gives the first. Only a definitive "nothing
 * here" gives the second: a 2xx that is not JSON (the SPA's own HTML) or a 404/405
 * from a static host. A timeout, a network error or a 5xx says nothing about the
 * origin (a control plane on a cold start with migrations can take longer than a
 * second to answer), so it is not cached, and the next boot probes again.
 *
 * WHAT A STALLED NETWORK COSTS. The first probe may use the whole long budget, so
 * a cold start has time to answer. When it times out, a short-lived note says so,
 * and boots in the next few minutes probe with the short budget: the long request
 * will have woken a cold function, and a network that swallows requests does not
 * hold every boot for five seconds. The note is not a negative and is cleared by
 * any answer. A network error fails at once (an offline device) and is not
 * retried, so it adds no wait; only a 5xx, the cold start and migration signal,
 * is asked again.
 */
import { instanceFetch, instancePath, getInstanceBase } from '../lib/instance.ts';
import type { AuthConfig, OrgState } from './index.ts';
import { beginAiProbe, finishAiProbe, knownManagedAi } from './ai-policy.ts';

/** Short budget for the org seam's small control-plane calls (the device sign-in
 *  start uses four times this). The boot probe has its own, longer budget below. */
export const PROBE_TIMEOUT_MS = 1500;
/** Total budget for the boot probe of `/api/auth/config`, retry included. Long
 *  enough for a cold start to answer; a hung network delays boot by at most this.
 *  A deployment with no control plane answers at once (404, or the SPA's HTML),
 *  so the dormant path still costs one quick request. */
export const AUTH_PROBE_BUDGET_MS = 5000;
/** After a probe that got no answer, later boots use {@link PROBE_TIMEOUT_MS}
 *  instead of the long budget for this long. */
const UNANSWERED_TTL_MS = 10 * 60 * 1000; // 10 min
/** A retry is only worth starting with at least this much of the budget left. */
const AUTH_PROBE_RETRY_MIN_MS = 1000;
/** Pause before the single retry, so a function that just failed can settle. */
const AUTH_PROBE_RETRY_DELAY_MS = 250;
/** localStorage negative-cache TTL (per instance base). Optional acceleration
 *  only: it lets a known-dormant origin skip even the one probe on later boots,
 *  and self-heals - if a deployment later gains a control plane, it is seen once
 *  the cached negative expires. Never on the critical path for correctness. */
const ABSENT_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const absentKey = (): string => `lolly:org-absent:${getInstanceBase() || 'same-origin'}`;
const unansweredKey = (): string => `lolly:org-probe-unanswered:${getInstanceBase() || 'same-origin'}`;

/** instanceFetch with an optional time box. Never rejects: `res` is null on any
 *  failure, and `timedOut` tells a spent budget apart from an instant error. A
 *  budget of zero or less aborts at once; only an omitted one means no limit. */
async function fetchWithin(path: string, init: RequestInit | undefined, timeoutMs: number | undefined): Promise<{ res: Response | null; timedOut: boolean }> {
  const ctrl = timeoutMs === undefined ? null : new AbortController();
  const timer = ctrl ? setTimeout(() => ctrl.abort(), Math.max(1, timeoutMs ?? 0)) : null;
  try {
    return { res: await instanceFetch(instancePath(path), ctrl ? { ...init, signal: ctrl.signal } : init), timedOut: false };
  } catch {
    return { res: null, timedOut: !!ctrl?.signal.aborted };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** A time-boxed instanceFetch that never rejects - resolves null on any failure
 *  (network error, abort, thrown). */
export async function safeFetch(path: string, init?: RequestInit, timeoutMs?: number): Promise<Response | null> {
  return (await fetchWithin(path, init, timeoutMs)).res;
}

/** Parse a JSON body only when the response looks like real JSON - a 200 that is
 *  actually an SPA-fallback HTML page (a misrouted /api on a static host) is
 *  rejected, so it can never be mistaken for a control-plane reply. */
export async function jsonBody<T>(res: Response | null): Promise<T | null> {
  if (!res || !res.ok) return null;
  const ct = res.headers.get('content-type') || '';
  if (!/\bjson\b/i.test(ct)) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function isAuthConfig(v: unknown): v is AuthConfig {
  return !!v && typeof v === 'object'
    && ['open', 'gated', 'per-tool'].includes((v as AuthConfig).mode);
}

/** The boot probe's answer. `auth` is the control plane's config, or null for
 *  dormancy. `absent` is true only when the origin definitively has no control
 *  plane, which is the one case worth remembering across boots. */
export interface AuthProbeResult {
  auth: AuthConfig | null;
  absent: boolean;
}

/** Read one probe response. `retry` marks a 5xx, a server that may be starting
 *  up, so asking again can help. No response at all is not retried: a timeout
 *  has spent the budget, and a network error fails again just as fast. */
async function readProbeResponse(res: Response | null): Promise<AuthProbeResult & { retry: boolean }> {
  if (!res) return { auth: null, absent: false, retry: false };             // timeout / network error
  if (res.status >= 500) return { auth: null, absent: false, retry: true }; // server error, maybe a cold start
  if (res.status === 404 || res.status === 405) return { auth: null, absent: true, retry: false };
  if (!res.ok) return { auth: null, absent: false, retry: false };          // 401, 403, 429: a proxy, not an answer
  const ct = res.headers.get('content-type') || '';
  if (!/\bjson\b/i.test(ct)) return { auth: null, absent: true, retry: false }; // the SPA's own HTML
  const cfg = await jsonBody<AuthConfig>(res);
  if (isAuthConfig(cfg)) return { auth: cfg, absent: false, retry: false };
  return { auth: null, absent: false, retry: false };                       // JSON, but not ours
}

/**
 * Probe for a control plane, telling a definitive "none here" apart from a probe
 * that simply did not get an answer. One request in the usual case; one retry
 * only after a 5xx, and only while enough of the budget is left, so boot never
 * waits longer than {@link AUTH_PROBE_BUDGET_MS}. Within a few minutes of a probe
 * that got no answer, the budget is {@link PROBE_TIMEOUT_MS} instead.
 */
export async function probeInstance(): Promise<AuthProbeResult> {
  const long = !recentlyUnanswered();
  const budget = long ? AUTH_PROBE_BUDGET_MS : PROBE_TIMEOUT_MS;
  const deadline = Date.now() + budget;
  let attempt = await fetchWithin('/api/auth/config', undefined, budget);
  let r = await readProbeResponse(attempt.res);
  if (r.retry && deadline - Date.now() - AUTH_PROBE_RETRY_DELAY_MS >= AUTH_PROBE_RETRY_MIN_MS) {
    await new Promise(resolve => setTimeout(resolve, AUTH_PROBE_RETRY_DELAY_MS));
    // Measured again after the pause: a busy page can run the timer late.
    const left = deadline - Date.now();
    if (left >= AUTH_PROBE_RETRY_MIN_MS / 2) {
      attempt = await fetchWithin('/api/auth/config', undefined, left);
      r = await readProbeResponse(attempt.res);
    }
  }
  if (attempt.res) forgetUnanswered();
  else if (attempt.timedOut && long) rememberUnanswered();
  return { auth: r.auth, absent: r.absent };
}

function recentlyUnanswered(): boolean {
  try {
    const at = Number(localStorage.getItem(unansweredKey()));
    return at > 0 && Date.now() - at < UNANSWERED_TTL_MS;
  } catch { return false; }
}

function rememberUnanswered(): void {
  try { localStorage.setItem(unansweredKey(), String(Date.now())); } catch { /* ignore */ }
}

function forgetUnanswered(): void {
  try { localStorage.removeItem(unansweredKey()); } catch { /* ignore */ }
}

/** Probe for a control plane. Returns its auth config, or null (dormant). */
export async function probeAuthConfig(): Promise<AuthConfig | null> {
  return (await probeInstance()).auth;
}

export function isRecentlyAbsent(): boolean {
  try {
    const raw = localStorage.getItem(absentKey());
    if (!raw) return false;
    const at = Number(raw);
    if (Number.isFinite(at) && Date.now() - at < ABSENT_TTL_MS) return true;
    localStorage.removeItem(absentKey());
  } catch { /* storage unavailable - just probe */ }
  return false;
}

export function rememberAbsent(): void {
  try { localStorage.setItem(absentKey(), String(Date.now())); } catch { /* ignore */ }
}

/**
 * Boot's entry to the org seam: the same three outcomes `initOrg()` documents
 * (`null` dormant, `gate: true` stop boot, `gate: false` proceed), reached without
 * loading org/index.ts unless a control plane actually answered.
 *
 * The dormant paths return before the import, so the module graph a public
 * deployment executes is this file and nothing beneath it. Tolerant by
 * construction, exactly like initOrg: a failure anywhere reads as dormancy, and a
 * chunk that will not load is a control plane we cannot honour - the same
 * situation as a probe that times out.
 */
export async function initOrgProbeFirst(): Promise<OrgState | null> {
  beginAiProbe();
  try {
    if (!knownManagedAi() && isRecentlyAbsent()) { finishAiProbe(false); return null; }
    const { auth, absent } = await probeInstance();
    if (!auth) { finishAiProbe(false); if (absent) rememberAbsent(); return null; }
    finishAiProbe(true);
    const org = await import('./index.ts');
    return await org.initOrgWithAuth(auth);
  } catch {
    return null;
  }
}
