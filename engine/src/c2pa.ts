// SPDX-License-Identifier: MPL-2.0
/**
 * C2PA (Content Credentials) manifest builder + PDF embedder - pure, DOM-free.
 *
 * Example-grade but spec-shaped C2PA: a JUMBF (ISO 19566-5) store holding one
 * manifest (assertion store + CBOR claim + COSE_Sign1 claim signature), signed
 * with an ephemeral on-device self-signed ECDSA P-256 certificate. Emits a
 * C2PA 2.x claim (`c2pa.claim.v2`, created_assertions, claim_generator_info,
 * c2pa.actions.v2) by default - validated by c2patool / c2pa-rs; the legacy v1
 * claim is retained behind buildC2paManifest's `claimVersion` only so the
 * dual-version verifier keeps v1-read coverage.
 * Validators parse the structure but report the signer as unknown/untrusted -
 * that is the intended trust posture: no real credential ever leaves the
 * device, so what must be right is the container, not the chain.
 *
 * Hand-rolled on purpose (no npm deps; globalThis.crypto only - browsers and
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
 * own byte range OMITTED (C2PA exclusions skip ranges - they do not zero
 * them), which forces the two-pass layout in embedC2paInPdf: freeze the byte
 * layout around a placeholder manifest of the exact final length, hash, then
 * rebuild with the real digest. Only fixed-width fields (32-byte hashes,
 * 64-byte raw signature) differ between passes, so the length holds by
 * construction; the hash assertion's `pad` field absorbs any residual drift.
 *
 * Not every asset can carry its store: section 11.4 allows the manifest to live BESIDE
 * the asset instead (a `.c2pa` sidecar served as application/c2pa), and section A.7.1.2
 * gives HTML documents a `<link rel="c2pa-manifest">` to point at one.
 * buildExternalC2paStore is that path - a whole-asset hash with no exclusion
 * range, so it needs neither container surgery nor the two-pass layout below.
 *
 * ISO BMFF (mp4) is the one container with its own binding: the spec forbids
 * byte-range c2pa.hash.data there, so mp4 carries c2pa.hash.bmff.v2 - the
 * manifest rides in a top-level `uuid` box and the hash walks top-level boxes
 * (each surviving box contributes its u64-BE file offset, then its bytes;
 * /uuid, /ftyp, /free, /skip, /mfra are excluded), which is what c2patool
 * verifies. WebM/Matroska has NO standardised C2PA binding (c2patool rejects
 * the container outright), so the manifest rides as a Matroska attachment
 * (`application/c2pa`) under the ordinary data-hash binding - readable by
 * Lolly's own verifier (c2pa-verify.js), invisible to c2pa-rs by necessity.
 *
 * Like emf.js / eps.js this is a format authority: no DOM, no Handlebars, no
 * ajv - fully node:test-able. Container byte grammar for mp4/webm is imported
 * from video-meta.js (same package), which owns those two formats.
 */

import { asDate, generateSigner } from './x509.ts';
import { concatBytes, asBufferSource, sha256, bytesToHex } from './bytes.ts';
// Container-specific byte-splicing (PDF/png/jpeg/gif/svg/tiff/webp/mp4/webm) and
// the public embedC2pa/embedC2paInPdf entry points live in c2pa-containers.ts -
// this file is the manifest/claim BUILDER only (CBOR, JUMBF, COSE_Sign1,
// buildC2paManifest). ONE genuine runtime cycle, by design: buildC2paManifest
// needs the BMFF exclusion-set shape (bmffHashExclusions, which references the
// BMFF usertype UUID) from there, and c2pa-containers.ts needs buildC2paManifest/
// urnUuid/BMFF_HASH_LABEL from here. Safe - every cross-reference is inside a
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
  /** Licensing-contact site (the claim form's "Email or site" when it isn't an email). */
  url?: string;
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
// source type) - the honest claim for a tool export. 'delivered' = the signer
// is distributing an EXISTING asset unchanged (the standard c2pa.published
// action, no source type), so the credential proves authenticity + integrity
// without overstating authorship - surfaced as "Delivered by Lolly". Default
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
  /** User-asserted copyright + licence, emitted as `dc:rights` in the v2
   *  cawg.metadata assertion (from buildExportMeta / an input's bindToMeta). */
  rights?: string;
  /**
   * Explicit action history for the actions assertion. When present and
   * non-empty it REPLACES the default single created/published action - each
   * entry is decorated with the shared softwareAgent + `when`. Build a sensible
   * list from an export's transformations with {@link exportActionSteps}.
   */
  actions?: C2paActionInput[];
  /** Credentialed ingredients to preserve into the store (multi-manifest). */
  ingredients?: C2paIngredient[];
  /**
   * section 18.28 machine-readable AI transparency, emitted as a `c2pa.ai-disclosure`
   * CBOR assertion and referenced from `created_assertions` (section 2776 - created
   * assertions are the ones attributed to the signer, which is exactly what a
   * disclosure is). Absent → no assertion and byte-identical output, so nothing
   * that never asks for it changes.
   */
  aiDisclosure?: C2paAiDisclosureInput;
  /**
   * The C2PA specification version this manifest declares it was produced to
   * (SemVer). C2PA 2.4 moved the field OUT of the claim and INTO
   * `claim_generator_info`, which is where this writes it; the claim-level field
   * is deprecated and never written. v2 claims only.
   *
   * Not stamped on each action's `softwareAgent` (also a generator-info map):
   * section 10.2.3.1 scopes the declaration to the MANIFEST, and repeating it per step
   * would inflate every action for no added fact. {@link C2PA_SPEC_VERSION}
   * carries the value this module was written against.
   */
  specVersion?: string;
  assetHash?: AssetHash;
  format?: string;
  dates?: Dates;
  signer?: Signer;
  manifestLabel?: string;
  instanceId?: string;
  /**
   * Claim format to emit. Default 2 (C2PA 2.x `c2pa.claim.v2`) - the format
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
  /** User-asserted copyright + licence → `dc:rights` in the manifest. */
  rights?: string;
  actions?: C2paActionInput[];
  ingredients?: C2paIngredient[];
  /**
   * section 18.28 AI transparency, forwarded verbatim to {@link buildC2paManifest} by
   * both embedders. An EMBEDDED store is the only place a component that ships
   * as its own file (a signed docs masthead, an inline logo) can disclose the
   * model that made it, so the option has to survive the container path, not
   * just the external-store one. Absent → byte-identical output.
   */
  aiDisclosure?: C2paAiDisclosureInput;
  /** `claim_generator_info.specVersion` (SemVer) - see {@link C2PA_SPEC_VERSION}. */
  specVersion?: string;
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
    if (!Number.isSafeInteger(value)) {
      // Non-integer (or unsafe-range) numbers encode as an IEEE 754 float64
      // (major 7, additional 27). Without this, any fractional manifest value
      // - the TTS speed 0.8/1.2 was the live case - threw here, and BOTH
      // credential paths (in-file embed and record-side fallback) silently
      // saved synthetic audio with no Content Credential at all: an EU AI Act
      // Article 50 disclosure gap. NaN/Infinity stay refused: nothing in a
      // manifest legitimately carries them, and a quiet 0xf97e00 would only
      // mask an upstream bug.
      if (!Number.isFinite(value)) throw new Error('cbor: non-finite numbers are not supported, got ' + value);
      const f = new Uint8Array(9);
      f[0] = 0xfb;
      new DataView(f.buffer).setFloat64(1, value);
      out.push(f);
      return;
    }
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
// x5chain carries `signer.chain` (DER certs, leaf first) when present -
// certDer is the single-cert back-compat shape - and an external signer
// supplies sign() instead of a CryptoKey. ES256 is hardcoded, so anything
// other than a 64-byte raw signature would silently corrupt the two-pass
// byte layout downstream: throw an error instead.
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
// source by a digital device - a live camera frame or a mic/AV recording. The
// created step carries this (instead of digitalCreation) when the render's origin
// was a sensor, so the credential declares the capture honestly. Readers already
// surface it as "Captured by a camera" (engine c2pa-verify + web Verify view).
export const CAPTURE_SOURCE_TYPE = 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCapture';

// IPTC DigitalSourceType for a screenshot / screen recording - "a capture of the
// contents of the screen of a computer or mobile device". DISTINCT from
// digitalCapture on purpose: that term means a sensor recorded the real world, which
// a screen capture never did, so reusing it would over-claim the file's origin (the
// one thing a credential must never do). Nothing here infers this - only a caller
// that KNOWS it captured a display sets the flag.
export const SCREEN_SOURCE_TYPE = 'http://cv.iptc.org/newscodes/digitalsourcetype/screenCapture';

// IPTC DigitalSourceType for media produced wholly by a trained model - the
// "artificially generated" mark EU AI Act Article 50 asks for, machine-readable.
// The created step carries this when the essence came out of a generative model
// (e.g. an on-device TTS clip: the voice is not a real person). The read side
// already maps the slug to 'generated' (c2pa-extract aiKind), so an ingredient
// chain built on this constant surfaces the AI flag without further wiring.
export const GENERATED_SOURCE_TYPE = 'http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia';

// IPTC DigitalSourceType for a COMPOSITE of trained-algorithmic media with other
// media - the honest mark for a real photograph enlarged by an AI upscaler: real
// pixels, model-inferred detail, never claimed as wholly generated. The created
// step carries this (instead of digitalCreation) when the render's essence is an
// on-device AI-upscaled asset. The read side already maps the slug to 'composite'
// (c2pa-extract aiKind), so the AI flag surfaces on /verify without further wiring.
export const COMPOSITE_SOURCE_TYPE = 'http://cv.iptc.org/newscodes/digitalsourcetype/compositeWithTrainedAlgorithmicMedia';

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
  // Audio: a record-side credential (e.g. a TTS wav, whose container cannot
  // embed) still names its format honestly when carried as an ingredient.
  wav: 'audio/wav', mp3: 'audio/mpeg', ogg: 'audio/ogg',
  avif: 'image/avif',
};

// Joins a list of human-readable fragments as "a, b and c" (Oxford-comma-free,
// matching British house style elsewhere in this file's descriptions).
function joinList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** One placed ingredient the user (or its own file metadata) declared as
 *  AI-made: 'full' = wholly generated, 'partial' = AI-assisted/composite. */
export interface AiIngredientDeclaration { name: string; kind: 'full' | 'partial' }

/**
 * Collect the AI-origin declarations riding the placed assets of a runtime
 * input model (`runtime.getModel()` after asset resolution): every top-level
 * asset input and every asset sub-field of a `blocks` grid whose resolved ref
 * carries `meta.aiGenerated` - the flag the declare-AI-origins control, a
 * C2PA credential, or a bare IPTC DigitalSourceType declaration set on the
 * record. The dual of the runtime's aiUpscale walk, shared here so the web,
 * CLI and TUI export paths read the same census. Deduped by name+kind; a
 * value with no meta contributes nothing.
 */
export function collectAiIngredientDeclarations(model: ReadonlyArray<{ type: string; value?: unknown; fields?: ReadonlyArray<{ id: string; type?: string }> }>): AiIngredientDeclaration[] {
  const out: AiIngredientDeclaration[] = [];
  const seen = new Set<string>();
  const read = (v: unknown): void => {
    const ref = v as { id?: unknown; meta?: { name?: unknown; aiGenerated?: unknown } } | null | undefined;
    const kind = ref?.meta?.aiGenerated;
    if (kind !== 'full' && kind !== 'partial') return;
    const name = String(ref?.meta?.name ?? ref?.id ?? 'an ingredient');
    const key = `${name}|${kind}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ name, kind });
  };
  for (const input of model) {
    if (input.type === 'asset') read(input.value);
    else if (input.type === 'blocks' && Array.isArray(input.value)) {
      const assetFields = (input.fields ?? []).filter(f => f.type === 'asset').map(f => f.id);
      for (const item of input.value) {
        if (item && typeof item === 'object') for (const fid of assetFields) read((item as Record<string, unknown>)[fid]);
      }
    }
  }
  return out;
}

/**
 * Assemble an honest action history for a Lolly export from what the pipeline
 * actually did. Opens with `c2pa.created` (digitalCreation) - or a single
 * `c2pa.published` when `delivered` - then appends ONE step per transformation
 * that genuinely happened, each its own entry so the credential's history is as
 * granular as the pipeline itself: a CMYK conversion (`cmyk`), a brand-palette
 * colour snap (`paletteColors`, named by count), whichever print marks/bleed
 * were added - named individually, not lumped together (`marks`) - the
 * experimental-tool overlay watermark (`watermarked`), the durable in-pixel
 * Lolly watermark (`imprint`), an added audio track (`audio`), and a closing
 * render/encode for raster, video and PDF outputs. Vector-native (svg/emf/dxf/
 * eps) and text outputs add nothing beyond the close - the created asset
 * already IS that file. Pass the result as `actions` to {@link embedC2pa} /
 * {@link buildC2paManifest}.
 *
 * Three `flags` make the origin honest rather than assumed: `capture` (a live
 * camera frame or a mic/AV recording produced the essence) swaps the created
 * step's source type to `digitalCapture` with a "captured/recorded live"
 * description; `aiUpscale` (the essence is an on-device AI-upscaled asset) swaps
 * it to `compositeWithTrainedAlgorithmicMedia` - a real image with model-inferred
 * detail - and appends an "AI-upscaled with <model> <version>" edit step naming
 * the model; `textAdded` (rendered text placed OVER an opened asset - the caller
 * gates this on an ingredient being present) appends a `c2pa.edited` "Added text"
 * step. From-scratch text is content, not an edit - it belongs in the input
 * digest, so callers must NOT set `textAdded` without an ingredient.
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
  /** The render's essence was captured from a device sensor - created → digitalCapture.
   *  `screen` instead means a display was captured (a screenshot / screen recording) →
   *  created → screenCapture, which is a different IPTC term and a different claim. */
  capture?: { camera?: boolean; microphone?: boolean; screen?: boolean };
  /** Text was placed over an opened asset (gate on ingredients) - appends "Added text". */
  textAdded?: boolean;
  /** Short teaser of that text for the step label (full copy rides in the input digest). */
  textSample?: string;
  /** The render's essence is an on-device AI-upscaled asset - created →
   *  compositeWithTrainedAlgorithmicMedia, plus an edit step naming the model. */
  aiUpscale?: { model: string; version: string };
  /** Placed ingredients the user declared AI-made (collectAiIngredientDeclarations):
   *  created → compositeWithTrainedAlgorithmicMedia, plus a c2pa.placed step naming
   *  each. Pair with an `aiDisclosure` on the manifest (section 18.28.3). */
  aiIngredients?: AiIngredientDeclaration[];
} = {}): C2paActionInput[] {
  if (flags.delivered) return [{ action: 'c2pa.published' }];
  const f = String(format || '').toLowerCase();
  // Origin: a captured essence (camera/mic) declares digitalCapture with an honest
  // description; otherwise the software-authored default (digitalCreation).
  const cap = flags.capture;
  // A display capture is its OWN source type, not a sensor capture - check it first so a
  // narrated screen recording (screen + microphone) never reads as a mic recording of the
  // real world. The screen is what the essence IS; the mic is a track laid over it.
  const screened = !!cap?.screen;
  const captured = !!(cap && (cap.camera || cap.microphone));
  // AI-upscale wins the source-type label: a photo that a trained model enlarged is a
  // COMPOSITE of real + algorithmic media, which is the most complete honest claim even
  // if the source was itself a capture. The capture/screen origin, when present, still
  // rides the ingredient chain; here the composite mark leads.
  const upscaled = flags.aiUpscale;
  // AI-declared ingredients make the whole render a composite of authored and
  // trained-algorithmic media - the fuller claim, so like aiUpscale it wins the
  // source-type label over a capture origin; the origin still rides the chain.
  const aiPlaced = flags.aiIngredients?.length ? flags.aiIngredients : undefined;
  const created: C2paActionInput = upscaled
    ? { action: 'c2pa.created', digitalSourceType: COMPOSITE_SOURCE_TYPE, description: 'Composited from a real image enhanced by a trained algorithm' }
    : aiPlaced
      ? { action: 'c2pa.created', digitalSourceType: COMPOSITE_SOURCE_TYPE, description: 'Composited with ingredient media declared as AI-made' }
      : screened
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
  if (flags.textAdded) steps.push({ action: 'c2pa.edited', description: flags.textSample ? `Added text - “${flags.textSample}”` : 'Added text' });
  // The model that enlarged the image, named - so an inspected asset discloses not
  // just THAT it was AI-upscaled but with what. Kept as its own step after the other
  // edits, before the render/encode close.
  if (upscaled) steps.push({ action: 'c2pa.edited', description: `AI-upscaled with ${upscaled.model} ${upscaled.version}` });
  // Each AI-declared ingredient named with its declared grade, so the record
  // says not just THAT AI media was placed but which piece and how fully.
  if (aiPlaced) steps.push({ action: 'c2pa.placed', description: `Placed AI-declared ingredient${aiPlaced.length === 1 ? '' : 's'}: ${joinList(aiPlaced.map(i => `${i.name} (${i.kind === 'full' ? 'AI-generated' : 'AI-assisted'})`))}` });
  if (RASTER_OUTPUTS.has(f)) steps.push({ action: 'c2pa.converted', description: `Rendered to ${f.toUpperCase()}` });
  else if (VIDEO_OUTPUTS.has(f)) steps.push({ action: 'c2pa.converted', description: `Encoded to ${f.toUpperCase()}` });
  else if (f === 'pdf' || f === 'pdf-cmyk') steps.push({ action: 'c2pa.converted', description: 'Rendered to PDF' });
  return steps;
}

// The created step's description for a captured essence - camera, mic, or both.
function captureDescription(cap: { camera?: boolean; microphone?: boolean; screen?: boolean }): string {
  // Screen first, and it never claims the camera: a display capture's essence came from
  // the screen. The mic gets named because it recorded the room, which the rest of
  // the file did not.
  if (cap.screen) return cap.microphone ? 'Captured from the screen with microphone narration' : 'Captured from the screen';
  if (cap.camera && cap.microphone) return 'Recorded live from the camera and microphone';
  if (cap.camera) return 'Captured live from the camera';
  return 'Recorded live from the microphone';
}

// Custom assertion label for Lolly's export context (reverse-domain of
// lolly.tools). c2pa-rs surfaces unknown CBOR assertions verbatim in reports
// and validates them only by hashed URI - no allowlist, no penalty.
export const LOLLY_EXPORT_ASSERTION = 'tools.lolly.export';

// The BMFF (mp4) hard-binding assertion label - used here (buildC2paManifest
// picks it over the byte-range c2pa.hash.data for bmff assets) and by
// c2pa-containers.ts's BMFF placer/digest, which imports it back from here.
export const BMFF_HASH_LABEL = 'c2pa.hash.bmff.v2';

// Authorship rides in the classic schema.org CreativeWork assertion (a JSON
// assertion, unlike the CBOR ones). The current spec deprecates it in favour
// of CAWG identity assertions - which require a real identity credential this
// on-device signer deliberately doesn't have - but every validator today
// (c2patool, Verify) still parses and DISPLAYS it as the work's author.
export const CREATIVE_WORK_ASSERTION = 'stds.schema-org.CreativeWork';
// How a human author is recorded in v2. NOT the strict `c2pa.metadata`
// assertion: C2PA 2.x locked that to a technical field whitelist (exif/tiff/
// crs/pdf/dc-technical…) that EXCLUDES dc:creator - c2patool rejects a creator
// there with `assertion.metadata.disallowed` and marks the whole file Invalid.
// The spec-clean vehicle for creator metadata is the CAWG metadata assertion
// (`cawg.metadata`): same JSON-LD metadata structure, not field-restricted,
// purpose-built for dc:creator - validated Valid by c2patool, and distinct from
// the `cawg.identity` assertion (which needs a real identity credential this
// on-device signer lacks). schema.org/Exif/IPTC standalone assertions were
// removed in 2.x, so this replaces the v1 CreativeWork path.
export const METADATA_ASSERTION = 'cawg.metadata';
const DC_CONTEXT = { dc: 'http://purl.org/dc/elements/1.1/' };

// ─── section 18.28 AI disclosure (C2PA 2.4) ──────────────────────────────────────────

// The assertion label section 18.28.2 fixes: "The AI Disclosure assertion shall have a
// label of c2pa.ai-disclosure." Read back by the verifier for EVERY format
// (c2pa-verify's readAiDisclosure), which is this writer's round-trip check.
export const AI_DISCLOSURE_ASSERTION = 'c2pa.ai-disclosure';

// Table 12's generic entry - "AI/ML model which is not described by any other
// model type". section 18.28.2 makes modelType the one REQUIRED field, and Table 12's
// other entries name model FORMATS (tensorflow, onnx, coreml…), none of which
// honestly describes "a chat assistant wrote this SVG". So the generic term is
// the default: it is the only value that neither guesses a framework nor leaves
// out a field the CDDL requires.
export const AI_MODEL_TYPE_GENERIC = 'c2pa.types.model';

/**
 * Table 12, "Model type values", copied verbatim - the enumeration section 18.28.2 requires:
 * "The value of the modelType field is an enumeration of AI model types defined
 * in Table 12 … and it shall be present in the ai-model-disclosure-map object."
 *
 * section 18.28.4's CDDL widens the socket to `$model-type-choice /= tstr`, which is why
 * this is a validation and not a hard closed set: an entity may name its own type
 * in its own namespace, the way section 18.21.1 spells out for the neighbouring asset
 * type ("or use an entity-specific namespace (e.g., com.litware.types.abc),
 * conforming to the syntax defined for assertion labels in section 6.2.2"). So the rule
 * enforced below is: a Table 12 value, or a well-formed label in someone else's
 * namespace - and NEVER an invented `c2pa.*` value, because squatting the
 * specification's own namespace is the one case that is simply wrong.
 */
export const AI_MODEL_TYPES = Object.freeze([
  'c2pa.types.model',
  'c2pa.types.model.caffe',
  'c2pa.types.model.caffe2',
  'c2pa.types.model.catboost',
  'c2pa.types.model.coreml',
  'c2pa.types.model.flax',
  'c2pa.types.model.huggingface.transformers',
  'c2pa.types.model.jax',
  'c2pa.types.model.keras',
  'c2pa.types.model.lightgbm',
  'c2pa.types.model.ml_net',
  'c2pa.types.model.mxnet',
  'c2pa.types.model.onnx',
  'c2pa.types.model.openvino',
  'c2pa.types.model.openvino.parameter',
  'c2pa.types.model.openvino.topology',
  'c2pa.types.model.paddle',
  'c2pa.types.model.pytorch',
  'c2pa.types.model.sklearn',
  'c2pa.types.model.tensorflow',
  'c2pa.types.model.tensorrt',
  'c2pa.types.model.tflite',
  'c2pa.types.model.torchscript',
  'c2pa.types.model.xgboost',
] as const);

// section 6.2.2's ABNF for namespaced labels, copied verbatim:
//   namespaced-label = qualified-namespace label
//   entity           = entity-component *( "." entity-component )
//   entity-component = 1( DIGIT / ALPHA ) *( DIGIT / ALPHA / "-" / "_" )
//   label            = 1*( "." label-component )
const NAMESPACED_LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*(?:\.[A-Za-z0-9][A-Za-z0-9_-]*)+$/;

// section 18.28.4's human-oversight-enum, verbatim and in the spec's own order:
// fully_autonomous - no human review after model output
// prompt_guided - human provided prompts/config but no final approval
// human_validated - human reviewed/approved the final output before release
// section 18.28.3 pairs these with digitalSourceType rather than replacing it, so a
// disclosure normally travels WITH a trainedAlgorithmicMedia created action.
export const HUMAN_OVERSIGHT_LEVELS = Object.freeze(['fully_autonomous', 'prompt_guided', 'human_validated'] as const);
export type HumanOversightLevel = (typeof HUMAN_OVERSIGHT_LEVELS)[number];

/**
 * A section 18.28 AI transparency statement, as a caller states it. Flattened where the
 * spec nests: `oversight` becomes `contentProfile.humanOversightLevel`, which is
 * the only field of that sub-map the spec defines - and the same flattening the
 * read side does (`C2paAiDisclosure.oversight`), so a value written here comes
 * back under the same name.
 *
 * SELF-ASSERTED, like every claim fact: it records what the signer declared, not
 * what a model did. Only claim it for content a model actually produced.
 */
export interface C2paAiDisclosureInput {
  /** Table 12 model type; defaults to {@link AI_MODEL_TYPE_GENERIC}. */
  modelType?: string;
  /** Human-readable model name, e.g. 'Claude Fable 5'. */
  modelName?: string;
  /** Stable identifier where one exists (URI, PURL, …). */
  modelIdentifier?: string;
  /** section 18.28.4 contentProfile.humanOversightLevel. */
  oversight?: HumanOversightLevel;
  /** arXiv taxonomy term(s), e.g. 'cs.AI' or ['cs.AI', 'physics.optics']. */
  scientificDomain?: string | string[];
}

// section 18.28.4: `$scientific-domain-string /= tstr .regexp
// "^[A-Za-z0-9-]+(\\.[A-Za-z0-9-]+)+$"` - copied verbatim, not approximated.
const SCIENTIFIC_DOMAIN_RE = /^[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+$/;

// section 10.2.3's `semver-string` regexp, copied verbatim from the CDDL (the canonical
// SemVer 2.0.0 pattern). Used to refuse a malformed specVersion at write time:
// a version string is a conformance DECLARATION, and one the CDDL rejects is
// worse than none at all.
const SEMVER_RE = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;

/**
 * The version of the C2PA specification this module was written against - the
 * value a caller passes as `specVersion` when it wants the manifest to declare
 * one (section 10.2.3.1: "A specVersion field SHOULD be present").
 *
 * Deliberately NOT a default. Setting it says "this manifest contains no
 * construct deprecated in 2.4" (section 10.2.2), which is a claim about the whole
 * builder, and no credential should make a claim its author did not choose to
 * make. It also keeps every manifest written before this option byte-identical.
 */
export const C2PA_SPEC_VERSION = '2.4.0';

/**
 * section 18.28's `ai-model-disclosure-map`, CDDL key order preserved (the CBOR encoder
 * writes objects in insertion order, so the map's bytes are stable across calls
 * with the same input - which the two-pass container embedders require).
 *
 * Validates rather than coerces, because all three constrained fields are enums a
 * config file can typo: an unknown oversight level, a domain the taxonomy regexp
 * rejects, or a model type outside Table 12 would produce a non-conformant
 * assertion that our own liberal reader would happily echo back, hiding the
 * mistake. Fail at write time.
 */
function aiDisclosureMap(d: C2paAiDisclosureInput): Record<string, unknown> {
  const modelType = String(d.modelType ?? AI_MODEL_TYPE_GENERIC).trim();
  if (!modelType) throw new Error('c2pa: aiDisclosure.modelType cannot be empty (section 18.28.2 requires it; omit the field to get the generic c2pa.types.model)');
  // section 18.28.2's enumeration, or an entity's own namespaced label (section 18.21.1 +
  // section 6.2.2) - never an invented value in the c2pa namespace.
  if (!(AI_MODEL_TYPES as readonly string[]).includes(modelType)
    && (modelType.startsWith('c2pa.') || !NAMESPACED_LABEL_RE.test(modelType))) {
    throw new Error(`c2pa: aiDisclosure.modelType '${modelType}' is neither a Table 12 model type (section 18.28.2) nor an entity-specific namespaced label (section 6.2.2, e.g. 'com.litware.types.abc') - omit the field to get the generic ${AI_MODEL_TYPE_GENERIC}`);
  }
  if (d.oversight != null && !(HUMAN_OVERSIGHT_LEVELS as readonly string[]).includes(String(d.oversight))) {
    throw new Error(`c2pa: aiDisclosure.oversight must be one of ${HUMAN_OVERSIGHT_LEVELS.join(' / ')} (section 18.28.4), got '${String(d.oversight)}'`);
  }
  const raw = d.scientificDomain == null ? [] : Array.isArray(d.scientificDomain) ? d.scientificDomain : [d.scientificDomain];
  const domains = raw.map((s) => String(s).trim()).filter(Boolean);
  for (const s of domains) {
    if (!SCIENTIFIC_DOMAIN_RE.test(s)) throw new Error(`c2pa: aiDisclosure.scientificDomain '${s}' is not an arXiv taxonomy term (section 18.28.4 e.g. 'cs.AI', 'physics.optics')`);
  }
  return {
    modelType,
    ...(d.modelName ? { modelName: String(d.modelName) } : {}),
    ...(d.modelIdentifier ? { modelIdentifier: String(d.modelIdentifier) } : {}),
    ...(d.oversight ? { contentProfile: { humanOversightLevel: String(d.oversight) } } : {}),
    // The CDDL says a list (`1* $scientific-domain-string`) even though
    // section 18.28.4's own example ships a bare string. Write the conformant list;
    // the read side accepts both.
    ...(domains.length ? { scientificDomain: domains } : {}),
  };
}

/**
 * Build a complete C2PA JUMBF store (→ Uint8Array). Emits a C2PA 2.x claim
 * (`c2pa.claim.v2`) by default; `claimVersion: 1` builds the legacy
 * `c2pa.claim` and exists only so the dual-version verifier keeps v1-read test
 * coverage - the embedders never pass it, so Lolly's products only write v2.
 *
 * Assertions: the actions assertion (c2pa.actions.v2 on v2, c2pa.actions on v1)
 * with one c2pa.created action (softwareAgent = the generator-info map on v2 /
 * the generator string on v1, digitalSourceType = digitalCreation, when =
 * dates.signedAt), the c2pa.hash.data hard binding carrying assetHash verbatim:
 *   assetHash = { exclusions: [{start, length}], name?, alg?, hash: Uint8Array, pad?: Uint8Array }
 * - or, with assetHash = { bmff: true, hash, pad? }, the ISO-BMFF binding
 * c2pa.hash.bmff.v2 with the fixed top-level box exclusions instead -
 * and - when `environment` is given - a `tools.lolly.export` CBOR assertion
 * recording the export context (tool, format, surface, browser engine, OS…).
 * `generatorInfo` ({ name, version, operating_system? }) becomes the claim's
 * claim_generator_info (a single REQUIRED map in v2; an optional array
 * alongside the free-text claim_generator string in v1), with `specVersion`
 * added to the CLAIM's copy when the caller declares one (2.4 moved that field
 * out of the claim). The v2 claim drops dc:format and the schema.org
 * CreativeWork author assertion per the 2.x spec.
 *
 * `aiDisclosure` adds the section 18.28 `c2pa.ai-disclosure` assertion (model type/
 * name/identifier and the human-oversight level), referenced from
 * created_assertions like every other assertion authored here. Both of these
 * are optional and absent by default, so a caller that does not ask for them
 * gets byte-identical output to before they existed.
 *
 * The claim references each assertion by hashed URI - a JUMBF URI relative to
 * the manifest plus sha256 over the assertion superbox's payload (jumd +
 * content boxes, excluding the outer 8-byte box header).
 *
 * `signer` / `manifestLabel` / `instanceId` are optional and exist so the
 * embedders (and tests) can hold them constant across the two-pass layout;
 * fresh ones are generated when absent. A signer may be external (e.g. a
 * CA-issued device credential): { privateKey | sign(bytes) → raw 64-byte
 * r||s, certDer, chain? } - chain (leaf first) wins over certDer in the
 * COSE x5chain. P-256/ES256 only.
 */
export async function buildC2paManifest({
  title,
  claimGenerator,
  generatorInfo,
  environment,
  author,
  authorship = 'created',
  rights,
  actions: actionSteps,
  ingredients,
  aiDisclosure,
  specVersion,
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
  // 2.4's specVersion lives in claim_generator_info - but only the CLAIM's copy,
  // never the per-action softwareAgent (same map type, different subject: the
  // manifest was produced to a spec version; a single edit step was not). A
  // caller that omits it gets `genInfoMap` itself, so the claim's bytes are
  // unchanged from before this option existed.
  if (specVersion != null && !SEMVER_RE.test(String(specVersion))) {
    throw new Error(`c2pa: specVersion must be a SemVer string (section 10.2.3, e.g. '${C2PA_SPEC_VERSION}'), got '${String(specVersion)}'`);
  }
  const claimGenInfo: Record<string, unknown> = specVersion != null
    ? { ...genInfoMap, specVersion: String(specVersion) }
    : genInfoMap;

  // A creation claim carries the digitalCreation source type; a delivery claim
  // (distributing an existing asset, the standard c2pa.published action)
  // deliberately omits it, so the credential never asserts the signer authored
  // the work. Key insertion order is preserved on the created path - its bytes
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
  // Each preserved ingredient is opened FIRST, and the opened step carries the
  // ingredient's AI/ML source type, so the new asset's OWN active manifest
  // declares the AI origin (not only the walked-in ingredient chain). This
  // guarantees the AI origin cannot be hidden: strip the ingredient manifests
  // and the flag still fires from Lolly's signed actions.
  const ingList = ingredients ?? [];
  // Build each preserved ingredient's c2pa.ingredient.v3 assertion FIRST: the
  // c2pa.opened action below must reference it via parameters.ingredients (the
  // spec requires opened/placed/removed actions to name their ingredients), and
  // the same hash feeds the claim's assertion list. Each assertion carries the
  // V3-required validationResults - the integrity checks the ingredient's own
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
      // (jumd + content, minus the 8-byte header) - Lolly's hashed-URI convention.
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
  // Each ingredient is opened FIRST - the opened step references its ingredient
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
  // xpath exclusions) instead of byte ranges - c2pa-rs rejects a data-hash
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
    // section 11.4's external form (and section A.7.1.3's link element) hash the asset WHOLE:
    // "the data hash assertion shall have no exclusion range". The CDDL is
    // `? "exclusions": [1* EXCLUSION_RANGE-map]` - optional, but non-empty when
    // present - so an empty list is written as NO KEY, not as `[]`. Every
    // embedded caller passes at least one range, so their bytes are unchanged.
    ...(assetHash.exclusions!.length
      ? { exclusions: assetHash.exclusions!.map((e) => ({ start: e.start, length: e.length })) }
      : {}),
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
  // real identity credential the ephemeral on-device signer lacks - so a v2
  // credential attributes the software via claim_generator_info, never a human.
  let authorBox: Uint8Array | null = null;
  if (!v2 && author?.name) {
    // Profile authorship (opt-in upstream): a schema.org Person on the
    // CreativeWork. JSON assertion - jumd UUID 'json', content box 'json'.
    const person: { '@type': string; name: string; email?: string; url?: string } = { '@type': 'Person', name: String(author.name) };
    if (author.email) person.email = String(author.email);
    if (author.url) person.url = String(author.url);
    const work = { '@context': 'http://schema.org/', '@type': 'CreativeWork', author: [person] };
    authorBox = jumbfSuperbox(UUID_JSON_CONTENT, CREATIVE_WORK_ASSERTION, isoBox('json', te.encode(JSON.stringify(work))));
    storeBoxes.push(authorBox);
  }
  // v2: the human author rides in the spec-clean c2pa.metadata assertion
  // (JSON-LD, Dublin Core dc:creator) instead of the removed schema.org one.
  let metadataBox: Uint8Array | null = null;
  if (v2 && (author?.name || rights)) {
    // JSON-LD cawg.metadata: dc:creator (author) + dc:rights (user-asserted
    // copyright/licence). Either one alone is enough to emit the assertion.
    // The licensing contact rides inside the creator entry npm-style -
    // `Name <email> (site)` - Dublin Core has no contact term of its own, and a
    // composed string stays a single dc:creator any external viewer displays
    // verbatim; the verifier's parseCreatorEntry unpicks it on read.
    const metaLd: Record<string, unknown> = { '@context': DC_CONTEXT };
    if (author?.name) {
      const contact = [author.email ? `<${String(author.email)}>` : '', author.url ? `(${String(author.url)})` : ''].filter(Boolean).join(' ');
      metaLd['dc:creator'] = [contact ? `${String(author.name)} ${contact}` : String(author.name)];
    }
    if (rights) metaLd['dc:rights'] = String(rights);
    metadataBox = jumbfSuperbox(UUID_JSON_CONTENT, METADATA_ASSERTION, isoBox('json', te.encode(JSON.stringify(metaLd))));
    storeBoxes.push(metadataBox);
  }
  // section 18.28: the AI transparency statement, a CBOR assertion like the actions and
  // hash ones. Written for BOTH claim versions - the label is version-neutral
  // and a v1 store's `assertions` array references it the same way.
  let aiBox: Uint8Array | null = null;
  if (aiDisclosure) {
    aiBox = jumbfSuperbox(UUID_CBOR_CONTENT, AI_DISCLOSURE_ASSERTION, isoBox('cbor', encodeCbor(aiDisclosureMap(aiDisclosure))));
    storeBoxes.push(aiBox);
  }
  // The ingredient assertions were built up-front (their hashes feed the opened
  // action's parameters.ingredients); add them to the assertion store here so
  // they sit after the standard assertions.
  for (const box of ingredientBoxes) storeBoxes.push(box);
  const assertionStore = jumbfSuperbox(UUID_ASSERTION_STORE, 'c2pa.assertions', ...storeBoxes);

  // JUMBF-box hashed URIs cover the superbox PAYLOAD - the jumd description box
  // and content boxes, NOT the outer 8-byte LBox+TBox header (matches c2pa-rs,
  // which recreates the box and hashes write_box_payload). Same reference shape
  // in both versions; v2 only relabels the actions assertion.
  const assertionRefs = [
    { url: `self#jumbf=c2pa.assertions/${actionsLabel}`, hash: await sha256(actionsBox.subarray(8)) },
    { url: `self#jumbf=c2pa.assertions/${hashLabel}`, hash: await sha256(hashBox.subarray(8)) },
    ...(exportBox ? [{ url: `self#jumbf=c2pa.assertions/${LOLLY_EXPORT_ASSERTION}`, hash: await sha256(exportBox.subarray(8)) }] : []),
    ...(authorBox ? [{ url: `self#jumbf=c2pa.assertions/${CREATIVE_WORK_ASSERTION}`, hash: await sha256(authorBox.subarray(8)) }] : []),
    ...(metadataBox ? [{ url: `self#jumbf=c2pa.assertions/${METADATA_ASSERTION}`, hash: await sha256(metadataBox.subarray(8)) }] : []),
    ...(aiBox ? [{ url: `self#jumbf=c2pa.assertions/${AI_DISCLOSURE_ASSERTION}`, hash: await sha256(aiBox.subarray(8)) }] : []),
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
    claim_generator_info: claimGenInfo,
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
  // manifest - the store's LAST manifest is the active one (C2PA section "active
  // manifest"), and the read side (parseC2paStore / collectActionChain) walks
  // every manifest, so a preserved ingredient's full provenance chain surfaces.
  const ingredientManifestBoxes = ingList.flatMap((ing) => ing.manifestBoxes);
  return jumbfSuperbox(UUID_C2PA_STORE, 'c2pa', ...ingredientManifestBoxes, manifest);
}

// ─── external (sidecar) manifests - section 11.4 / section A.7.1.2 ──────────────────────────

/** {@link buildExternalC2paStore}'s options: everything {@link embedC2pa} takes,
 *  plus the two 2.4 writer additions and the hash assertion's display name. */
export interface ExternalC2paStoreOptions extends EmbedOptions {
  /** section 18.28 AI transparency statement - see {@link C2paAiDisclosureInput}. */
  aiDisclosure?: C2paAiDisclosureInput;
  /** SemVer spec version declared in claim_generator_info (section 10.2.3). */
  specVersion?: string;
  /**
   * The data-hash assertion's human-readable `name`. Defaults to
   * 'whole document' - the embedded default ('jumbf manifest') describes an
   * excluded region this binding does not have.
   */
  hashName?: string;
}

/**
 * Build + sign a C2PA Manifest Store that binds the WHOLE of `bytes`, and return
 * the JUMBF store on its own - nothing is placed in, appended to, or spliced
 * into the asset. This is section 11.4's external manifest: "keeping the C2PA Manifests
 * externally to the asset is an acceptable model for providing provenance",
 * served as `application/c2pa` from a location the asset points at.
 *
 * The hard binding is what makes it work without a container: section A.7.1.3, for an
 * HTML document that references its manifest with
 * `<link rel="c2pa-manifest" href="…">`, says "the data hash assertion shall
 * have no exclusion range; the hash shall be computed over the entire document"
 * - so there is no circular dependency between the manifest's length and the
 * offsets it declares, no two-pass layout, and no bytes added to the asset
 * beyond the one `<link>` element the caller wrote before hashing.
 *
 * Which means the ORDER matters and is the caller's responsibility: hash the
 * FINAL bytes, after the last serialization step and with the reference element
 * already in place (section A.7.1.3's note - any later re-serialization is, by design,
 * a modification). What comes back is written beside the asset as its `.c2pa`
 * sidecar.
 *
 * `ingredients` works exactly as it does for an embedded manifest: pass
 * `prepareC2paIngredient()` / `prepareC2paIngredientFromStore()` results and
 * each ingredient's own signed manifest is carried into this store beneath the
 * active claim, so a page's credential CONTAINS the components' credentials and
 * the verifier's existing chain walk derives their AI origin without new logic.
 *
 * Verified by handing both halves back to the reader:
 * `verifyC2pa(bytes, { externalManifest: store })`.
 */
export async function buildExternalC2paStore(bytes: Uint8Array, opts: ExternalC2paStoreOptions = {}): Promise<Uint8Array> {
  if (!(bytes instanceof Uint8Array)) throw new Error('c2pa: buildExternalC2paStore needs the asset bytes as a Uint8Array');
  const { hashName, ...rest } = opts;
  return buildC2paManifest({
    ...rest,
    // No exclusions: the whole asset is inside the hash, because the manifest is
    // outside the asset. buildC2paManifest omits the CDDL-empty `exclusions` key
    // entirely for this case rather than writing a non-conformant `[]`.
    assetHash: { exclusions: [], name: hashName || 'whole document', hash: await sha256(bytes) },
  });
}

