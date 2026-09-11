// SPDX-License-Identifier: MPL-2.0
/**
 * private-opener - the `'private'` slot of `lib/collab-launch.ts`: what actually happens
 * when someone presses "Start a collab" in the Share dialog (plan 100 section 0, section 6.1, section 11.25;
 * wave 2.4).
 *
 * `lib/collab-share-private.ts` renders that row, and has been gated on TWO things since
 * it landed: the `private-collab` flag, and an opener existing at all. Nothing registered
 * one, so the row has never rendered. This file registers it - as a side effect of being
 * imported, exactly like the share row itself, with `main.ts` importing it for that one
 * effect.
 *
 * ── Why this module holds no platform ──────────────────────────────────────────
 *
 * It is on the BOOT path, and what it opens is not: a peer connection, a QR encoder, a
 * ceremony dialog and the codec are ~all of `collab/` (plus the ceremony component). Most
 * loads of the app never start a collab - that was true when the flag was default-OFF and
 * is still true now that it is default-ON (2026-08-10), because the flag decides whether
 * the ROW exists, not whether anyone presses it. So the heavy half is behind one `await
 * import('./join-route.ts')` inside the opener - the same chunk `#/join` loads, which is
 * the right pairing anyway: the two sides of one ceremony share every platform piece.
 *
 * The static imports here are the two gates and the registry, nothing else.
 *
 * ── The flag is checked INSIDE the opener, not around the registration ─────────
 *
 * Registering unconditionally and gating inside is what makes the flag live: a user who
 * turns it on in their profile gets a working row without a reload, and one who turns it
 * off gets a row that stops opening anything. (`lib/collab-share-private.ts` reads the
 * flag on every dialog open for the same reason, so the row disappears in step with it.)
 * The cost of an inert registration is one closure.
 *
 * ── What happens on connect ────────────────────────────────────────────────────
 *
 * The live pair goes to `lib/collab-mount.ts` - the single-provider seam the co-editing
 * stitch registers into (`lib/collab-live-mount.ts`, installed from `main.ts`'s boot).
 * With nothing registered the connection is PARKED and the dialog gains one honest
 * sentence. Not a crash, not a silent success: `main.ts` installs a mount on every boot,
 * so the only person who ever sees that sentence is a developer running without it, and
 * they are owed the truth rather than a dialog that pretends.
 *
 * ── The seed (section 6.1, section 12 Q3: transfer-on-connect, one path) ─────────────────────
 *
 * The inviter serialises its live model ONCE, here, at ceremony start - and it does not
 * have to build that serialisation, because `CollabLaunchContext.baseParts` already IS
 * it: the Share dialog's own `buildShareParams(runtime)` output, the URL-mode encoding of
 * every declared input. `lib/collab-live-mount.ts`'s header explains why URL params are
 * the seed's currency rather than raw values (they are what `parseUrlState` types against
 * the manifest, which is also section 6.3's validation rule for a peer's payload).
 *
 * That one value is spent twice, in the two directions it has to travel:
 *
 *   - OUT, as the transport's in-band hello seed, so the acceptor's tool opens already
 *     populated instead of waiting for convergence to fill it in;
 *   - BACK, on {@link CollabConnection.seed}, so the inviter's own forced remount is born
 *     with the same model and unsaved edits survive becoming a collab.
 *
 * The outbound copy is PACKED when the engine can (`z=`, the same compression the address
 * bar uses above ~1800 chars) - the hello has a 64 KB frame ceiling and drops an
 * over-sized seed rather than lose the op-version declaration beside it. The local copy
 * stays readable, because the remount merges it with the address bar and two packed
 * blobs cannot be merged.
 *
 * ── The reply leg ──────────────────────────────────────────────────────────────
 *
 * section 11.25 calls the answer leg the ceremony's weak point and makes the reply a link too.
 * That link opens `#/join-reply` in a NEW tab, which posts the payload over a
 * `BroadcastChannel`; the listener wired here for the life of the dialog is the other end
 * of it. It drives the dialog's own paste path, so a reply that arrives this way is
 * validated, noticed and displayed exactly like one a human pasted.
 */

import { registerCollabOpener, type CollabLaunchContext } from '../lib/collab-launch.ts';
import { isFlagOnSync, PRIVATE_COLLAB_FLAG } from '../feature-flags.ts';
// A value import, and a free one: `lib/collab-mount.ts` imports nothing but types, so the
// registry costs the boot chunk a few lines and no platform at all.
import { deliverCollabConnection, releaseParked, type CollabConnection } from '../lib/collab-mount.ts';
// Likewise free: the seed codec is pure `URLSearchParams` work, and the module it lives in
// keeps every heavy thing behind a dynamic import (it is on the boot path itself).
import { seedFromBaseParts, seedToQuery } from '../lib/collab-live-mount.ts';
import type { CollabCeremonyHandle, CollabCeremonyOptions } from '../components/collab-ceremony.ts';
import type { CeremonyEffectsSource } from '../components/collab-ceremony.ts';
import type { CeremonyChannelLike, ChannelFactory } from './join-route.ts';
import type { RtcTransport } from './rtc-transport.ts';

/**
 * The wire form of the inviter's seed: the readable query, packed when the engine can and
 * when packing actually wins.
 *
 * Best-effort by construction - a browser without `CompressionStream` (`isPackAvailable`)
 * and a pack that came out no smaller both fall through to the readable form, which is
 * what `parseUrlState` reads on the far side either way. A failure here costs a faster
 * first paint, never the collab.
 */
async function wireSeed(query: string): Promise<string | undefined> {
  if (!query) return undefined;
  try {
    const { isPackAvailable, packQuery, PACK_PARAM } = await import('@lolly/engine');
    if (!isPackAvailable()) return query;
    const token = await packQuery(query);
    if (token == null) return query;
    // The same `z=<token>` shape `syncUrl` writes, and the same "only if it actually
    // helped" test - the acceptor's `expandQuery` reads it back either way.
    const packed = `${PACK_PARAM}=${token}`;
    return packed.length < query.length ? packed : query;
  } catch {
    return query;
  }
}

/**
 * Everything the opener would otherwise reach for itself.
 *
 * Supplying `openCeremony` AND `effects` skips the dynamic import entirely, which is what
 * lets this module's own suite run without a WebRTC stack, a camera or a QR encoder.
 */
export interface PrivateCollabDeps {
  readonly flagOn?: () => boolean;
  readonly openCeremony?: (opts: CollabCeremonyOptions) => CollabCeremonyHandle;
  readonly effects?: CeremonyEffectsSource;
  /** Report each transport built. Ignored when `effects` is supplied by the caller. */
  readonly onTransport?: (transport: RtcTransport) => void;
  /** The reply channel. `null` opens none (a browser without `BroadcastChannel`). */
  readonly channel?: ChannelFactory | null | undefined;
  /**
   * Replace the section 11.25 reply listener wholesale. Given a getter for the open dialog,
   * returns its teardown (or null for "not listening"). Only a test needs this - it is
   * how the wiring is observed without a real channel behind it.
   */
  readonly listen?: (dialog: () => ParentNode | null) => (() => void) | null;
  readonly profileName?: string;
  /** Base for the invite link. Defaults to the app root - see `join-route.ts`'s
   *  `appLinkBase`, and why the tool view's `/t/<id>` pathname must never be in it. */
  readonly linkBase?: string;
  readonly renderQr?: CollabCeremonyOptions['renderQr'] | null;
  readonly scan?: CollabCeremonyOptions['scan'] | null;
  /** Take the live pair. Defaults to the collab-mount registry + the scaffold note. */
  readonly onConnected?: (conn: CollabConnection, dialog: ParentNode | null) => void;
  /**
   * Build the {@link CollabConnection} from the connected ceremony. Defaults to Track A's
   * producer (`./rtc-connection.ts`), which is where the convergence document is built - 
   * a test with no transport behind its injected effects never reaches it.
   */
  readonly connect?: typeof import('./rtc-connection.ts')['rtcCollabConnection'];
}

/**
 * Open the INVITER ceremony for a session.
 *
 * Resolves with the dialog handle, or `null` when the flag is off - so a caller that
 * wants to know (a test, a future keyboard shortcut) can, while the registered opener
 * itself is fire-and-forget.
 */
export async function openPrivateCollab(
  ctx: CollabLaunchContext,
  deps: PrivateCollabDeps = {},
): Promise<CollabCeremonyHandle | null> {
  const flagOn = deps.flagOn ?? (() => isFlagOnSync(PRIVATE_COLLAB_FLAG));
  if (!flagOn()) return null;

  let transport: RtcTransport | null = null;
  // The live model, serialised once, at ceremony start - see the header. Pure
  // `URLSearchParams` work on a value the Share dialog already computed, so it costs
  // nothing on a flag-off open (which returned above).
  const seed = seedFromBaseParts(ctx.baseParts);
  const seedQuery = seedToQuery(seed);

  // One import for the whole platform half - the same chunk `#/join` loads. Skipped
  // entirely when the caller supplied both halves, which is what keeps this file's own
  // suite free of WebRTC, a camera and a QR encoder.
  let wiring: typeof import('./join-route.ts') | null = null;
  let track: typeof import('./rtc-connection.ts') | null = null;
  let qr: typeof import('./qr-skin.ts') | null = null;
  if (!deps.openCeremony || !deps.effects) {
    [wiring, track, qr] = await Promise.all([
      import('./join-route.ts'),
      import('./rtc-connection.ts'),
      // qr-skin is already inside join-route's chunk (it imports it statically), so this
      // costs no extra request - it just hands us the same `createQrElementRenderer` the
      // accept side uses, so the inviter's invite screen shows a scannable code too.
      import('./qr-skin.ts'),
    ]);
  }

  const open = deps.openCeremony ?? wiring?.openCollabCeremony;
  const effects = deps.effects ?? wiring?.createCollabEffects({
    toolId: ctx.toolId,
    // Transfer-on-connect (section 12 Q3), in band on the ops hello: the acceptor's tool opens
    // populated rather than empty-then-converging. Awaited before the dialog exists, so
    // the value is in the transport from its very first frame.
    seed: await wireSeed(seedQuery),
    onTransport: (built) => { transport = built; deps.onTransport?.(built); },
  });
  // Both are present by construction - `wiring` is loaded whenever either is missing.
  // The guard is for the type checker, not for a state this can actually reach.
  if (!open || !effects) return null;

  const scan = deps.scan === null ? undefined : deps.scan;
  // Default to drawing the invite as a QR, the same default the accept side
  // (`join-route.ts`) applies - so a second device can scan the invite instead of
  // copy-pasting the code. `null` opts out (this file's own suite has no QR encoder); a
  // caller-supplied renderer wins over the default.
  const renderQr = deps.renderQr === null ? undefined : deps.renderQr ?? qr?.createQrElementRenderer();

  let channel: CeremonyChannelLike | null = null;
  let stopListening: (() => void) | null = null;
  /** The pair this dialog handed on, so closing the dialog can hang up an unadopted one. */
  let handed: CollabConnection | null = null;

  const dialog = open({
    role: 'inviter',
    effects,
    toolId: ctx.toolId,
    profileName: deps.profileName,
    renderQr,
    scan,
    linkBase: deps.linkBase ?? wiring?.appLinkBase(),
    onConnected: (handle) => {
      const live = transport;
      const build = deps.connect ?? track?.rtcCollabConnection;
      // No transport (or no producer) means the caller injected effects with nothing
      // behind them. Handing the mount a connection it cannot send on - or hang up - 
      // would be worse than handing it nothing (`lib/collab-mount.ts`).
      if (!live || !build) return;
      const conn: CollabConnection = {
        ...build({
          role: 'inviter',
          ceremony: handle,
          transport: live,
          launch: ctx,
          // The inviter's own copy of the seed, readable rather than packed: the remount
          // merges it with the address bar, and a `z=` blob cannot be merged with params.
          seed,
        }),
        // The ceremony learns the tool from the invite it minted; the launch context is
        // the fallback for a dialog that never carried one.
        toolId: handle.toolId ?? ctx.toolId,
      };
      handed = conn;
      const take = deps.onConnected ?? wiring?.handOffConnection ?? ((c: CollabConnection) => { deliverCollabConnection(c); });
      take(conn, dialog.el);
    },
    onClose: () => {
      stopListening?.();
      stopListening = null;
      try { channel?.close(); } catch { /* a closed channel is the goal either way */ }
      channel = null;
      // A pair nobody adopted is a live peer connection with three data channels, and
      // the dialog will not close it (`lib/collab-mount.ts`: after `onConnected` the
      // transport belongs to whoever took it). Closing the ceremony is the moment we
      // know nobody will - a no-op once a mount has actually taken it.
      if (handed) { releaseParked(handed); handed = null; }
    },
  });

  // Wired for the whole life of the dialog rather than only while the machine is
  // awaiting an answer. The delivery helper is the real gate - it refuses (and so does
  // not ack) whenever the dialog has no reply field to fill, which is exactly every
  // phase before the invite exists and every phase after the pair is live. Listening
  // across all of them costs one closure and removes a race with the human, who can
  // click the reply link at any moment.
  if (deps.listen) {
    stopListening = deps.listen(() => dialog.el);
  } else if (wiring && deps.channel !== null) {
    channel = wiring.openCeremonyChannel(deps.channel);
    if (channel) stopListening = wiring.listenForReply(channel, () => dialog.el);
  }

  return dialog;
}

// Register once, as a side effect of import - see the header. `openCollabLaunch` already
// swallows a throwing opener; the rejection handler is for the async half, which it
// cannot see.
registerCollabOpener('private', (ctx) => {
  void openPrivateCollab(ctx).catch(() => { /* a collab that cannot open must not break Share */ });
});
