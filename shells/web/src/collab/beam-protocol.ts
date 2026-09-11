// SPDX-License-Identifier: MPL-2.0
/**
 * beam-protocol - the message and state layer for a **Beam**: an AirDrop-grade,
 * serverless hand-off of a saved session, a whole project, the user's own assets, or
 * a tag pack, over the direct channel the pairing ceremony already established
 * (plan 100 section 6.4, section 11.6, section 11.15a, section 11.18, section 11.24).
 *
 * WHAT THIS FILE IS NOT. There is no `RTCDataChannel` here, no Worker, no IndexedDB,
 * no OPFS, no `fetch`, no DOM, and no wall clock. This module is pure logic: it
 * defines the frames two peers exchange and the two state machines that produce and
 * consume them. The transport, the staging store and the pack builder are all
 * **drivers** that sit outside and feed these machines - which is what lets the whole
 * protocol be exercised headlessly, byte-exactly, against an in-memory sink.
 *
 * That separation is not tidiness. section 11.15a requires beam work to run off the main
 * thread with chunks streaming to staging as they arrive, and section 11.18 requires a
 * cancelled transfer to leave nothing behind. Both are properties of the *driver* - 
 * but they are only provable if the protocol never touches storage itself and never
 * decides on its own when to write. So:
 *
 *   - the sender is **pull-based** (`nextChunk()`), so the transport decides the
 *     pace. The `bufferedamountlow` integration point is "call nextChunk() again";
 *     nothing is ever pushed on a timer or a microtask of our own (section 11.6);
 *   - the receiver writes through an injected `BeamSink` (`write`/`finalize`/
 *     `discard`), so the IDB/OPFS integration is a driver, not part of the protocol;
 *   - **every terminal path that is not `complete` calls `sink.discard()` exactly
 *     once** (section 11.18: no partial ingest). Decline, protocol violation, peer cancel,
 *     channel death and `dispose()` all land there. That is one latch and one test,
 *     rather than an audit of every exit.
 *
 * ── The exchange ──────────────────────────────────────────────────────────────
 *
 *   sender                                receiver
 *   ------                                --------
 *   offer  {kind,name,items[],totalBytes} ─▶   (shown to the human, sized)
 *                                        ◀─  accept {}   |   decline {reason}
 *   chunk  {itemIndex,seq,last}          ─▶   staged through the sink
 *   <binary payload frame>               ─▶
 *   …                                          (repeat, one pull per chunk)
 *   item-done {itemIndex,checksum}       ─▶   finalize + verify the digest
 *   …
 *   complete {}                          ─▶   phase 'complete'
 *   cancel {reason}                     ◀─▶   either side, at any moment
 *
 * A chunk is TWO frames - a JSON header immediately followed by its binary payload.
 * The channel that carries a beam is reliable-ordered (section 11.6: beam gets its own
 * channel so a bulk transfer never queues ops or presence behind it), so the header
 * is guaranteed to arrive before its bytes. A payload with no pending header, or a
 * second header with no payload between, is a protocol violation - that pairing is
 * the only framing this needs, and it costs nothing on the wire.
 *
 * ── The consent gate (section 6.4, section 11.24) ──────────────────────────────────────────
 *
 * Nothing transfers on pairing alone. The offer discloses kind, name, item count,
 * per-item labels and the exact byte total BEFORE anything moves ("Receive 'Berlin
 * pack' - 14 assets, 38 MB?"). Until `accept()` is called the receiver treats ANY
 * chunk header or binary frame as `unsolicited-bytes` - a typed protocol violation
 * that cancels and discards. A peer cannot push bytes at a device that has not said
 * yes, and the machine proves it rather than the UI promising it.
 *
 * ── Integrity (section 6.4, section 11.18) ─────────────────────────────────────────────────
 *
 * Checksums are the catalog's own primitive: SRI `sha256-<base64>`, byte-for-byte the
 * form `scripts/checksum-assets.ts` writes and `bridge/assets.ts` verifies against, so
 * a received asset's checksum compares equal to the one the sender's catalog already
 * holds and receiver-side dedup-by-checksum is a string compare. Each item's digest is
 * stated twice - in the offer (so the receiver can dedup and skip before consenting)
 * and again in `item-done` (the digest of what was actually sent). They must agree,
 * and the staged bytes must match both; any disagreement is `checksum-mismatch` and
 * the whole beam is discarded, never partially ingested.
 *
 * The hasher is injectable for two reasons, and only one of them is tests. Web Crypto
 * has no streaming digest, so the built-in `sha256Hasher` retains each chunk until
 * `digest()` - O(item) memory, which is exactly what section 11.15a says a 38 MB beam must
 * not do in the renderer. The escape hatch is `BeamSink.finalize()`: a driver that
 * holds the staged bytes anyway may return the digest from `finalize`, and that value
 * wins over (and is computed instead of) anything the hasher would produce - pass
 * `hasher: null` and the protocol buffers nothing at all. A driver that supplies
 * neither fails closed (`sink-failure`), never "verified" by omission.
 *
 * ── Untrusted discipline (section 11.21 applied to bulk transfer) ───────────────────
 *
 * Every inbound frame is peer-controlled input from someone you paired with, and is
 * treated that way: one strict parser (`parseBeamMessage`) is the single door, with
 * caps on item count, name/label/id lengths, per-item and total byte sizes, chunk
 * size, and a wire-version equality check. `totalBytes` must equal the sum of the
 * declared item sizes exactly - a peer cannot disclose 2 MB and then send 2 GB. Item
 * indices advance strictly 0…n-1 and `seq` strictly +1 within an item, so neither
 * out-of-order nor replayed chunks can reach staging. Sizes are checked against the
 * DECLARED size on every payload, so an item cannot overflow what the human accepted.
 * Nothing peer-supplied is ever used as an object key (items are addressed by index,
 * ids only ever land in a `Set` for a uniqueness check), so the prototype-key class of
 * bug has no surface here. Every violation produces a typed `BeamCancelReason`, sent
 * to the peer and surfaced in state - never a thrown exception, never a silent drop.
 *
 * ── Ordering & versioning ────────────────────────────────────────────────────
 *
 * Items are sent strictly in declared order and an item's chunks strictly in seq
 * order; the receiver enforces both. `BEAM_PROTOCOL_VERSION` is checked for equality,
 * not range: a peer on another wire version gets an explicit `protocol-version`
 * refusal rather than a best-effort guess. No wall clock is read anywhere in this
 * file - a beam between two airgapped devices with wrong clocks behaves identically
 * (section 11.7's rule, honoured here for the same reason).
 */

import { ulid } from '../lib/row-id.ts';

// ── Version & caps ────────────────────────────────────────────────────────────

/** The beam wire version. Checked for EQUALITY at the offer, not compatibility-ranged
 * - a peer on a different version is refused explicitly (`protocol-version`) rather
 *  than half-understood. Independent of CANVAS_OP_VERSION and CONTRACT_VERSION. */
export const BEAM_PROTOCOL_VERSION = 1;

/** Default payload size for one chunk frame. section 11.6: every SCTP message stays ≤64 KB
 *  to be cross-browser safe, and a chunk frame is the largest thing a beam sends. */
export const DEFAULT_CHUNK_BYTES = 64 * 1024;
/** Hard ceiling for one payload frame - the section 11.6 SCTP limit, not a preference. */
export const MAX_CHUNK_BYTES = 64 * 1024;
/** Floor, so a hostile or buggy driver cannot turn a 38 MB beam into 38 M frames. */
export const MIN_CHUNK_BYTES = 1024;

/** Cap on items in one offer (a tag pack of a few hundred assets is the realistic
 *  worst case; beyond that the pack builder should split). */
export const MAX_ITEMS = 512;
/** Protocol ceiling on one item, above the receiver's own policy. */
export const MAX_ITEM_BYTES = 1024 * 1024 * 1024;
/** Protocol ceiling on a whole beam. Drivers pass a smaller `maxTotalBytes` policy. */
export const MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

export const MAX_BEAM_ID_CHARS = 64;
export const MAX_NAME_CHARS = 120;
export const MAX_LABEL_CHARS = 200;
export const MAX_ID_CHARS = 128;
/** Cap on one JSON control frame, so a decode cannot be made expensive. */
export const MAX_MESSAGE_CHARS = 128 * 1024;

/** SRI SHA-256, the catalog's checksum form: 32 raw bytes → 43 base64 chars + `=`. */
export const CHECKSUM_RE = /^sha256-[A-Za-z0-9+/]{43}=$/;

/** What a beam carries (section 6.4). Additive: a new kind is a minor wire bump. */
export const BEAM_KINDS = ['session', 'assets', 'project', 'tag-pack'] as const;
export type BeamKind = (typeof BEAM_KINDS)[number];

// ── Reasons ───────────────────────────────────────────────────────────────────

/**
 * Why a beam ended badly. Every one is produced by a specific check in this file and
 * carried to the peer, so both sides can say the same true thing to their human.
 */
export type BeamCancelReason =
  /** A human pressed cancel. */
  | 'user'
  /** Malformed, unknown, or out-of-phase control frame. */
  | 'bad-message'
  /** The wire version is not this one. */
  | 'protocol-version'
  /** The offer is internally inconsistent (totals don't add up, duplicate ids, …). */
  | 'bad-offer'
  /** Bigger than the receiver will take. */
  | 'too-large'
  /** More items than the receiver will take. */
  | 'too-many-items'
  /** Bytes (or a chunk header) arrived before consent - the section 11.24 gate. */
  | 'unsolicited-bytes'
  /** `seq` was not the next one for this item. */
  | 'bad-sequence'
  /** A chunk or item-done named the wrong item. */
  | 'bad-item'
  /** A payload frame exceeded the chunk cap or would overflow its item. */
  | 'oversize-chunk'
  /** An item ended with a byte count other than the one declared. */
  | 'size-mismatch'
  /** Staged bytes, the offer, and `item-done` do not all agree. */
  | 'checksum-mismatch'
  /** The local staging sink threw, or produced no digest to verify against. */
  | 'sink-failure'
  /** The sender's own byte source threw or returned the wrong length. */
  | 'source-failure'
  /** The channel died under us (local only - nothing is sent). */
  | 'transport';

/** Why a receiver said no. A decline is a normal outcome, not a violation. */
export type BeamDeclineReason =
  | 'user'
  | 'too-large'
  | 'too-many-items'
  | 'unsupported-kind'
  | 'no-space';

export type BeamEndReason = BeamCancelReason | BeamDeclineReason;

// ── Wire messages ─────────────────────────────────────────────────────────────

/** One thing inside a beam. `checksum` is SRI SHA-256 over the item's exact bytes. */
export interface BeamItem {
  /** Sender-local id (a session slot, an upload id). Receiver-local ids are re-keyed
   *  on ingest by the driver - section 11.18 - so this is a label for humans and dedup, not
   *  an address. */
  readonly id: string;
  /** What the human sees in the consent sheet. May be empty. */
  readonly label: string;
  readonly bytes: number;
  readonly checksum: string;
}

interface BeamBase {
  readonly v: number;
  readonly beamId: string;
}

export interface BeamOfferMessage extends BeamBase {
  readonly t: 'offer';
  readonly kind: BeamKind;
  readonly name: string;
  readonly items: readonly BeamItem[];
  /** Exactly the sum of `items[].bytes`. Restated so the consent sheet never has to
   *  add up numbers it was told separately, and so a mismatch is a caught lie. */
  readonly totalBytes: number;
}

export interface BeamAcceptMessage extends BeamBase {
  readonly t: 'accept';
}

export interface BeamDeclineMessage extends BeamBase {
  readonly t: 'decline';
  readonly reason: BeamDeclineReason;
}

/** The JSON header that immediately precedes one binary payload frame. */
export interface BeamChunkMessage extends BeamBase {
  readonly t: 'chunk';
  readonly itemIndex: number;
  /** 0-based within the item, strictly +1 per chunk. */
  readonly seq: number;
  /** This is the item's final chunk. */
  readonly last: boolean;
}

export interface BeamItemDoneMessage extends BeamBase {
  readonly t: 'item-done';
  readonly itemIndex: number;
  /** SRI SHA-256 of what was actually sent - must equal the offered checksum. */
  readonly checksum: string;
}

export interface BeamCompleteMessage extends BeamBase {
  readonly t: 'complete';
}

export interface BeamCancelMessage extends BeamBase {
  readonly t: 'cancel';
  readonly reason: BeamCancelReason;
  /** Diagnostic for logs. Never user copy, never trusted. */
  readonly detail?: string;
}

export type BeamMessage =
  | BeamOfferMessage
  | BeamAcceptMessage
  | BeamDeclineMessage
  | BeamChunkMessage
  | BeamItemDoneMessage
  | BeamCompleteMessage
  | BeamCancelMessage;

/** `ok: false` is a typed refusal carrying the reason to cancel with - not a throw. */
export type BeamParseResult =
  | { readonly ok: true; readonly value: BeamMessage }
  | { readonly ok: false; readonly reason: BeamCancelReason; readonly detail: string };

// ── Parsing ───────────────────────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isSafeCount(v: unknown, max: number): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max;
}

function isStr(v: unknown, max: number, min = 1): v is string {
  return typeof v === 'string' && v.length >= min && v.length <= max;
}

function bad(reason: BeamCancelReason, detail: string): BeamParseResult {
  return { ok: false, reason, detail };
}

/** Every reason a peer may legitimately put on the wire. `transport` is local-only
 *  (a dead channel cannot tell you it died), so it is deliberately absent. */
const KNOWN_CANCEL: readonly string[] = [
  'user', 'bad-message', 'protocol-version', 'bad-offer', 'too-large', 'too-many-items',
  'unsolicited-bytes', 'bad-sequence', 'bad-item', 'oversize-chunk', 'size-mismatch',
  'checksum-mismatch', 'sink-failure', 'source-failure',
];

const KNOWN_DECLINE: readonly string[] = ['user', 'too-large', 'too-many-items', 'unsupported-kind', 'no-space'];

function parseItems(raw: unknown): BeamParseResult | readonly BeamItem[] {
  if (!Array.isArray(raw)) return bad('bad-offer', 'items is not an array');
  if (raw.length === 0) return bad('bad-offer', 'offer has no items');
  if (raw.length > MAX_ITEMS) return bad('too-many-items', `${raw.length} items`);
  const items: BeamItem[] = [];
  const ids = new Set<string>();
  for (let i = 0; i < raw.length; i++) {
    const it = raw[i];
    if (!isRecord(it)) return bad('bad-offer', `item ${i} is not an object`);
    if (!isStr(it.id, MAX_ID_CHARS)) return bad('bad-offer', `item ${i} has no usable id`);
    if (typeof it.label !== 'string' || it.label.length > MAX_LABEL_CHARS) {
      return bad('bad-offer', `item ${i} label`);
    }
    if (!isSafeCount(it.bytes, MAX_ITEM_BYTES)) return bad('bad-offer', `item ${i} bytes`);
    if (typeof it.checksum !== 'string' || !CHECKSUM_RE.test(it.checksum)) {
      return bad('bad-offer', `item ${i} checksum is not SRI sha256`);
    }
    if (ids.has(it.id)) return bad('bad-offer', `duplicate item id at ${i}`);
    ids.add(it.id);
    items.push({ id: it.id, label: it.label, bytes: it.bytes, checksum: it.checksum });
  }
  return items;
}

/**
 * The single door every inbound frame passes through, on BOTH sides. Strict by
 * construction: unknown message types, unknown wire versions, missing or oversized
 * fields and self-inconsistent offers all come back as a typed refusal the caller
 * turns straight into a `cancel`.
 */
export function parseBeamMessage(raw: unknown): BeamParseResult {
  if (!isRecord(raw)) return bad('bad-message', 'not an object');
  if (raw.v !== BEAM_PROTOCOL_VERSION) return bad('protocol-version', `v=${String(raw.v)}`);
  if (!isStr(raw.beamId, MAX_BEAM_ID_CHARS)) return bad('bad-message', 'beamId');
  const beamId = raw.beamId;
  const v = BEAM_PROTOCOL_VERSION;

  switch (raw.t) {
    case 'offer': {
      if (typeof raw.kind !== 'string' || !(BEAM_KINDS as readonly string[]).includes(raw.kind)) {
        return bad('bad-offer', `kind=${String(raw.kind)}`);
      }
      if (!isStr(raw.name, MAX_NAME_CHARS)) return bad('bad-offer', 'name');
      const items = parseItems(raw.items);
      if (!Array.isArray(items)) return items as BeamParseResult;
      let sum = 0;
      for (const it of items) sum += it.bytes;
      if (!isSafeCount(raw.totalBytes, MAX_TOTAL_BYTES)) {
        return sum > MAX_TOTAL_BYTES
          ? bad('too-large', `${sum} bytes`)
          : bad('bad-offer', 'totalBytes');
      }
      if (raw.totalBytes !== sum) {
        return bad('bad-offer', `totalBytes ${raw.totalBytes} ≠ sum ${sum}`);
      }
      return {
        ok: true,
        value: { v, beamId, t: 'offer', kind: raw.kind as BeamKind, name: raw.name, items, totalBytes: sum },
      };
    }
    case 'accept':
      return { ok: true, value: { v, beamId, t: 'accept' } };
    case 'decline': {
      const reason = typeof raw.reason === 'string' ? raw.reason : 'user';
      return {
        ok: true,
        value: {
          v,
          beamId,
          t: 'decline',
          reason: (KNOWN_DECLINE.includes(reason) ? reason : 'user') as BeamDeclineReason,
        },
      };
    }
    case 'chunk': {
      if (!isSafeCount(raw.itemIndex, MAX_ITEMS - 1)) return bad('bad-item', 'itemIndex');
      if (!isSafeCount(raw.seq, Number.MAX_SAFE_INTEGER)) return bad('bad-sequence', 'seq');
      if (typeof raw.last !== 'boolean') return bad('bad-message', 'last');
      return { ok: true, value: { v, beamId, t: 'chunk', itemIndex: raw.itemIndex, seq: raw.seq, last: raw.last } };
    }
    case 'item-done': {
      if (!isSafeCount(raw.itemIndex, MAX_ITEMS - 1)) return bad('bad-item', 'itemIndex');
      if (typeof raw.checksum !== 'string' || !CHECKSUM_RE.test(raw.checksum)) {
        return bad('checksum-mismatch', 'item-done checksum is not SRI sha256');
      }
      return { ok: true, value: { v, beamId, t: 'item-done', itemIndex: raw.itemIndex, checksum: raw.checksum } };
    }
    case 'complete':
      return { ok: true, value: { v, beamId, t: 'complete' } };
    case 'cancel': {
      // The reason selects localized copy, so an unknown word from the peer degrades
      // to `user` rather than reaching the UI - and `detail` is a bounded log string,
      // never shown. The key is omitted when absent so the parsed shape is exact.
      const raw2 = typeof raw.reason === 'string' ? raw.reason : 'user';
      const reason = (KNOWN_CANCEL.includes(raw2) ? raw2 : 'user') as BeamCancelReason;
      const detail = typeof raw.detail === 'string' ? raw.detail.slice(0, 200) : undefined;
      return {
        ok: true,
        value: detail === undefined
          ? { v, beamId, t: 'cancel', reason }
          : { v, beamId, t: 'cancel', reason, detail },
      };
    }
    default:
      return bad('bad-message', `t=${String(raw.t)}`);
  }
}

/**
 * The beamId a raw frame CLAIMS, read before it has been validated.
 *
 * Used for one decision only: whether a frame this machine could not parse is even
 * addressed to it. One channel may carry more than one machine's traffic, and both
 * machines already decline to judge well-formed frames belonging to another beam - 
 * but a PARSE FAILURE was acted on before that check, so a single garbage frame
 * belonging to a different beam terminated an unrelated, healthy transfer.
 */
function claimedBeamId(raw: unknown): string | undefined {
  return isRecord(raw) && typeof raw.beamId === 'string' ? raw.beamId : undefined;
}

/** JSON form of one control frame. */
export function encodeBeamMessage(msg: BeamMessage): string {
  return JSON.stringify(msg);
}

/** Decode + validate one JSON control frame, with a length cap before the parse. */
export function decodeBeamMessage(text: string): BeamParseResult {
  if (typeof text !== 'string') return bad('bad-message', 'not a string');
  if (text.length > MAX_MESSAGE_CHARS) return bad('bad-message', `${text.length} chars`);
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return bad('bad-message', 'not JSON');
  }
  return parseBeamMessage(raw);
}

// ── Hashing ───────────────────────────────────────────────────────────────────

/** An incremental digest. `digest()` returns the catalog's SRI `sha256-<base64>`. */
export interface BeamHash {
  update(bytes: Uint8Array): void;
  digest(): Promise<string>;
}

export type BeamHasher = () => BeamHash;

// Chunked so a multi-MB digest input can't blow the call stack via spread/apply - 
// the same guard lib/bundle.ts uses for the identical conversion.
function bytesToBase64(bytes: Uint8Array): string {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(bin);
}

/**
 * SRI SHA-256 over a complete buffer - byte-for-byte the catalog's form
 * (`scripts/checksum-assets.ts` writes `createHash('sha256').digest('base64')`;
 * Node's base64 alphabet and padding are identical to `btoa` over the raw digest, so
 * the strings compare equal - the note `bridge/assets.ts` already relies on).
 */
export async function sriSha256(bytes: Uint8Array): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('beam: no Web Crypto - cannot verify a transfer');
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  const digest = await subtle.digest('SHA-256', copy.buffer);
  return `sha256-${bytesToBase64(new Uint8Array(digest))}`;
}

/**
 * The built-in incremental hasher. Web Crypto has no streaming digest, so this
 * RETAINS every chunk until `digest()` - O(item) memory, which section 11.15a explicitly
 * does not want in the renderer for a 38 MB beam. Two ways out, both supported:
 * return the digest from `BeamSink.finalize()` (the driver holds the bytes anyway),
 * or inject a real streaming hasher from the Worker. Passing `hasher: null` with a
 * digest-returning sink means the protocol buffers nothing at all.
 */
export const sha256Hasher: BeamHasher = () => {
  const parts: Uint8Array[] = [];
  let total = 0;
  return {
    update(bytes) {
      parts.push(bytes);
      total += bytes.length;
    },
    async digest() {
      const all = new Uint8Array(total);
      let at = 0;
      for (const p of parts) {
        all.set(p, at);
        at += p.length;
      }
      // BOTH halves of the state are cleared. Clearing `parts` alone left `total`
      // carrying the previous item's length, so a reused instance digested a
      // wrongly-sized, zero-padded buffer - a wrong digest that reads as
      // `checksum-mismatch`, or worse matches another zero-padded value. `BeamHasher`
      // is an exported surface a driver is invited to hold, so "no internal caller
      // reuses one" is not a property this can rely on.
      parts.length = 0;
      total = 0;
      return sriSha256(all);
    },
  };
};

// ── Injected surfaces ─────────────────────────────────────────────────────────

/** The outbound half of the transport. Both machines only ever write through this. */
export interface BeamWire {
  /** One JSON control frame. */
  json(msg: BeamMessage): void;
  /** One binary payload frame - always immediately after its `chunk` header. The
   *  bytes may be a view over a shared buffer, so a wire that defers must copy. */
  binary(bytes: Uint8Array): void;
}

/** Where the sender reads item bytes from (IDB, OPFS, a packed zip in a Worker). */
export interface BeamSource {
  /** Exactly `length` bytes of item `itemIndex` starting at `offset`. Returning a
   *  different length, or throwing, ends the beam with `source-failure`. */
  read(itemIndex: number, offset: number, length: number): Uint8Array | Promise<Uint8Array>;
}

/**
 * Where the receiver stages bytes. The whole IDB/OPFS integration is this interface
 * (section 11.15a) - the protocol never learns what a staging row is.
 *
 * `finalize` SEALS an item's staging - it is emphatically NOT ingestion. Verification
 * happens after it (that is where a corrupted item is caught), and section 11.18 means
 * nothing may enter the user's library until the receiver reaches `complete`. A
 * driver that ingests on `finalize` has broken the no-partial-ingest guarantee.
 * `finalize` MAY return the SRI digest of everything staged for the item; when it
 * does, that is what gets verified and the protocol never buffers the bytes itself.
 *
 * `discard()` must be safe to call having staged nothing at all: section 11.18's guarantee
 * is unconditional, so it fires on a decline too, and it is called at most once.
 */
export interface BeamSink {
  write(itemIndex: number, seq: number, bytes: Uint8Array): void | Promise<void>;
  // biome-ignore lint/suspicious/noConfusingVoidType: `undefined` would reject `async finalize(i) { await seal(i) }`, whose type is Promise<void>.
  finalize(itemIndex: number): string | void | Promise<string | void>;
  discard(): void | Promise<void>;
}

/** Per-item and whole-beam counters, emitted on both sides after every frame. */
export interface BeamProgress {
  /** The item in flight; equals `items.length` once everything is done. */
  readonly itemIndex: number;
  /** Bytes moved for the item in flight. */
  readonly itemBytes: number;
  /** That item's declared size (0 when there is no item in flight). */
  readonly itemTotal: number;
  /** Bytes moved across the whole beam. */
  readonly bytes: number;
  /** The whole beam's declared size. */
  readonly totalBytes: number;
  /** Items fully transferred and (receiver side) verified. */
  readonly itemsDone: number;
}

function progressFor(itemIndex: number, itemBytes: number, itemTotal: number, bytes: number, totalBytes: number, itemsDone: number): BeamProgress {
  return { itemIndex, itemBytes, itemTotal, bytes, totalBytes, itemsDone };
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Subscriber fan-out that a throwing subscriber cannot break (ceremony's rule). */
function notify<T>(subs: Set<(v: T) => void>, value: T): void {
  for (const fn of [...subs]) {
    try {
      fn(value);
    } catch {
      /* a broken observer must not break the transfer */
    }
  }
}

// ── Sender ────────────────────────────────────────────────────────────────────

export type BeamSendPhase =
  /** Constructed; the offer has not been sent. */
  | 'idle'
  /** Offer sent, awaiting the human on the other end. Nothing else has been sent. */
  | 'offered'
  /** Consented; `nextChunk()` will produce frames. */
  | 'sending'
  /** Consented but held - `nextChunk()` produces nothing until `resume()`. */
  | 'paused'
  | 'complete'
  | 'declined'
  | 'cancelled';

export interface BeamSendState {
  readonly beamId: string;
  readonly phase: BeamSendPhase;
  readonly kind: BeamKind;
  readonly name: string;
  readonly items: readonly BeamItem[];
  readonly progress: BeamProgress;
  /** Terminal only. */
  readonly reason?: BeamEndReason;
  /** Terminal only: a diagnostic for logs, never user copy. */
  readonly detail?: string;
}

/** What one `nextChunk()` pull did. */
export type BeamPullResult =
  /** One chunk frame (header + payload) went out. Pull again when the buffer drains. */
  | 'sent'
  /** A pull is already in flight; this call did nothing. */
  | 'busy'
  /** Nothing to send right now - not yet accepted, or paused. */
  | 'waiting'
  /** Everything is sent and `complete` has been emitted. */
  | 'complete'
  /** Declined, cancelled, or failed. Stop pulling. */
  | 'ended';

export interface BeamOfferDraft {
  readonly kind: BeamKind;
  readonly name: string;
  readonly items: readonly BeamItem[];
  /** Defaults to a fresh ULID. */
  readonly beamId?: string;
}

export interface BeamSenderOptions {
  readonly offer: BeamOfferDraft;
  readonly source: BeamSource;
  readonly wire: BeamWire;
  /** Clamped to [MIN_CHUNK_BYTES, MAX_CHUNK_BYTES]; defaults to DEFAULT_CHUNK_BYTES. */
  readonly chunkBytes?: number;
  /**
   * Opt-in: re-digest what is actually read and send THAT in `item-done`, refusing
   * to continue if the source has drifted from the offer. Off by default, because
   * the built-in hasher would hold a whole item in renderer memory (section 11.15a) for a
   * guarantee the receiver already enforces against the offered checksum.
   */
  readonly hasher?: BeamHasher | null;
}

export interface BeamSender {
  readonly state: BeamSendState;
  /** Emit the offer. Idempotent-ish: only acts in `idle`. */
  offer(): void;
  /** The pull. The transport calls this when its buffer drains (`bufferedamountlow`). */
  nextChunk(): Promise<BeamPullResult>;
  pause(): void;
  resume(): void;
  cancel(reason?: BeamCancelReason, detail?: string): void;
  /** Feed one inbound control frame (already JSON-decoded, or a raw object). */
  receive(raw: unknown): void;
  /** The channel died - terminal, and nothing is written to the wire. */
  abort(reason?: BeamCancelReason, detail?: string): void;
  subscribe(fn: (state: BeamSendState) => void): () => void;
  dispose(): void;
}

export function createBeamSender(opts: BeamSenderOptions): BeamSender {
  const beamId = opts.offer.beamId ?? ulid();
  const items = opts.offer.items.map((it) => ({ ...it }));
  let totalBytes = 0;
  for (const it of items) totalBytes += it.bytes;

  const chunkBytes = clampChunk(opts.chunkBytes);
  const makeHash = opts.hasher ?? null;
  const subs = new Set<(s: BeamSendState) => void>();

  let phase: BeamSendPhase = 'idle';
  let reason: BeamEndReason | undefined;
  let detail: string | undefined;
  let index = 0;
  let offset = 0;
  let seq = 0;
  let sent = 0;
  let itemsDone = 0;
  let pulling = false;
  let hash: BeamHash | null = null;

  let state: BeamSendState = buildState();

  function buildState(): BeamSendState {
    const cur = items[index];
    return {
      beamId,
      phase,
      kind: opts.offer.kind,
      name: opts.offer.name,
      items,
      progress: progressFor(index, offset, cur ? cur.bytes : 0, sent, totalBytes, itemsDone),
      reason,
      detail,
    };
  }

  function emit(): void {
    state = buildState();
    notify(subs, state);
  }

  function settled(): boolean {
    return phase === 'complete' || phase === 'declined' || phase === 'cancelled';
  }

  /**
   * EVERY write to the wire goes through these two, and neither ever throws.
   * `RTCDataChannel.send()` throws `InvalidStateError` on a channel that is not
   * open and throws again when the send buffer is full - both of which are
   * ordinary conditions on a channel this file's own pull-based design exists to
   * manage. This module promises "never a thrown exception" (module header), so a
   * write that fails is reported through the state machine, not up the stack.
   */
  function wireJson(msg: BeamMessage): boolean {
    try {
      opts.wire.json(msg);
      return true;
    } catch {
      return false;
    }
  }
  function wireBinary(bytes: Uint8Array): boolean {
    try {
      opts.wire.binary(bytes);
      return true;
    } catch {
      return false;
    }
  }

  /** Reads `phase` opaquely. TypeScript's control-flow narrowing cannot see that the
   *  closures below reassign it, and a synchronous transport delivering the peer's
   *  cancel re-entrantly does exactly that in the middle of a pull. */
  function phaseNow(): BeamSendPhase {
    return phase;
  }

  function end(next: BeamSendPhase, why?: BeamEndReason, why2?: string): void {
    if (settled()) return;
    phase = next;
    reason = why;
    detail = why2;
    hash = null;
    emit();
  }

  /** Terminal FIRST, announcement second: the state machine must land even when the
   *  wire is the thing that is broken. */
  function fail(why: BeamCancelReason, why2?: string, silent = false): void {
    if (settled()) return;
    const announce = !silent && phase !== 'idle';
    end('cancelled', why, why2);
    if (announce) wireJson({ v: BEAM_PROTOCOL_VERSION, beamId, t: 'cancel', reason: why, detail: why2 });
  }

  /** False when the frame could not be written - the caller ends the beam. */
  function sendItemDone(i: number, checksum: string): boolean {
    if (!wireJson({ v: BEAM_PROTOCOL_VERSION, beamId, t: 'item-done', itemIndex: i, checksum })) return false;
    itemsDone++;
    return true;
  }

  /** Advance past any zero-byte items, which carry an `item-done` and no chunks. */
  function flushEmpty(): boolean {
    while (!settled() && index < items.length && items[index]!.bytes === 0) {
      if (!sendItemDone(index, items[index]!.checksum)) {
        fail('transport', `item-done for item ${index} could not be written`, true);
        return false;
      }
      index++;
      offset = 0;
      seq = 0;
    }
    return true;
  }

  /** True when there is nothing left to send - which is `complete` if the frame went
   *  out, and `cancelled` if the wire refused it. Callers read `phaseNow()` to tell
   *  the two apart rather than assuming success. */
  function finishIfDone(): boolean {
    if (index < items.length) return false;
    if (!wireJson({ v: BEAM_PROTOCOL_VERSION, beamId, t: 'complete' })) {
      fail('transport', 'complete could not be written', true);
      return true;
    }
    end('complete');
    return true;
  }

  return {
    get state() {
      return state;
    },

    offer() {
      if (phase !== 'idle') return;
      phase = 'offered';
      const sentOffer = wireJson({
        v: BEAM_PROTOCOL_VERSION,
        beamId,
        t: 'offer',
        kind: opts.offer.kind,
        name: opts.offer.name,
        items,
        totalBytes,
      });
      if (!sentOffer) {
        fail('transport', 'offer could not be written', true);
        return;
      }
      emit();
    },

    async nextChunk(): Promise<BeamPullResult> {
      if (phase === 'complete') return 'complete';
      if (settled()) return 'ended';
      if (phase !== 'sending') return 'waiting';
      if (pulling) return 'busy';
      pulling = true;
      try {
        if (!flushEmpty()) return 'ended';
        if (finishIfDone()) return phaseNow() === 'complete' ? 'complete' : 'ended';

        const item = items[index]!;
        const length = Math.min(chunkBytes, item.bytes - offset);
        const last = offset + length >= item.bytes;
        const at = index;
        const atSeq = seq;
        const atOffset = offset;

        let bytes: Uint8Array;
        try {
          bytes = await opts.source.read(at, atOffset, length);
        } catch (err) {
          fail('source-failure', errText(err));
          return 'ended';
        }
        // A cancel, decline or pause may have landed while the read was in flight.
        // Bytes already in hand are dropped and re-read on resume - nothing has been
        // written to the wire yet, so no `seq` is burned and no gap can appear.
        if (settled()) return 'ended';
        if (phase !== 'sending') return 'waiting';
        if (!(bytes instanceof Uint8Array) || bytes.length !== length) {
          fail('source-failure', `read ${bytes instanceof Uint8Array ? bytes.length : 'non-bytes'} for ${length}`);
          return 'ended';
        }

        // A CHUNK IS TWO FRAMES AND THEY MUST NOT COME APART. If the header goes
        // out and the payload does not, the peer sees a header with no payload
        // while `offset`/`seq` (below) have not advanced - so the next pull emits
        // the SAME header, the receiver sees "two chunk headers with no payload
        // between" and kills the beam, and the sender never learns. One transient
        // backpressure throw would desynchronize the framing permanently, with no
        // resync path. Neither half is allowed to escape as an exception either
        // (`nextChunk` is a promise the driver awaits, not a place to throw), so a
        // wire that refuses ends the transfer, deterministically, on both sides of
        // the pair of writes.
        if (!wireJson({ v: BEAM_PROTOCOL_VERSION, beamId, t: 'chunk', itemIndex: at, seq: atSeq, last })) {
          fail('transport', `chunk header ${at}/${atSeq} could not be written`, true);
          return 'ended';
        }
        if (!wireBinary(bytes)) {
          fail('transport', `chunk payload ${at}/${atSeq} could not be written`, true);
          return 'ended';
        }
        if (makeHash) {
          hash ??= makeHash();
          const copy = new Uint8Array(bytes.length);
          copy.set(bytes);
          hash.update(copy);
        }
        offset += length;
        sent += length;
        seq++;
        // A synchronous transport can deliver the peer's cancel re-entrantly, from
        // inside the two writes above. Nothing more may be emitted once that lands.
        if (settled()) return 'ended';

        if (last) {
          let checksum = item.checksum;
          if (hash) {
            try {
              checksum = await hash.digest();
            } catch (err) {
              fail('sink-failure', errText(err));
              return 'ended';
            }
            hash = null;
            if (settled()) return 'ended';
            if (checksum !== item.checksum) {
              fail('checksum-mismatch', `source drifted for item ${at}`);
              return 'ended';
            }
          }
          if (!sendItemDone(at, checksum)) {
            fail('transport', `item-done for item ${at} could not be written`, true);
            return 'ended';
          }
          index++;
          offset = 0;
          seq = 0;
          if (!flushEmpty()) return 'ended';
          if (settled()) return phaseNow() === 'complete' ? 'complete' : 'ended';
          if (finishIfDone()) return phaseNow() === 'complete' ? 'complete' : 'ended';
        }
        emit();
        return 'sent';
      } finally {
        pulling = false;
      }
    },

    pause() {
      if (phase !== 'sending') return;
      phase = 'paused';
      emit();
    },

    resume() {
      if (phase !== 'paused') return;
      phase = 'sending';
      emit();
    },

    cancel(why = 'user', why2) {
      fail(why, why2);
    },

    abort(why = 'transport', why2) {
      fail(why, why2, true);
    },

    receive(raw: unknown) {
      if (settled() || phase === 'idle') return;
      const parsed = parseBeamMessage(raw);
      if (!parsed.ok) {
        // The beamId filter applies to frames we could NOT parse too. It used to
        // run four lines later, so a garbage frame addressed to another beam on the
        // same channel terminated this healthy transfer - contradicting the comment
        // immediately below it.
        const claimed = claimedBeamId(raw);
        if (claimed !== undefined && claimed !== beamId) return;
        fail(parsed.reason, parsed.detail);
        return;
      }
      const msg = parsed.value;
      // Frames for another beam are not ours to judge - one channel may carry more
      // than one machine's traffic, and a late frame from a dead beam is not a lie.
      if (msg.beamId !== beamId) return;
      switch (msg.t) {
        case 'accept':
          if (phase !== 'offered') {
            fail('bad-message', `accept in ${phase}`);
            return;
          }
          phase = 'sending';
          emit();
          return;
        case 'decline':
          end('declined', msg.reason);
          return;
        case 'cancel':
          end('cancelled', msg.reason, msg.detail);
          return;
        default:
          fail('bad-message', `sender received ${msg.t}`);
      }
    },

    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },

    dispose() {
      if (!settled()) end('cancelled', 'transport', 'disposed');
      subs.clear();
    },
  };
}

function clampChunk(v: number | undefined): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return DEFAULT_CHUNK_BYTES;
  return Math.max(MIN_CHUNK_BYTES, Math.min(MAX_CHUNK_BYTES, Math.floor(v)));
}

// ── Receiver ──────────────────────────────────────────────────────────────────

export type BeamRecvPhase =
  /** No offer yet. Any byte arriving here is `unsolicited-bytes`. */
  | 'waiting'
  /** An offer is on the table, awaiting the human. Bytes are still refused. */
  | 'offered'
  /** Consented - and only now may a chunk be staged. */
  | 'receiving'
  | 'complete'
  | 'declined'
  | 'cancelled';

export interface BeamRecvState {
  readonly beamId: string;
  readonly phase: BeamRecvPhase;
  readonly offer?: BeamOfferMessage;
  readonly progress: BeamProgress;
  readonly reason?: BeamEndReason;
  readonly detail?: string;
  /** Has `sink.discard()` run? The section 11.18 invariant, observable. */
  readonly discarded: boolean;
}

/** Receiver-side limits, on top of the protocol ceilings. */
export interface BeamPolicy {
  readonly maxItems?: number;
  readonly maxTotalBytes?: number;
  readonly maxChunkBytes?: number;
  /** Kinds this device will take at all; defaults to every kind. */
  readonly acceptKinds?: readonly BeamKind[];
}

export interface BeamReceiverOptions {
  readonly wire: BeamWire;
  readonly sink: BeamSink;
  /** Defaults to `sha256Hasher`. `null` means the sink's `finalize()` must return
   *  the digest instead - verification is never skipped. */
  readonly hasher?: BeamHasher | null;
  readonly policy?: BeamPolicy;
}

export interface BeamReceiver {
  readonly state: BeamRecvState;
  /** One inbound control frame (already JSON-decoded, or a raw object). */
  receive(raw: unknown): void;
  /** One inbound binary payload frame. */
  receiveBinary(bytes: Uint8Array): void;
  /** The consent gate (section 11.24). Only meaningful while an offer is on the table. */
  accept(): void;
  decline(reason?: BeamDeclineReason): void;
  cancel(reason?: BeamCancelReason, detail?: string): void;
  /** The channel died - terminal, nothing sent, staging discarded. */
  abort(reason?: BeamCancelReason, detail?: string): void;
  /** Resolve once every queued staging write, finalize and verify has settled. */
  drain(): Promise<void>;
  subscribe(fn: (state: BeamRecvState) => void): () => void;
  /** Teardown. An unfinished beam is aborted first, so staging never leaks (section 11.18). */
  dispose(): void;
}

export function createBeamReceiver(opts: BeamReceiverOptions): BeamReceiver {
  const makeHash = opts.hasher === undefined ? sha256Hasher : opts.hasher;
  const policy = opts.policy ?? {};
  const maxItems = Math.min(policy.maxItems ?? MAX_ITEMS, MAX_ITEMS);
  const maxTotal = Math.min(policy.maxTotalBytes ?? MAX_TOTAL_BYTES, MAX_TOTAL_BYTES);
  const maxChunk = Math.min(policy.maxChunkBytes ?? MAX_CHUNK_BYTES, MAX_CHUNK_BYTES);
  const kinds = policy.acceptKinds ?? BEAM_KINDS;
  const subs = new Set<(s: BeamRecvState) => void>();

  let phase: BeamRecvPhase = 'waiting';
  let offer: BeamOfferMessage | undefined;
  let reason: BeamEndReason | undefined;
  let detail: string | undefined;
  let discarded = false;

  let index = 0;
  let itemBytes = 0;
  let expectSeq = 0;
  let sawLast = false;
  let received = 0;
  let itemsDone = 0;
  /** The header waiting for its payload frame. Exactly one may be outstanding. */
  let pending: BeamChunkMessage | null = null;
  let hash: BeamHash | null = null;

  // Staging work is serialised behind one promise chain: `write` and `finalize` may
  // be async, and an item's verify must not run before its bytes have landed. Inbound
  // frames stay synchronous (transports deliver them that way) and only enqueue.
  let chain: Promise<void> = Promise.resolve();

  let state: BeamRecvState = buildState();

  function buildState(): BeamRecvState {
    const cur = offer?.items[index];
    return {
      beamId: offer?.beamId ?? '',
      phase,
      offer,
      progress: progressFor(index, itemBytes, cur ? cur.bytes : 0, received, offer?.totalBytes ?? 0, itemsDone),
      reason,
      detail,
      discarded,
    };
  }

  function emit(): void {
    state = buildState();
    notify(subs, state);
  }

  function settled(): boolean {
    return phase === 'complete' || phase === 'declined' || phase === 'cancelled';
  }

  /** Every write to the wire, and neither ever throws - see the sender's pair. */
  function wireJson(msg: BeamMessage): boolean {
    try {
      opts.wire.json(msg);
      return true;
    } catch {
      return false;
    }
  }

  /** The section 11.18 latch: at most once, and on every terminal that is not `complete`. */
  function discardOnce(): void {
    if (discarded) return;
    discarded = true;
    const run = async (): Promise<void> => {
      try {
        await opts.sink.discard();
      } catch {
        /* teardown must not resurrect a dead transfer */
      }
    };
    // BOTH handlers, deliberately: section 11.18's guarantee is unconditional, so a chain
    // that has somehow rejected must still reach the discard - a bare `.then(run)`
    // would skip it and leave the staged bytes behind, which is the one outcome
    // this latch exists to make impossible.
    chain = chain.then(run, run);
  }

  function end(next: BeamRecvPhase, why?: BeamEndReason, why2?: string): void {
    if (settled()) return;
    phase = next;
    reason = why;
    detail = why2;
    pending = null;
    hash = null;
    if (next !== 'complete') discardOnce();
    emit();
  }

  /**
   * TERMINAL FIRST, ANNOUNCEMENT SECOND. The order is the whole fix: the wire write
   * used to run before `end()`, and `wire.json` can throw (an `RTCDataChannel` that
   * is closed, or whose send buffer is full) - so a fail on a dying channel never
   * reached `end()`. `discardOnce()` never fired, `phase` stayed `receiving`, and
   * the receiver went on accepting and STAGING bytes from the peer it had just
   * judged to be violating the protocol. Both headline guarantees broke on one
   * line: section 11.18's exactly-once discard, and "never a thrown exception". Announcing
   * afterwards through the non-throwing `wireJson` costs nothing and cannot.
   */
  function fail(why: BeamCancelReason, why2?: string, silent = false): void {
    if (settled()) return;
    const target = silent ? undefined : offer;
    end('cancelled', why, why2);
    if (target) {
      wireJson({ v: BEAM_PROTOCOL_VERSION, beamId: target.beamId, t: 'cancel', reason: why, detail: why2 });
    }
  }

  function enqueue(fn: () => void | Promise<void>): void {
    chain = chain.then(async () => {
      if (settled()) return;
      try {
        await fn();
      } catch (err) {
        fail('sink-failure', errText(err));
      }
    });
  }

  function startItem(): void {
    itemBytes = 0;
    expectSeq = 0;
    sawLast = false;
    hash = makeHash ? makeHash() : null;
  }

  function onOffer(msg: BeamOfferMessage): void {
    if (phase !== 'waiting') {
      fail('bad-message', `offer in ${phase}`);
      return;
    }
    offer = msg;
    if (!kinds.includes(msg.kind)) {
      declineWith('unsupported-kind');
      return;
    }
    if (msg.items.length > maxItems) {
      declineWith('too-many-items');
      return;
    }
    if (msg.totalBytes > maxTotal) {
      declineWith('too-large');
      return;
    }
    phase = 'offered';
    emit();
  }

  function declineWith(why: BeamDeclineReason): void {
    // Same order as `fail`, for the same reason: a decline that could not be sent is
    // still a decline, and section 11.18's discard must not depend on the wire.
    const target = offer;
    end('declined', why);
    if (target) wireJson({ v: BEAM_PROTOCOL_VERSION, beamId: target.beamId, t: 'decline', reason: why });
  }

  function onChunkHeader(msg: BeamChunkMessage): void {
    // THE CONSENT GATE (section 6.4, section 11.24). Nothing about the transfer is inspected first
    // - a header before accept is refused for arriving at all.
    if (phase !== 'receiving') {
      fail('unsolicited-bytes', `chunk header in ${phase}`, !offer);
      return;
    }
    if (pending) {
      fail('bad-message', 'two chunk headers with no payload between');
      return;
    }
    if (index >= offer!.items.length) {
      fail('bad-item', `chunk after the last item (${index})`);
      return;
    }
    if (msg.itemIndex !== index) {
      fail('bad-item', `chunk for item ${msg.itemIndex}, expected ${index}`);
      return;
    }
    if (sawLast) {
      fail('bad-sequence', `chunk after the last chunk of item ${index}`);
      return;
    }
    if (msg.seq !== expectSeq) {
      fail('bad-sequence', `seq ${msg.seq}, expected ${expectSeq}`);
      return;
    }
    pending = msg;
  }

  function onItemDone(msg: BeamItemDoneMessage): void {
    if (phase !== 'receiving') {
      fail('unsolicited-bytes', `item-done in ${phase}`, !offer);
      return;
    }
    if (pending) {
      fail('bad-message', 'item-done with a chunk header still unpaid');
      return;
    }
    const item = offer!.items[index];
    if (!item || msg.itemIndex !== index) {
      fail('bad-item', `item-done for ${msg.itemIndex}, expected ${index}`);
      return;
    }
    if (item.bytes === 0 ? itemBytes !== 0 : !sawLast || itemBytes !== item.bytes) {
      fail('size-mismatch', `item ${index} staged ${itemBytes} of ${item.bytes}`);
      return;
    }
    // The offer and the sender's own post-hoc digest must agree before a single byte
    // is compared: a sender whose source drifted mid-transfer is caught here.
    if (msg.checksum !== item.checksum) {
      fail('checksum-mismatch', `item ${index} item-done ≠ offer`);
      return;
    }

    const at = index;
    const expected = item.checksum;
    const itemHash = hash;
    index++;
    startItem();
    enqueue(async () => {
      const fromSink = await opts.sink.finalize(at);
      let actual: string | null = typeof fromSink === 'string' ? fromSink : null;
      if (actual === null && itemHash) actual = await itemHash.digest();
      if (actual === null) {
        fail('sink-failure', `no digest available for item ${at}`);
        return;
      }
      if (actual !== expected) {
        fail('checksum-mismatch', `item ${at} staged bytes ≠ ${expected}`);
        return;
      }
      itemsDone++;
      emit();
    });
    emit();
  }

  function onComplete(): void {
    if (phase !== 'receiving') {
      fail('bad-message', `complete in ${phase}`);
      return;
    }
    if (pending || index !== offer!.items.length) {
      fail('bad-message', `complete with ${offer!.items.length - index} item(s) outstanding`);
      return;
    }
    // Queued so the last item's finalize + verify has definitively passed first; a
    // failed verify sets a terminal phase and this task then no-ops.
    enqueue(() => {
      end('complete');
    });
  }

  return {
    get state() {
      return state;
    },

    receive(raw: unknown) {
      if (settled()) return;
      const parsed = parseBeamMessage(raw);
      if (!parsed.ok) {
        // As on the sender: a frame that names a DIFFERENT beam is not ours to
        // judge, and that has to be decided before the refusal, not after it.
        // (Before an offer exists there is no identity to compare against, so a
        // stray frame in `waiting` is still taken as ours - the offer is the only
        // thing that could tell us otherwise.)
        const claimed = claimedBeamId(raw);
        if (offer && claimed !== undefined && claimed !== offer.beamId) return;
        fail(parsed.reason, parsed.detail, !offer);
        return;
      }
      const msg = parsed.value;
      if (offer && msg.beamId !== offer.beamId) return;
      switch (msg.t) {
        case 'offer':
          onOffer(msg);
          return;
        case 'chunk':
          onChunkHeader(msg);
          return;
        case 'item-done':
          onItemDone(msg);
          return;
        case 'complete':
          onComplete();
          return;
        case 'cancel':
          end('cancelled', msg.reason, msg.detail);
          return;
        default:
          fail('bad-message', `receiver received ${msg.t}`);
      }
    },

    receiveBinary(bytes: Uint8Array) {
      if (settled()) return;
      if (phase !== 'receiving') {
        fail('unsolicited-bytes', `payload frame in ${phase}`, !offer);
        return;
      }
      const header = pending;
      if (!header) {
        fail('bad-message', 'payload frame with no chunk header');
        return;
      }
      pending = null;
      if (!(bytes instanceof Uint8Array)) {
        fail('bad-message', 'payload frame is not bytes');
        return;
      }
      if (bytes.length === 0) {
        fail('bad-message', 'empty payload frame');
        return;
      }
      if (bytes.length > maxChunk) {
        fail('oversize-chunk', `${bytes.length} bytes`);
        return;
      }
      const item = offer!.items[index]!;
      if (itemBytes + bytes.length > item.bytes) {
        fail('oversize-chunk', `item ${index} would exceed its declared ${item.bytes}`);
        return;
      }
      if (header.last && itemBytes + bytes.length !== item.bytes) {
        fail('size-mismatch', `item ${index} last chunk ends at ${itemBytes + bytes.length} of ${item.bytes}`);
        return;
      }

      // Copied because the staging write is deferred behind the queue: the caller's
      // buffer is ours only for the duration of this synchronous call.
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      const at = index;
      const seq = header.seq;
      itemBytes += copy.length;
      received += copy.length;
      expectSeq++;
      if (header.last) sawLast = true;
      hash?.update(copy);
      enqueue(() => opts.sink.write(at, seq, copy));
      emit();
    },

    accept() {
      if (phase !== 'offered') return;
      phase = 'receiving';
      startItem();
      if (!wireJson({ v: BEAM_PROTOCOL_VERSION, beamId: offer!.beamId, t: 'accept' })) {
        // The channel died between the offer and the human saying yes. Nothing is
        // staged yet, but the latch still runs - section 11.18 is unconditional.
        fail('transport', 'accept could not be written', true);
        return;
      }
      emit();
    },

    decline(why = 'user') {
      if (phase !== 'offered' && phase !== 'waiting') return;
      declineWith(why);
    },

    cancel(why = 'user', why2) {
      fail(why, why2);
    },

    abort(why = 'transport', why2) {
      fail(why, why2, true);
    },

    async drain() {
      // Never rejects. A sink error is already converted into `fail('sink-failure')`
      // by `enqueue`, so a rejected chain would only ever be a bug in this module - 
      // and surfacing it as a rejection from `drain()` would break the same "never a
      // thrown exception" promise everywhere else here keeps.
      let seen: Promise<void>;
      do {
        seen = chain;
        await seen.catch(() => undefined);
      } while (seen !== chain);
    },

    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },

    dispose() {
      // Unlike the ceremony's dispose, this one is not purely observational: a
      // half-received beam holds staging, and section 11.18 says staging never survives a
      // transfer that did not complete. So tear down first, silently.
      if (!settled()) end('cancelled', 'transport', 'disposed');
      subs.clear();
    },
  };
}
