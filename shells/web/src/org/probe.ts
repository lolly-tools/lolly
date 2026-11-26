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
 *
 * THE LAST ANSWER (plan 371, decided 2026-11-20). Separately from the six-hour
 * skip, every definitive answer is written down with its time: "no control
 * plane" or "a control plane". Boot reads it before the first route: when the
 * last answer for this origin and instance base was "no control plane", given
 * within {@link CLEAN_ANSWER_TTL_MS}, the browse routes (gallery, utilities, docs)
 * paint while the probe runs, every other route waits for its answer, and a gate that
 * arrives after all replaces the view (lib/late-gate.ts).
 * Anything else waits as before: no record, a control plane, a damaged or future
 * time stamp, or a device that has met a control plane anywhere on this origin
 * (saved work is kept per origin, so it may hold an account's work). A probe that
 * got no answer writes nothing, so it can never stand in for "no control plane".
 *
 * A GATED ORIGIN STAYS GATED (plan 371). A probe that runs out of time, or meets a
 * server error, says nothing about whether a gate is there. When the last answer for
 * this origin and base was a control plane that is not open to everyone (gated or
 * per tool, or a record from before the mode was written down), boot does not take
 * that silence for "no control plane": it keeps the waiting screen up and asks again,
 * further apart each time ({@link GATED_RETRY_DELAYS_MS}), with the long budget, until
 * a real answer arrives. Two tabs that boot together on a slow control plane share
 * one connection pool, so the second tab's request can wait behind the first tab's
 * downloads; every definitive answer is therefore also sent to the other tabs of this
 * origin, and a tab still waiting takes the first answer that arrives, its own or
 * another tab's. An origin that never had a control plane is not affected: it paints
 * at once as before. A request that fails at once (an offline device) is not retried
 * either: it boots as it always has.
 */
import { getInstanceBase } from '../lib/instance.ts';
import { fetchWithin, jsonBody } from '../lib/instance-json.ts';
export { safeFetch, jsonBody } from '../lib/instance-json.ts';
import type { AuthConfig, OrgState } from './index.ts';
import { beginAiProbe, finishAiProbe, knownManagedAi } from './ai-policy.ts';
import { settleWorkspaceCompany } from '../lib/workspace-templates.ts';

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
/**
 * How long a remembered "no control plane" lets boot paint before the probe answers.
 * Every boot past the six-hour skip still probes, and a gate replaces the view as soon
 * as it answers, so this lifetime does not decide how long a new gate can be missed
 * (one probe round trip at most). It decides how old a prediction may be and still be
 * acted on: a month covers people who come back weekly or monthly, while a device away
 * for longer waits for one probe, as every device did before.
 */
export const CLEAN_ANSWER_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
/** A stored time further ahead of the clock than this is not believed. */
const CLOCK_SKEW_MS = 60 * 1000;
/** localStorage is already per origin; the origin is in the key as well so the record
 *  says what it is about, beside the instance base that the probe asks. */
const lastAnswerKey = (): string => `lolly:org-last-answer:${pageOrigin()}|${getInstanceBase() || 'same-origin'}`;

function pageOrigin(): string {
  try { return globalThis.location?.origin ?? ''; } catch { return ''; }
}

type ProbeAnswer = 'absent' | 'control-plane';
/** `auth` is the control plane's public auth config (what `/api/auth/config` answers to
 *  anyone), written beside a control-plane answer; records from before it was written
 *  have none. */
interface LastAnswer { v: 1; answer: ProbeAnswer; at: number; auth?: AuthConfig }

function readLastAnswer(key = lastAnswerKey()): LastAnswer | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const record = JSON.parse(raw) as Partial<LastAnswer> | null;
    if (!record || typeof record !== 'object' || record.v !== 1) return null;
    if (record.answer !== 'absent' && record.answer !== 'control-plane') return null;
    if (typeof record.at !== 'number' || !Number.isFinite(record.at)) return null;
    if (record.auth !== undefined && (record.answer !== 'control-plane' || !isAuthConfig(record.auth))) return null;
    return record as LastAnswer;
  } catch { return null; }
}

/**
 * Write down a definitive answer. A control plane always replaces the record. "No
 * control plane" never replaces a control-plane answer stamped later, so a tab whose
 * slower probe finishes last cannot undo what a newer probe in another tab learned.
 */
function recordAnswer(answer: ProbeAnswer, auth?: AuthConfig, at = Date.now()): void {
  try {
    if (answer === 'absent') {
      const previous = readLastAnswer();
      if (previous?.answer === 'control-plane' && previous.at > at) return;
    }
    const record: LastAnswer = { v: 1, answer, at, ...(answer === 'control-plane' && auth ? { auth } : {}) };
    localStorage.setItem(lastAnswerKey(), JSON.stringify(record));
  } catch { /* storage unavailable: nothing remembered, so boot keeps waiting */ }
}

/**
 * Whether the last definitive answer for this origin and base was a control plane that
 * may draw a sign-in gate: gated, per tool, or a record that does not say (written
 * before the config was kept). Only an open control plane, or no control plane, is not.
 */
export function gateRemembered(): boolean {
  const record = readLastAnswer();
  return record?.answer === 'control-plane' && record.auth?.mode !== 'open';
}

/** How recent a control-plane answer written by another tab must be for this tab to
 *  use it instead of asking again. Tabs a browser restores together boot within a
 *  few seconds of each other. */
export const SHARED_ANSWER_FRESH_MS = 15_000;

/** A control-plane answer with its config, written within {@link SHARED_ANSWER_FRESH_MS}
 *  (by this tab or another), or null. */
function freshControlPlane(now = Date.now()): AuthConfig | null {
  const record = readLastAnswer();
  if (record?.answer !== 'control-plane' || !record.auth) return null;
  return record.at <= now + CLOCK_SKEW_MS && now - record.at < SHARED_ANSWER_FRESH_MS ? record.auth : null;
}

// ── Answers shared between the tabs of this origin ───────────────────────────

const ANSWER_CHANNEL = 'lolly:org-answer';
interface SharedAnswer { v: 1; key: string; answer: ProbeAnswer; auth?: AuthConfig }

let channel: BroadcastChannel | null = null;
function answerChannel(): BroadcastChannel | null {
  if (channel) return channel;
  if (typeof BroadcastChannel !== 'function') return null;
  try {
    channel = new BroadcastChannel(ANSWER_CHANNEL);
    // A test process (Node) must not stay alive for a channel nobody closes.
    (channel as BroadcastChannel & { unref?: () => void }).unref?.();
    return channel;
  } catch { return null; }
}

/** Tell the other tabs of this origin what the control plane answered. */
function shareAnswer(answer: ProbeAnswer, auth?: AuthConfig): void {
  try {
    answerChannel()?.postMessage({ v: 1, key: lastAnswerKey(), answer, ...(auth ? { auth } : {}) } satisfies SharedAnswer);
  } catch { /* another tab simply probes for itself */ }
}

/**
 * The first definitive answer another tab of this origin hears for the same instance
 * base, while this tab waits for its own. `stop` ends the wait (the promise then never
 * settles).
 */
function answerFromAnotherTab(): { answer: Promise<AuthProbeResult>; stop(): void } {
  const ch = answerChannel();
  if (!ch) return { answer: new Promise(() => {}), stop() {} };
  let listener: ((event: MessageEvent) => void) | null = null;
  const answer = new Promise<AuthProbeResult>(resolve => {
    listener = (event: MessageEvent): void => {
      const msg = event.data as Partial<SharedAnswer> | null;
      if (msg?.v !== 1 || msg.key !== lastAnswerKey()) return;
      if (msg.answer === 'absent') resolve({ auth: null, absent: true });
      else if (msg.answer === 'control-plane' && isAuthConfig(msg.auth)) resolve({ auth: msg.auth, absent: false });
    };
    ch.addEventListener('message', listener);
  });
  return { answer, stop() { if (listener) ch.removeEventListener('message', listener); listener = null; } };
}

/**
 * Whether this device has ever met a control plane on this origin, under any instance
 * base. Saved work lives in one database per origin and survives a change of instance,
 * so the question is asked of the whole origin, not of the current base only: a device
 * that ever signed in anywhere here may hold that account's work. Storage that cannot be
 * read counts as yes.
 */
function controlPlaneSeenHere(): boolean {
  if (knownManagedAi()) return true;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (key.startsWith('lolly:managed-ai:') && localStorage.getItem(key) === '1') return true;
      if (key.startsWith('lolly:org-last-answer:') && readLastAnswer(key)?.answer === 'control-plane') return true;
    }
  } catch { return true; }
  return false;
}

/**
 * Whether the last definitive probe answer for this origin and instance base was "no
 * control plane", recent enough to act on, on a device that has never met a control
 * plane on this origin. Read after the instance base has loaded.
 */
export function cleanAnswerRemembered(now = Date.now()): boolean {
  if (controlPlaneSeenHere()) return false;
  const record = readLastAnswer();
  if (!record || record.answer !== 'absent') return false;
  if (record.at > now + CLOCK_SKEW_MS) return false;
  return now - record.at < CLEAN_ANSWER_TTL_MS;
}

let gateListener: ((gate: Element | null) => void) | null = null;

/**
 * Hear about the sign-in gate at the moment it is drawn into the view. Boot sets this
 * only when it painted before the probe answered, so the view underneath can be stopped
 * in the same task as the gate is drawn. Pass null to stop listening.
 */
export function onGateShown(listener: ((gate: Element | null) => void) | null): void {
  gateListener = listener;
}

/** Called by the gate's renderer (org/index.ts) right after it writes the gate. */
export function noteGateShown(gate: Element | null): void {
  try { gateListener?.(gate); } catch (error) { console.error('[org] gate listener failed', error); }
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
  const { auth, absent } = await probeOnce();
  return { auth, absent };
}

/** One probe, with its retry after a 5xx. `silent` is true when the control plane
 *  gave no answer that says anything: the budget ran out, or it kept answering
 *  with a server error. A request that fails at once (offline) is not silent. */
async function probeOnce(opts: { budgetMs?: number; signal?: AbortSignal } = {}): Promise<AuthProbeResult & { silent: boolean }> {
  const long = opts.budgetMs !== undefined || !recentlyUnanswered();
  const budget = opts.budgetMs ?? (long ? AUTH_PROBE_BUDGET_MS : PROBE_TIMEOUT_MS);
  const deadline = Date.now() + budget;
  const init = opts.signal ? { signal: opts.signal } : undefined;
  let attempt = await fetchWithin('/api/auth/config', init, budget);
  let r = await readProbeResponse(attempt.res);
  if (r.retry && !opts.signal?.aborted && deadline - Date.now() - AUTH_PROBE_RETRY_DELAY_MS >= AUTH_PROBE_RETRY_MIN_MS) {
    await new Promise(resolve => setTimeout(resolve, AUTH_PROBE_RETRY_DELAY_MS));
    // Measured again after the pause: a busy page can run the timer late.
    const left = deadline - Date.now();
    if (left >= AUTH_PROBE_RETRY_MIN_MS / 2 && !opts.signal?.aborted) {
      attempt = await fetchWithin('/api/auth/config', init, left);
      r = await readProbeResponse(attempt.res);
    }
  }
  if (attempt.res) forgetUnanswered();
  else if (attempt.timedOut && long) rememberUnanswered();
  // Only a definitive answer is written down; anything else leaves the last one.
  if (r.auth) { recordAnswer('control-plane', r.auth); shareAnswer('control-plane', r.auth); }
  else if (r.absent) { recordAnswer('absent'); shareAnswer('absent'); }
  return { auth: r.auth, absent: r.absent, silent: !r.auth && !r.absent && (attempt.timedOut || r.retry) };
}

/** How long a tab on a gated origin waits before each further probe when the
 *  control plane stays silent. The last delay repeats until it answers. */
export const GATED_RETRY_DELAYS_MS: readonly number[] = [1000, 2000, 4000, 8000, 15000];

/**
 * The boot probe's answer, shared with the other tabs of this origin. The first
 * definitive answer wins, whether this tab's request or another tab's brought the answer.
 * On a gated origin a silent control plane is asked again until it answers, so the
 * page stays on its waiting screen instead of booting without the gate.
 */
export async function probeForBoot(): Promise<AuthProbeResult> {
  // Another tab of this origin has just asked: its answer stands for this boot too.
  const recent = freshControlPlane();
  if (recent) return { auth: recent, absent: false };
  const other = answerFromAnotherTab();
  const cancel = new AbortController();
  const shared = other.answer.then(answer => { cancel.abort(); return { ...answer, silent: false }; });
  try {
    let result = await Promise.race([probeOnce({ signal: cancel.signal }), shared]);
    for (let i = 0; result.silent && gateRemembered(); i++) {
      const delay = GATED_RETRY_DELAYS_MS[Math.min(i, GATED_RETRY_DELAYS_MS.length - 1)]!;
      const ask = new Promise<void>(resolve => setTimeout(resolve, delay)).then(() =>
        cancel.signal.aborted ? new Promise<never>(() => {}) : probeOnce({ budgetMs: AUTH_PROBE_BUDGET_MS, signal: cancel.signal }));
      result = await Promise.race([ask, shared]);
    }
    return { auth: result.auth, absent: result.absent };
  } finally {
    other.stop();
  }
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
  let state: OrgState | null = null;
  try {
    state = await probeAndInit();
    return state;
  } finally {
    // Every outcome is in, so the person's company is known (or there is none):
    // the first-visit welcome waits for this rather than guess (plans/82 M3).
    settleWorkspaceCompany(!!state && !state.gate);
  }
}

async function probeAndInit(): Promise<OrgState | null> {
  try {
    if (!knownManagedAi() && isRecentlyAbsent()) { finishAiProbe(false); return null; }
    // The base the probe asks. initOrgWithAuth compares it with the base in use once
    // the session is read, because catalog sync may set the instance aside meanwhile.
    const askedOf = getInstanceBase();
    const { auth, absent } = await probeForBoot();
    if (!auth) { finishAiProbe(false); if (absent) rememberAbsent(); return null; }
    finishAiProbe(true);
    const org = await import('./index.ts');
    return await org.initOrgWithAuth(auth, askedOf);
  } catch {
    return null;
  }
}
