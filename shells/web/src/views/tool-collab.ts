// SPDX-License-Identifier: MPL-2.0
/**
 * tool-collab - the presence chrome of ONE mounted tool, composed (plan 100 section 4.6, section 5).
 *
 * `views/tool.ts` owns a single guarded block that asks whether this mount is part of
 * a collab and, if it is, imports this module. Everything the answer "yes" costs - a
 * session, an overlay layer, remote focus rings, a cursor ticker, a stage pill, and
 * the exact undo for all five - lives here and nowhere else.
 *
 * ── WHY IT IS A SEPARATE MODULE, NOT A HUNDRED LINES OF `mountTool` ───────────
 *
 * Two reasons, both of them properties a reviewer can check rather than preferences.
 *
 * 1. IT MUST COST A SINGLE-PLAYER BUILD NOTHING. `collab-pill.ts`'s own header sets
 *    that rule ("a collab is lazy chrome that must cost a single-player build
 *    nothing"), and a static import from the tool view would break it silently: the
 *    session, the palette derivation, the presence engine, the pill, the rings and
 *    the cursors would ride the tool chunk into every mount that will never use
 *    them. Reached through one `import()` inside the guard, they are a chunk that is
 *    never fetched - the same treatment `neuro-dock`/`music-player` get.
 * 2. `mountTool` CANNOT BE TESTED. It imports stylesheets and reaches modules that
 *    resolve siblings with `.js` specifiers, so no suite outside Vite can mount it - 
 *    which is why the tool view's guards are all source scans. This module imports
 *    neither, so the composition is exercised for real against jsdom: mounted,
 *    driven, and torn down with the leak assertions that actually matter.
 *
 * ── THE INVARIANT THAT OUTRANKS EVERY OTHER ──────────────────────────────────
 *
 * NOTHING HERE WRITES INTO THE RENDER. The canvas is passed to be MEASURED and read;
 * the rings and cursors paint on an overlay layer `mountOverlayLayer` deliberately
 * climbs OUT of it, and the pill is a child of the stage. A collaborator's presence
 * must not be able to change a single byte of an exported PNG (section 4.6, section 8) - and the
 * sidebar is the one surface decorated in place, because the sidebar is chrome and
 * is never exported.
 *
 * The one exception to "read only" that is not an exception: remote focus is painted
 * from element RECTS, never by writing a class or an attribute into tool DOM. A
 * template repaint swaps `innerHTML` wholesale, so a decoration written into it
 * would be destroyed on the next keystroke and the layer would drift out of sync
 * with the document it decorates.
 */

import type { CanvasOp } from '@lolly-tools/core/canvas-op-v1';
import type { HostV1 } from '@lolly-tools/core/host-v1';
import { createCollabFocus } from '../components/collab-focus.ts';
import type { CollabFocus } from '../components/collab-focus.ts';
import { createCollabCursors, mountOverlayLayer } from '../components/collab-overlay.ts';
import type { CollabCursors, OverlayLayer } from '../components/collab-overlay.ts';
import { collabDisplayName, mountCollabPill } from '../components/collab-pill.ts';
import type { CollabPill } from '../components/collab-pill.ts';
import { attachCollabBeam } from '../lib/collab-live-mount.ts';
import type { CollabBeamAttachment } from '../lib/collab-live-mount.ts';
import type { BeamPackHost } from '../lib/beam-pack.ts';
import type { CollabRuntime } from '../lib/collab-plumbing.ts';
import { createCollabSession } from '../lib/collab-session.ts';
import type {
  CollabRole, CollabSession, CollabSessionHandle, CollabSessionState, CollabStream,
  CollabToolManifest,
} from '../lib/collab-session.ts';
import { livePalette } from '../lib/live-palette.ts';

/** Gap between the collab pill and whatever else owns the stage's top lane. */
export const PILL_LANE_GAP_PX = 8;

/**
 * The two OPTIONAL lanes a transport may expose beyond `CollabSessionHandle`.
 *
 * `CollabSessionHandle` deliberately carries neither: a session takes ops through
 * `applyRemotePatch`, "which the MOUNT calls" (`org/collab-handle.ts`'s own header),
 * and it reads `handle.role` live rather than being told when it changes. Both tracks
 * DO publish them, under these two names - Track A on `RtcCollabHandle` (rtc-handle.ts),
 * Track B on the adapter (`org/collab-handle.ts`) - so this is the one place that has to
 * know they exist, and it reads them STRUCTURALLY rather than importing either track.
 * A transport that publishes neither still mounts; it simply never receives.
 */
interface CollabHandleLanes {
  readonly opsIn?: CollabStream<readonly CanvasOp[]>;
  readonly roleIn?: CollabStream<CollabRole>;
}

/** One optional lane, or null when this transport does not publish it. Duck-typed on
 *  `subscribe` alone, which is the whole of {@link CollabStream}. */
function lane<T>(handle: CollabSessionHandle, key: keyof CollabHandleLanes): CollabStream<T> | null {
  const stream = (handle as CollabHandleLanes)[key] as CollabStream<T> | undefined;
  return stream && typeof stream.subscribe === 'function' ? stream : null;
}

export interface ToolCollabOptions {
  /** The transport, straight from `lib/collab-session-source.ts`. */
  handle: CollabSessionHandle;
  /** The mounted tool's runtime - the same object the op plumbing wraps. */
  runtime: CollabRuntime;
  /** The tool being edited (`tool.manifest`). */
  toolManifest?: CollabToolManifest | null;
  /** The host bridge: the pack's colour tokens (section 4.4), and the bridge an OUTGOING beam
   *  is packed from - which for an acceptor is the memory-backed clone (section 11.17), so a
   *  working copy that may never reach a slot on this device can still be given away. */
  host?: HostV1 | null;
  /**
   * The bridge as it was BEFORE the acceptor's ephemeral swap - where a RECEIVED beam
   * lands. Identical to {@link ToolCollabOptions.host} for everyone else, and omitted
   * means "the same one".
   *
   * A received beam is a disclosed gift the human accepted by name, not the acceptor's
   * borrowed copy of the inviter's document: section 6.4 says it "lands attributed ('From
   * Priya') in the receiver's library, storage meter updated honestly", and section 11.17's
   * ephemerality rule is about the collab document and nothing else. Landing it in the
   * memory store made the toast report a success that evaporated at teardown - and only
   * half of one, since the assets ride `host.assets` and were persisting all along.
   */
  libraryHost?: HostV1 | null;
  /**
   * The `__export_*` markers a save writes, read at the moment a beam is sent.
   *
   * They do not live in the input model - the export bar owns them (`renderActions`'s
   * `sessionSnapshot`) - and `views/tool.ts` reads them straight back off a resumed
   * session, so a beam without them arrives at tool defaults: an A3 300 DPI setup with
   * bleed and marks reopens on the receiver as a default-size PNG. Optional, because a
   * tool with no export bar has none; only `__export_`-prefixed keys are taken, so this
   * can never become a second, competing source of input values.
   */
  exportSettings?: (() => Record<string, unknown> | null) | null;
  /** `.tool-stage` - the pill's container and the overlay layer's host. Both are
   *  siblings of the render surface, which is the section 4.6 rule made structural. */
  stage: HTMLElement;
  /** `#tool-canvas` / `#tool-content` - the render surface. READ ONLY. */
  canvas: HTMLElement;
  /** `#tool-inputs`. Null for a hideSidebar layout, which then reports no focus. */
  sidebar?: HTMLElement | null;

  /** Pre-derived collaborator colours; skips the palette read entirely (tests). */
  colors?: Parameters<typeof createCollabSession>[0]['colors'];
  /** Injected so a test can drive the session without the real timers. */
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  raf?: (fn: () => void) => void;
}

export interface ToolCollab {
  /** The live session, for a caller that wants to read the roster. */
  readonly session: CollabSession;
  /** Re-measure and re-apply every presence decoration. THE hook the tool view's
   *  rAF paint and stage ResizeObserver call - a canvas rebuild moves every rect
   *  the rings are anchored from, and a sidebar rebuild washes their classes off. */
  reanchor(): void;
  /** Everything down, in reverse of construction. Idempotent. */
  teardown(): void;
}

/**
 * The pack's colour tokens as `collabPalette` takes them, and the accent that
 * anchors the hue spin (section 4.4 - collaborator colours are derived from the ACTIVE
 * design system, never a fixed list).
 *
 * Neither read may fail the mount: a pack that answers nothing simply yields the
 * default circle, which is legible by construction because the band is calibrated
 * rather than chosen.
 */
async function packColors(host: HostV1 | null | undefined): Promise<{ palette?: string[]; accent: string | null }> {
  let palette: string[] | undefined;
  let accent: string | null = null;
  if (!host) return { accent };
  try {
    palette = (await livePalette(host)).map(p => p.hex).filter(Boolean);
  } catch { /* no tokens: the whole circle is spun from the accent instead */ }
  try {
    const primary = await host.tokens?.resolve('color.semantic.primary');
    if (typeof primary === 'string' && primary) accent = primary;
  } catch { /* a pack with no semantic primary anchors on its first chromatic hue */ }
  return { ...(palette ? { palette } : {}), accent };
}

/** The slice of an input-model item this module reads - structural, so a test can build
 *  one from a literal and the engine's `InputModelItem` satisfies it unchanged. */
interface SessionModelItem {
  readonly id: string;
  readonly type?: string;
  readonly value: unknown;
}

/**
 * A value holding the user's own file bytes, wherever it came from.
 *
 * Duck-typed on `__file`, the same way `views/tool-inputs.ts` recognises one, rather than
 * imported from the engine: the shape is the engine's `InputFile` and this is the third
 * place in the shell to read it structurally. `multiple` file inputs hold an ARRAY of
 * them, and one picked file in the array condemns the whole value - a half-sent list is
 * worse than an empty one.
 */
function holdsPickedFile(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(holdsPickedFile);
  return !!value && typeof value === 'object' && (value as { __file?: unknown }).__file === true;
}

/**
 * The live model as a session record holds it - MINUS the one thing that must never go
 * on the wire.
 *
 * `file` inputs are the user's own file, held in memory as an `InputFile` whose `bytes`
 * are a `Uint8Array`. section 3's exclusions say it plainly ("`file` inputs never sync", "local
 * file - not shared"), and the beam's own design agrees: bytes travel as chunked asset
 * ITEMS, checksummed and consented to, never inline in the session JSON. What actually
 * happened when one did is worth recording, because none of the guards caught it:
 * `buildBeamOffer` ends with `JSON.stringify(sessionData)`, and JSON.stringify renders a
 * Uint8Array as `{"0":137,"1":80,…}` - measured here at ~12× the bytes (13.1 million
 * characters for a 1 MB pick, 70 million for a 5 MB one; the exact ratio moves with the
 * data), under a 100 MB pick cap and a 1 GB item ceiling that would both wave it through.
 * Before that, `collectSessionAssetRefs` walks the same object and recurses into
 * `Object.values()` of the byte array, once per byte. And it arrives BROKEN: the receiver
 * JSON.parses a numeric-keyed object where a Uint8Array belongs, plus a `blob:` URL from
 * another origin, and `isFileValue()` still says true - so a hook reads
 * `bytes.byteLength === undefined` instead of failing cleanly.
 *
 * The key is dropped rather than blanked: an absent input reads as "not set" everywhere
 * (URL mode, a resumed slot, the model), while a `null` would be a value the receiver's
 * tool has to interpret.
 *
 * Both the DECLARED type and the value shape are checked. The declaration is the contract
 * (`file`, and `darkroom`/`convert-image`/`compress-pdf`/`claim`/
 * `font-convert`/`strip-data`/`redact`/`rebrand-deck` all have one); the shape is what a
 * hook could put anywhere, and the property that matters is "no bytes leave", not "the
 * manifest was honest".
 */
export function liveSessionState(
  model: readonly SessionModelItem[],
  extras?: Record<string, unknown> | null,
): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  for (const item of model) {
    if (item.type === 'file' || holdsPickedFile(item.value)) continue;
    state[item.id] = item.value;
  }
  // The export bar's markers, and ONLY those: everything else a caller might hand over
  // would be shadowing an input value from outside the model that produced it.
  for (const [key, value] of Object.entries(extras ?? {})) {
    if (key.startsWith('__export_')) state[key] = value;
  }
  return state;
}

/**
 * Where the pill sits in the stage's top-inline-end lane.
 *
 * `collab-pill.ts` deliberately refuses to place itself - it cannot see the zoom HUD
 * it shares that lane with, and a component that pinned its own position would be a
 * collision nobody could fix from outside. So the clearance is MEASURED: the HUD's
 * width moves with the zoom readout and its docked toggles, so a constant would be
 * wrong at the first theme toggle.
 *
 * Exported for the test, and because the arithmetic is the whole of the contract.
 */
export function pillLaneOffset(stage: HTMLElement, width: (el: HTMLElement) => number): string {
  // The HUD is anchored to the PHYSICAL right (`right:`, editor.css) and the pill to
  // the LOGICAL inline end, so in RTL they sit on opposite edges of the stage and
  // there is nothing at all to clear.
  const rtl = stage.ownerDocument.documentElement.dir === 'rtl';
  const nav = rtl ? null : stage.querySelector<HTMLElement>('.stage-nav');
  const w = nav ? Math.round(width(nav)) : 0;
  return w > 0 ? `${w + PILL_LANE_GAP_PX}px` : '';
}

/**
 * Compose one tool mount's presence chrome. Resolves once everything is on screen;
 * the caller holds the returned handle and must call `teardown()` exactly where it
 * tears down the rest of the mount.
 *
 * CONSTRUCTION IS UNWOUND ON A THROW, and the teardown list is what unwinds it. Every
 * step is pushed onto `steps` the instant the thing it undoes exists, so the rollback
 * path and the teardown path are literally the same code - there is no second,
 * quietly-diverging cleanup to keep in sync. Without it the failure is invisible and
 * permanent: `createCollabSession` arms a 15 s presence heartbeat and a 3 s sweep,
 * adds `visibilitychange` on the document, adds a focusin/focusout pair on the sidebar
 * root, and wraps `runtime.setInput` - and the caller in `views/tool.ts` catches the
 * throw, drops the teardown handle and closes only the transport, so `session.close()`
 * is never reached. A tool view the user navigated away from would keep those timers
 * and listeners for the life of the tab.
 */
export async function mountToolCollab(opts: ToolCollabOptions): Promise<ToolCollab> {
  const { handle, runtime, stage, canvas } = opts;
  const sidebar = opts.sidebar ?? null;

  const { palette, accent } = opts.colors ? { palette: undefined, accent: null } : await packColors(opts.host);

  // Reverse of construction: each step is UNSHIFTED as its subject comes into being,
  // so the list is always "undo everything that exists, newest first". The transport
  // closes LAST so presence can still broadcast its leave frame down a live channel - 
  // peers drop us immediately instead of ghosting for the 30 s TTL.
  const steps: (() => void)[] = [];
  const unwind = (why: string): void => {
    // One failing step must never strand the rest - which is exactly what the
    // per-step catch buys, on both the rollback and the teardown path.
    for (const step of steps.splice(0)) {
      try { step(); } catch (e) { console.warn(`[lolly:collab] ${why}`, e); }
    }
  };

  try {
    const session: CollabSession = createCollabSession({
      handle,
      runtime,
      toolManifest: opts.toolManifest ?? null,
      // ONE delegated focusin/focusout pair on the sidebar root. That is what makes
      // "which control are you in" the presence primitive every tool gets for free
      // (section 4.1), and delegation is what makes it survive the sidebar's rebuilds.
      sidebarRoot: sidebar,
      ...(opts.colors ? { colors: opts.colors } : { palette, accent }),
      ...(opts.now ? { now: opts.now } : {}),
      ...(opts.setTimer ? { setTimer: opts.setTimer } : {}),
      ...(opts.clearTimer ? { clearTimer: opts.clearTimer } : {}),
      ...(opts.raf ? { raf: opts.raf } : {}),
    });
    steps.unshift(() => session.close());

    // ONE layer for both canvas surfaces - the z-order the two component sheets
    // assume (focus boxes under cursors), and one node instead of two. `canvas` is
    // handed over as the thing to MEASURE: mountOverlayLayer walks the host OUT of it
    // and returns null rather than mounting inside the render surface (see the header).
    const layer: OverlayLayer | null = mountOverlayLayer(canvas, stage);
    steps.unshift(() => layer?.unmount());

    const focus: CollabFocus = createCollabFocus({
      sidebar,
      canvas,
      layer: layer?.el ?? null,
      // A blocks row is addressed by its stable id on the wire and by array index in
      // the DOM; the model is the only thing that maps one to the other.
      getModel: () => runtime.getModel(),
    });
    steps.unshift(() => focus.dispose());

    const cursors: CollabCursors = createCollabCursors({ stage: canvas, layer: layer?.el ?? null });
    steps.unshift(() => cursors.dispose());

    /**
     * THE BEAM'S ENTRY POINT (section 6.4), and the reason it is HERE.
     *
     * The paired channel is a general conduit - co-editing is one payload type on it,
     * and a whole session (with the uploads it references) is another. The stack for
     * that shipped complete and unreachable: nothing created the session, mounted the
     * toast or called `sendCurrentSession`. `attachCollabBeam` is that call, and it can
     * only be made from a mounted tool, because a beam needs three things nothing
     * earlier in the chain holds: the host bridge it packs from (already swapped to the
     * acceptor's memory state by `views/tool.ts`, section 11.17 - so an ephemeral copy beams
     * through the identical path), the live model it sends, and a page for the toast.
     *
     * The two directions take DIFFERENT hosts, and that asymmetry is the whole of section 11.17
     * versus section 6.4. Outgoing packs from `host`: for an acceptor that is the memory clone,
     * which is right - the working copy is theirs to give away and must not touch a slot.
     * Incoming lands in `libraryHost`, the bridge as it was before the swap, because a
     * received beam is a gift the human accepted by name and section 6.4 promises it lands in
     * their library. With one host for both, an acceptor's toast reported a success that
     * evaporated at teardown - and only half of one: the assets go through
     * `host.assets`, which was never swapped, so they persisted while the session they
     * belong to did not.
     *
     * `null` for every collab that cannot beam, which is every WORK collab: Track B's
     * transport publishes no bulk lane (section 7), so the pill grows no control rather than
     * one that answers "not available".
     */
    const currentSession = (): { state: Record<string, unknown>; label?: string } => {
      // The live model, by value, as a save would write it - NOT the URL-mode params a
      // seed travels in (`lib/collab-live-mount.ts`'s header says why that encoder is
      // lossy). A beam moves bytes over an established channel, so an uploaded logo and
      // a 40 KB paragraph travel intact; a PICKED FILE deliberately does not, and
      // `liveSessionState` is where that rule and its reasons live.
      let settings: Record<string, unknown> | null = null;
      // Read at press time, off a bar that may not exist. A throw here would cost the
      // user their whole beam over a size field, so it costs them the size field.
      try { settings = opts.exportSettings?.() ?? null; }
      catch (e) { console.warn('[lolly:collab] export settings', e); }
      const state = liveSessionState(runtime.getModel(), settings);
      // `CollabToolManifest` narrows to `{ id? }`, but the object the tool view passes
      // is the whole manifest - read structurally, for the same reason the two lanes
      // above are, and absent fields simply do not travel.
      const manifest = opts.toolManifest as { id?: string; name?: string; version?: string } | null | undefined;
      if (manifest?.id) state.__toolId = manifest.id;
      if (manifest?.version) state.__toolVersion = manifest.version;
      return { state, ...(manifest?.name ? { label: manifest.name } : {}) };
    };

    // Both hosts are WEB-BRIDGE slices (`_exportUserAssets` and friends), wider than the
    // tool-facing HostV1 this module is typed against - the same structural cast
    // `lib/data-transfer.ts` makes for a backup.
    const asPackHost = (h: HostV1 | null | undefined): BeamPackHost | null =>
      (h ?? null) as unknown as BeamPackHost | null;
    const beam: CollabBeamAttachment | null = await attachCollabBeam({
      toolId: opts.toolManifest?.id ?? '',
      // Where a received beam LANDS: the un-swapped library, falling back to the only
      // host there is for every mount that never swapped one (all of them but an
      // acceptor's).
      host: asPackHost(opts.libraryHost ?? opts.host),
      // What an outgoing beam is PACKED from: this mount's own host, ephemeral or not.
      packHost: asPackHost(opts.host),
      currentSession,
    });
    if (beam) steps.unshift(() => beam.close());

    // No `onInvite`: the ceremony lives behind the launch registry, which no build
    // wires yet, and the pill renders no invite button without one rather than a
    // control that does nothing. The beam's action follows the identical rule one slot
    // over - supplied only when there is something for it to do.
    const pill: CollabPill = mountCollabPill(stage, {
      source: session,
      className: 'collab-pill--stage',
      ...(beam ? { actions: beam.actions } : {}),
    });
    steps.unshift(() => pill.destroy());

    const syncPillLane = (): void => {
      const next = pillLaneOffset(stage, el => el.getBoundingClientRect().width);
      if (pill.el.style.getPropertyValue('--collab-pill-offset') === next) return;
      if (next) pill.el.style.setProperty('--collab-pill-offset', next);
      else pill.el.style.removeProperty('--collab-pill-offset');
    };
    syncPillLane();

    /**
     * Roster → the two overlays.
     *
     * The cursor sample is deliberately not on `CollabParticipant` (a true x/y cursor
     * is opt-in per tool, section 4.3, while focus ships on every tool), so it is read off
     * the presence roster and joined by client id. `collabDisplayName` supplies
     * section 4.5's Host/Invitee fallback, so a peer who chose no name still has something
     * on their chip rather than a blank one.
     */
    const paint = (state: CollabSessionState): void => {
      const cursorOf = new Map(session.presence.roster().map(p => [p.id, p.state.cursor]));
      const peers = state.peers.map(p => ({
        id: p.clientId,
        name: collabDisplayName(p),
        color: p.color,
        away: p.away,
      }));
      // The two surfaces are updated INDEPENDENTLY, and that is not defensive habit.
      // A session swallows a subscriber's exception by design (a consumer's failure is
      // its own), so a single throw in the first surface would take the second one
      // down with it and surface as "presence just stopped" with nothing in the
      // console - which is precisely how this was found (a missing
      // `requestAnimationFrame` inside `announce()` cost the cursor layer every frame,
      // silently).
      try {
        focus.setPeers(peers.map((base, i) => ({ ...base, focus: state.peers[i]?.focus ?? null })));
      } catch (e) { console.warn('[lolly:collab] focus paint', e); }
      try {
        cursors.setPeers(peers.map(base => ({ ...base, cursor: cursorOf.get(base.id) ?? null })));
      } catch (e) { console.warn('[lolly:collab] cursor paint', e); }
    };
    paint(session.state());
    const unsubscribe = session.subscribe(paint);
    steps.unshift(unsubscribe);

    /**
     * THE OPS WIRE. Without it a collab is a beautiful lie: the roster fills, the rings
     * and cursors track, the pill reads "live" - and every edit on either side is local
     * forever, because nothing was joining the transport's inbound ops to the session.
     * Both adapters say in their headers that the MOUNT owns this one line, and this is
     * the mount.
     *
     * `session.applyRemotePatch` is the only door: it runs the section 11.21 op guard before
     * the plumbing queues anything, so a hostile batch never reaches the converging
     * document, and the plumbing then coalesces per frame and lands them atomically. A
     * throw here is contained for the same reason the paint is - a transport must not be
     * able to take a mount down - but it is LOUD, because silent op loss is the one
     * failure a user cannot see and cannot work around.
     */
    const opsIn = lane<readonly CanvasOp[]>(handle, 'opsIn');
    if (opsIn) {
      steps.unshift(opsIn.subscribe((ops) => {
        if (!ops || ops.length === 0) return;
        try { session.applyRemotePatch(ops); } catch (e) { console.warn('[lolly:collab] apply ops', e); }
      }));
    }

    /**
     * THE ROLE WIRE (section 11.19). A downgrade to observer is decided by the transport - an
     * incompatible op-contract major on Track A, the gateway's seat on Track B - and
     * `CollabSessionState.role` is rebuilt from `handle.role` on every notify, so the
     * pill's observer banner is already correct as soon as anything notifies. What was
     * missing is the notify: a demotion that arrives while nothing else is happening
     * changed the handle and told nobody. `refreshLocation()` is the session's public
     * "republish and notify", which is exactly the effect wanted - the extra presence
     * frame it sends is one frame, and it is honest.
     */
    const roleIn = lane<CollabRole>(handle, 'roleIn');
    if (roleIn) {
      // Both tracks REPLAY the current role on subscribe, so the first callback lands
      // synchronously with a value we already have; the latch makes that a no-op rather
      // than a spurious republish during construction.
      let seenRole: CollabRole = session.state().role;
      steps.unshift(roleIn.subscribe((next) => {
        if (next === seenRole) return;
        seenRole = next;
        try { session.refreshLocation(); } catch (e) { console.warn('[lolly:collab] role change', e); }
      }));
    }

    return {
      session,
      /**
       * Called from the tool view's rAF paint, which does the URL sync, the export
       * dimension drivers and the auto-export AFTER it - so a throw here would not
       * degrade presence, it would break the tool. Presence is cosmetic and the
       * render is not: each step is isolated, and a failing one is reported and
       * stepped over.
       */
      reanchor(): void {
        try { focus.reanchor(); } catch (e) { console.warn('[lolly:collab] focus reanchor', e); }
        try { cursors.reanchor(); } catch (e) { console.warn('[lolly:collab] cursor reanchor', e); }
        try { syncPillLane(); } catch (e) { console.warn('[lolly:collab] pill lane', e); }
      },
      teardown(): void {
        // `splice(0)` empties the list on the first run, so a second teardown - which
        // the tool view's abort path can genuinely produce - is a no-op rather than a
        // double dispose.
        unwind('teardown');
      },
    };
  } catch (e) {
    // Everything that DID get built comes down before the throw continues out. The
    // caller only ever learns "the collab failed"; it has no handle to clean up with,
    // which is why cleaning up is this function's job and not its caller's.
    unwind('mount rollback');
    throw e;
  }
}
