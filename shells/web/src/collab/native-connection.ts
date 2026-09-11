// SPDX-License-Identifier: MPL-2.0
/**
 * native-connection - a live native session as a `CollabConnection` (plans/110 section 4).
 *
 * The mirror of `collab/rtc-connection.ts` for the native LAN transport. It adapts a
 * `NativeTransportHandle` (byte lanes over the Tauri commands, `native-transport.ts`) into
 * the surfaces the collab mount consumes, REUSING `createRtcCollabHandle` - so the op
 * ordering, the presence roster, the section 6.2 divergence backstop, and the section 11.21 op validation
 * (which runs in the handle, not the transport) are all shared, not reimplemented.
 *
 * ── The two places native genuinely differs from WebRTC (verify on-device) ──────
 *
 * 1. `sendOp`/`sendPresence` are SYNCHRONOUS in the `RtcHandleTransport` contract, but
 *    `native_send` is async (a Tauri invoke). They fire-and-forget and return `'sent'`;
 *    a send that rejects flips the transport to `closed` and emits a `state` event, since a
 *    dead native socket is terminal (no ICE reconnect - a fresh pairing is needed). Marked
 *    ⟨SEND-SEAM⟩ below.
 * 2. The beam lane has no `bufferedamountlow`. Backpressure is TCP: the Rust reader stops
 *    reading when its reliable queue is full, so `native_send` awaits. We drive the beam's
 *    `nextChunk` pull off each send's RESOLUTION instead of a browser event. Marked
 *    ⟨BEAM-SEAM⟩ below. This is the one spot that wants a real large-beam test on two
 *    machines.
 */

import { createRtcCollabHandle } from './rtc-handle.ts';
import type { RtcHandleTransport } from './rtc-handle.ts';
import type {
  RtcTransportState,
  RtcSendResult,
  RtcInboundMessage,
  RtcPresenceOutbound,
  RtcBeamLane,
  RtcTransportEventMap,
} from './rtc-transport.ts';
import type { CollabBeamTransport } from './beam-ui.ts';
import type { CeremonyRole } from './ceremony.ts';
import type { CollabConnection } from '../lib/collab-mount.ts';
import type { CollabBeamCapable } from './beam-ui.ts';
import type { CollabLaunchContext } from '../lib/collab-launch.ts';
import type { NativeTransportHandle, NativeLane } from './native-transport.ts';
import { encodeOps, encodePresence, encodeBeam, decodeFrame } from './native-wire.ts';

/** A native session is connected the moment the handle exists (Rust did the handshake),
 *  so its transport state is a constant "live, no ICE" until it closes. `diagnosis` carries
 *  the value the real transport reports once everConnected - meaningful only on failure. */
function nativeState(open: boolean): RtcTransportState {
  const laneState = open ? 'open' : 'closed';
  return {
    connection: open ? 'live' : 'closed',
    ice: open ? 'connected' : 'closed',
    gathering: 'complete',
    lanes: { ops: laneState, presence: laneState, beam: laneState },
    everConnected: true,
    localCandidates: 0,
    remoteCandidates: 0,
    candidatePairSeen: true,
    diagnosis: 'connection-lost',
    isolationSuspected: false,
  };
}

/** A tiny event bus over the native handle: one poll subscription, decoded once, fanned to
 *  message listeners; plus a state-change fan. */
interface NativeBus {
  onMessage(fn: (m: RtcInboundMessage) => void): () => void;
  emitState(): void;
  onState(fn: (s: RtcTransportState) => void): () => void;
  markClosed(): void;
  isOpen(): boolean;
}

function nativeBus(handle: NativeTransportHandle): NativeBus {
  const msgSubs = new Set<(m: RtcInboundMessage) => void>();
  const stateSubs = new Set<(s: RtcTransportState) => void>();
  let open = true;
  let unsub: (() => void) | null = null;

  function ensureSub(): void {
    if (unsub || !open) return;
    unsub = handle.subscribe((lane: NativeLane, bytes: Uint8Array) => {
      const msg = decodeFrame(lane, bytes);
      if (msg) for (const fn of msgSubs) fn(msg);
    });
  }

  return {
    onMessage(fn) {
      msgSubs.add(fn);
      ensureSub();
      return () => { msgSubs.delete(fn); };
    },
    onState(fn) {
      stateSubs.add(fn);
      return () => { stateSubs.delete(fn); };
    },
    emitState() {
      const s = nativeState(open);
      for (const fn of stateSubs) fn(s);
    },
    markClosed() {
      if (!open) return;
      open = false;
      if (unsub) { unsub(); unsub = null; }
      const s = nativeState(false);
      for (const fn of stateSubs) fn(s);
    },
    isOpen() { return open; },
  };
}

export interface NativeTransportOptions {
  readonly clientId: string;
  readonly opVersion?: string;
}

/** Present a native session as the narrow `RtcHandleTransport` `createRtcCollabHandle` takes.
 *  Also exposes `bus` so the connection wrapper can send the hello + drive the beam over the
 *  same subscription. */
export function nativeAsRtcTransport(
  handle: NativeTransportHandle,
  opts: NativeTransportOptions,
): RtcHandleTransport & { readonly bus: NativeBus } {
  const bus = nativeBus(handle);

  // ⟨SEND-SEAM⟩ async send, sync result. A rejected send is a dead socket ⇒ terminal.
  function fire(lane: NativeLane, bytes: Uint8Array): RtcSendResult {
    if (!bus.isOpen()) return 'closed';
    handle.send(lane, bytes).catch(() => bus.markClosed());
    return 'sent';
  }

  return {
    bus,
    clientId: opts.clientId,
    state(): RtcTransportState {
      return nativeState(bus.isOpen());
    },
    sendOp(op: unknown): RtcSendResult {
      return fire('ops', encodeOps({ kind: 'op', op }));
    },
    sendPresence(frame: RtcPresenceOutbound): RtcSendResult {
      return fire('presence', encodePresence(frame));
    },
    on<K extends keyof RtcTransportEventMap>(type: K, fn: (value: RtcTransportEventMap[K]) => void): () => void {
      if (type === 'message') return bus.onMessage(fn as (m: RtcInboundMessage) => void);
      if (type === 'state') return bus.onState(fn as (s: RtcTransportState) => void);
      // 'channel-open' - native lanes are open from birth and the handle never subscribes
      // to it (it uses message + state only); a no-op teardown satisfies the type.
      return () => {};
    },
    close(): void {
      bus.markClosed();
      void handle.close();
    },
  };
}

/** The beam lane over a native session. ⟨BEAM-SEAM⟩ backpressure is TCP: we pull the next
 *  chunk when the previous send RESOLVES (native has no bufferedamountlow). */
function nativeBeamLane(handle: NativeTransportHandle, bus: NativeBus): RtcBeamLane {
  const drains = new Set<() => void>();
  function fireDrains(): void {
    for (const pull of drains) pull();
  }
  function send(bytes: Uint8Array): void {
    if (!bus.isOpen()) return;
    handle.send('beam', bytes).then(fireDrains).catch(() => bus.markClosed());
  }
  return {
    json(message: unknown): void { send(encodeBeam({ json: message })); },
    binary(bytes: Uint8Array): void { send(encodeBeam({ bytes })); },
    onDrain(pull: () => void): () => void {
      drains.add(pull);
      // Kick the sender once - the lane is already open.
      if (bus.isOpen()) queueMicrotask(pull);
      return () => { drains.delete(pull); };
    },
    bufferedAmount(): number { return 0; }, // no JS-side buffer; backpressure lives in TCP
    lowThreshold: 256 * 1024,
    isOpen(): boolean { return bus.isOpen(); },
  };
}

/** The `CollabBeamTransport` (beam lane + its own message subscription). */
function nativeBeamTransport(handle: NativeTransportHandle, bus: NativeBus): CollabBeamTransport {
  return {
    beam: nativeBeamLane(handle, bus),
    on(_type: 'message', fn: (message: RtcInboundMessage) => void): () => void {
      return bus.onMessage(fn);
    },
  };
}

export interface NativeConnectionInput {
  readonly handle: NativeTransportHandle;
  readonly role: CeremonyRole;
  readonly clientId: string;
  readonly opVersion?: string;
  /** The chosen display name (section 11.23), never a profile field. */
  readonly localName?: string;
  readonly peerName?: string;
  readonly toolId?: string;
  /** Inviter only: the Share-dialog context. */
  readonly launch?: CollabLaunchContext;
  /** Inviter only: the packed session seed to send over the ops-lane hello (section 6.1). */
  readonly seedQuery?: string;
}

/**
 * A live native session as a {@link CollabConnection}. Structurally the native mirror of
 * `rtcCollabConnection`: build the handle over the adapter, publish the beam, and hand the
 * mount everything it reads.
 *
 * The inviter sends the ops-lane hello (with its packed seed) once the handle is up; the
 * acceptor receives it through the handle's own ops path, exactly as on the WebRTC track.
 * The plate is already established (Rust `h` → `derivePlateFromTranscript`) - there is no
 * offer/answer here, only the plate compare, which the ceremony did before this call.
 */
export function nativeCollabConnection(input: NativeConnectionInput): CollabConnection & CollabBeamCapable {
  const { handle, role, clientId } = input;
  const transport = nativeAsRtcTransport(handle, { clientId, opVersion: input.opVersion });

  const collabHandle = createRtcCollabHandle({
    transport,
    role,
    self: { clientId, name: input.localName || undefined },
  });

  // The inviter announces itself + seeds the acceptor over the ops-lane hello (section 6.1). The
  // hello is not an op, so it goes through the raw handle + codec, not `sendOp`.
  if (role === 'inviter') {
    const hello = encodeOps({
      kind: 'hello',
      clientId,
      ...(input.opVersion ? { opVersion: input.opVersion } : {}),
      ...(input.seedQuery ? { seed: input.seedQuery } : {}),
    });
    void handle.send('ops', hello).catch(() => transport.bus.markClosed());
  }

  return {
    role,
    handle: collabHandle,
    close: () => { collabHandle.close(); },
    toolId: input.toolId,
    launch: input.launch,
    // section 6.2a: the inviter owns the saved session; the acceptor's copy is ephemeral.
    ephemeral: role === 'acceptor',
    beam: {
      transport: nativeBeamTransport(handle, transport.bus),
      role,
      ...(input.peerName ? { peerName: input.peerName } : {}),
      ...(input.localName ? { selfName: input.localName } : {}),
    },
  };
}
