// SPDX-License-Identifier: MPL-2.0
/** AI has a short online lease, independent of the longer org-config UI cache. */
import { aiPolicy, requireAiPolicy } from '../lib/ai-policy.ts';
import { getInstanceBase, instanceFetch, instancePath } from '../lib/instance.ts';

const managedKey = (): string => `lolly:managed-ai:${getInstanceBase() || 'same-origin'}`;
export function knownManagedAi(): boolean {
  if (requireAiPolicy) return true;
  try {
    return localStorage.getItem(managedKey()) === '1';
  } catch {
    return false;
  }
}
export function beginAiProbe(): void {
  stopAiPolicyPolling();
  aiPolicy.setManaged(true);
}
export function finishAiProbe(found: boolean): void {
  if (found) {
    try {
      localStorage.setItem(managedKey(), '1');
    } catch {
      /* build flag protects storage-less deployments */
    }
    aiPolicy.setManaged(true);
  } else aiPolicy.setManaged(knownManagedAi());
}

let generation = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let request: AbortController | null = null;
export function stopAiPolicyPolling(): void {
  generation++;
  clearTimeout(timer);
  request?.abort();
  request = null;
  aiPolicy.apply(null);
}

/** 30-second renewal, five-second request budget, 60-second maximum lease.
 * A failed renewal revokes immediately. No persisted AI policy is accepted. */
export function startAiPolicyPolling(freshPolicy?: unknown): void {
  stopAiPolicyPolling();
  const active = generation;
  aiPolicy.apply(freshPolicy);
  const poll = async (): Promise<void> => {
    if (active !== generation) return;
    const ctrl = new AbortController();
    request = ctrl;
    const deadline = setTimeout(() => ctrl.abort(), 5000);
    try {
      const res = await instanceFetch(instancePath('/api/v1/policy/ai'), {
        signal: ctrl.signal,
        cache: 'no-store',
      });
      if (!res.ok || !/\bjson\b/i.test(res.headers.get('content-type') || ''))
        throw new Error('unavailable');
      // A policy contains ten capability names at most. Bound even a corrupt or
      // misrouted response; the timeout remains live while reading its body.
      const reader = res.body?.getReader();
      if (!reader) throw new Error('missing policy');
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 4096) {
          await reader.cancel();
          throw new Error('oversized policy');
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      const policy: unknown = JSON.parse(new TextDecoder().decode(bytes));
      if (active === generation && !ctrl.signal.aborted) aiPolicy.apply(policy);
    } catch {
      if (active === generation) aiPolicy.apply(null);
    } finally {
      clearTimeout(deadline);
      if (request === ctrl) request = null;
      if (active === generation) schedule();
    }
  };
  const schedule = (): void => {
    timer = setTimeout(() => {
      void poll();
    }, 30_000);
    (timer as unknown as { unref?: () => void }).unref?.();
  };
  schedule();
}
