// SPDX-License-Identifier: MPL-2.0
/**
 * collab-rendezvous-entry (plans/138 Tier C, WP3b) - the on-screen door to a
 * shared-cloud collab. It opens the SAME ceremony flows the QR path uses, only with
 * the signalling routed through a rendezvous on a provider both people have
 * connected (S3 / WebDAV / Drive / Dropbox). Two people who share a cloud pick it
 * here, agree a short session code, and pair - no QR, no link relay.
 *
 * Reuse, not reinvention:
 *   - INVITER: `openPrivateCollab` (collab/private-opener.ts) already builds the
 *     transport effects, the seed, and the onConnected → live-session handoff; we
 *     pass it an `openCeremony` that layers the rendezvous bindings on. Nothing of
 *     its logic is duplicated, and the QR path it normally drives is untouched.
 *   - ACCEPTOR: the same small onConnected block #/join uses, from the same
 *     exported pieces (`createCollabEffects`, `rtcCollabConnection`,
 *     `handOffConnection`, `releaseParked`) - but with the invite pulled from, and
 *     the answer published to, the shared cloud instead of a pasted token.
 *
 * Lazy-loaded off the Share dialog's private-collab row (a button handler dynamic-
 * imports this), so none of the collab/WebRTC chunk touches the boot path.
 */

import { openPrivateCollab } from '../collab/private-opener.ts';
import type { CollabLaunchContext } from './collab-launch.ts';
import { openCollabCeremony, type CollabCeremonyHandle } from '../components/collab-ceremony.ts';
import { createCollabEffects, handOffConnection, appLinkBase } from '../collab/join-route.ts';
import { rtcCollabConnection } from '../collab/rtc-connection.ts';
import { releaseParked, type CollabConnection } from './collab-mount.ts';
import type { RtcTransport } from '../collab/rtc-transport.ts';
import { hasConnection } from './provider-connections.ts';
import { pathStoreFor, rendezvousKinds, type RendezvousOpts } from './collab-rendezvous.ts';
import { rendezvousBindings } from './collab-rendezvous-launch.ts';
import { syncProviderLabel } from './sync-service.ts';
import { PLATE_ALPHABET } from '../collab/plate.ts';
import { mountModal } from '../components/modal.ts';
import { t } from '../i18n.ts';
import { escape } from '../utils.ts';
import { announce } from '../a11y.ts';

/** The rendezvous providers usable right now: a store exists AND it is connected. */
export function connectedRendezvousProviders(): Array<{ kind: string; label: string }> {
  return rendezvousKinds()
    .filter((kind) => hasConnection(kind))
    .map((kind) => ({ kind, label: syncProviderLabel(kind) }));
}

/** A short, confusable-free session code both people type (namespaces the rendezvous). */
export function makeSessionCode(): string {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(8));
  let s = '';
  for (const b of bytes) s += PLATE_ALPHABET[b % PLATE_ALPHABET.length];
  return s;
}

/** INVITER: reuse openPrivateCollab, swapping the signalling channel for the
 *  rendezvous (invite published to the cloud, reply pulled from it). */
export async function openRendezvousInviter(
  ctx: CollabLaunchContext, kind: string, code: string, ropts: RendezvousOpts = {},
): Promise<CollabCeremonyHandle | null> {
  const store = pathStoreFor(kind);
  if (!store) return null;
  return openPrivateCollab(ctx, {
    // No QR: the invite rides the cloud, not a scan; the shared code is the link.
    renderQr: null,
    openCeremony: (opts) => openCollabCeremony({ ...opts, ...rendezvousBindings('inviter', store, code, ropts) }),
  });
}

/** ACCEPTOR: open an acceptor ceremony whose invite is pulled from, and answer
 *  published to, the shared cloud. Mirrors #/join's onConnected/onClose lifecycle. */
export function openRendezvousAcceptor(
  kind: string, code: string, opts: { profileName?: string; rendezvous?: RendezvousOpts } = {},
): CollabCeremonyHandle | null {
  const store = pathStoreFor(kind);
  if (!store) return null;
  let transport: RtcTransport | null = null;
  let handed: CollabConnection | null = null;
  let dialog: CollabCeremonyHandle | undefined;
  const effects = createCollabEffects({ onTransport: (built) => { transport = built; } });
  dialog = openCollabCeremony({
    role: 'acceptor',
    effects,
    profileName: opts.profileName,
    linkBase: appLinkBase(),
    ...rendezvousBindings('acceptor', store, code, opts.rendezvous ?? {}),
    onConnected: (handle) => {
      if (!transport) return;
      handed = rtcCollabConnection({ role: 'acceptor', ceremony: handle, transport, launch: undefined });
      handOffConnection(handed, dialog?.el ?? null);
    },
    onClose: () => {
      // A pair nobody adopted is still a live peer connection; hang it up (a no-op
      // once a mount took it), exactly as #/join does on close.
      if (handed) { releaseParked(handed); handed = null; }
    },
  });
  return dialog;
}

/**
 * The picker: choose a shared provider, agree a session code, and Host or Join.
 * Opened from the Share dialog's private-collab row. Host reuses the invite ctx;
 * Join needs only the provider + code (it receives the session on connect).
 */
export function openRendezvousPicker(ctx: CollabLaunchContext): void {
  const providers = connectedRendezvousProviders();
  if (providers.length === 0) {
    announce(t('Connect a provider that supports sync first, in Connected services.'));
    return;
  }
  const code = makeSessionCode();
  const opts = providers.map((p) => `<option value="${escape(p.kind)}">${escape(p.label)}</option>`).join('');
  const modal = mountModal<void>(`
    <h2 class="rv-title" style="margin:0 0 .4rem;font-size:1rem">${t('Connect over shared cloud')}</h2>
    <p class="rv-note" style="margin:0 0 .8rem;font-size:.85rem;opacity:.8">${t('Pick a place you both have connected, agree a code, and pair - no QR, no link relay.')}</p>
    <label style="display:block;margin:0 0 .6rem;font-size:.85rem">${t('Where')}
      <select data-rv-provider class="field-input" style="margin-top:.25rem">${opts}</select>
    </label>
    <label style="display:block;margin:0 0 .4rem;font-size:.85rem">${t('Session code')}
      <input data-rv-code class="field-input" value="${escape(code)}" autocomplete="off" spellcheck="false" style="margin-top:.25rem;font-family:var(--font-mono, ui-monospace, monospace);letter-spacing:.08em">
    </label>
    <p class="rv-note" style="margin:0 0 .9rem;font-size:.8rem;opacity:.75">${t('Share this code with the other person. You both need the same place connected here. One of you Hosts, the other Joins.')}</p>
    <div style="display:flex;gap:.5rem;flex-wrap:wrap">
      <button type="button" class="btn" data-rv-host>${t('Host')}</button>
      <button type="button" class="btn" data-rv-join>${t('Join')}</button>
      <button type="button" class="btn-link" data-rv-cancel style="margin-left:auto">${t('Cancel')}</button>
    </div>`, {
    className: 'modal rv-picker',
    ariaLabel: t('Connect over shared cloud'),
    initialFocus: (el) => el.querySelector<HTMLElement>('[data-rv-host]'),
  });

  const read = (): { kind: string; code: string } => ({
    kind: modal.el.querySelector<HTMLSelectElement>('[data-rv-provider]')?.value ?? providers[0]!.kind,
    code: (modal.el.querySelector<HTMLInputElement>('[data-rv-code]')?.value ?? code).trim(),
  });

  modal.el.addEventListener('click', (ev) => {
    const act = (ev.target as HTMLElement)?.closest<HTMLElement>('[data-rv-host],[data-rv-join],[data-rv-cancel]');
    if (!act) return;
    if (act.matches('[data-rv-cancel]')) { modal.close(); return; }
    const { kind, code: sessionCode } = read();
    if (!sessionCode) { announce(t('Enter a session code first.')); return; }
    modal.close();
    if (act.matches('[data-rv-host]')) {
      void openRendezvousInviter(ctx, kind, sessionCode);
      announce(t('Hosting a collab over your shared cloud'));
    } else {
      openRendezvousAcceptor(kind, sessionCode);
      announce(t('Joining a collab over your shared cloud'));
    }
  });
}
