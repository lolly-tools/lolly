// SPDX-License-Identifier: MPL-2.0
/**
 * nearby-accept - the acceptor's front door for a nearby pairing (plans/110 section 3).
 *
 * The inviter taps a discovered peer (the ceremony's Nearby panel) and hands over the
 * invite over the nearby channel; on THIS device that arrives as a `subscribeInvites`
 * callback. This module opens the accept ceremony for it, exactly as if the human had
 * pasted the invite, and sends the minted reply back over the SAME channel (via the
 * ceremony's `onAnswer` hook) instead of showing a QR to scan. The plate compare and the
 * tool probe are unchanged - nearby only replaces the transport of the invite/reply blobs,
 * never the trust ceremony (mDNS is unauthenticated; the matching plates are the auth).
 *
 * Installed once at boot beside `installNearbyBoot`. It is dormant unless a LAN provider is
 * registered (Tauri only) AND the `nearby-discovery` flag is on - so a plain web build wires
 * nothing. The heavy ceremony/transport code is a dynamic import behind the first invite, the
 * same discipline as `collab/private-opener.ts`.
 */

import { getNearbyProvider, type NearbyInboundInvite } from '../lib/nearby.ts';
import { isFlagOnSync, NEARBY_DISCOVERY_FLAG } from '../feature-flags.ts';

let installed = false;

/** Subscribe to inbound nearby invites, opening the accept ceremony for each. A no-op off
 *  Tauri / with the flag off / when already installed. */
export function installNearbyAccept(): void {
  if (installed) return;
  const provider = getNearbyProvider('lan');
  if (!provider || !isFlagOnSync(NEARBY_DISCOVERY_FLAG)) return;
  installed = true;

  // One pairing at a time: a second invite arriving mid-ceremony is declined rather than
  // stacking a second dialog. The common case is exactly one.
  let busy = false;
  provider.subscribeInvites((invite) => {
    if (busy) { invite.decline(); return; }
    busy = true;
    void acceptNearbyInvite(invite).finally(() => { busy = false; });
  });
}

async function acceptNearbyInvite(invite: NearbyInboundInvite): Promise<void> {
  let ceremony: typeof import('../components/collab-ceremony.ts');
  let jr: typeof import('./join-route.ts');
  let rc: typeof import('./rtc-connection.ts');
  let qr: typeof import('./qr-skin.ts');
  let mount: typeof import('../lib/collab-mount.ts');
  let i18n: typeof import('../i18n.ts');
  try {
    [ceremony, jr, rc, qr, mount, i18n] = await Promise.all([
      import('../components/collab-ceremony.ts'),
      import('./join-route.ts'),
      import('./rtc-connection.ts'),
      import('./qr-skin.ts'),
      import('../lib/collab-mount.ts'),
      import('../i18n.ts'),
    ]);
  } catch {
    invite.decline(); // could not even load the ceremony - do not leave the peer hanging
    return;
  }
  await i18n.loadNamespace('collab').catch(() => { /* falls back to English */ });

  // The transport type is what rtcCollabConnection accepts; extract it rather than restate it.
  let transport: Parameters<typeof rc.rtcCollabConnection>[0]['transport'] | null = null;
  let handed: ReturnType<typeof rc.rtcCollabConnection> | null = null;
  let connected = false;

  const effects = jr.createCollabEffects({ onTransport: (built) => { transport = built; } });

  const dialog = ceremony.openCollabCeremony({
    role: 'acceptor',
    effects,
    // Explicit linkBase so the reply link never falls back to the ceremony's
    // defaultLinkBase() (a trap from a /t/<id> crawler-stub pathname) - same pattern
    // join-route.ts and private-opener.ts already apply.
    linkBase: jr.appLinkBase(),
    renderQr: qr.createQrElementRenderer(),
    // The minted reply goes straight back over the nearby channel instead of a QR.
    onAnswer: (signal) => { invite.respond(signal); },
    onConnected: (handle) => {
      if (!transport) return;
      const conn = rc.rtcCollabConnection({ role: 'acceptor', ceremony: handle, transport });
      handed = conn;
      connected = true;
      jr.handOffConnection(conn, dialog?.el ?? null);
    },
    onClose: () => {
      // A pair nobody adopted is a live connection the dialog will not close; park it so
      // the mount can. Closed WITHOUT connecting ⇒ tell the peer we declined.
      if (handed) { mount.releaseParked(handed); handed = null; }
      if (!connected) invite.decline();
    },
  });

  // However the invite arrived, deliver it as if pasted (the ceremony's own tolerant path).
  jr.deliverInviteToDialog(dialog.el, invite.token);
}

/** TEST-ONLY: reset the install latch. */
export function _resetNearbyAcceptForTests(): void { installed = false; }
