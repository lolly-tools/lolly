// SPDX-License-Identifier: MPL-2.0
/**
 * native-transport - the JS driver for the native LAN socket transport (plans/110 section 4).
 *
 * The transport itself is Rust (`src-tauri/src/native_transport.rs`): it connects the
 * socket, runs the Noise handshake, and streams framed lane messages. This module is the
 * thin JS side - it drives that transport over the poll-based Tauri command surface, the
 * same shape as `lib/nearby-boot.ts`:
 *
 *   native_connect({peerId}) -> {sessionId, plateHex}   connect (initiator) + handshake
 *   native_poll_inbound() -> [{sessionId, plateHex}]     inbound (responder) sessions to adopt
 *   native_adopt({sessionId}) -> bool                    claim an inbound session
 *   native_send({sessionId, lane, data(b64)})            send one lane frame
 *   native_recv({sessionId}) -> [{lane, data(b64)}]      drain buffered inbound frames
 *   native_plate({sessionId}) -> hex                     the handshake hash h (SAS plate input)
 *   native_close({sessionId})                            tear down
 *
 * ── What this is NOT ──────────────────────────────────────────────────────────
 *
 * It is NOT the WebRTC transport's ceremony surface. There is no ICE, no offer/answer, no
 * op-version-hello here: by the time a handle exists the pair is already cryptographically
 * connected (Rust did the handshake). What remains for the ceremony is the SAS plate - 
 * `plate()` returns `h`, which the ceremony feeds to `derivePlateFromTranscript` (plate.ts)
 * and the humans compare. The commitment in the Rust handshake is what makes that plate a
 * real MITM barrier (see plate.ts's caveat). Adapting a handle into a `CollabConnection`
 * (the lanes the mount consumes) is the ceremony-integration step above this module.
 *
 * ── The lanes ─────────────────────────────────────────────────────────────────
 *
 * `ops` and `beam` are reliable+ordered, `presence` is lossy - the Rust inbox enforces that
 * (reliable frames are never dropped; presence is drop-oldest), so this side just fans each
 * decoded frame to its subscriber. A single poll drains every buffered frame at once, so the
 * only latency is the poll interval.
 */

import { tauriInvoke, type TauriInvoke } from '../lib/nearby-boot.ts';

export type NativeLane = 'ops' | 'presence' | 'beam';
const LANES: readonly NativeLane[] = ['ops', 'presence', 'beam'];

/** An inbound session awaiting adoption: its id and the SAS plate input (hex of `h`). */
export interface NativeInbound {
  readonly sessionId: string;
  readonly plateHex: string;
}

/** Injectable environment so the driver is unit-testable with a fake invoke + clock. */
export interface NativeEnv {
  invoke: TauriInvoke;
  setInterval?: (fn: () => void, ms: number) => unknown;
  clearInterval?: (h: unknown) => void;
}

/** Poll cadence for the data lanes. Low enough that ops latency stays imperceptible; a
 *  single poll drains all buffered frames, so this bounds latency, not throughput. */
export const NATIVE_POLL_MS = 30;
/** Defensive cap on frames accepted from one poll (Rust is ours, but this is a boundary). */
const MAX_FRAMES_PER_POLL = 4096;

// ── byte <-> string helpers for the command boundary ──────────────────────────────

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
  return btoa(s);
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Hex `h` (as Rust returns it) to bytes, for derivePlateFromTranscript. Odd/invalid → null. */
export function hexToBytes(hex: string): Uint8Array | null {
  if (typeof hex !== 'string' || hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(hex)) {
    return null;
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function isLane(v: unknown): v is NativeLane {
  return typeof v === 'string' && (LANES as readonly string[]).includes(v);
}

/** A live native session: send/receive on the lanes, read the plate, tear down. */
export interface NativeTransportHandle {
  readonly sessionId: string;
  send(lane: NativeLane, bytes: Uint8Array): Promise<void>;
  /** Observe inbound frames while subscribed. Starts a poll loop on the first subscriber,
   *  stops it on the last unsubscribe. Returns an unsubscribe fn. */
  subscribe(cb: (lane: NativeLane, bytes: Uint8Array) => void): () => void;
  /** The handshake hash `h` (bytes), or null - the SAS plate's input. */
  plate(): Promise<Uint8Array | null>;
  close(): Promise<void>;
}

/** Build a handle over an already-established session (from native_connect or an adopted
 *  inbound session). */
export function createNativeHandle(sessionId: string, env: NativeEnv): NativeTransportHandle {
  const setI = env.setInterval ?? ((fn, ms) => setInterval(fn, ms));
  const clrI = env.clearInterval ?? ((h) => clearInterval(h as ReturnType<typeof setInterval>));
  const { invoke } = env;

  const subs = new Set<(lane: NativeLane, bytes: Uint8Array) => void>();
  let handle: unknown = null;
  let polling = false;
  let closed = false;

  async function poll(): Promise<void> {
    if (polling || closed || subs.size === 0) return;
    polling = true;
    try {
      const raw = (await invoke('native_recv', { sessionId })) as unknown;
      if (!Array.isArray(raw)) return;
      for (const f of raw.slice(0, MAX_FRAMES_PER_POLL)) {
        const lane = (f as { lane?: unknown })?.lane;
        const data = (f as { data?: unknown })?.data;
        if (!isLane(lane) || typeof data !== 'string') continue;
        let bytes: Uint8Array;
        try {
          bytes = base64ToBytes(data);
        } catch {
          continue; // a malformed frame is dropped, never thrown past the loop
        }
        for (const cb of subs) cb(lane, bytes);
      }
    } catch {
      /* transient (native side busy) - the next tick retries */
    } finally {
      polling = false;
    }
  }

  function ensureLoop(): void {
    if (!handle && !closed && subs.size > 0) {
      handle = setI(() => { void poll(); }, NATIVE_POLL_MS);
      void poll(); // an immediate first drain
    }
  }
  function stopLoop(): void {
    if (handle) { clrI(handle); handle = null; }
  }

  return {
    sessionId,

    async send(lane: NativeLane, bytes: Uint8Array): Promise<void> {
      if (closed) throw new Error('native-session-closed');
      await invoke('native_send', { sessionId, lane, data: bytesToBase64(bytes) });
    },

    subscribe(cb): () => void {
      subs.add(cb);
      ensureLoop();
      return () => {
        subs.delete(cb);
        if (subs.size === 0) stopLoop();
      };
    },

    async plate(): Promise<Uint8Array | null> {
      const hex = (await invoke('native_plate', { sessionId })) as unknown;
      return typeof hex === 'string' ? hexToBytes(hex) : null;
    },

    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      stopLoop();
      subs.clear();
      try { await invoke('native_close', { sessionId }); } catch { /* best-effort */ }
    },
  };
}

/** Connect (initiator) to a nearby-discovered peer and return a live handle + the plate hex.
 *  The address is resolved + private-range-checked in Rust; this never sees it. */
export async function nativeConnect(
  peerId: string,
  env: NativeEnv,
): Promise<{ handle: NativeTransportHandle; plateHex: string }> {
  const res = (await env.invoke('native_connect', { peerId })) as { sessionId?: unknown; plateHex?: unknown };
  const sessionId = typeof res?.sessionId === 'string' ? res.sessionId : '';
  const plateHex = typeof res?.plateHex === 'string' ? res.plateHex : '';
  if (!sessionId) throw new Error('native-connect-failed');
  return { handle: createNativeHandle(sessionId, env), plateHex };
}

/** Inbound (responder) sessions awaiting adoption - poll during a ceremony and adopt the one
 *  whose plate matches the pairing. */
export async function pollNativeInbound(env: NativeEnv): Promise<NativeInbound[]> {
  const raw = (await env.invoke('native_poll_inbound')) as unknown;
  if (!Array.isArray(raw)) return [];
  const out: NativeInbound[] = [];
  for (const r of raw) {
    const sessionId = (r as { sessionId?: unknown })?.sessionId;
    const plateHex = (r as { plateHex?: unknown })?.plateHex;
    if (typeof sessionId === 'string' && sessionId && typeof plateHex === 'string') {
      out.push({ sessionId, plateHex });
    }
  }
  return out;
}

/** Claim an inbound session so the Rust reaper leaves it alone; returns a live handle. */
export async function adoptNative(sessionId: string, env: NativeEnv): Promise<NativeTransportHandle | null> {
  const ok = (await env.invoke('native_adopt', { sessionId })) === true;
  return ok ? createNativeHandle(sessionId, env) : null;
}

/** The real environment: Tauri's invoke, or null off Tauri (no native transport there). */
export function nativeEnv(): NativeEnv | null {
  const invoke = tauriInvoke();
  return invoke ? { invoke } : null;
}
