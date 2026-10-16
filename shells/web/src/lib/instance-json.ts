// SPDX-License-Identifier: MPL-2.0
/** Bounded JSON requests shared by instance discovery and sign-in. */
import { instanceFetch, instancePath } from './instance.ts';

/** instanceFetch with an optional time box. Never rejects: `res` is null on any
 *  failure, and `timedOut` tells a spent budget apart from an instant error. A
 *  budget of zero or less aborts at once; only an omitted one means no limit. */
export async function fetchWithin(path: string, init: RequestInit | undefined, timeoutMs: number | undefined): Promise<{ res: Response | null; timedOut: boolean }> {
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
  if (!res?.ok) return null;
  const ct = res.headers.get('content-type') || '';
  if (!/\bjson\b/i.test(ct)) return null;
  try {
    return (await res.json()) as T;
  } catch {
    return null;
  }
}
