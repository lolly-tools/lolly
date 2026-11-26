// SPDX-License-Identifier: MPL-2.0
/** Bounded JSON requests shared by instance discovery and sign-in. */
import { instanceFetch, instancePath } from './instance.ts';

/** instanceFetch with an optional time box. Never rejects: `res` is null on any
 *  failure, and `timedOut` tells a spent budget apart from an instant error. A
 *  budget of zero or less aborts at once; only an omitted one means no limit. A
 *  signal in `init` still cancels the request; a cancel is not a timeout. */
export async function fetchWithin(path: string, init: RequestInit | undefined, timeoutMs: number | undefined): Promise<{ res: Response | null; timedOut: boolean }> {
  const ctrl = timeoutMs === undefined ? null : new AbortController();
  let timedOut = false;
  const timer = ctrl ? setTimeout(() => { timedOut = true; ctrl.abort(); }, Math.max(1, timeoutMs ?? 0)) : null;
  const outer = init?.signal;
  const cancel = (): void => ctrl?.abort();
  if (ctrl && outer) {
    if (outer.aborted) ctrl.abort();
    else outer.addEventListener('abort', cancel, { once: true });
  }
  try {
    // The budget also goes to the native transport of the apps, which cannot be
    // cancelled by a signal: the request then ends there at the same time.
    const limits = timeoutMs === undefined ? undefined : { timeoutMs: Math.max(1, Math.ceil(timeoutMs)) };
    return { res: await instanceFetch(instancePath(path), ctrl ? { ...init, signal: ctrl.signal } : init, limits), timedOut: false };
  } catch {
    return { res: null, timedOut };
  } finally {
    if (timer) clearTimeout(timer);
    outer?.removeEventListener('abort', cancel);
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
