// SPDX-License-Identifier: MPL-2.0
/**
 * collab-rendezvous-launch (plans/138 Tier C, WP3b) - opens the EXISTING collab
 * ceremony dialog (components/collab-ceremony.ts) with its signalling routed
 * through a shared-cloud rendezvous instead of QR/paste. It only swaps the
 * signalling CHANNEL: the caller still supplies the real transport effects, the
 * tool, and `onConnected`, so the dialog drives the machine and hands off to the
 * live session exactly as the QR path does - the human/QR path is untouched.
 *
 * The three dialog seams it binds:
 *   - inviter: `onInvite` publishes the minted invite; `scan` pulls the reply.
 *   - acceptor: `scan` pulls the invite; `onAnswer` publishes the minted reply.
 * `scan` is the dialog's "get a signal from somewhere" affordance (a tap on the
 * waiting/paste screen), which here reads from the shared cloud rather than a
 * camera. Everything the rendezvous writes is ciphertext at a hashed path
 * (collab-rendezvous.ts); op-guard / identity binding stay wherever they are.
 */

import { openCollabCeremony, type CollabCeremonyOptions, type CollabCeremonyHandle } from '../components/collab-ceremony.ts';
import { appLinkBase } from '../collab/join-route.ts';
import type { CeremonyRole } from '../collab/ceremony.ts';
import {
  pathStoreFor, rendezvousPublish, rendezvousAwait, type PathStore, type RendezvousOpts,
} from './collab-rendezvous.ts';

type SignalBindings = Pick<CollabCeremonyOptions, 'scan' | 'onInvite' | 'onAnswer'>;

/** The dialog bindings that route one role's signalling through the rendezvous.
 *  A failed/timed-out pull resolves to null (the dialog then says "nothing yet"),
 *  never rejects; a publish is fire-and-forget best-effort. */
export function rendezvousBindings(role: CeremonyRole, store: PathStore, code: string, opts: RendezvousOpts = {}): SignalBindings {
  if (role === 'inviter') {
    return {
      onInvite: (sig) => { void rendezvousPublish(store, code, 'offer', sig).catch(() => { /* the QR/link stays as a fallback */ }); },
      scan: () => rendezvousAwait(store, code, 'answer', opts).then((t) => t, () => null),
    };
  }
  return {
    scan: () => rendezvousAwait(store, code, 'offer', opts).then((t) => t, () => null),
    onAnswer: (sig) => { void rendezvousPublish(store, code, 'answer', sig).catch(() => { /* fall back to showing the reply */ }); },
  };
}

export type RendezvousLaunchOptions =
  Omit<CollabCeremonyOptions, 'scan' | 'onInvite' | 'onAnswer'>
  & { kind: string; code: string; rendezvous?: RendezvousOpts };

/**
 * Open the ceremony dialog for `role`, signalling over the shared cloud provider
 * `kind` under session `code`. Throws if the provider has no rendezvous store.
 */
export function launchRendezvousCollab(o: RendezvousLaunchOptions): CollabCeremonyHandle {
  const store = pathStoreFor(o.kind);
  if (!store) throw new Error(`No shared-cloud provider for sync of kind "${o.kind}".`);
  const { kind: _kind, code, rendezvous, ...dialog } = o;
  // linkBase must be explicit: the default falls back to location.pathname,
  // which is the crawler-stub path under /t/<id> (see link-base.test.ts).
  return openCollabCeremony({
    ...dialog,
    linkBase: dialog.linkBase ?? appLinkBase(),
    ...rendezvousBindings(dialog.role, store, code, rendezvous),
  });
}
