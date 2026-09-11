// SPDX-License-Identifier: MPL-2.0
/**
 * native-wire - the byte format for the native transport's lanes (plans/110 section 4).
 *
 * The native transport (`native-transport.ts`) carries raw bytes per lane; this module is
 * the encode/decode that turns a collab message into those bytes and an inbound frame back
 * into the SAME `RtcInboundMessage` shape the WebRTC transport produces. That shared shape
 * is the whole point: a native session can then be adapted into `createRtcCollabHandle`
 * unchanged, so the op-ordering, presence roster, and section 6.2 divergence backstop - and the
 * section 11.21 op validation, which runs DOWNSTREAM in the handle, not in the transport - are all
 * reused, not reimplemented. A native pair uses this codec on both ends, so it only has to
 * be self-consistent; it does not need to match the WebRTC channels' exact bytes (native
 * never talks to WebRTC).
 *
 * Untrusted-input discipline: every inbound frame is a stranger's bytes. `decodeFrame`
 * returns `null` for anything malformed rather than throwing, and presence goes through the
 * shipped `parsePresenceFrame` (which copies fields one by one so nothing a peer added rides
 * into the roster). Ops are delivered verbatim and validated in the handle, exactly as the
 * WebRTC path delivers them.
 */

import { parsePresenceFrame, type RtcInboundMessage, type RtcPresenceOutbound } from './rtc-transport.ts';
import type { NativeLane } from './native-transport.ts';

const enc = new TextEncoder();
const dec = new TextDecoder();

// Beam is the only lane that carries binary as well as JSON, so its bytes lead with a tag.
const BEAM_JSON = 0x6a; // 'j'
const BEAM_BINARY = 0x62; // 'b'

/** An outbound ops-lane message: a canvas op, or the one-shot hello (section 6.1). */
export type OpsOutbound =
  | { readonly kind: 'op'; readonly op: unknown }
  | { readonly kind: 'hello'; readonly clientId?: string; readonly opVersion?: string; readonly seed?: string };

/** An outbound beam-lane payload. */
export type BeamOutbound = { readonly json: unknown } | { readonly bytes: Uint8Array };

// ── encode (message → lane bytes) ─────────────────────────────────────────────────

export function encodeOps(msg: OpsOutbound): Uint8Array {
  return enc.encode(JSON.stringify(msg));
}

export function encodePresence(frame: RtcPresenceOutbound): Uint8Array {
  return enc.encode(JSON.stringify(frame));
}

export function encodeBeam(payload: BeamOutbound): Uint8Array {
  if ('bytes' in payload) {
    const out = new Uint8Array(payload.bytes.length + 1);
    out[0] = BEAM_BINARY;
    out.set(payload.bytes, 1);
    return out;
  }
  const body = enc.encode(JSON.stringify(payload.json));
  const out = new Uint8Array(body.length + 1);
  out[0] = BEAM_JSON;
  out.set(body, 1);
  return out;
}

// ── decode (lane bytes → RtcInboundMessage | null) ────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function decodeOps(bytes: Uint8Array): RtcInboundMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(dec.decode(bytes));
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  if (parsed.kind === 'op') {
    return { lane: 'ops', kind: 'op', op: parsed.op };
  }
  if (parsed.kind === 'hello') {
    // Copy only the known fields - never spread a stranger's record.
    const out: Extract<RtcInboundMessage, { kind: 'hello' }> = { lane: 'ops', kind: 'hello' };
    const clientId = typeof parsed.clientId === 'string' ? parsed.clientId : undefined;
    const opVersion = typeof parsed.opVersion === 'string' ? parsed.opVersion : undefined;
    const seed = typeof parsed.seed === 'string' ? parsed.seed : undefined;
    return { ...out, ...(clientId ? { clientId } : {}), ...(opVersion ? { opVersion } : {}), ...(seed ? { seed } : {}) };
  }
  return null;
}

function decodePresence(bytes: Uint8Array): RtcInboundMessage | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(dec.decode(bytes));
  } catch {
    return null;
  }
  const frame = parsePresenceFrame(parsed);
  return frame ? { lane: 'presence', kind: 'presence', frame } : null;
}

function decodeBeam(bytes: Uint8Array): RtcInboundMessage | null {
  if (bytes.length < 1) return null;
  const tag = bytes[0];
  const body = bytes.subarray(1);
  if (tag === BEAM_BINARY) {
    return { lane: 'beam', kind: 'binary', bytes: new Uint8Array(body) };
  }
  if (tag === BEAM_JSON) {
    try {
      return { lane: 'beam', kind: 'json', json: JSON.parse(dec.decode(body)) };
    } catch {
      return null;
    }
  }
  return null;
}

/** Decode one inbound lane frame, or null if malformed (never throws). */
export function decodeFrame(lane: NativeLane, bytes: Uint8Array): RtcInboundMessage | null {
  switch (lane) {
    case 'ops': return decodeOps(bytes);
    case 'presence': return decodePresence(bytes);
    case 'beam': return decodeBeam(bytes);
  }
}
