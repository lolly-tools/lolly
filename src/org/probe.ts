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
 */
import { instanceFetch, instancePath, getInstanceBase } from '../lib/instance.ts';
import type { AuthConfig, OrgState } from './index.ts';
import { beginAiProbe, finishAiProbe, knownManagedAi } from './ai-policy.ts';

/** Short probe budget - a hung network must never delay boot by more than this. */
export const PROBE_TIMEOUT_MS = 1500;
/** localStorage negative-cache TTL (per instance base). Optional acceleration
 *  only: it lets a known-dormant origin skip even the one probe on later boots,
 *  and self-heals - if a deployment later gains a control plane, it is seen once
 *  the cached negative expires. Never on the critical path for correctness. */
const ABSENT_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const absentKey = (): string => `lolly:org-absent:${getInstanceBase() || 'same-origin'}`;

/** A time-boxed instanceFetch that never rejects - resolves null on any failure
 *  (network error, abort, thrown). */
export async function safeFetch(path: string, init?: RequestInit, timeoutMs?: number): Promise<Response | null> {
  const ctrl = timeoutMs ? new AbortController() : null;
  const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
  try {
    return await instanceFetch(instancePath(path), ctrl ? { ...init, signal: ctrl.signal } : init);
  } catch {
    return null;
  } finally {
    if (timer) clearTimeout(timer);
  }
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

/** Probe for a control plane. Returns its auth config, or null (dormant). */
export async function probeAuthConfig(): Promise<AuthConfig | null> {
  const cfg = await jsonBody<AuthConfig>(await safeFetch('/api/auth/config', undefined, PROBE_TIMEOUT_MS));
  return isAuthConfig(cfg) ? cfg : null;
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
    const auth = await probeAuthConfig();
    if (!auth) { finishAiProbe(false); rememberAbsent(); return null; }
    finishAiProbe(true);
    const org = await import('./index.ts');
    return await org.initOrgWithAuth(auth);
  } catch {
    return null;
  }
}
