// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA (Content Credentials) manifest builder + PDF embedder — pure, DOM-free.
 *
 * Example-grade but spec-shaped C2PA: a JUMBF (ISO 19566-5) store holding one
 * manifest (assertion store + CBOR claim + COSE_Sign1 claim signature), signed
 * with an ephemeral on-device self-signed ECDSA P-256 certificate. Emits a
 * C2PA 2.x claim (`c2pa.claim.v2`, created_assertions, claim_generator_info,
 * c2pa.actions.v2) by default — validated by c2patool / c2pa-rs; the legacy v1
 * claim is retained behind buildC2paManifest's `claimVersion` only so the
 * dual-version verifier keeps v1-read coverage.
 * Validators parse the structure but report the signer as unknown/untrusted —
 * that is the intended trust posture: no real credential ever leaves the
 * device, so what must be right is the container, not the chain.
 *
 * Hand-rolled on purpose (no npm deps; globalThis.crypto only — browsers and
 * Node 18+):
 *   - deterministic definite-length CBOR (the subset the claim needs),
 *   - JUMBF box writer (c2pa / c2ma / c2as / c2cl / c2cs box UUIDs + labels),
 *   - COSE_Sign1 ES256 with detached payload (payload == the CBOR claim
 *     bytes; the COSE array itself carries null),
 *   - minimal X.509 v3 certs (x509.js, shared with the CA issuance path).
 *     WebCrypto ECDSA emits raw r||s, which is exactly what COSE wants;
 *     X.509 wants a DER ECDSA-Sig-Value, so cert signatures are re-wrapped
 *     and the COSE one is not.
 *   - classic-xref PDF incremental update attaching the manifest as an
 *     associated embedded file (/AF + /Names→/EmbeddedFiles). The original
 *     bytes are preserved as a byte-identical prefix (asserted).
 *
 * The hard binding (c2pa.hash.data) hashes the FINAL file with the manifest's
 * own byte range OMITTED (C2PA exclusions skip ranges — they do not zero
 * them), which forces the two-pass layout in embedC2paInPdf: freeze the byte
 * layout around a placeholder manifest of the exact final length, hash, then
 * rebuild with the real digest. Only fixed-width fields (32-byte hashes,
 * 64-byte raw signature) differ between passes, so the length holds by
 * construction; the hash assertion's `pad` field absorbs any residual drift.
 *
 * ISO BMFF (mp4) is the one container with its own binding: the spec forbids
 * byte-range c2pa.hash.data there, so mp4 carries c2pa.hash.bmff.v2 — the
 * manifest rides in a top-level `uuid` box and the hash walks top-level boxes
 * (each surviving box contributes its u64-BE file offset, then its bytes;
 * /uuid, /ftyp, /free, /skip, /mfra are excluded), which is what c2patool
 * verifies. WebM/Matroska has NO standardised C2PA binding (c2patool rejects
 * the container outright), so the manifest rides as a Matroska attachment
 * (`application/c2pa`) under the ordinary data-hash binding — readable by
 * Lolly's own verifier (c2pa-verify.js), invisible to c2pa-rs by necessity.
 *
 * Like emf.js / eps.js this is a format authority: no DOM, no Handlebars, no
 * ajv — fully node:test-able. Container byte grammar for mp4/webm is imported
 * from video-meta.js (same package), which owns those two formats.
 */

import { asDate, generateSigner } from './x509.ts';
import { concatBytes, asBufferSource, sha256, bytesToHex } from './bytes.ts';
// Container-specific byte-splicing (PDF/png/jpeg/gif/svg/tiff/webp/mp4/webm) and
// the public embedC2pa/embedC2paInPdf entry points live in c2pa-containers.ts —
// this file is the manifest/claim BUILDER only (CBOR, JUMBF, COSE_Sign1,
// buildC2paManifest). ONE genuine runtime cycle, by design: buildC2paManifest
// needs the BMFF exclusion-set shape (bmffHashExclusions, which references the
// BMFF usertype UUID) from there, and c2pa-containers.ts needs buildC2paManifest/
// urnUuid/BMFF_HASH_LABEL from here. Safe — every cross-reference is inside a
// function BODY, never at module-top-level evaluation, which is the case ESM
// circular imports handle correctly (verified: the full c2pa*/x509/fuzz suite
// passes). Not a design to imitate elsewhere without the same care.
import { bmffHashExclusions } from './c2pa-containers.ts';

// The ephemeral self-signed signer (and the DER/X.509 writers behind it)
// moved to x509.js in 1.11.0; re-exported so existing importers keep working.
export { generateSigner } from './x509.ts';
// Re-exported so every existing `from './c2pa.ts'` import (index.ts, the test
// suite, scripts/sign-credentialed-assets.ts) keeps working unchanged.
export {
  embedC2pa, embedC2paInPdf, attachC2paStore, C2PA_FORMATS, C2PA_BMFF_UUID, C2PA_ATTACHMENT_MIME,
} from './c2pa-containers.ts';

// ─── shared types ─────────────────────────────────────────────────────────────

type DateInput = Date | string | number | null | undefined;

interface Dates {
  signedAt?: DateInput;
  notBefore?: DateInput;
  notAfter?: DateInput;
}

/** External or ephemeral signer: privateKey OR sign(bytes) → raw 64-byte r||s. */
export interface Signer {
  privateKey?: CryptoKey;
  certDer?: Uint8Array;
  chain?: Uint8Array[];
  sign?: (bytes: Uint8Array) => Promise<ArrayBuffer | Uint8Array> | ArrayBuffer | Uint8Array;
}

interface Author {
  name?: string;
  email?: string;
}

export interface Exclusion {
  start: number;
  length: number;
}

interface AssetHash {
  bmff?: boolean;
  exclusions?: Exclusion[];
  name?: string;
  alg?: string;
  hash: Uint8Array;
  pad?: Uint8Array;
}

// 'created' = the signer made this asset (c2pa.created + a digitalCreation
// source type) — the honest claim for a tool export. 'delivered' = the signer
// is distributing an EXISTING asset unchanged (the standard c2pa.published
// action, no source type), so the credential proves authenticity + integrity
// without overstating authorship — surfaced as "Delivered by Lolly". Default
// 'created' preserves every existing caller.
type Authorship = 'created' | 'delivered';

// One recorded step for the actions assertion. `action` is a C2PA action code
// (c2pa.created / c2pa.edited / c2pa.converted / c2pa.color_adjustments / …);
// `digitalSourceType` (IPTC) and a free-text `description` are optional. The
// uniform softwareAgent and `when` are stamped by buildC2paManifest so every
// step of one export agrees byte-for-byte. Exported so shells can assemble
// custom histories (e.g. a catalog recolour/crop download) for embedC2pa.
export interface C2paActionInput { action: string; digitalSourceType?: string; description?: string; parameters?: unknown; }

// A credentialed ingredient to preserve into a new asset's manifest store. Its
// `manifestBoxes` (the ingredient store's manifest superboxes, verbatim, active
// last) are carried into the new store ahead of the active manifest, so the
// ingredient's own signatures and full provenance chain stay intact and
// independently verifiable; the active manifest gains a c2pa.ingredient
// assertion referencing `activeLabel` and a c2pa.opened action that propagates
// `digitalSourceType` (so an AI origin is never laundered away). Produce one
// with the read side's prepareC2paIngredient(). Structurally identical to
// C2paIngredientData in c2pa-verify.ts (kept separate to avoid an import cycle).
interface C2paIngredient {
  manifestBoxes: Uint8Array[];
  activeLabel: string;
  title?: string;
  format?: string;
  relationship?: string;
  digitalSourceType?: string;
}

interface BuildC2paManifestOptions {
  title?: string;
  claimGenerator?: string;
  generatorInfo?: unknown;
  environment?: unknown;
  author?: Author | null;
  authorship?: Authorship;
  /**
   * Explicit action history for the actions assertion. When present and
   * non-empty it REPLACES the default single created/published action — each
   * entry is decorated with the shared softwareAgent + `when`. Build a sensible
   * list from an export's transformations with {@link exportActionSteps}.
   */
  actions?: C2paActionInput[];
  /** Credentialed ingredients to preserve into the store (multi-manifest). */
  ingredients?: C2paIngredient[];
  assetHash?: AssetHash;
  format?: string;
  dates?: Dates;
  signer?: Signer;
  manifestLabel?: string;
  instanceId?: string;
  /**
   * Claim format to emit. Default 2 (C2PA 2.x `c2pa.claim.v2`) — the format
   * every current validator reads and the spec's required output. `1` builds
   * the legacy `c2pa.claim` and is retained only so the dual-version verifier
   * keeps v1-read test coverage; the embedders never request it, so Lolly's
   * products only ever write v2.
   */
  claimVersion?: 1 | 2;
}

export interface EmbedOptions {
  title?: string;
  claimGenerator?: string;
  generatorInfo?: unknown;
  environment?: unknown;
  author?: Author | null;
  authorship?: Authorship;
  actions?: C2paActionInput[];
  ingredients?: C2paIngredient[];
  dates?: Dates;
  signer?: Signer;
}

export interface PlaceResult {
  out: Uint8Array;
  exclusions: Exclusion[];
}

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;

// ─── CBOR (RFC 8949 subset: definite lengths, shortest-form heads) ────────────

/** Wrapper for CBOR major type 6, e.g. new CborTag(18, coseArray). */
export class CborTag {
  tag: number;
  value: unknown;
  constructor(tag: number, value: unknown) { this.tag = tag; this.value = value; }
}

function cborHead(major: number, n: number): Uint8Array {
  const m = major << 5;
  if (n < 24) return Uint8Array.of(m | n);
  if (n < 0x100) return Uint8Array.of(m | 24, n);
  if (n < 0x10000) return Uint8Array.of(m | 25, n >>> 8, n & 0xff);
  if (n < 0x100000000) return Uint8Array.of(m | 26, n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
  const out = new Uint8Array(9);
  out[0] = m | 27;
  new DataView(out.buffer).setBigUint64(1, BigInt(n));
  return out;
}

function cborEncodeInto(value: unknown, out: Uint8Array[]): void {
  if (value === null) { out.push(Uint8Array.of(0xf6)); return; }
  if (value === true) { out.push(Uint8Array.of(0xf5)); return; }
  if (value === false) { out.push(Uint8Array.of(0xf4)); return; }
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('cbor: only safe integers are supported, got ' + value);
    out.push(value >= 0 ? cborHead(0, value) : cborHead(1, -1 - value));
    return;
  }
  if (typeof value === 'string') {
    const b = te.encode(value);
    out.push(cborHead(3, b.length), b);
    return;
  }
  if (value instanceof Uint8Array) { out.push(cborHead(2, value.length), value); return; }
  if (Array.isArray(value)) {
    out.push(cborHead(4, value.length));
    for (const v of value) cborEncodeInto(v, out);
    return;
  }
  if (value instanceof CborTag) {
    out.push(cborHead(6, value.tag));
    cborEncodeInto(value.value, out);
    return;
  }
  if (value instanceof Map) {
    out.push(cborHead(5, value.size));
    for (const [k, v] of value) { cborEncodeInto(k, out); cborEncodeInto(v, out); }
    return;
  }
  if (typeof value === 'object') {
    const keys = Object.keys(value);
    out.push(cborHead(5, keys.length));
    for (const k of keys) { cborEncodeInto(k, out); cborEncodeInto((value as Record<string, unknown>)[k], out); }
    return;
  }
  throw new Error('cbor: unsupported value type ' + typeof value);
}

/**
 * Encode a JS value as deterministic definite-length CBOR. Maps and objects
 * keep insertion order; use Map for non-string keys (COSE header labels).
 */
export function encodeCbor(value: unknown): Uint8Array {
  const out: Uint8Array[] = [];
  cborEncodeInto(value, out);
  return concatBytes(out);
}

// ─── JUMBF (ISO 19566-5 boxes, C2PA 1.x labels + UUIDs) ───────────────────────

// C2PA box-type UUIDs are 4 ASCII chars + this fixed ISO suffix; the 'cbor'
// UUID is the ISO CBOR content-type, used both for CBOR assertions' jumd and
// implied by their 'cbor' content boxes.
const JUMBF_UUID_SUFFIX = [0x00, 0x11, 0x00, 0x10, 0x80, 0x00, 0x00, 0xaa, 0x00, 0x38, 0x9b, 0x71];
const boxUuid = (fourcc: string): Uint8Array =>
  Uint8Array.of(fourcc.charCodeAt(0), fourcc.charCodeAt(1), fourcc.charCodeAt(2), fourcc.charCodeAt(3), ...JUMBF_UUID_SUFFIX);

const UUID_C2PA_STORE = boxUuid('c2pa');      // store superbox, label 'c2pa'
const UUID_MANIFEST = boxUuid('c2ma');        // manifest superbox, label 'urn:uuid:…'
const UUID_ASSERTION_STORE = boxUuid('c2as'); // label 'c2pa.assertions'
const UUID_CLAIM = boxUuid('c2cl');           // label 'c2pa.claim'
const UUID_SIGNATURE = boxUuid('c2cs');       // label 'c2pa.signature'
const UUID_CBOR_CONTENT = boxUuid('cbor');    // CBOR assertions
const UUID_JSON_CONTENT = boxUuid('json');    // JSON assertions (schema.org)

// [u32 length | 4-char type | payload]; length covers the 8-byte header.
function isoBox(type: string, ...payloads: Uint8Array[]): Uint8Array {
  const body = concatBytes(payloads);
  const out = new Uint8Array(8 + body.length);
  new DataView(out.buffer).setUint32(0, out.length);
  out[4] = type.charCodeAt(0);
  out[5] = type.charCodeAt(1);
  out[6] = type.charCodeAt(2);
  out[7] = type.charCodeAt(3);
  out.set(body, 8);
  return out;
}

// Superbox = jumb[ jumd(UUID + toggles + NUL-terminated label), children… ].
// Toggles 0x03 = requestable | label present.
function jumbfSuperbox(uuid: Uint8Array, label: string, ...children: Uint8Array[]): Uint8Array {
  const jumd = isoBox('jumd', uuid, Uint8Array.of(0x03), te.encode(label), Uint8Array.of(0));
  return isoBox('jumb', jumd, ...children);
}

// ─── COSE_Sign1 (RFC 9052 / 9360) ─────────────────────────────────────────────

const COSE_HEADER_ALG = 1;      // ES256 = -7
const COSE_HEADER_X5CHAIN = 33; // array of DER certs, leaf first

// Detached payload: the COSE_Sign1 array carries null; the Signature1
// Sig_structure carries the claim bytes. Signature stays raw r||s per COSE.
// x5chain carries `signer.chain` (DER certs, leaf first) when present —
// certDer is the single-cert back-compat shape — and an external signer
// supplies sign() instead of a CryptoKey. ES256 is hardcoded, so anything
// other than a 64-byte raw signature would silently corrupt the two-pass
// byte layout downstream: fail loud instead.
async function coseSign1Detached(signer: Signer, payload: Uint8Array): Promise<Uint8Array> {
  const protectedBytes = encodeCbor(new Map<number, unknown>([
    [COSE_HEADER_ALG, -7],
    [COSE_HEADER_X5CHAIN, signer.chain ?? [signer.certDer]],
  ]));
  const sigStructure = encodeCbor(['Signature1', protectedBytes, new Uint8Array(0), payload]);
  const raw = signer.sign
    ? new Uint8Array(await signer.sign(sigStructure))
    : new Uint8Array(await subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signer.privateKey!, asBufferSource(sigStructure)));
  if (raw.length !== 64) throw new Error(`c2pa: signer returned a ${raw.length}-byte signature; ES256 needs raw 64-byte r||s`);
  return encodeCbor(new CborTag(18, [protectedBytes, new Map(), null, raw])); // COSE_Sign1_Tagged
}

// ─── manifest ─────────────────────────────────────────────────────────────────

export function urnUuid(): string {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = bytesToHex(b);
  return `urn:uuid:${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// xsd:dateTime at fixed (second) precision so manifest length is date-stable.
const isoSeconds = (d: Date): string => d.toISOString().slice(0, 19) + 'Z';

// IPTC digital source type for works created by software (shown by validators
// as the provenance kind of the c2pa.created action). Exported alongside
// C2paActionInput so a shell-authored history can open with the same honest
// created step the engine's own exportActionSteps emits.
export const DIGITAL_SOURCE_TYPE = 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCreation';

// IPTC DigitalSourceType for content whose essence was captured from a real-world
// source by a digital device — a live camera frame or a mic/AV recording. The
// created step carries this (instead of digitalCreation) when the render's origin
// was a sensor, so the credential declares the capture honestly. Readers already
// surface it as "Captured by a camera" (engine c2pa-verify + web Verify view).
export const CAPTURE_SOURCE_TYPE = 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture';

// IPTC DigitalSourceType for a screenshot / screen recording — "a capture of the
// contents of the screen of a computer or mobile device". DISTINCT from
// digitalCapture on purpose: that term means a sensor recorded the real world, which
// a screen capture never did, so reusing it would over-claim the file's origin (the
// one thing a credential must never do). Nothing here infers this — only a caller
// that KNOWS it captured a display sets the flag.
export const SCREEN_SOURCE_TYPE = 'http://cv.iptc.org/newscodes/digitalsourcetype/screenCapture';

// Output formats that are a genuine re-encode/render of the authored design
// (so a c2pa.converted step is honest) vs vector-native / text serialisations
// that ARE the created asset and warrant no conversion step.
const RASTER_OUTPUTS = new Set(['png', 'apng', 'jpg', 'jpeg', 'webp', 'webp-anim', 'tiff', 'cmyk-tiff', 'gif', 'ico']);
const VIDEO_OUTPUTS = new Set(['mp4', 'm4v', 'mov', 'webm']);

// dc:format MIME for a preserved ingredient's c2pa.ingredient assertion.
const INGREDIENT_MIME: Record<string, string> = {
  png: 'image/png', apng: 'image/apng', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif',
  svg: 'image/svg+xml', tiff: 'image/tiff', webp: 'image/webp', pdf: 'application/pdf',
  mp4: 'video/mp4', webm: 'video/webm', mkv: 'video/x-matroska',
};

// Joins a list of human-readable fragments as "a, b and c" (Oxford-comma-free,
// matching British house style elsewhere in this file's descriptions).
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Assemble an honest action history for a Lolly export from what the pipeline
 * actually did. Opens with `c2pa.created` (digitalCreation) — or a single
 * `c2pa.published` when `delivered` — then appends ONE step per transformation
 * that genuinely happened, each its own entry so the credential's history is as
 * granular as the pipeline itself: a CMYK conversion (`cmyk`), a brand-palette
 * colour snap (`paletteColors`, named by count), whichever print marks/bleed
 * were added — named individually, not lumped together (`marks`) — the
 * experimental-tool overlay watermark (`watermarked`), the durable in-pixel
 * Lolly watermark (`imprint`), an added audio track (`audio`), and a closing
 * render/encode for raster, video and PDF outputs. Vector-native (svg/emf/dxf/
 * eps) and text outputs add nothing beyond the close — the created asset
 * already IS that file. Pass the result as `actions` to {@link embedC2pa} /
 * {@link buildC2paManifest}.
 *
 * Two `flags` make the origin honest rather than assumed: `capture` (a live
 * camera frame or a mic/AV recording produced the essence) swaps the created
 * step's source type to `digitalCapture` with a "captured/recorded live"
 * description; `textAdded` (rendered text placed OVER an opened asset — the
 * caller gates this on an ingredient being present) appends a `c2pa.edited`
 * "Added text" step. From-scratch text is content, not an edit — it belongs in
 * the input digest, so callers must NOT set `textAdded` without an ingredient.
 */
export function exportActionSteps(format: string, flags: {
  delivered?: boolean;
  cmyk?: boolean;
  /** Count of distinct brand-palette colours the export was snapped to. */
  paletteColors?: number;
  /** Print marks/bleed applied, named individually (e.g. ['3mm bleed', 'crop marks']). */
  marks?: string[];
  watermarked?: boolean;
  imprint?: boolean;
  audio?: boolean;
  /** The render's essence was captured from a device sensor — created → digitalCapture.
   *  `screen` instead means a display was captured (a screenshot / screen recording) →
   *  created → screenCapture, which is a different IPTC term and a different claim. */
  capture?: { camera?: boolean; microphone?: boolean; screen?: boolean };
  /** Text was placed over an opened asset (gate on ingredients) — appends "Added text". */
  textAdded?: boolean;
  /** Short teaser of that text for the step label (full copy rides in the input digest). */
  textSample?: string;
} = {}): C2paActionInput[] {
  if (flags.delivered) return [{ action: 'c2pa.published' }];
  const f = String(format || '').toLowerCase();
  // Origin: a captured essence (camera/mic) declares digitalCapture with an honest
  // description; otherwise the software-authored default (digitalCreation).
  const cap = flags.capture;
  // A display capture is its OWN source type, not a sensor capture — check it first so a
  // narrated screen recording (screen + microphone) never reads as a mic recording of the
  // real world. The screen is what the essence IS; the mic is a track laid over it.
  const screened = !!cap?.screen;
  const captured = !!(cap && (cap.camera || cap.microphone));
  const created: C2paActionInput = screened
    ? { action: 'c2pa.created', digitalSourceType: SCREEN_SOURCE_TYPE, description: captureDescription(cap!) }
    : captured
      ? { action: 'c2pa.created', digitalSourceType: CAPTURE_SOURCE_TYPE, description: captureDescription(cap!) }
      : { action: 'c2pa.created', digitalSourceType: DIGITAL_SOURCE_TYPE };
  const steps: C2paActionInput[] = [created];
  if (flags.cmyk) steps.push({ action: 'c2pa.color_adjustments', description: 'Converted colours to CMYK for print' });
  if (flags.paletteColors) steps.push({ action: 'c2pa.color_adjustments', description: `Snapped colours to the brand palette (${flags.paletteColors} colour${flags.paletteColors === 1 ? '' : 's'})` });
  if (flags.marks?.length) steps.push({ action: 'c2pa.edited', description: `Added ${joinList(flags.marks)}` });
  if (flags.watermarked) steps.push({ action: 'c2pa.edited', description: 'Added experimental-tool watermark' });
  if (flags.imprint) steps.push({ action: 'c2pa.edited', description: 'Embedded a durable Lolly pixel watermark' });
  if (flags.audio) steps.push({ action: 'c2pa.edited', description: 'Added an audio track' });
  // Text over an opened asset is a genuine edit (the caller has already gated this
  // on an ingredient); its short teaser labels the step, the full copy is digested.
  if (flags.textAdded) steps.push({ action: 'c2pa.edited', description: flags.textSample ? `Added text — “${flags.textSample}”` : 'Added text' });
  if (RASTER_OUTPUTS.has(f)) steps.push({ action: 'c2pa.converted', description: `Rendered to ${f.toUpperCase()}` });
  else if (VIDEO_OUTPUTS.has(f)) steps.push({ action: 'c2pa.converted', description: `Encoded to ${f.toUpperCase()}` });
  else if (f === 'pdf' || f === 'pdf-cmyk') steps.push({ action: 'c2pa.converted', description: 'Rendered to PDF' });
  return steps;
}

// The created step's description for a captured essence — camera, mic, or both.
function captureDescription(cap: { camera?: boolean; microphone?: boolean; screen?: boolean }): string {
  // Screen first, and it never claims the camera: a display capture's essence came from
  // the screen. The mic is worth naming because it recorded the room, which the rest of
  // the file did not.
  if (cap.screen) return cap.microphone ? 'Captured from the screen with microphone narration' : 'Captured from the screen';
  if (cap.camera && cap.microphone) return 'Recorded live from the camera and microphone';
  if (cap.camera) return 'Captured live from the camera';
  return 'Recorded live from the microphone';
}

// Custom assertion label for Lolly's export context (reverse-domain of
// lolly.tools). c2pa-rs surfaces unknown CBOR assertions verbatim in reports
// and validates them only by hashed URI — no allowlist, no penalty.
export const LOLLY_EXPORT_ASSERTION = 'tools.lolly.export';

// The BMFF (mp4) hard-binding assertion label — used here (buildC2paManifest
// picks it over the byte-range c2pa.hash.data for bmff assets) and by
// c2pa-containers.ts's BMFF placer/digest, which imports it back from here.
export const BMFF_HASH_LABEL = 'c2pa.hash.bmff.v2';

// Authorship rides in the classic schema.org CreativeWork assertion (a JSON
// assertion, unlike the CBOR ones). The current spec deprecates it in favour
// of CAWG identity assertions — which require a real identity credential this
// on-device signer deliberately doesn't have — but every validator today
// (c2patool, Verify) still parses and DISPLAYS it as the work's author.
export const CREATIVE_WORK_ASSERTION = 'stds.schema-org.CreativeWork';
// How a human author is recorded in v2. NOT the strict `c2pa.metadata`
// assertion: C2PA 2.x locked that to a technical field whitelist (exif/tiff/
// crs/pdf/dc-technical…) that EXCLUDES dc:creator — c2patool rejects a creator
// there with `assertion.metadata.disallowed` and marks the whole file Invalid.
// The spec-clean vehicle for creator metadata is the CAWG metadata assertion
// (`cawg.metadata`): same JSON-LD metadata structure, not field-restricted,
// purpose-built for dc:creator — validated Valid by c2patool, and distinct from
// the `cawg.identity` assertion (which needs a real identity credential this
// on-device signer lacks). schema.org/Exif/IPTC standalone assertions were
// removed in 2.x, so this replaces the v1 CreativeWork path.
export const METADATA_ASSERTION = 'cawg.metadata';
const DC_CONTEXT = { dc: 'http://purl.org/dc/elements/1.1/' };

/**
 * Build a complete C2PA JUMBF store (→ Uint8Array). Emits a C2PA 2.x claim
 * (`c2pa.claim.v2`) by default; `claimVersion: 1` builds the legacy
 * `c2pa.claim` and exists only so the dual-version verifier keeps v1-read test
 * coverage — the embedders never pass it, so Lolly's products only write v2.
 *
 * Assertions: the actions assertion (c2pa.actions.v2 on v2, c2pa.actions on v1)
 * with one c2pa.created action (softwareAgent = the generator-info map on v2 /
 * the generator string on v1, digitalSourceType = digitalCreation, when =
 * dates.signedAt), the c2pa.hash.data hard binding carrying assetHash verbatim:
 *   assetHash = { exclusions: [{start, length}], name?, alg?, hash: Uint8Array, pad?: Uint8Array }
 * — or, with assetHash = { bmff: true, hash, pad? }, the ISO-BMFF binding
 * c2pa.hash.bmff.v2 with the fixed top-level box exclusions instead —
 * and — when `environment` is given — a `tools.lolly.export` CBOR assertion
 * recording the export context (tool, format, surface, browser engine, OS…).
 * `generatorInfo` ({ name, version, operating_system? }) becomes the claim's
 * claim_generator_info (a single REQUIRED map in v2; an optional array
 * alongside the free-text claim_generator string in v1). The v2 claim drops
 * dc:format and the schema.org CreativeWork author assertion per the 2.x spec.
 *
 * The claim references each assertion by hashed URI — a JUMBF URI relative to
 * the manifest plus sha256 over the assertion superbox's payload (jumd +
 * content boxes, excluding the outer 8-byte box header).
 *
 * `signer` / `manifestLabel` / `instanceId` are optional and exist so the
 * embedders (and tests) can hold them constant across the two-pass layout;
 * fresh ones are generated when absent. A signer may be external (e.g. a
 * CA-issued device credential): { privateKey | sign(bytes) → raw 64-byte
 * r||s, certDer, chain? } — chain (leaf first) wins over certDer in the
 * COSE x5chain. P-256/ES256 only.
 */
export async function buildC2paManifest({
  title,
  claimGenerator,
  generatorInfo,
  environment,
  author,
  authorship = 'created',
  actions: actionSteps,
  ingredients,
  assetHash,
  format = 'application/pdf',
  dates = {},
  signer,
  manifestLabel,
  instanceId,
  claimVersion = 2,
}: BuildC2paManifestOptions = {}): Promise<Uint8Array> {
  const bmff = !!assetHash?.bmff;
  if (!assetHash || !(assetHash.hash instanceof Uint8Array) || (!bmff && !Array.isArray(assetHash.exclusions))) {
    throw new Error('c2pa: assetHash requires { exclusions: [{start, length}], hash: Uint8Array } (or { bmff: true, hash })');
  }
  const v2 = claimVersion !== 1;
  const signedAt = asDate(dates.signedAt, Date.now());
  const sig = signer || (await generateSigner(dates));

  // Generator identity. v1 carries a free-text `claim_generator` string plus an
  // optional claim_generator_info array; v2 drops the string and makes a single
  // claim_generator_info map the sole identity, reused as each action's
  // softwareAgent. Build it once so the claim and the actions agree byte-exactly.
  const generatorName = String(claimGenerator || 'Lolly');
  const genInfoMap: Record<string, unknown> =
    generatorInfo && typeof generatorInfo === 'object' && Object.keys(generatorInfo as object).length
      ? { name: generatorName, ...(generatorInfo as Record<string, unknown>) }
      : { name: generatorName };

  // A creation claim carries the digitalCreation source type; a delivery claim
  // (distributing an existing asset, the standard c2pa.published action)
  // deliberately omits it, so the credential never asserts the signer authored
  // the work. Key insertion order is preserved on the created path — its bytes
  // are unchanged. In v2 the action's softwareAgent is a generator-info map (an
  // object); in v1 it stays the bare generator string.
  const softwareAgent: unknown = v2 ? genInfoMap : generatorName;
  const delivered = authorship === 'delivered';
  // An explicit step list (from exportActionSteps) wins; otherwise the historic
  // single created/published action. Every step is decorated with the same
  // softwareAgent + `when` so one export's history agrees byte-for-byte; the
  // created path keeps its exact key order (action, digitalSourceType, …) so
  // pre-existing single-action manifests hash identically.
  const baseSteps: C2paActionInput[] = (actionSteps && actionSteps.length)
    ? actionSteps
    : [delivered
      ? { action: 'c2pa.published' }
      : { action: 'c2pa.created', digitalSourceType: DIGITAL_SOURCE_TYPE }];
  // Each preserved ingredient is opened FIRST — and the opened step carries the
  // ingredient's AI/ML source type, so the new asset's OWN active manifest
  // declares the AI origin (not only the walked-in ingredient chain). This is
  // the anti-laundering guarantee: strip the ingredient manifests and the flag
  // still fires from Lolly's signed actions.
  const ingList = ingredients ?? [];
  // Build each preserved ingredient's c2pa.ingredient.v3 assertion FIRST: the
  // c2pa.opened action below must reference it via parameters.ingredients (the
  // spec requires opened/placed/removed actions to name their ingredients), and
  // the same hash feeds the claim's assertion list. Each assertion carries the
  // V3-required validationResults — the integrity checks the ingredient's own
  // manifest passed at ingest (signature + hashes; carried verbatim so they
  // still hold; trust is reported separately by the reader).
  const ingredientBoxes: Uint8Array[] = [];
  const ingredientRefs: { url: string; hash: Uint8Array }[] = [];
  const ingredientParamRefs: { url: string; alg: string; hash: Uint8Array }[] = [];
  for (let i = 0; i < ingList.length; i++) {
    const ing = ingList[i]!;
    const activeBox = ing.manifestBoxes[ing.manifestBoxes.length - 1]!;
    // Distinct labels when several ingredients are preserved (spec allows the
    // __N disambiguation suffix on repeated assertion labels).
    const label = ingList.length > 1 ? `c2pa.ingredient.v3__${i + 1}` : 'c2pa.ingredient.v3';
    const ingAssertion = {
      'dc:title': ing.title || 'Ingredient',
      ...(ing.format && INGREDIENT_MIME[ing.format] ? { 'dc:format': INGREDIENT_MIME[ing.format] } : {}),
      relationship: ing.relationship || 'parentOf',
      // activeManifest hashed URI covers the referenced manifest superbox payload
      // (jumd + content, minus the 8-byte header) — Lolly's hashed-URI convention.
      activeManifest: { url: `self#jumbf=/c2pa/${ing.activeLabel}`, alg: 'sha256', hash: await sha256(activeBox.subarray(8)) },
      validationResults: {
        activeManifest: {
          success: [{ code: 'claimSignature.validated', url: `self#jumbf=/c2pa/${ing.activeLabel}/c2pa.signature` }],
          informational: [],
          failure: [],
        },
      },
    };
    const box = jumbfSuperbox(UUID_CBOR_CONTENT, label, isoBox('cbor', encodeCbor(ingAssertion)));
    const hash = await sha256(box.subarray(8));
    ingredientBoxes.push(box);
    ingredientRefs.push({ url: `self#jumbf=c2pa.assertions/${label}`, hash });
    ingredientParamRefs.push({ url: `self#jumbf=c2pa.assertions/${label}`, alg: 'sha256', hash });
  }
  // Each ingredient is opened FIRST — the opened step references its ingredient
  // assertion AND carries the ingredient's AI/ML source type, so the new asset's
  // OWN active manifest declares the AI origin (not only the walked-in chain):
  // strip the ingredient manifests and the flag still fires from Lolly's actions.
  const openedSteps: C2paActionInput[] = ingList.map((ing, i) => ({
    action: 'c2pa.opened',
    ...(ing.digitalSourceType ? { digitalSourceType: ing.digitalSourceType } : {}),
    ...(ing.title ? { description: `Opened ${ing.title}` } : {}),
    parameters: { ingredients: [ingredientParamRefs[i]!] },
  }));
  const stepList = [...openedSteps, ...baseSteps];
  const actions = {
    actions: stepList.map((s) => ({
      action: s.action,
      ...(s.digitalSourceType ? { digitalSourceType: s.digitalSourceType } : {}),
      ...(s.description ? { description: s.description } : {}),
      ...(s.parameters ? { parameters: s.parameters } : {}),
      softwareAgent,
      when: isoSeconds(signedAt),
    })),
  };
  // BMFF assets carry the spec's box-walking binding (c2pa.hash.bmff.v2, fixed
  // xpath exclusions) instead of byte ranges — c2pa-rs rejects a data-hash
  // binding on mp4. Both payloads keep `pad` last so the two-pass embedders
  // can absorb length drift.
  const hashLabel = bmff ? BMFF_HASH_LABEL : 'c2pa.hash.data';
  const hashData = bmff ? {
    exclusions: bmffHashExclusions(),
    name: assetHash.name || 'jumbf manifest',
    alg: assetHash.alg || 'sha256',
    hash: assetHash.hash,
    pad: assetHash.pad || new Uint8Array(0),
  } : {
    exclusions: assetHash.exclusions!.map((e) => ({ start: e.start, length: e.length })),
    name: assetHash.name || 'jumbf manifest',
    alg: assetHash.alg || 'sha256',
    hash: assetHash.hash,
    pad: assetHash.pad || new Uint8Array(0),
  };
  // v2 renames the actions assertion to c2pa.actions.v2; the data-hash / BMFF
  // binding labels are version-independent and stay the same.
  const actionsLabel = v2 ? 'c2pa.actions.v2' : 'c2pa.actions';
  const actionsBox = jumbfSuperbox(UUID_CBOR_CONTENT, actionsLabel, isoBox('cbor', encodeCbor(actions)));
  const hashBox = jumbfSuperbox(UUID_CBOR_CONTENT, hashLabel, isoBox('cbor', encodeCbor(hashData)));
  const storeBoxes = [actionsBox, hashBox];
  let exportBox: Uint8Array | null = null;
  if (environment && typeof environment === 'object' && Object.keys(environment).length) {
    // Stable key order (object insertion order) keeps the two-pass length fixed.
    exportBox = jumbfSuperbox(UUID_CBOR_CONTENT, LOLLY_EXPORT_ASSERTION, isoBox('cbor', encodeCbor(environment)));
    storeBoxes.push(exportBox);
  }
  // Authorship rode in a schema.org CreativeWork assertion on v1. C2PA 2.x
  // removed the schema.org/Exif/IPTC assertions (a conformant v2 generator must
  // not write them), and the CAWG identity assertion that replaces them needs a
  // real identity credential the ephemeral on-device signer lacks — so a v2
  // credential attributes the software via claim_generator_info, never a human.
  let authorBox: Uint8Array | null = null;
  if (!v2 && author?.name) {
    // Profile authorship (opt-in upstream): a schema.org Person on the
    // CreativeWork. JSON assertion — jumd UUID 'json', content box 'json'.
    const person: { '@type': string; name: string; email?: string } = { '@type': 'Person', name: String(author.name) };
    if (author.email) person.email = String(author.email);
    const work = { '@context': 'http://schema.org/', '@type': 'CreativeWork', author: [person] };
    authorBox = jumbfSuperbox(UUID_JSON_CONTENT, CREATIVE_WORK_ASSERTION, isoBox('json', te.encode(JSON.stringify(work))));
    storeBoxes.push(authorBox);
  }
  // v2: the human author rides in the spec-clean c2pa.metadata assertion
  // (JSON-LD, Dublin Core dc:creator) instead of the removed schema.org one.
  let metadataBox: Uint8Array | null = null;
  if (v2 && author?.name) {
    const meta = { '@context': DC_CONTEXT, 'dc:creator': [String(author.name)] };
    metadataBox = jumbfSuperbox(UUID_JSON_CONTENT, METADATA_ASSERTION, isoBox('json', te.encode(JSON.stringify(meta))));
    storeBoxes.push(metadataBox);
  }
  // The ingredient assertions were built up-front (their hashes feed the opened
  // action's parameters.ingredients); add them to the assertion store here so
  // they sit after the standard assertions.
  for (const box of ingredientBoxes) storeBoxes.push(box);
  const assertionStore = jumbfSuperbox(UUID_ASSERTION_STORE, 'c2pa.assertions', ...storeBoxes);

  // JUMBF-box hashed URIs cover the superbox PAYLOAD — the jumd description box
  // and content boxes, NOT the outer 8-byte LBox+TBox header (matches c2pa-rs,
  // which recreates the box and hashes write_box_payload). Same reference shape
  // in both versions; v2 only relabels the actions assertion.
  const assertionRefs = [
    { url: `self#jumbf=c2pa.assertions/${actionsLabel}`, hash: await sha256(actionsBox.subarray(8)) },
    { url: `self#jumbf=c2pa.assertions/${hashLabel}`, hash: await sha256(hashBox.subarray(8)) },
    ...(exportBox ? [{ url: `self#jumbf=c2pa.assertions/${LOLLY_EXPORT_ASSERTION}`, hash: await sha256(exportBox.subarray(8)) }] : []),
    ...(authorBox ? [{ url: `self#jumbf=c2pa.assertions/${CREATIVE_WORK_ASSERTION}`, hash: await sha256(authorBox.subarray(8)) }] : []),
    ...(metadataBox ? [{ url: `self#jumbf=c2pa.assertions/${METADATA_ASSERTION}`, hash: await sha256(metadataBox.subarray(8)) }] : []),
    ...ingredientRefs,
  ];

  // v2 claim map (c2pa.claim.v2): no free-text claim_generator, no dc:format; a
  // REQUIRED single claim_generator_info map; assertion references split into
  // created_assertions (authored here) and optional gathered_assertions (none,
  // so omitted). v1 claim map (c2pa.claim): the historical single `assertions`
  // array plus the claim_generator string. dc:title keeps its spelling in both.
  const claim = v2 ? {
    ...(title ? { 'dc:title': String(title) } : {}),
    instanceID: instanceId || urnUuid(),
    claim_generator_info: genInfoMap,
    created_assertions: assertionRefs,
    signature: 'self#jumbf=c2pa.signature',
    alg: 'sha256',
  } : {
    'dc:title': String(title || 'Untitled'),
    'dc:format': format,
    instanceID: instanceId || urnUuid(),
    claim_generator: generatorName,
    ...(generatorInfo ? { claim_generator_info: [generatorInfo] } : {}),
    signature: 'self#jumbf=c2pa.signature',
    assertions: assertionRefs,
    alg: 'sha256',
  };
  const claimBytes = encodeCbor(claim);
  const claimBox = jumbfSuperbox(UUID_CLAIM, v2 ? 'c2pa.claim.v2' : 'c2pa.claim', isoBox('cbor', claimBytes));
  const signatureBox = jumbfSuperbox(UUID_SIGNATURE, 'c2pa.signature', isoBox('cbor', await coseSign1Detached(sig, claimBytes)));
  const manifest = jumbfSuperbox(UUID_MANIFEST, manifestLabel || urnUuid(), assertionStore, claimBox, signatureBox);
  // Ingredient manifests are carried in verbatim BEFORE the active (Lolly)
  // manifest — the store's LAST manifest is the active one (C2PA §"active
  // manifest"), and the read side (parseC2paStore / collectActionChain) walks
  // every manifest, so a preserved ingredient's full provenance chain surfaces.
  const ingredientManifestBoxes = ingList.flatMap((ing) => ing.manifestBoxes);
  return jumbfSuperbox(UUID_C2PA_STORE, 'c2pa', ...ingredientManifestBoxes, manifest);
}

