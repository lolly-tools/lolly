// SPDX-License-Identifier: MPL-2.0
/**
 * op-guard - the check every INBOUND collaboration message passes before it is
 * allowed to become state (plan 100 section 6.3 + section 11.21, wave 2.4).
 *
 * A paired peer is untrusted input, continuously (section 11.22): the threat model equals
 * "opened a shared lolly URL", except the URL keeps arriving, forty times a second,
 * from a machine we do not control. Everything below the transport therefore assumes
 * the bytes are hostile until this module has said otherwise. It is the ONE place
 * that assumption is discharged; `collab-plumbing.ts` (the seam that turns ops into
 * a `runtime.applyPatch`) re-checks a couple of the same rules as defence in depth,
 * but it is not the boundary and must not be asked to be.
 *
 * FOUR LAYERS, in this order, because each one protects the next:
 *
 *  1. STRUCTURE - an iterative walk (never recursion: the guard must not be the
 *     thing that stack-overflows on a nested payload) enforcing JSON depth, array
 *     length, a per-payload visit budget and finite numbers, and killing `__proto__`
 *     / `constructor` / `prototype` own keys wherever they appear. Runs FIRST so ajv
 *     never recurses into a pathological shape.
 *  2. SCHEMA - the canonical `validateCanvasOp` from `@lolly-tools/core`: the SAME
 *     ajv-compiled `schemas/canvas-op.schema.json` lolly-work's gateway runs, so a
 *     private pair and an org room agree on op shape by construction (section 6.3).
 *  3. MANIFEST WHITELIST - an own-property check against the tool's DECLARED inputs
 *     and blocks sub-fields. Both peers run the same tool from their own local copy
 *     (section 11.22 - peers send values, never code), so anything the manifest does not
 *     declare has no legitimate sender.
 *  4. CAPS - per-value size, ops per message, and (via `recordAndCheckRate`) ops and
 *     presence frames per second.
 *
 * WHAT THE SCHEMA DOES NOT CATCH, measured rather than assumed - this is why layers
 * 1 and 3 exist at all. Every one of these validates CLEAN against the canonical
 * schema today, and every one of them is a real write on the other side:
 *
 *   - `{k:'geom', fields:{x: NaN}}` and `{x: Infinity}`. ajv's `type: "number"` is a
 *     `typeof` test; NaN and Infinity are numbers. They land as a box coordinate and
 *     poison every layout computation downstream (section 11.11 names NaN explicitly).
 *   - `origin: {clock: Infinity}`. `type: "integer"` is `!(data % 1)`, and
 *     `Infinity % 1` is NaN, so it passes - an origin that wins every future LWW
 *     merge for the lifetime of the document. (NaN is caught by ajv; Infinity is not.)
 *   - `{k:'add', row:{"__proto__": null}}`. `row`'s `additionalProperties` is the
 *     scalar $ref, so ANY key is schema-legal - and `JSON.parse` makes `__proto__` an
 *     OWN property. The rebuild in collab-plumbing does `row[field] = value` on an
 *     object literal, where that key is the prototype setter, not data.
 *   - `{k:'field', field:'__proto__'}` and `{k:'param', key:'__proto__'}`. Both are
 *     just strings to the schema, and both become object keys downstream.
 *
 * FORBIDDEN KEYS DIE REGARDLESS OF ANY LIST. `__proto__`, `constructor` and
 * `prototype` are refused as op keys, as field names, as param keys and as
 * collection ids even if a manifest declares an input by that name - the whitelist
 * is a narrowing, never a permission (the enum/prototype-key discipline
 * `engine/src/url-mode.ts` applies to untrusted URL text, same reasoning, same
 * boundary). Every whitelist here is a `Set`, which is the own-property discipline
 * in its strongest available form: a `Set` has no string-keyed prototype chain to
 * confuse in the first place, so `has('constructor')` is false unless something
 * genuinely added it. Where raw objects ARE read, they are read through
 * `Object.keys`/`Object.hasOwn`, never a bare member access on an inherited name.
 *
 * DROP vs DISCONNECT. Two different failures wear the same return shape and must not
 * be treated alike by the caller. A single op that is merely *unrecognised* - an
 * input id this build does not declare, an op shape a newer peer minted - is DROPPED
 * (that op only; section 11.11: never the batch, never a throw) and the session continues;
 * PWA staleness makes version skew routine (section 11.19). A cap breach - depth, array
 * length, batch size, a forbidden key, a rate ceiling - is ABUSE, and section 11.21 is
 * explicit that such a peer is disconnected, not silently throttled. `ABUSE_REASONS`
 * is the set the caller tests against so that decision is made from data rather than
 * from a string comparison at the call site.
 *
 * NO WALL CLOCK. `recordAndCheckRate` takes `nowMs` as a parameter and this module
 * never reads `Date.now`, `performance.now` or a `Date` - partly so the rate window
 * is deterministically testable, and partly for the section 11.7 rule that an airgapped
 * device with a wrong clock behaves identically to one with a right one. A test pins
 * the absence by scanning this file's source.
 *
 * SCOPE. Pure module: no DOM, no transport, no timers, no I/O, no state beyond the
 * two rate windows. It does not decide WHAT an op means (that is collab-plumbing's
 * projection) and it does not type-check a value against its input's declared type
 * (that is `applyPatch`'s job, section 11.11 - an out-of-whitelist enum or a string for a
 * number input is dropped there, per key). It decides only whether a message is
 * allowed to be looked at.
 */

import { validateCanvasOp } from '@lolly-tools/core';
import type { CanvasOp, Presence } from '@lolly-tools/core/canvas-op-v1';
// The row-id field is resolved through the ONE definition the sidebar, the canvas
// and the collab projection all share: a row minted under one name and addressed
// under another is a row nothing can resolve (lib/row-id.ts header).
import { rowIdField } from '../lib/row-id.ts';

// ── The refusal vocabulary ────────────────────────────────────────────────────

/**
 * Why a message, or one op inside it, was refused. Typed rather than free text
 * because the disconnect copy (section 11.26 asks for a SPECIFIC cause, never a generic
 * failure) and the abuse decision both key on it.
 */
export type OpRejectReason =
  /** Not the container/object shape this entry point takes at all. */
  | 'malformed'
  /** More ops in one message than `opsPerMessage` - the whole batch is refused. */
  | 'batch-too-large'
  /** Nested deeper than `maxDepth`. */
  | 'too-deep'
  /** An array longer than `maxArrayLength`. */
  | 'array-too-long'
  /** More values visited while scanning one op or frame than `maxNodes`. */
  | 'too-many-nodes'
  /** `__proto__` / `constructor` / `prototype` as a key, field, param or collection. */
  | 'forbidden-key'
  /** Failed the canonical ajv canvas-op schema. */
  | 'schema'
  /** NaN or Infinity where the schema's `number`/`integer` let one through. */
  | 'not-finite'
  /** A finite `origin.clock` that is not a safe integer - the LWW poisoning
   *  `not-finite` catches only the infinite half of. */
  | 'clock-out-of-range'
  /** A `param` key that is not a declared input id. */
  | 'unknown-input'
  /** A declared input, but not one whose whole value is a scalar (`param`'s lane). */
  | 'wrong-lane'
  /** A `col` that is not a declared `blocks` input (or a box op with no default). */
  | 'unknown-collection'
  /** A field/row key that is not a declared sub-field of that collection. */
  | 'unknown-field'
  /** A string value over the per-value size cap. */
  | 'value-too-large'
  /** A box/client/order identifier longer than `idChars`. */
  | 'id-too-long'
  /** A string carrying characters that are unsafe where it lands (presence colour). */
  | 'unsafe-string'
  /** Reported by the caller when `recordAndCheckRate` returns false. */
  | 'rate-limited';

/** One refusal: the typed reason, plus the offending name/value where naming it is
 *  useful for a log line. `detail` is derived from the peer's payload and is capped,
 *  so it is safe to log but must never be rendered as trusted text. */
export interface OpRejection {
  readonly reason: OpRejectReason;
  readonly detail?: string;
}

/**
 * The reasons that mean "this peer is misbehaving, disconnect" rather than "this one
 * op made no sense to this build, drop it" (section 11.21: a peer exceeding caps is
 * disconnected, not throttled silently).
 *
 * The line is drawn where section 11.11 draws it. A structural cap breach (depth, array
 * length, node count, batch size, rate) or a prototype key has no innocent sender - 
 * nothing in this codebase can emit one, so seeing one means the peer is not running
 * this protocol in good faith. An out-of-range VALUE, by contrast - an oversized
 * string, a NaN coordinate, an unknown input id, a colour with a semicolon in it - is
 * exactly the case section 11.11 says to handle by dropping that key and carrying on: it is
 * what a buggy, half-migrated or newer build genuinely produces.
 */
export const ABUSE_REASONS: ReadonlySet<OpRejectReason> = new Set<OpRejectReason>([
  'batch-too-large', 'too-deep', 'array-too-long', 'too-many-nodes',
  'forbidden-key', 'rate-limited', 'clock-out-of-range',
]);

/** Longest peer-derived string that may ride in a rejection `detail`. The REASON
 *  is typed and bounded; the detail is a slice of the peer's own payload, and the
 *  contract above tells the caller it is safe to log - which is only true if it is
 *  bounded. Without this a 5 MB `col`, param key or field name is retained in the
 *  `rejected` array and handed to the logger, up to `opsPerMessage` times per
 *  message. (`stringBytes` does not help: the per-value cap runs on values, never
 *  on the NAMES, and the ops walk carries no string ceiling at all.) */
const DETAIL_CHARS = 120;

/** A peer string, safe to put in a `detail`. */
function clip(s: string): string {
  return s.length > DETAIL_CHARS ? `${s.slice(0, DETAIL_CHARS)}... (${s.length} chars)` : s;
}

/**
 * The ceiling on `origin.clock`, and it is `Number.isSafeInteger` for a reason
 * beyond tidiness. The schema's `{type:'integer', minimum:0}` has no maximum, and
 * ajv's integer test is `!(data % 1)` - so `1e308` is schema-valid, finite (layer
 * 1 passes it) and an integer. Landing one is the exact attack the module header
 * describes: an origin that wins every future LWW merge for the life of the
 * document. Worse than losing the merge, the inbound clock feeds
 * `collab-plumbing`'s `observeClock`, whose `nextClock()` is `++clock` - and
 * `++1e308 === 1e308`, so every subsequent LOCAL op carries that same clock
 * forever, every write ties, and the tiebreak falls to client id: a peer whose id
 * sorts higher can permanently prevent the local user from overwriting anything,
 * with no recovery short of a reload. Above MAX_SAFE_INTEGER `++` stops
 * incrementing, so the safe-integer band IS the band in which a Lamport counter
 * still counts. Nothing legitimate approaches it: a clock is minted by `++` from
 * zero.
 */
function clockOutOfRange(clock: number): boolean {
  return !Number.isSafeInteger(clock) || clock < 0;
}

/** Ops that survived the guard, and everything that did not. `ok` holds the ORIGINAL
 *  op objects - the guard never rewrites, normalizes or clones a payload, so what the
 *  adapter applies is byte-identical to what the peer sent. */
export interface OpCheckResult {
  readonly ok: CanvasOp[];
  readonly rejected: OpRejection[];
}

/** A presence frame that survived (the original object), or null. */
export interface PresenceCheckResult {
  readonly ok: Presence | null;
  readonly rejected: OpRejection[];
}

/** The two independently-capped inbound lanes (section 11.6: ops are reliable-ordered,
 *  presence is unordered-lossy, and they ride separate data channels). */
export type RateKind = 'ops' | 'presence';

// ── Caps ──────────────────────────────────────────────────────────────────────

/** Every ceiling the guard enforces, all overridable so a test can trip one
 *  cheaply and a future transport can tighten them without a code change. */
export interface OpGuardCaps {
  /** Per string value, in UTF-8 bytes. */
  stringBytes: number;
  /** Per string value landing in a `longtext` input or sub-field, in UTF-8 bytes. */
  longtextBytes: number;
  /** Max characters in a box id, client id, collection id or order key. */
  idChars: number;
  /** Max entries in any single array anywhere in a payload. */
  maxArrayLength: number;
  /** Max container nesting depth (the op/frame object itself is depth 1). */
  maxDepth: number;
  /**
   * Max VALUES - containers and the primitives inside them - visited while scanning
   * one op or one presence frame. This is the walk's work budget, and it counts
   * primitives deliberately: a container budget alone bounds the shape but not the
   * effort, so a wide-but-shallow payload (arrays of arrays of scalars, each inside
   * the length cap) could still cost millions of iterations per message while never
   * exceeding a count of containers. Must stay comfortably above `maxArrayLength`,
   * or an array AT the length cap trips this instead and the length cap becomes
   * unreachable.
   */
  maxNodes: number;
  /** Max ops in one message (section 11.21's ~200). */
  opsPerMessage: number;
  /** Max ops accepted per second across messages (section 11.21's ~200/s). */
  opsPerSecond: number;
  /** Max presence frames per second (section 11.21's ~40/s). */
  presencePerSecond: number;
  /** Max characters in any single presence string. */
  presenceStringChars: number;
  /**
   * Max characters summed over every string in one presence frame - the ceiling
   * that makes a frame's cost bounded even where its keys are not (unknown keys are
   * tolerated for forward compatibility, so SOMETHING has to bound them).
   *
   * It has a real consequence worth stating rather than discovering: presence rides
   * at up to `presencePerSecond`, so a frame budget IS a bandwidth budget, and a
   * broadcast `selection` of stable ids costs ~27 characters each. At the shipped
   * numbers that is roughly 600 ids before a frame is refused. Above that a sender
   * must summarize (a count, not a list) - the presence engine's job, not the
   * boundary's. The guard REFUSES rather than truncating, because a truncated
   * selection is a frame that quietly lies about what the peer has selected.
   */
  presenceTotalChars: number;
  /** Max characters of cursor chat - pinned to the schema's own `maxLength: 64`. */
  chatChars: number;
}

/**
 * The shipped ceilings. The numbers section 11.21 names (200 ops/message, 200 ops/s,
 * 40 presence/s, 64 KB per value, 1 MB for longtext) plus the ones it implies.
 *
 * These are the SEMANTIC caps. The transport has its own, tighter, outer bound - 
 * section 11.6 keeps every SCTP message ≤64 KB cross-browser - so on the P2P path a
 * 1 MB longtext arrives chunked or not at all; the longtext ceiling exists for the
 * paths where a whole value legitimately can arrive at once (a catch-up snapshot,
 * a same-process provider, an org room's ws frame).
 */
export const DEFAULT_OP_GUARD_CAPS: OpGuardCaps = {
  stringBytes: 64 * 1024,
  longtextBytes: 1024 * 1024,
  idChars: 256,
  maxArrayLength: 4096,
  maxDepth: 8,
  // Comfortably above maxArrayLength (so the length cap is the one that fires on a
  // long array) and far above any legitimate payload: a real op visits a few dozen
  // values, and the fattest legitimate presence frame - a full selection plus the
  // same ids under `drag` - visits about 8200.
  maxNodes: 16384,
  opsPerMessage: 200,
  opsPerSecond: 200,
  presencePerSecond: 40,
  presenceStringChars: 512,
  presenceTotalChars: 16 * 1024,
  chatChars: 64,
};

/** The rate window, in ms. Fixed (not sliding): each window starts at the first
 *  sample after the previous one closed. A burst can therefore straddle a boundary
 *  and reach 2× the limit across two adjacent windows - deliberate, because the
 *  consequence of tripping is DISCONNECTION, and a guard that would rather let a
 *  brief overshoot through than falsely accuse a peer is the right bias for this guard. */
const RATE_WINDOW_MS = 1000;

// ── What the guard knows about the tool ───────────────────────────────────────

/**
 * The slice of one declared input the guard reads - structural on purpose (like
 * `RowIdInput` in lib/row-id.ts), so this module needs no engine import and a real
 * `InputModelItem[]` from `runtime.getModel()` passes without adaptation.
 */
export interface OpGuardInput {
  id: string;
  /** The declared `InputType` (engine/src/inputs.ts). */
  type: string;
  /** Declared sub-fields of a `blocks` input (`BlockFieldSpec`). */
  fields?: { id: string; type?: string }[];
  /** Present on the editor-layout canvas collection (`BoxFieldConfig`). */
  canvas?: Record<string, unknown> | undefined;
}

export interface OpGuardOpts {
  /** The tool's declared inputs - the whitelist. An empty list means nothing is
   *  addressable, which is the correct behaviour for a runtime with no model yet. */
  inputs: readonly OpGuardInput[];
  /** Overrides for individual ceilings; anything omitted keeps its default. */
  caps?: Partial<OpGuardCaps>;
}

export interface OpGuard {
  /** Validate one inbound ops message. */
  checkOps(raw: unknown): OpCheckResult;
  /** Validate one inbound presence frame. */
  checkPresence(raw: unknown): PresenceCheckResult;
  /** Record `count` arrivals on `kind` at `nowMs` and report whether the lane is
   *  still within its per-second ceiling. False means "disconnect this peer"
   *  (section 11.21) - the caller reports it as `'rate-limited'`. */
  recordAndCheckRate(kind: RateKind, count: number, nowMs: number): boolean;
}

/**
 * The input types whose whole value IS a scalar, and therefore the only ones a
 * `param` op may address. MIRRORS the private `SCALAR_INPUT_TYPES` in
 * lib/collab-plumbing.ts, which is where the reasoning lives (an `asset` is
 * deliberately shape-blind in the engine, so a bare string dropped on one gives
 * `{{asset logo}}` a ref it cannot resolve). The two are pinned together by a
 * source-drift test rather than by an import, because that one is module-private.
 */
const SCALAR_INPUT_TYPES: ReadonlySet<string> = new Set([
  'text', 'longtext', 'number', 'boolean', 'color', 'select',
  'date', 'time', 'datetime-local', 'url',
]);

/** Keys that are never data, whatever any manifest says. */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Characters that would let a presence colour escape the CSS value context it is
 * painted into - the declaration separator, block delimiters, the quote and markup
 * characters that matter if it is ever interpolated into a `style="…"` attribute or
 * a stylesheet, control characters, and `*` (which exists in no colour value and
 * whose only use here is opening or closing a CSS block comment that would swallow
 * the rest of the declaration it lands in).
 *
 * `/` is deliberately NOT banned: it is the modern alpha separator, so
 * `oklch(0.7 0.1 200 / 0.5)` and `rgb(0 0 0 / 50%)` are ordinary colours. Banning
 * `*` kills the comment forms without taking alpha with it.
 *
 * Deliberately a character ban rather than a colour grammar, because the
 * collaborator colour engine (section 4.4) emits OKLCH and any grammar this module
 * invented would be the thing that broke the day it emits something new. Function
 * CALLS are the one exception, handled separately below.
 */
const UNSAFE_CSS_PUNCT: ReadonlySet<string> = new Set([';', '{', '}', '<', '>', '"', "'", '\\', '*']);

/**
 * The only function names a presence colour may call.
 *
 * Parentheses have to be allowed - OKLCH is a function call - but "anything with
 * parentheses" also allows `url(https://attacker.example/x)`, and the header's
 * stated worst case ("a string that passes this and still is not a colour simply
 * fails to paint, a cosmetic bug in one avatar") is false for that one: `url()` is
 * a NETWORK FETCH, made from the viewer's browser, to an address a paired peer
 * chose. The deployed `img-src` CSP would refuse it today, but this module claims
 * to BE the defence in depth rather than to rely on it, and a Tauri shell or a
 * self-hosted instance may not carry that header. So the name in front of every
 * `(` must be one the colour engine can actually emit.
 */
const CSS_FN_ALLOW: ReadonlySet<string> = new Set([
  'oklch', 'oklab', 'lch', 'lab', 'rgb', 'rgba', 'hsl', 'hsla', 'hwb', 'color', 'color-mix',
]);

/** Is this an ASCII character a CSS function name may contain? */
function isFnNameChar(code: number): boolean {
  return (code >= 0x61 && code <= 0x7a) // a-z
    || (code >= 0x41 && code <= 0x5a) // A-Z
    || (code >= 0x30 && code <= 0x39) // 0-9
    || code === 0x2d; // -
}

/** True for a colour string that must not be painted. Spelled as a character
 *  loop rather than a regex so this source stays plain ASCII (no control-character
 *  escapes in a literal) and so the control-character rule reads as itself. */
function unsafeCssValue(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
    if (UNSAFE_CSS_PUNCT.has(s.charAt(i))) return true;
    if (code !== 0x28) continue; // '('
    // Read the identifier immediately before the paren; an unnamed or unknown
    // function is refused, which covers `url(`, `image-set(`, `attr(` and `var(`.
    let start = i;
    while (start > 0 && isFnNameChar(s.charCodeAt(start - 1))) start--;
    if (start === i) return true; // '(' with no function name in front of it
    if (!CSS_FN_ALLOW.has(s.slice(start, i).toLowerCase())) return true;
  }
  return false;
}

/** Presence keys this build understands. Unknown keys are TOLERATED (see
 *  `checkPresence`) - this set names which values get typed checks, and is what the
 *  drift test compares against the schema's own `presence` $def. */
export const PRESENCE_KEYS: ReadonlySet<string> = new Set([
  'userId', 'name', 'color', 'cursor', 'selection', 'drag',
  'focus', 'location', 'following', 'viewport', 'chat',
]);

// ── UTF-8 size, without allocating a copy of every value ──────────────────────

const utf8 = typeof TextEncoder === 'function' ? new TextEncoder() : null;

/**
 * Is `s` longer than `cap` UTF-8 bytes? Bounded both ways before encoding anything:
 * a UTF-8 byte count is never below the UTF-16 code-unit count and never above 3× it
 * (astral pairs are 2 units → 4 bytes, and a lone surrogate encodes as U+FFFD), so
 * only strings inside that band are actually measured.
 */
function tooManyBytes(s: string, cap: number): boolean {
  if (s.length > cap) return true;
  if (s.length * 3 <= cap) return false;
  return (utf8 ? utf8.encode(s).length : s.length * 3) > cap;
}

// ── Layer 1: the structural walk ──────────────────────────────────────────────

/** Ceilings the structural walk enforces; a subset of OpGuardCaps so presence can
 *  pass its own (tighter, string-summing) variant through the same code. */
interface ScanLimits {
  maxDepth: number;
  maxArrayLength: number;
  maxNodes: number;
  /** When set, every string is capped at this many characters… */
  stringChars?: number;
  /** …and their total is capped at this many. */
  totalChars?: number;
}

/**
 * Walk `root` iteratively, refusing anything structurally abusive. ITERATIVE is not
 * a style choice: a recursive walk would blow the stack on precisely the payload
 * this is here to refuse, turning the guard into the denial of service.
 *
 * Checks, in one pass: nesting depth, array length, the visit budget, forbidden own
 * keys, non-finite numbers, and (presence only) string sizes. Returns a reason, or
 * null.
 *
 * The budget is charged on EVERY value popped, primitives included, because the
 * effort is what needs bounding, not the shape: containers alone would let an
 * entry of arrays-of-scalars - every array inside the length cap - cost the product
 * of the two caps in iterations. An array's length is checked when the array itself
 * is popped, BEFORE its children are pushed, so an oversized one costs a length read
 * rather than a traversal.
 */
function scanStructure(root: unknown, limits: ScanLimits): OpRejection | null {
  const stack: { v: unknown; d: number }[] = [{ v: root, d: 1 }];
  let visited = 0;
  let chars = 0;
  while (stack.length > 0) {
    const top = stack.pop();
    if (top === undefined) break;
    const { v, d } = top;
    if (++visited > limits.maxNodes) return { reason: 'too-many-nodes' };
    if (typeof v === 'number') {
      if (!Number.isFinite(v)) return { reason: 'not-finite', detail: String(v) };
      continue;
    }
    if (typeof v === 'string') {
      if (limits.stringChars !== undefined && v.length > limits.stringChars) {
        return { reason: 'value-too-large', detail: `${v.length} chars` };
      }
      if (limits.totalChars !== undefined) {
        chars += v.length;
        if (chars > limits.totalChars) {
          return { reason: 'value-too-large', detail: `${chars} chars total` };
        }
      }
      continue;
    }
    if (v === null || typeof v !== 'object') continue;
    if (d > limits.maxDepth) return { reason: 'too-deep' };
    if (Array.isArray(v)) {
      if (v.length > limits.maxArrayLength) {
        return { reason: 'array-too-long', detail: String(v.length) };
      }
      for (const child of v) stack.push({ v: child, d: d + 1 });
      continue;
    }
    // Object.keys is own+enumerable only, and a forbidden key is refused BEFORE its
    // value is read - so nothing here ever touches an inherited member.
    for (const key of Object.keys(v)) {
      if (FORBIDDEN_KEYS.has(key)) return { reason: 'forbidden-key', detail: key };
      stack.push({ v: (v as Record<string, unknown>)[key], d: d + 1 });
    }
  }
  return null;
}

// ── The guard ─────────────────────────────────────────────────────────────────

/** One `blocks` input's whitelist, precomputed once at construction. */
interface Collection {
  /** Declared sub-field ids, plus the row-id field this collection addresses rows by
   *  (the tool's own id sub-field on a canvas collection, `__rid` elsewhere). */
  allowed: ReadonlySet<string>;
  /** The subset declared `longtext`, which earns the larger value cap. */
  longtext: ReadonlySet<string>;
}

/**
 * Build the guard for ONE mounted tool. The whitelist is captured at construction:
 * a tool whose model changes shape (it cannot - inputs are declared in the manifest,
 * not inferred) would need a fresh guard.
 */
export function createOpGuard(opts: OpGuardOpts): OpGuard {
  const caps: OpGuardCaps = { ...DEFAULT_OP_GUARD_CAPS, ...opts.caps };

  const declaredIds = new Set<string>();
  const paramIds = new Set<string>();
  const longtextParams = new Set<string>();
  const collections = new Map<string, Collection>();
  let canvasCol: string | undefined;

  for (const input of opts.inputs ?? []) {
    const id = input?.id;
    // A manifest CANNOT buy an input the right to be a prototype key (nor can a
    // hostile catalog entry that claims to be one).
    if (typeof id !== 'string' || !id || FORBIDDEN_KEYS.has(id)) continue;
    declaredIds.add(id);
    if (SCALAR_INPUT_TYPES.has(input.type)) {
      paramIds.add(id);
      if (input.type === 'longtext') longtextParams.add(id);
    }
    if (input.type !== 'blocks') continue;
    const allowed = new Set<string>();
    const longtext = new Set<string>();
    for (const f of input.fields ?? []) {
      if (typeof f?.id !== 'string' || !f.id || FORBIDDEN_KEYS.has(f.id)) continue;
      allowed.add(f.id);
      if (f.type === 'longtext') longtext.add(f.id);
    }
    // The row's own id field is addressable (it is how the row is named), and it is
    // resolved through the shared definition - declared id sub-field on a canvas
    // collection, the hidden `__rid` on every other blocks input.
    const idField = rowIdField(input);
    if (!FORBIDDEN_KEYS.has(idField)) allowed.add(idField);
    collections.set(id, { allowed, longtext });
    // A box op with no `col` means the default canvas collection - the same rule
    // collab-plumbing's inbound path applies (v1.0 shape, v1.1's documented default).
    if (input.canvas && canvasCol === undefined) canvasCol = id;
  }

  const windows = new Map<RateKind, { start: number; count: number }>();

  /** Per-value size check over a param/field value (a scalar, or a `{bind:…}`
   *  descriptor whose provider/query/version strings are also peer-supplied). */
  function valueTooLarge(value: unknown, cap: number): OpRejection | null {
    if (typeof value === 'string') {
      return tooManyBytes(value, cap) ? { reason: 'value-too-large' } : null;
    }
    if (value === null || typeof value !== 'object') return null;
    for (const key of Object.keys(value)) {
      if (FORBIDDEN_KEYS.has(key)) return { reason: 'forbidden-key', detail: key };
      const found = valueTooLarge((value as Record<string, unknown>)[key], cap);
      if (found) return found;
    }
    return null;
  }

  /** Identifier length check - box ids and client ids are peer-minted (ULIDs are 26
   *  chars) and order keys grow by a character per contested mid-insert, so they are
   *  bounded rather than whitelisted. */
  function idTooLong(...values: string[]): OpRejection | null {
    for (const v of values) {
      if (v.length > caps.idChars) return { reason: 'id-too-long', detail: String(v.length) };
    }
    return null;
  }

  /** One field write against a collection's whitelist, plus its value cap. */
  function checkField(col: Collection, field: string, value: unknown): OpRejection | null {
    if (FORBIDDEN_KEYS.has(field)) return { reason: 'forbidden-key', detail: field };
    if (!col.allowed.has(field)) return { reason: 'unknown-field', detail: clip(field) };
    return valueTooLarge(value, col.longtext.has(field) ? caps.longtextBytes : caps.stringBytes);
  }

  /** Layer 3 + the per-value part of layer 4, for one schema-valid op. */
  function checkWhitelist(op: CanvasOp): OpRejection | null {
    // Before anything about WHAT the op addresses: the origin it claims. Layer 1
    // establishes only that the clock is finite, and the schema only that it is a
    // non-negative integer - neither of which bounds it (see `clockOutOfRange`).
    if (clockOutOfRange(op.origin.clock)) {
      return { reason: 'clock-out-of-range', detail: String(op.origin.clock) };
    }
    if (op.k === 'param') {
      const key = op.key;
      if (FORBIDDEN_KEYS.has(key)) return { reason: 'forbidden-key', detail: key };
      if (!declaredIds.has(key)) return { reason: 'unknown-input', detail: clip(key) };
      if (!paramIds.has(key)) return { reason: 'wrong-lane', detail: clip(key) };
      const long = idTooLong(op.origin.client);
      if (long) return long;
      return valueTooLarge(op.value, longtextParams.has(key) ? caps.longtextBytes : caps.stringBytes);
    }

    const colId = op.col ?? canvasCol;
    // No `col` and no canvas collection: nothing this op could legitimately mean.
    if (colId === undefined) return { reason: 'unknown-collection' };
    if (FORBIDDEN_KEYS.has(colId)) return { reason: 'forbidden-key', detail: colId };
    const col = collections.get(colId);
    if (col === undefined) return { reason: 'unknown-collection', detail: clip(colId) };

    const long = idTooLong(op.id, op.origin.client, op.k === 'add' || op.k === 'order' ? op.orderKey : '');
    if (long) return long;

    switch (op.k) {
      case 'field':
        return checkField(col, op.field, op.value);
      case 'add': {
        for (const field of Object.keys(op.row)) {
          const bad = checkField(col, field, op.row[field]);
          if (bad) return bad;
        }
        return null;
      }
      case 'geom': {
        // The schema already restricts these names to x/y/w/h/rot; they must ALSO be
        // fields this collection actually declares, which is what keeps a geometry
        // op off a generic blocks input that has no geometry at all.
        for (const field of Object.keys(op.fields)) {
          if (!col.allowed.has(field)) return { reason: 'unknown-field', detail: clip(field) };
        }
        return null;
      }
      case 'remove':
      case 'order':
        return null;
    }
  }

  return {
    checkOps(raw: unknown): OpCheckResult {
      const ok: CanvasOp[] = [];
      const rejected: OpRejection[] = [];
      if (!Array.isArray(raw)) {
        rejected.push({ reason: 'malformed', detail: 'not an array of ops' });
        return { ok, rejected };
      }
      // Batch size is checked before any per-op work, so an absurd message costs a
      // length read. The whole batch goes - this is a cap breach, not a stale op.
      if (raw.length > caps.opsPerMessage) {
        rejected.push({ reason: 'batch-too-large', detail: String(raw.length) });
        return { ok, rejected };
      }
      for (const entry of raw) {
        const structural = scanStructure(entry, caps);
        if (structural) { rejected.push(structural); continue; }
        if (!validateCanvasOp(entry).valid) {
          rejected.push({ reason: 'schema' });
          continue;
        }
        const op = entry as CanvasOp;
        const bad = checkWhitelist(op);
        if (bad) { rejected.push(bad); continue; }
        ok.push(op);
      }
      // A cap breach anywhere in the message takes the WHOLE message, not just the
      // op that tripped it. `batch-too-large` already worked this way; the other
      // abuse reasons did not, which left the caller holding a list of ops to apply
      // from the same message it was being told to disconnect over. The two
      // decisions must not be able to disagree at the call site - and they cannot
      // now, because there is nothing to apply.
      if (rejected.some((r) => ABUSE_REASONS.has(r.reason))) return { ok: [], rejected };
      return { ok, rejected };
    },

    checkPresence(raw: unknown): PresenceCheckResult {
      const rejected: OpRejection[] = [];
      const reject = (reason: OpRejectReason, detail?: string): PresenceCheckResult => {
        rejected.push(detail === undefined ? { reason } : { reason, detail });
        return { ok: null, rejected };
      };
      if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
        return reject('malformed', 'not a presence object');
      }
      // Presence has no exported ajv validator (the schema's `presence` $def is not
      // compiled by `validateCanvasOp`), so layer 2 is this hand-written mirror of
      // it - pinned to the schema by a drift test, exactly as the two copies of the
      // manifest schema are. The scan carries presence's own string ceilings, so an
      // unknown subtree is bounded even though it is tolerated.
      const structural = scanStructure(raw, {
        maxDepth: caps.maxDepth,
        maxArrayLength: caps.maxArrayLength,
        maxNodes: caps.maxNodes,
        stringChars: caps.presenceStringChars,
        totalChars: caps.presenceTotalChars,
      });
      if (structural) { rejected.push(structural); return { ok: null, rejected }; }

      const p = raw as Record<string, unknown>;
      const str = (key: string): string | undefined =>
        Object.hasOwn(p, key) && typeof p[key] === 'string' ? (p[key] as string) : undefined;

      // Required (schema: userId, name, color, cursor, selection).
      const userId = str('userId');
      if (userId === undefined || userId === '') return reject('schema', 'userId');
      if (str('name') === undefined) return reject('schema', 'name');
      const color = str('color');
      if (color === undefined) return reject('schema', 'color');
      if (unsafeCssValue(color)) return reject('unsafe-string', 'color');

      const cursor = Object.hasOwn(p, 'cursor') ? p.cursor : undefined;
      if (cursor === null || typeof cursor !== 'object' || Array.isArray(cursor)) {
        return reject('schema', 'cursor');
      }
      const c = cursor as Record<string, unknown>;
      for (const axis of ['x', 'y'] as const) {
        const n = Object.hasOwn(c, axis) ? c[axis] : undefined;
        // Normalized unit space (plans/99 section 5) - a cursor outside 0..1 is not a
        // cursor, and finiteness was already established by the scan.
        if (typeof n !== 'number' || n < 0 || n > 1) return reject('schema', `cursor.${axis}`);
      }

      const selection = Object.hasOwn(p, 'selection') ? p.selection : undefined;
      if (!Array.isArray(selection)) return reject('schema', 'selection');
      for (const id of selection) {
        if (typeof id !== 'string' || id === '') return reject('schema', 'selection[]');
        if (id.length > caps.idChars) return reject('id-too-long', 'selection[]');
      }

      // Optional v1.1 fields - checked only when present, since an older peer sends
      // none of them and a newer one may send fields this build has never heard of.
      if (Object.hasOwn(p, 'drag') && p.drag !== undefined) {
        const drag = p.drag;
        if (drag === null || typeof drag !== 'object' || Array.isArray(drag)) {
          return reject('schema', 'drag');
        }
        const d = drag as Record<string, unknown>;
        const ids = Object.hasOwn(d, 'ids') ? d.ids : undefined;
        if (!Array.isArray(ids)) return reject('schema', 'drag.ids');
        for (const id of ids) {
          if (typeof id !== 'string' || id === '') return reject('schema', 'drag.ids[]');
          if (id.length > caps.idChars) return reject('id-too-long', 'drag.ids[]');
        }
        const dxy = Object.hasOwn(d, 'dxy') ? d.dxy : undefined;
        if (!Array.isArray(dxy) || dxy.length !== 2) return reject('schema', 'drag.dxy');
        for (const n of dxy) if (typeof n !== 'number') return reject('schema', 'drag.dxy[]');
      }

      for (const key of ['focus', 'location', 'following'] as const) {
        if (Object.hasOwn(p, key) && p[key] !== undefined && str(key) === undefined) {
          return reject('schema', key);
        }
      }

      if (Object.hasOwn(p, 'viewport') && p.viewport !== undefined) {
        const vp = p.viewport;
        if (vp === null || typeof vp !== 'object' || Array.isArray(vp)) {
          return reject('schema', 'viewport');
        }
        const v = vp as Record<string, unknown>;
        for (const key of ['x', 'y', 'zoom'] as const) {
          if (typeof (Object.hasOwn(v, key) ? v[key] : undefined) !== 'number') {
            return reject('schema', `viewport.${key}`);
          }
        }
      }

      if (Object.hasOwn(p, 'chat') && p.chat !== undefined) {
        const chat = str('chat');
        if (chat === undefined) return reject('schema', 'chat');
        // The schema's own maxLength - cursor chat is 64 characters, not 64 KB.
        if (chat.length > caps.chatChars) return reject('value-too-large', 'chat');
      }

      // Unknown keys are deliberately TOLERATED rather than refused. Presence is
      // ephemeral, lossy and forward-compatible by design: refusing a frame because
      // a newer peer added a v1.2 field would make that peer's cursor invisible for
      // the whole session (section 11.19 makes version skew routine), and the shell only
      // ever reads the fields above. The scan has already bounded whatever is in
      // there. PRESENCE_KEYS exists so the drift test can prove this list is the
      // schema's list - not to gate the frame.
      return { ok: raw as unknown as Presence, rejected };
    },

    recordAndCheckRate(kind: RateKind, count: number, nowMs: number): boolean {
      const limit = kind === 'presence' ? caps.presencePerSecond : caps.opsPerSecond;
      // `nowMs` is injected, so a caller bug can hand this a non-number. A single
      // NaN would otherwise open a window that can never close - `NaN - start >=
      // RATE_WINDOW_MS` is false and `nowMs < start` is false for EVERY later
      // value - so the counter would accumulate forever and the lane would return
      // false permanently, which the contract defines as "disconnect this peer".
      // A permanent false accusation is precisely what the backwards-clock branch
      // below exists to avoid, so an unusable timestamp is not recorded at all:
      // the batch is still bounded on its own, and the window is left intact.
      if (!Number.isFinite(nowMs)) return count <= limit;
      const w = windows.get(kind);
      // A clock that jumped BACKWARDS opens a fresh window rather than being ignored:
      // the parameter is injected precisely so this module never depends on a monotonic
      // source, and a backwards step must not lock a peer out until the clock catches up.
      if (w === undefined || nowMs - w.start >= RATE_WINDOW_MS || nowMs < w.start) {
        windows.set(kind, { start: nowMs, count });
        return count <= limit;
      }
      w.count += count;
      return w.count <= limit;
    },
  };
}
