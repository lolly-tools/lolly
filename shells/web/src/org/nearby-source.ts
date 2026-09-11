// SPDX-License-Identifier: MPL-2.0
/**
 * org nearby-source - the `'org'` NearbyProvider (plans/26 section 8, OSS plans/110 section 5),
 * registered by org/index.ts when the instance grants `collab.nearby`.
 *
 * A browser cannot discover devices on a network, but a control plane can group its
 * online members by apparent address and offer "likely nearby" colleagues in the
 * invite flow. This provider is the shell's read of that: it polls the instance's
 * `/api/v1/collab/nearby` while someone is watching, and POSTs the member's own
 * opt-in. It is a SORTING HINT surface, never true device discovery, so:
 *
 *   - `exchangeInvite` REJECTS. A browser cannot hand an invite token peer-to-peer;
 *     inviting an org colleague goes through the work-collab room (org/collab-*),
 *     not this provider. Listing a colleague is the whole capability of this provider.
 *   - `subscribeInvites` never fires - there is no inbound P2P invite on this track.
 *
 * Everything goes through instanceFetch/instancePath (lib/instance.ts), so a shell
 * pointed at a remote instance polls THAT instance. Pure data: fetch + shape, no
 * engine, no DOM.
 */

import { instanceFetch, instancePath } from '../lib/instance.ts';
import type {
  NearbyProvider,
  NearbyPeer,
  NearbyVisibility,
  NearbyInboundInvite,
} from '../lib/nearby.ts';
import { isVisibilityActive } from '../lib/nearby.ts';

/** How often the peer list is refreshed while at least one subscriber is watching.
 *  Nearby is a background hint, not a live channel - a slow poll is correct. */
export const ORG_NEARBY_POLL_MS = 30_000;

interface NearbyMemberWire {
  userId?: unknown;
  name?: unknown;
  near?: unknown;
}

function shapePeers(raw: unknown): NearbyPeer[] {
  const members = (raw as { members?: unknown } | null)?.members;
  if (!Array.isArray(members)) return [];
  const out: NearbyPeer[] = [];
  for (const m of members as NearbyMemberWire[]) {
    const id = typeof m?.userId === 'string' ? m.userId : '';
    const name = typeof m?.name === 'string' ? m.name : '';
    if (!id || !name) continue;
    // The server does not report a device kind for a member; 'desktop' is the
    // neutral default (this surface never distinguishes desktop from mobile).
    out.push({ id, name, kind: 'desktop', source: 'org', near: m?.near === true });
  }
  return out;
}

async function postVisible(visible: boolean): Promise<void> {
  await instanceFetch(instancePath('/api/v1/collab/nearby'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ visible }),
  }).catch(() => { /* best-effort; a failed opt-in must not break the caller */ });
}

/** Injectable timers so the poll loop is unit-testable without real time. */
export interface OrgNearbyEnv {
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (h: unknown) => void;
  now?: () => number;
}

/** Build the `'org'` provider. Exported for org/index.ts and for tests. */
export function createOrgNearbyProvider(env: OrgNearbyEnv = {}): NearbyProvider {
  const setI = env.setInterval ?? ((fn, ms) => setInterval(fn, ms));
  const clrI = env.clearInterval ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>));
  const now = env.now ?? (() => Date.now());

  const peerSubs = new Set<(peers: readonly NearbyPeer[]) => void>();
  let handle: unknown = null;
  let polling = false;

  async function poll(): Promise<void> {
    if (polling || peerSubs.size === 0) return;
    polling = true;
    try {
      const res = await instanceFetch(instancePath('/api/v1/collab/nearby'));
      if (!res.ok) return; // 404 disabled / 501 no-registry / 401 - nothing to show
      const peers = shapePeers(await res.json());
      for (const cb of peerSubs) cb(peers);
    } catch {
      /* transient - the next tick retries */
    } finally {
      polling = false;
    }
  }

  return {
    source: 'org',

    async setVisible(v: NearbyVisibility, _name: string): Promise<void> {
      // The instance owns identity (the member's own name); only the on/off state
      // travels. A timed window maps to "visible now"; the server's TTL ages it off.
      await postVisible(isVisibilityActive(v, now()));
    },

    async hide(): Promise<void> {
      await postVisible(false);
    },

    subscribePeers(cb): () => void {
      peerSubs.add(cb);
      if (!handle) {
        handle = setI(() => { void poll(); }, ORG_NEARBY_POLL_MS);
        void poll(); // immediate first read
      }
      return () => {
        peerSubs.delete(cb);
        if (peerSubs.size === 0 && handle) { clrI(handle); handle = null; }
      };
    },

    subscribeInvites(_cb: (inv: NearbyInboundInvite) => void): () => void {
      // No inbound P2P invites on the org track - the room is the path.
      return () => {};
    },

    async exchangeInvite(_peerId: string, _token: string): Promise<string> {
      throw new Error('org-nearby-no-p2p-exchange');
    },
  };
}
