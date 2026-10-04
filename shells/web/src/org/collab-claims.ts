// SPDX-License-Identifier: MPL-2.0
import { interactionKey, readClaimTarget } from '@lolly-tools/core/canvas-interaction-v1';
import type { CanvasClaim, CanvasClaimTarget } from '@lolly-tools/core/canvas-interaction-v1';
import type { ClientFrame } from './collab-protocol.ts';
import type { CanvasClaimCapability } from '../lib/canvas-interaction.ts';

function readClaim(raw: unknown): CanvasClaim | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>, target = readClaimTarget(c.target);
  return target && interactionKey(c.id) && interactionKey(c.owner) && typeof c.name === 'string'
    && c.name.length <= 256 && typeof c.expiresAt === 'number' && Number.isSafeInteger(c.expiresAt)
    ? { id: c.id, owner: c.owner, name: c.name, target, expiresAt: c.expiresAt } : null;
}
export function createWorkClaims(post: (frame: Extract<ClientFrame, { t: 'claim' }>) => boolean): CanvasClaimCapability & {
  join(version: unknown, list: unknown, owner?: string): void;
  receive(frame: { t: string; requestId?: unknown; claim?: unknown; claims?: unknown; reason?: unknown; blockedBy?: unknown }): void;
  disconnect(): void;
} {
  let supported = false, claims: CanvasClaim[] = [];
  let owner: string | undefined;
  const subscribers = new Set<(claims: readonly CanvasClaim[]) => void>();
  const pending = new Map<string, { resolve: (claim: CanvasClaim) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  const publish = (raw: unknown): void => {
    claims = Array.isArray(raw) ? raw.slice(0, 20).map(readClaim).filter((c): c is CanvasClaim => !!c) : [];
    for (const fn of subscribers) fn(claims);
  };
  function request(action: 'acquire' | 'renew', target?: CanvasClaimTarget, claimId?: string): Promise<CanvasClaim> {
    if (!supported) return Promise.reject(new Error('Work disconnected'));
    if (pending.size >= 4) return Promise.reject(new Error('An edit is still connecting'));
    return new Promise((resolve, reject) => {
      const requestId = globalThis.crypto.randomUUID();
      const timer = setTimeout(() => { pending.delete(requestId); reject(new Error('Editing claim timed out')); }, 4_000);
      pending.set(requestId, { resolve, reject, timer });
      if (!post({ t: 'claim', requestId, action, ...(target ? { target } : {}), ...(claimId ? { claimId } : {}) })) {
        clearTimeout(timer); pending.delete(requestId); reject(new Error('Work disconnected'));
      }
    });
  }
  return {
    available: () => supported,
    owner: () => owner,
    list: () => claims,
    acquire: target => request('acquire', target),
    renew: id => request('renew', undefined, id),
    release(id) { if (supported) post({ t: 'claim', requestId: globalThis.crypto.randomUUID(), action: 'release', claimId: id }); },
    subscribe(fn) { subscribers.add(fn); fn(claims); return () => { subscribers.delete(fn); }; },
    join(version, list, own) { owner = own; supported = version === 1; publish(supported ? list : []); },
    receive(frame) {
      if (frame.t === 'claims') { publish(frame.claims); return; }
      if (typeof frame.requestId !== 'string') return;
      const reply = pending.get(frame.requestId); if (!reply) return;
      clearTimeout(reply.timer); pending.delete(frame.requestId);
      const claim = readClaim(frame.claim);
      if (claim) reply.resolve(claim);
      else reply.reject(new Error(typeof frame.blockedBy === 'string' ? `${frame.blockedBy.slice(0, 256)} is editing this object`
        : frame.reason === 'view-only' ? 'View only' : 'Editing claim unavailable'));
    },
    disconnect() {
      supported = false;
      for (const reply of pending.values()) { clearTimeout(reply.timer); reply.reject(new Error('Work disconnected')); }
      pending.clear(); publish([]);
    },
  };
}
