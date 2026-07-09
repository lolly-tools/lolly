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

import {
  walkBoxes, box as bmffBox,
  EBML_ID, SEGMENT_ID, SEEKHEAD, CUES,
  readVint, writeVint, ebml, idAt, scanSegmentChildren, seekHeadEntrySplice, beUint,
} from './video-meta.ts';
import { asDate, generateSigner } from './x509.ts';

// The ephemeral self-signed signer (and the DER/X.509 writers behind it)
// moved to x509.js in 1.11.0; re-exported so existing importers keep working.
export { generateSigner } from './x509.ts';

// ─── shared types ─────────────────────────────────────────────────────────────

type DateInput = Date | string | number | null | undefined;

interface Dates {
  signedAt?: DateInput;
  notBefore?: DateInput;
  notAfter?: DateInput;
}

/** External or ephemeral signer: privateKey OR sign(bytes) → raw 64-byte r||s. */
interface Signer {
  privateKey?: CryptoKey;
  certDer?: Uint8Array;
  chain?: Uint8Array[];
  sign?: (bytes: Uint8Array) => Promise<ArrayBuffer | Uint8Array> | ArrayBuffer | Uint8Array;
}

interface Author {
  name?: string;
  email?: string;
}

interface Exclusion {
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
// step of one export agrees byte-for-byte.
interface C2paActionInput { action: string; digitalSourceType?: string; description?: string; parameters?: unknown; }

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

interface EmbedOptions {
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

interface PlaceResult {
  out: Uint8Array;
  exclusions: Exclusion[];
}

const te = new TextEncoder();
const subtle = globalThis.crypto.subtle;

// ─── bytes ────────────────────────────────────────────────────────────────────

function concatBytes(parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

// TS 5.7+ widens Uint8Array to Uint8Array<ArrayBufferLike>; WebCrypto wants an
// ArrayBuffer-backed BufferSource. Every buffer here is ArrayBuffer-backed, so
// this is a type-only widening, erased at runtime.
const asBufferSource = (b: Uint8Array): BufferSource => b as unknown as BufferSource;

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  return new Uint8Array(await subtle.digest('SHA-256', asBufferSource(bytes)));
}

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

function urnUuid(): string {
  const b = globalThis.crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6]! & 0x0f) | 0x40;
  b[8] = (b[8]! & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
  return `urn:uuid:${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// xsd:dateTime at fixed (second) precision so manifest length is date-stable.
const isoSeconds = (d: Date): string => d.toISOString().slice(0, 19) + 'Z';

// IPTC digital source type for works created by software (shown by validators
// as the provenance kind of the c2pa.created action).
const DIGITAL_SOURCE_TYPE = 'http://cv.iptc.org/newscodes/digitalsourcetype/digitalCreation';

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
} = {}): C2paActionInput[] {
  if (flags.delivered) return [{ action: 'c2pa.published' }];
  const f = String(format || '').toLowerCase();
  const steps: C2paActionInput[] = [{ action: 'c2pa.created', digitalSourceType: DIGITAL_SOURCE_TYPE }];
  if (flags.cmyk) steps.push({ action: 'c2pa.color_adjustments', description: 'Converted colours to CMYK for print' });
  if (flags.paletteColors) steps.push({ action: 'c2pa.color_adjustments', description: `Snapped colours to the brand palette (${flags.paletteColors} colour${flags.paletteColors === 1 ? '' : 's'})` });
  if (flags.marks?.length) steps.push({ action: 'c2pa.edited', description: `Added ${joinList(flags.marks)}` });
  if (flags.watermarked) steps.push({ action: 'c2pa.edited', description: 'Added experimental-tool watermark' });
  if (flags.imprint) steps.push({ action: 'c2pa.edited', description: 'Embedded a durable Lolly pixel watermark' });
  if (flags.audio) steps.push({ action: 'c2pa.edited', description: 'Added an audio track' });
  if (RASTER_OUTPUTS.has(f)) steps.push({ action: 'c2pa.converted', description: `Rendered to ${f.toUpperCase()}` });
  else if (VIDEO_OUTPUTS.has(f)) steps.push({ action: 'c2pa.converted', description: `Encoded to ${f.toUpperCase()}` });
  else if (f === 'pdf' || f === 'pdf-cmyk') steps.push({ action: 'c2pa.converted', description: 'Rendered to PDF' });
  return steps;
}

// Custom assertion label for Lolly's export context (reverse-domain of
// lolly.tools). c2pa-rs surfaces unknown CBOR assertions verbatim in reports
// and validates them only by hashed URI — no allowlist, no penalty.
export const LOLLY_EXPORT_ASSERTION = 'tools.lolly.export';

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

// ─── PDF incremental update ───────────────────────────────────────────────────

// Byte-transparent binary string. TextDecoder('latin1') is really
// windows-1252 (remaps 0x80–0x9f), so both directions are hand-rolled.
function bytesToBin(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000) as unknown as number[]);
  }
  return s;
}

function binToBytes(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

const PDF_WS = ' \t\r\n\f\0';
const PDF_DELIM = ' \t\r\n\f\0()<>[]{}/%';

function skipWs(s: string, i: number): number {
  while (i < s.length && PDF_WS.includes(s[i]!)) i++;
  return i;
}

function literalStringEnd(s: string, i: number): number {
  let p = 1;
  i++;
  while (i < s.length && p > 0) {
    if (s[i] === '\\') i += 2;
    else {
      if (s[i] === '(') p++;
      else if (s[i] === ')') p--;
      i++;
    }
  }
  if (p !== 0) throw new Error('C2PA embed: unterminated PDF string');
  return i;
}

// End (exclusive) of a composite value starting at i ('<<' or '['). Skips
// literal strings (escapes + nested parens), hex strings and comments.
function compositeEnd(s: string, i: number): number {
  let depth = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === '(') i = literalStringEnd(s, i);
    else if (c === '<' && s[i + 1] === '<') { depth++; i += 2; }
    else if (c === '>' && s[i + 1] === '>') { depth--; i += 2; if (depth === 0) return i; }
    else if (c === '<') { const j = s.indexOf('>', i); if (j < 0) break; i = j + 1; }
    else if (c === '[') { depth++; i++; }
    else if (c === ']') { depth--; i++; if (depth === 0) return i; }
    else if (c === '%') { while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++; }
    else i++;
  }
  throw new Error('C2PA embed: unbalanced PDF value');
}

// End (exclusive) of any PDF value starting at i (whitespace already skipped).
function valueEnd(s: string, i: number): number {
  const c = s[i];
  if ((c === '<' && s[i + 1] === '<') || c === '[') return compositeEnd(s, i);
  if (c === '<') {
    const j = s.indexOf('>', i);
    if (j < 0) throw new Error('C2PA embed: unterminated hex string');
    return j + 1;
  }
  if (c === '(') return literalStringEnd(s, i);
  if (c === '/') {
    let j = i + 1;
    while (j < s.length && !PDF_DELIM.includes(s[j]!)) j++;
    return j;
  }
  const ref = /^\d+\s+\d+\s+R(?![A-Za-z0-9])/.exec(s.slice(i, i + 32));
  if (ref) return i + ref[0]!.length;
  const tok = /^[^\s()<>[\]{}/%]+/.exec(s.slice(i, i + 128));
  if (tok) return i + tok[0]!.length;
  throw new Error('C2PA embed: cannot parse PDF value');
}

interface DictEntry {
  key: string;
  valStart: number;
  valEnd: number;
}

// Top-level key/value spans of an inline dict source ('<<…>>', offsets into src).
function dictEntries(src: string): DictEntry[] {
  const entries: DictEntry[] = [];
  let i = skipWs(src, 2);
  while (i < src.length) {
    if (src[i] === '>' && src[i + 1] === '>') break;
    if (src[i] !== '/') throw new Error('C2PA embed: malformed PDF dictionary');
    let j = i + 1;
    while (j < src.length && !PDF_DELIM.includes(src[j]!)) j++;
    const key = src.slice(i + 1, j);
    const valStart = skipWs(src, j);
    const valEnd = valueEnd(src, valStart);
    entries.push({ key, valStart, valEnd });
    i = skipWs(src, valEnd);
  }
  return entries;
}

interface XrefEntry {
  num: number;
  offset: number;
  gen: number;
  type: string;
}

interface XrefSection {
  entries: XrefEntry[];
  trailer: string;
  prev: number | null;
}

// One classic xref section at `off`: entries + raw trailer dict + /Prev.
// Cross-reference *streams* (PDF 1.5+) start with "N G obj" instead — those
// get a distinct error the shell maps to "cannot attach".
function parseXrefSection(bin: string, off: number): XrefSection {
  let i = skipWs(bin, off);
  if (!bin.startsWith('xref', i)) {
    if (/^\d+\s+\d+\s+obj\b/.test(bin.slice(i, i + 32))) {
      throw new Error('C2PA embed: PDF uses a cross-reference stream (PDF 1.5+); cannot attach');
    }
    throw new Error('C2PA embed: startxref does not point at a cross-reference table');
  }
  i = skipWs(bin, i + 4);
  const entries: XrefEntry[] = [];
  while (!bin.startsWith('trailer', i)) {
    const head = /^(\d+)[ \t]+(\d+)/.exec(bin.slice(i, i + 40));
    if (!head) throw new Error('C2PA embed: malformed cross-reference subsection');
    const start = +head[1]!;
    const count = +head[2]!;
    i = skipWs(bin, i + head[0]!.length);
    for (let k = 0; k < count; k++) {
      const e = /^(\d{10}) (\d{5}) ([nf])/.exec(bin.slice(i, i + 20));
      if (!e) throw new Error('C2PA embed: malformed cross-reference entry');
      entries.push({ num: start + k, offset: +e[1]!, gen: +e[2]!, type: e[3]! });
      i = skipWs(bin, i + 18);
    }
  }
  i = skipWs(bin, i + 7);
  if (!(bin[i] === '<' && bin[i + 1] === '<')) throw new Error('C2PA embed: malformed trailer');
  const trailer = bin.slice(i, compositeEnd(bin, i));
  const prev = /\/Prev\s+(\d+)/.exec(trailer);
  return { entries, trailer, prev: prev ? +prev[1]! : null };
}

interface PdfRoot {
  num: number;
  gen: number;
}

interface PdfInfo {
  startxref: number;
  entries: Map<number, XrefEntry>;
  root: PdfRoot;
  maxNum: number;
  infoRaw: string | null;
  idRaw: string | null;
}

function parsePdf(bin: string): PdfInfo {
  if (!bin.startsWith('%PDF-')) throw new Error('C2PA embed: not a PDF');
  const sxAt = bin.lastIndexOf('startxref');
  const sx = sxAt < 0 ? null : /^startxref\s+(\d+)/.exec(bin.slice(sxAt, sxAt + 40));
  if (!sx) throw new Error('C2PA embed: missing startxref');
  const startxref = +sx[1]!;
  const entries = new Map<number, XrefEntry>(); // first seen wins — the chain walks newest → oldest
  const trailers: string[] = [];
  const seen = new Set<number>();
  for (let off: number | null = startxref; off != null && !seen.has(off); ) {
    seen.add(off);
    const sec = parseXrefSection(bin, off);
    for (const e of sec.entries) if (!entries.has(e.num)) entries.set(e.num, e);
    trailers.push(sec.trailer);
    off = sec.prev;
  }
  let root: PdfRoot | null = null;
  for (const t of trailers) {
    const m = /\/Root\s+(\d+)\s+(\d+)\s+R/.exec(t);
    if (m) { root = { num: +m[1]!, gen: +m[2]! }; break; }
  }
  if (!root) throw new Error('C2PA embed: trailer has no /Root');
  const sizeM = /\/Size\s+(\d+)/.exec(trailers[0]!);
  let maxNum = sizeM ? +sizeM[1]! - 1 : 0;
  for (const n of entries.keys()) if (n > maxNum) maxNum = n;
  const infoM = /\/Info\s+\d+\s+\d+\s+R/.exec(trailers[0]!);
  const idM = /\/ID\s*\[[^\]]*\]/.exec(trailers[0]!);
  return { startxref, entries, root, maxNum, infoRaw: infoM ? infoM[0] : null, idRaw: idM ? idM[0] : null };
}

// The Catalog dict source, via the xref entry for /Root (raw scan fallback
// for slightly-off offsets — some writers pad or shift by an EOL).
function catalogSource(bin: string, info: PdfInfo): string {
  const { num, gen } = info.root;
  const headRe = new RegExp(`^${num}\\s+${gen}\\s+obj\\b`);
  let at = -1;
  const entry = info.entries.get(num);
  if (entry && entry.type === 'n') {
    const i = skipWs(bin, entry.offset);
    if (headRe.test(bin.slice(i, i + 32))) at = i;
  }
  if (at < 0) {
    const re = new RegExp(`(?:^|[^0-9])(${num}\\s+${gen}\\s+obj)\\b`, 'g');
    for (let m; (m = re.exec(bin)); ) at = m.index + m[0]!.length - m[1]!.length; // last = newest revision
  }
  if (at < 0) throw new Error('C2PA embed: cannot locate the PDF Catalog object');
  const objM = /^\d+\s+\d+\s+obj/.exec(bin.slice(at, at + 32));
  const i = skipWs(bin, at + objM![0]!.length);
  if (!(bin[i] === '<' && bin[i + 1] === '<')) throw new Error('C2PA embed: Catalog object is not a dictionary');
  const src = bin.slice(i, compositeEnd(bin, i));
  if (!/\/Type\s*\/Catalog\b/.test(src)) throw new Error('C2PA embed: /Root object is not a /Catalog');
  return src;
}

// Clone the Catalog dict source with /AF + /Names→/EmbeddedFiles attached.
// Inline values are merged in place; an indirect /Names, indirect /AF or a
// pre-existing /EmbeddedFiles tree is out of scope → clear "cannot attach".
function catalogWithAttachment(src: string, fsRef: string): string {
  const efEntry = `/EmbeddedFiles << /Names [(manifest.c2pa) ${fsRef}] >>`;
  const entries = dictEntries(src);
  const find = (k: string) => entries.find((e) => e.key === k);
  const edits: { at: number; text: string }[] = [];
  const names = find('Names');
  if (names) {
    const val = src.slice(names.valStart, names.valEnd);
    if (!val.startsWith('<<')) throw new Error('C2PA embed: catalog /Names is an indirect object; cannot attach');
    if (dictEntries(val).some((e) => e.key === 'EmbeddedFiles')) {
      throw new Error('C2PA embed: PDF already has an /EmbeddedFiles name tree; cannot attach');
    }
    edits.push({ at: names.valEnd - 2, text: ` ${efEntry} ` });
  }
  const af = find('AF');
  if (af) {
    if (src[af.valStart] !== '[') throw new Error('C2PA embed: catalog /AF is not an inline array; cannot attach');
    edits.push({ at: af.valEnd - 1, text: ` ${fsRef}` });
  }
  let tailAdd = '';
  if (!af) tailAdd += ` /AF [${fsRef}]`;
  if (!names) tailAdd += ` /Names << ${efEntry} >>`;
  if (tailAdd) edits.push({ at: src.length - 2, text: tailAdd + ' ' });
  let out = src;
  for (const e of edits.sort((a, b) => b.at - a.at)) out = out.slice(0, e.at) + e.text + out.slice(e.at);
  return out;
}

// "nnnnnnnnnn ggggg n\r\n" — exactly the 20-byte classic xref entry.
const xrefEntryLine = (offset: number, gen: number): string => `${String(offset).padStart(10, '0')} ${String(gen).padStart(5, '0')} n\r\n`;

/**
 * Attach a C2PA manifest to a PDF as an incremental update: the original
 * bytes are kept as a byte-identical prefix (asserted), then an updated
 * Catalog (same object number + generation, /AF + /Names→/EmbeddedFiles), a
 * /Filespec with /AFRelationship /C2PA_Manifest, the manifest as an
 * /EmbeddedFile stream, a classic xref section and a trailer whose /Prev
 * points at the original startxref. Requires a classic cross-reference
 * table (jsPDF-style); cross-reference streams throw a clear Error the
 * shell treats as "cannot attach".
 */
export async function embedC2paInPdf(pdfBytes: Uint8Array, { title, claimGenerator, generatorInfo, environment, author, authorship, actions, ingredients, dates = {}, signer }: EmbedOptions = {}): Promise<Uint8Array> {
  if (!(pdfBytes instanceof Uint8Array)) throw new Error('C2PA embed: pdfBytes must be a Uint8Array');
  const bin = bytesToBin(pdfBytes);
  const info = parsePdf(bin);
  const fsNum = info.maxNum + 1; // FileSpec dict
  const efNum = info.maxNum + 2; // EmbeddedFile stream
  const fsRef = `${fsNum} 0 R`;
  const catalog = catalogWithAttachment(catalogSource(bin, info), fsRef);

  const sep = bin.endsWith('\n') || bin.endsWith('\r') ? '' : '\n';
  const catObj = `${info.root.num} ${info.root.gen} obj\n${catalog}\nendobj\n`;
  const fsObj = `${fsNum} 0 obj\n<< /Type /Filespec /F (manifest.c2pa) /UF (manifest.c2pa) /AFRelationship /C2PA_Manifest /EF << /F ${efNum} 0 R >> >>\nendobj\n`;
  const afterStream = '\nendstream\nendobj\n';
  const trailerExtra = (info.infoRaw ? ' ' + info.infoRaw : '') + (info.idRaw ? ' ' + info.idRaw : '');

  // Full incremental-update layout for a manifest of exactly `manifestLen`
  // bytes. Only /Length's digit count and the startxref value vary with the
  // manifest length; xref entry offsets are fixed-width by format.
  const layoutFor = (manifestLen: number): { head: string; tail: string; manifestOffset: number } => {
    const catOff = pdfBytes.length + sep.length;
    const fsOff = catOff + catObj.length;
    const efOff = fsOff + fsObj.length;
    const head = sep + catObj + fsObj +
      `${efNum} 0 obj\n<< /Type /EmbeddedFile /Subtype /application#2Fc2pa /Length ${manifestLen} >>\nstream\n`;
    const manifestOffset = pdfBytes.length + head.length;
    const xrefOff = manifestOffset + manifestLen + afterStream.length;
    const tail = afterStream +
      'xref\n' +
      `${info.root.num} 1\n` + xrefEntryLine(catOff, info.root.gen) +
      `${fsNum} 2\n` + xrefEntryLine(fsOff, 0) + xrefEntryLine(efOff, 0) +
      `trailer\n<< /Size ${efNum + 1} /Root ${info.root.num} ${info.root.gen} R /Prev ${info.startxref}${trailerExtra} >>\n` +
      `startxref\n${xrefOff}\n%%EOF\n`;
    return { head, tail, manifestOffset };
  };

  // Signer, manifest label and instanceID are held constant across passes so
  // the manifest length is deterministic given input lengths. An external
  // signer's chain bytes are captured once so every pass signs the identical
  // protected header (byte-identical x5chain across builds).
  const sig: Signer = signer ?? (await generateSigner(dates));
  const internals = {
    signer: { ...sig, sign: sig.sign && sig.sign.bind(sig), chain: sig.chain ?? [sig.certDer!] },
    manifestLabel: urnUuid(),
    instanceId: urnUuid(),
  };
  const pad = new Uint8Array(8);
  const dummyHash = new Uint8Array(32);
  const build = (hash: Uint8Array, exclusions: Exclusion[], padBytes: Uint8Array): Promise<Uint8Array> => buildC2paManifest({
    title, claimGenerator, generatorInfo, environment, author, authorship, actions, ingredients, dates, format: 'application/pdf',
    assetHash: { exclusions, hash, pad: padBytes },
    ...internals,
  });

  // Pass 1: freeze the layout. Manifest length depends on the layout only
  // through the CBOR widths of exclusion start/length, so iterate to a fixed
  // point (converges in one round unless a width boundary is crossed).
  let manifestLen = (await build(dummyHash, [{ start: pdfBytes.length + 512, length: 4096 }], pad)).length;
  let layout: { head: string; tail: string; manifestOffset: number } | null = null;
  let placeholder: Uint8Array | null = null;
  for (let round = 0; round < 8 && !placeholder; round++) {
    const l = layoutFor(manifestLen);
    const m = await build(dummyHash, [{ start: l.manifestOffset, length: manifestLen }], pad);
    if (m.length === manifestLen) { layout = l; placeholder = m; }
    else manifestLen = m.length;
  }
  if (!placeholder) throw new Error('C2PA embed: manifest layout did not converge');

  const out = concatBytes([pdfBytes, binToBytes(layout!.head), placeholder, binToBytes(layout!.tail)]);
  const exclusions = [{ start: layout!.manifestOffset, length: manifestLen }];
  // Hard binding: sha256 of the final file with the manifest bytes OMITTED
  // (C2PA exclusions skip the range from the hash input; nothing is zeroed).
  const digest = await sha256(concatBytes([
    out.subarray(0, layout!.manifestOffset),
    out.subarray(layout!.manifestOffset + manifestLen),
  ]));

  // Pass 2: same layout, real hash. Only fixed-width fields changed, so the
  // length must match; `pad` absorbs any residual drift as a safety net.
  let manifest = await build(digest, exclusions, pad);
  if (manifest.length !== manifestLen) {
    const padLen = pad.length + (manifestLen - manifest.length);
    if (padLen < 0 || padLen >= 24) throw new Error('C2PA embed: manifest length drifted beyond pad range');
    manifest = await build(digest, exclusions, new Uint8Array(padLen));
    if (manifest.length !== manifestLen) throw new Error('C2PA embed: manifest length is not deterministic');
  }
  out.set(manifest, layout!.manifestOffset);

  // The incremental-update contract: original bytes are a byte-identical prefix.
  for (let i = 0; i < pdfBytes.length; i++) {
    if (out[i] !== pdfBytes[i]) throw new Error('C2PA embed: original PDF bytes were modified');
  }
  return out;
}

// ─── container embedders (png/jpeg/gif/svg/tiff/webp) ────────────────────────
//
// Each placer is a pure function place(container, manifest) → { out, exclusions }
// that splices a manifest of ANY length into the container. The shared driver
// runs the same two-pass hard-binding dance as the PDF path: place a
// placeholder of the final byte length, hash the result with the exclusion
// ranges OMITTED, rebuild the manifest with the real digest, place again.
// That works because every placer's output outside its exclusion ranges
// depends only on the manifest LENGTH, never its content (asserted below by
// re-hashing the final output). The recipes byte-match c2pa-rs's asset
// handlers (png_io/jpeg_io/gif_io/svg_io/tiff_io/riff_io) — the validator
// behind c2patool and verify.contentauthenticity.org — including each
// format's exact exclusion ranges.

const asciiBytes = (s: string): Uint8Array => te.encode(s);

function u32be(n: number): Uint8Array {
  return Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
}
function u32le(n: number): Uint8Array {
  return Uint8Array.of(n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff);
}
function u16be(n: number): Uint8Array {
  return Uint8Array.of((n >>> 8) & 0xff, n & 0xff);
}

// Standard PNG CRC-32 (reflected 0xEDB88320, init/xorout 0xFFFFFFFF).
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(...parts: Uint8Array[]): number {
  let c = 0xffffffff;
  for (const p of parts) for (let i = 0; i < p.length; i++) c = CRC_TABLE[(c ^ p[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const PNG_SIG = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);

// PNG: one `caBX` chunk immediately after IHDR; the exclusion covers the WHOLE
// chunk (length + type + data + CRC = len+12). Any pre-existing caBX is
// spliced out (two would make the file unreadable to c2pa-rs).
function placePng(png: Uint8Array, manifest: Uint8Array): PlaceResult {
  for (let i = 0; i < 8; i++) if (png[i] !== PNG_SIG[i]) throw new Error('C2PA embed: not a PNG');
  const dv = new DataView(png.buffer, png.byteOffset);
  let ihdrEnd = -1;
  const drop: { start: number; end: number }[] = []; // existing caBX ranges
  for (let i = 8; i + 8 <= png.length; ) {
    const len = dv.getUint32(i);
    const type = String.fromCharCode(png[i + 4]!, png[i + 5]!, png[i + 6]!, png[i + 7]!);
    const end = i + len + 12;
    if (end > png.length) throw new Error('C2PA embed: malformed PNG chunk');
    if (type === 'IHDR') ihdrEnd = end;
    if (type === 'caBX') drop.push({ start: i, end });
    if (type === 'IEND') break;
    i = end;
  }
  if (ihdrEnd < 0) throw new Error('C2PA embed: PNG has no IHDR');
  const chunk = concatBytes([u32be(manifest.length), asciiBytes('caBX'), manifest, u32be(crc32(asciiBytes('caBX'), manifest))]);
  const parts: Uint8Array[] = [];
  let insertAt = ihdrEnd;
  for (const d of drop) if (d.end <= ihdrEnd) insertAt -= d.end - d.start;
  let at = 0;
  for (const d of drop) { parts.push(png.subarray(at, d.start)); at = d.end; }
  parts.push(png.subarray(at));
  const cleaned = drop.length ? concatBytes(parts) : png;
  const out = concatBytes([cleaned.subarray(0, insertAt), chunk, cleaned.subarray(insertAt)]);
  return { out, exclusions: [{ start: insertAt, length: chunk.length }] };
}

// JPEG: APP11 (FF EB) JUMBF segments — CI "JP", En 0x0211, Z = u32BE 1-based;
// the manifest is chunked at 64000 bytes and continuation segments repeat the
// store's first 8 bytes (superbox LBox+TBox) after the Z field, exactly as
// jpeg_io.rs writes and its reader strips. Placed after the LAST APP0 (or
// right after SOI); the exclusion is one contiguous range over all segments.
const JPEG_CHUNK = 64000;
function placeJpeg(jpeg: Uint8Array, manifest: Uint8Array): PlaceResult {
  if (!(jpeg[0] === 0xff && jpeg[1] === 0xd8)) throw new Error('C2PA embed: not a JPEG');
  // Walk marker segments up to SOS (FF DA) — entropy data follows, nothing to
  // relocate past that point.
  let insertAt = 2;
  const drop: { start: number; end: number }[] = [];
  let dropEn = -1;
  for (let i = 2; i + 4 <= jpeg.length; ) {
    if (jpeg[i] !== 0xff) break;
    const marker = jpeg[i + 1]!;
    if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd9)) { i += 2; continue; } // standalone
    const le = (jpeg[i + 2]! << 8) | jpeg[i + 3]!;
    const end = i + 2 + le;
    if (end > jpeg.length) throw new Error('C2PA embed: malformed JPEG segment');
    if (marker === 0xe0) insertAt = end; // after the LAST APP0
    if (marker === 0xeb && le >= 18) {
      const c = jpeg.subarray(i + 4, end); // contents after Le
      const en = (c[2]! << 8) | c[3]!;
      const isStart = c.length > 28 &&
        c[24] === 0x63 && c[25] === 0x32 && c[26] === 0x70 && c[27] === 0x61; // 'c2pa'
      if (isStart) { drop.push({ start: i, end }); dropEn = en; }
      else if (en === dropEn && drop.length) drop.push({ start: i, end });
    }
    if (marker === 0xda) break; // SOS
    i = end;
  }
  const segs: Uint8Array[] = [];
  const head8 = manifest.subarray(0, 8); // LBox+TBox duplicated on continuations
  let z = 1;
  for (let o = 0; o < manifest.length; o += JPEG_CHUNK, z++) {
    const chunk = manifest.subarray(o, Math.min(o + JPEG_CHUNK, manifest.length));
    const body = z === 1
      ? concatBytes([asciiBytes('JP'), Uint8Array.of(0x02, 0x11), u32be(z), chunk])
      : concatBytes([asciiBytes('JP'), Uint8Array.of(0x02, 0x11), u32be(z), head8, chunk]);
    segs.push(concatBytes([Uint8Array.of(0xff, 0xeb), u16be(body.length + 2), body]));
  }
  const block = concatBytes(segs);
  let shift = 0;
  for (const d of drop) if (d.end <= insertAt) shift += d.end - d.start;
  const parts: Uint8Array[] = [];
  let at = 0;
  for (const d of drop) { parts.push(jpeg.subarray(at, d.start)); at = d.end; }
  parts.push(jpeg.subarray(at));
  const cleaned = drop.length ? concatBytes(parts) : jpeg;
  const pos = insertAt - shift;
  const out = concatBytes([cleaned.subarray(0, pos), block, cleaned.subarray(pos)]);
  return { out, exclusions: [{ start: pos, length: block.length }] };
}

// GIF: one Application Extension (21 FF 0B "C2PA_GIF" 01 00 00) holding the
// manifest as ≤255-byte sub-blocks + 00 terminator, inserted right after the
// preamble (header + LSD + optional GCT) — c2pa-rs stops scanning at the first
// Image Descriptor. Inserting an extension forces the version byte to '9'.
function placeGif(gif: Uint8Array, manifest: Uint8Array): PlaceResult {
  const sig = String.fromCharCode(...gif.subarray(0, 6));
  if (sig !== 'GIF87a' && sig !== 'GIF89a') throw new Error('C2PA embed: not a GIF');
  const packed = gif[10]!;
  let pre = 13; // header(6) + LSD(7)
  if (packed & 0x80) pre += 3 * (1 << ((packed & 0x07) + 1)); // global color table
  // Drop an existing C2PA_GIF app extension (scan blocks up to first image).
  // Every gif[j] read is bounds-checked BEFORE use: an out-of-range read is
  // undefined and NaN-poisons j into an unbreakable infinite loop on a
  // truncated file (a hang escapes the caller's try/catch, unlike a throw).
  let drop: { start: number; end: number } | null = null;
  for (let i = pre; i < gif.length && !drop; ) {
    const b = gif[i];
    if (b === 0x2c || b === 0x3b) break; // image descriptor / trailer
    if (b !== 0x21) throw new Error('C2PA embed: malformed GIF block');
    const label = gif[i + 1];
    let j = i + 2;
    if (j >= gif.length) throw new Error('C2PA embed: truncated GIF block');
    if (label === 0xff || label === 0x01 || label === 0xf9) j += 1 + gif[j]!; // sized header block
    // walk data sub-blocks
    while (j < gif.length && gif[j] !== 0x00) j += 1 + gif[j]!;
    if (j >= gif.length) throw new Error('C2PA embed: truncated GIF sub-blocks');
    j += 1;
    if (label === 0xff && String.fromCharCode(...gif.subarray(i + 3, i + 11)) === 'C2PA_GIF'
        && gif[i + 11] === 0x01 && gif[i + 12] === 0x00 && gif[i + 13] === 0x00) {
      drop = { start: i, end: j };
    }
    i = j;
  }
  const sub: Uint8Array[] = [];
  for (let o = 0; o < manifest.length; o += 255) {
    const chunk = manifest.subarray(o, Math.min(o + 255, manifest.length));
    sub.push(Uint8Array.of(chunk.length), chunk);
  }
  const block = concatBytes([
    Uint8Array.of(0x21, 0xff, 0x0b), asciiBytes('C2PA_GIF'), Uint8Array.of(0x01, 0x00, 0x00),
    ...sub, Uint8Array.of(0x00),
  ]);
  const cleaned = drop ? concatBytes([gif.subarray(0, drop.start), gif.subarray(drop.end)]) : gif;
  const out = concatBytes([cleaned.subarray(0, pre), block, cleaned.subarray(pre)]);
  out[4] = 0x39; // '9' — extensions require GIF89a
  return { out, exclusions: [{ start: pre, length: block.length }] };
}

// SVG: the manifest is standard base64 (with padding, one unbroken run) as the
// text of <c2pa:manifest> inside a direct <metadata> child of the root <svg>,
// with xmlns:c2pa declared on the root. Only the base64 TEXT is excluded from
// the hard binding — the tags around it are hashed, and the hash is over raw
// bytes (no XML canonicalisation), so placement is byte-splicing, not DOM work.
// Scanning is byte-wise over ASCII structural characters (UTF-8 safe).
const C2PA_XMLNS = ' xmlns:c2pa="http://c2pa.org/manifest"';
function placeSvg(svg: Uint8Array, manifest: Uint8Array): PlaceResult {
  const bin = bytesToBin(svg);
  // Root <svg …> open tag (quote-aware scan for its closing '>').
  const open = /<svg(?=[\s>])/.exec(bin);
  if (!open) throw new Error('C2PA embed: not an SVG (no <svg> root)');
  let i = open.index + 4;
  let q: string | null = null;
  for (; i < bin.length; i++) {
    const ch = bin[i];
    if (q) { if (ch === q) q = null; }
    else if (ch === '"' || ch === "'") q = ch;
    else if (ch === '>') break;
  }
  if (i >= bin.length) throw new Error('C2PA embed: unterminated <svg> tag');
  if (bin[i - 1] === '/') throw new Error('C2PA embed: self-closing <svg/> cannot hold a manifest');
  const tagSrc = bin.slice(open.index, i);
  let doc = bin;
  let rootEnd = i + 1; // just past '>'
  if (!tagSrc.includes('xmlns:c2pa')) {
    doc = bin.slice(0, i) + C2PA_XMLNS + bin.slice(i);
    rootEnd += C2PA_XMLNS.length;
  }
  // Replace an existing manifest element's text, else reuse the first direct
  // <metadata>, else create one right after the root open tag.
  let b64 = '';
  { // base64 with standard alphabet + padding, single line
    let s = '';
    for (let o = 0; o < manifest.length; o += 0x8000) s += String.fromCharCode.apply(null, manifest.subarray(o, o + 0x8000) as unknown as number[]);
    b64 = btoa(s);
  }
  const existing = /<c2pa:manifest[^>]*>/.exec(doc);
  let head: string, tail: string, b64Start: number;
  if (existing) {
    const close = doc.indexOf('</c2pa:manifest>', existing.index);
    if (close < 0) throw new Error('C2PA embed: unterminated c2pa:manifest element');
    head = doc.slice(0, existing.index + existing[0]!.length);
    tail = doc.slice(close);
    b64Start = head.length;
  } else {
    const meta = /<metadata(?=[\s>])[^>]*>/.exec(doc);
    if (meta && doc[meta.index + meta[0]!.length - 2] !== '/') {
      head = doc.slice(0, meta.index + meta[0]!.length) + '<c2pa:manifest>';
      tail = '</c2pa:manifest>' + doc.slice(meta.index + meta[0]!.length);
    } else {
      head = doc.slice(0, rootEnd) + '<metadata><c2pa:manifest>';
      tail = '</c2pa:manifest></metadata>' + doc.slice(rootEnd);
    }
    b64Start = head.length;
  }
  const out = binToBytes(head + b64 + tail);
  return { out, exclusions: [{ start: b64Start, length: b64.length }] };
}

// TIFF: manifest bytes verbatim as tag 0xCD41 (type UNDEFINED) in a dedicated
// single-entry IFD appended as the LAST IFD of the chain; the previous last
// IFD's next-IFD pointer is patched to it. Exclusions match c2pa-rs exactly:
// the value bytes AND the entry's 4-byte count field (so the manifest can be
// re-stamped without moving). Classic TIFF only, either endianness.
function placeTiff(tiff: Uint8Array, manifest: Uint8Array): PlaceResult {
  const le = tiff[0] === 0x49 && tiff[1] === 0x49;
  const be = tiff[0] === 0x4d && tiff[1] === 0x4d;
  if (!le && !be) throw new Error('C2PA embed: not a TIFF');
  const dv = new DataView(tiff.buffer, tiff.byteOffset);
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  if (u16(2) !== 42) throw new Error('C2PA embed: BigTIFF is not supported');
  // Find the last IFD in the chain (cycle-guarded).
  const seen = new Set<number>();
  let ifd = u32(4);
  if (!ifd) throw new Error('C2PA embed: TIFF has no IFD');
  let lastIfd = ifd;
  let nextPtrAt = 4; // file offset of the pointer that will be patched
  while (ifd && !seen.has(ifd)) {
    seen.add(ifd);
    const count = u16(ifd);
    const next = ifd + 2 + count * 12;
    if (next + 4 > tiff.length) throw new Error('C2PA embed: malformed TIFF IFD');
    lastIfd = ifd;
    nextPtrAt = next;
    ifd = u32(next);
  }
  if (ifd) throw new Error('C2PA embed: cyclic TIFF IFD chain');
  void lastIfd;
  // Append: [pad to 4] [IFD: count=1 | tag entry | next=0] [manifest]
  const padLen = (4 - (tiff.length % 4)) % 4;
  const ifdOffset = tiff.length + padLen;
  const valueOffset = ifdOffset + 2 + 12 + 4;
  const num16 = (n: number) => { const b = new Uint8Array(2); new DataView(b.buffer)[le ? 'setUint16' : 'setUint16'](0, n, le); return b; };
  const num32 = (n: number) => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n, le); return b; };
  const newIfd = concatBytes([
    num16(1),
    num16(0xcd41), num16(7), num32(manifest.length), num32(valueOffset),
    num32(0),
  ]);
  const out = concatBytes([tiff, new Uint8Array(padLen), newIfd, manifest]);
  // Patch the previous next-IFD pointer in place.
  new DataView(out.buffer, out.byteOffset).setUint32(nextPtrAt, ifdOffset, le);
  return {
    out,
    exclusions: [
      { start: ifdOffset + 2 + 2 + 2, length: 4 }, // the entry's count field
      { start: valueOffset, length: manifest.length },
    ],
  };
}

// WebP (RIFF): a top-level "C2PA" chunk appended as the LAST chunk (+0x00 pad
// when the manifest length is odd — the pad is HASHED, only header+data are
// excluded), with the RIFF size field at offset 4 updated. Any existing C2PA
// chunk is removed first.
function placeWebp(webp: Uint8Array, manifest: Uint8Array): PlaceResult {
  const fourcc = (o: number) => String.fromCharCode(webp[o]!, webp[o + 1]!, webp[o + 2]!, webp[o + 3]!);
  if (fourcc(0) !== 'RIFF' || fourcc(8) !== 'WEBP') throw new Error('C2PA embed: not a WebP');
  const dv = new DataView(webp.buffer, webp.byteOffset);
  let drop: { start: number; end: number } | null = null;
  for (let i = 12; i + 8 <= webp.length; ) {
    const size = dv.getUint32(i + 4, true);
    const end = i + 8 + size + (size & 1);
    if (end > webp.length + 1) throw new Error('C2PA embed: malformed WebP chunk');
    if (fourcc(i) === 'C2PA') drop = { start: i, end: Math.min(end, webp.length) };
    i = end;
  }
  const cleaned = drop ? concatBytes([webp.subarray(0, drop.start), webp.subarray(drop.end)]) : webp;
  const chunk = concatBytes([
    asciiBytes('C2PA'), u32le(manifest.length), manifest,
    manifest.length & 1 ? Uint8Array.of(0) : new Uint8Array(0),
  ]);
  const start = cleaned.length;
  const out = concatBytes([cleaned, chunk]);
  new DataView(out.buffer, out.byteOffset).setUint32(4, out.length - 8, true);
  return { out, exclusions: [{ start, length: manifest.length + 8 }] };
}

// ─── MP4 (ISO BMFF) ───────────────────────────────────────────────────────────

interface Box {
  off: number;
  size: number;
  type: string;
}

// C2PA's BMFF usertype (extended box type) — d8fec3d6-1b0e-483c-9297-5828877ec481.
export const C2PA_BMFF_UUID = Uint8Array.of(
  0xd8, 0xfe, 0xc3, 0xd6, 0x1b, 0x0e, 0x48, 0x3c,
  0x92, 0x97, 0x58, 0x28, 0x87, 0x7e, 0xc4, 0x81,
);

export const BMFF_HASH_LABEL = 'c2pa.hash.bmff.v2';

// The c2pa-rs default exclusion set for flat (non-fragmented) BMFF: the C2PA
// uuid box itself (matched by usertype at offset 8 — other uuid boxes are
// hashed), ftyp, and the padding/index boxes muxers rewrite freely.
const bmffHashExclusions = () => [
  { xpath: '/uuid', data: [{ offset: 8, value: C2PA_BMFF_UUID }] },
  { xpath: '/ftyp' },
  { xpath: '/mfra' },
  { xpath: '/free' },
  { xpath: '/skip' },
];

const isC2paUuidBox = (bytes: Uint8Array, b: Box): boolean =>
  b.type === 'uuid' && b.size >= 24 && C2PA_BMFF_UUID.every((v, i) => bytes[b.off + 8 + i] === v);

const bmffExcluded = (bytes: Uint8Array, b: Box): boolean =>
  isC2paUuidBox(bytes, b) || b.type === 'ftyp' || b.type === 'mfra' || b.type === 'free' || b.type === 'skip';

const u64be = (n: number): Uint8Array => {
  const out = new Uint8Array(8);
  for (let i = 7; i >= 0; i--) { out[i] = n % 256; n = Math.floor(n / 256); }
  return out;
};

/**
 * The c2pa.hash.bmff.v2 digest: walk the file's top-level boxes in order; each
 * box surviving the exclusions contributes its u64-BE file offset, then its
 * bytes (the offset markers are what distinguish v2+ from v1). Matches
 * c2pa-rs's bmff_to_jumbf_exclusions + hash_stream_by_alg, verified against
 * c2patool output byte-for-byte.
 */
async function bmffDigest(out: Uint8Array): Promise<Uint8Array> {
  const boxes = walkBoxes(out, 0, out.length);
  if (!boxes) throw new Error('C2PA embed: malformed MP4 (truncated or 64-bit boxes)');
  const spans: Uint8Array[] = [];
  for (const b of boxes) {
    if (bmffExcluded(out, b)) continue;
    spans.push(u64be(b.off), out.subarray(b.off, b.off + b.size));
  }
  return sha256(concatBytes(spans));
}

// The C2PA box: uuid + usertype, FullBox version/flags 0, purpose 'manifest'
// (nul-terminated), u64-BE offset to a merkle box (0 = none; flat hash), then
// the JUMBF store. Appended as the LAST top-level box: nothing before it
// moves, so moov's stco/co64 chunk offsets stay valid — and validators locate
// the box by usertype, not position (verified against c2patool).
function placeMp4(mp4: Uint8Array, manifest: Uint8Array): PlaceResult {
  const boxes = walkBoxes(mp4, 0, mp4.length);
  if (!boxes || !boxes.length) throw new Error('C2PA embed: malformed MP4 (truncated or 64-bit boxes)');
  if (boxes[0]!.type !== 'ftyp') throw new Error('C2PA embed: not an MP4 (no leading ftyp box)');
  // Re-stamp replaces a prior credential — but only a TRAILING one (our own
  // placement). Stripping a mid-file box (c2patool writes its after ftyp)
  // would shift mdat and stale every stco/co64 chunk offset, corrupting
  // playback while the credential still verifies. Refuse rather than corrupt.
  const priors = boxes.filter((b) => isC2paUuidBox(mp4, b));
  if (priors.length > 1 || (priors.length === 1 && priors[0] !== boxes[boxes.length - 1])) {
    throw new Error('C2PA embed: cannot replace an existing MP4 credential that is not the last box');
  }
  let cleaned = priors.length ? mp4.subarray(0, priors[0]!.off) : mp4;
  // Finalise a to-EOF last box (size field 0): the appended C2PA box would
  // otherwise be swallowed into its scope on re-parse. The resolved size is
  // manifest-independent, so the placer contract holds.
  const lastKept = priors.length ? boxes[boxes.length - 2] : boxes[boxes.length - 1];
  if (lastKept && ((mp4[lastKept.off]! | mp4[lastKept.off + 1]! | mp4[lastKept.off + 2]! | mp4[lastKept.off + 3]!) === 0)) {
    if (lastKept.size > 0xffffffff) throw new Error('C2PA embed: cannot finalise a to-EOF MP4 box over 4GB');
    cleaned = cleaned.slice();
    cleaned[lastKept.off] = lastKept.size >>> 24;
    cleaned[lastKept.off + 1] = (lastKept.size >>> 16) & 0xff;
    cleaned[lastKept.off + 2] = (lastKept.size >>> 8) & 0xff;
    cleaned[lastKept.off + 3] = lastKept.size & 0xff;
  }
  const c2paBox = bmffBox('uuid', C2PA_BMFF_UUID, new Uint8Array(4), asciiBytes('manifest\0'), new Uint8Array(8), manifest);
  const start = cleaned.length;
  return { out: concatBytes([cleaned, c2paBox]), exclusions: [{ start, length: c2paBox.length }] };
}

// ─── WebM (Matroska / EBML) ───────────────────────────────────────────────────

interface EbmlEl {
  off: number;
  id: number;
  idWidth: number;
  sizeWidth: number;
  size: number;
  unknown: boolean;
}

// Matroska has no standardised C2PA binding (c2patool: "type is unsupported"),
// so the store rides in the container's native side-channel — an Attachments
// element whose AttachedFile is `manifest.c2pa` / application/c2pa — under the
// ordinary byte-range data-hash binding. Lolly's verifier reads it back;
// nothing else will until the spec grows a Matroska mapping.
const ID_ATTACHMENTS  = Uint8Array.of(0x19, 0x41, 0xa4, 0x69);
const ID_ATTACHEDFILE = Uint8Array.of(0x61, 0xa7);
const ID_FILENAME     = Uint8Array.of(0x46, 0x6e);
const ID_FILEMIMETYPE = Uint8Array.of(0x46, 0x60);
const ID_FILEUID      = Uint8Array.of(0x46, 0xae);
const ID_FILEDATA     = Uint8Array.of(0x46, 0x5c);
const ATTACHMENTS_NUM = 0x1941a469; // readId()/scanSegmentChildren numeric form

export const C2PA_ATTACHMENT_MIME = 'application/c2pa';

const c2paAttachment = (manifest: Uint8Array): Uint8Array => ebml(ID_ATTACHMENTS, ebml(ID_ATTACHEDFILE, concatBytes([
  ebml(ID_FILENAME, asciiBytes('manifest.c2pa')),
  ebml(ID_FILEMIMETYPE, asciiBytes(C2PA_ATTACHMENT_MIME)),
  // FileUID must be non-zero; a fixed value keeps placement content-independent
  // (we never write more than one attachment, and re-stamps replace it).
  ebml(ID_FILEUID, beUint(1)),
  ebml(ID_FILEDATA, manifest),
])));

// Is this Attachments element (a scanSegmentChildren entry) a C2PA one? True
// when any AttachedFile inside declares the application/c2pa mime type. The
// scan end is clamped to the file: a crafted oversized size VINT must not
// turn this into a near-infinite loop (the bounds-before-read house rule).
function isC2paAttachments(bytes: Uint8Array, el: EbmlEl): boolean {
  if (el.id !== ATTACHMENTS_NUM || el.unknown) return false;
  const mime = asciiBytes(C2PA_ATTACHMENT_MIME);
  const end = Math.min(el.off + el.idWidth + el.sizeWidth + el.size, bytes.length);
  outer: for (let i = el.off; i + ID_FILEMIMETYPE.length <= end - mime.length; i++) {
    if (!idAt(bytes, i, ID_FILEMIMETYPE as unknown as number[])) continue;
    const size = readVint(bytes, i + ID_FILEMIMETYPE.length);
    if (!size || size.unknown || size.value !== mime.length) continue;
    const at = i + ID_FILEMIMETYPE.length + size.width;
    if (at + mime.length > end) continue;
    for (let j = 0; j < mime.length; j++) if (bytes[at + j] !== mime[j]) continue outer;
    return true;
  }
  return false;
}

/**
 * Place the manifest into a WebM/Matroska file.
 *
 * Finalised (known-size) Segments — what MediaRecorder blobs are — get the
 * attachment appended at the Segment's end (positions indexed by SeekHead/Cues
 * never move), the Segment size VINT patched at its existing width, and an
 * Attachments entry grown into the SeekHead's reserved Void when there is
 * room (best-effort — Lolly's verifier walks the children directly).
 * Streaming unknown-size Segments with no index get it inserted before the
 * first Cluster, where a linear walk can always reach it. A prior C2PA
 * attachment in either supported spot is replaced.
 */
function placeWebm(webm: Uint8Array, manifest: Uint8Array): PlaceResult {
  if (!idAt(webm, 0, EBML_ID)) throw new Error('C2PA embed: not a WebM/Matroska file');
  const headSize = readVint(webm, EBML_ID.length);
  if (!headSize || headSize.unknown) throw new Error('C2PA embed: malformed EBML header');
  const segOff = EBML_ID.length + headSize.width + headSize.value;
  if (!idAt(webm, segOff, SEGMENT_ID)) throw new Error('C2PA embed: no Matroska Segment');
  const segSize = readVint(webm, segOff + SEGMENT_ID.length);
  if (!segSize) throw new Error('C2PA embed: malformed Segment size');
  const attach = c2paAttachment(manifest);
  const payloadStart = segOff + SEGMENT_ID.length + segSize.width;

  if (segSize.unknown) {
    // Streaming shape (live MediaRecorder): nothing may index byte positions,
    // or inserting/removing would silently break seeks we cannot see. The
    // guard must look past the first Cluster too — a trailing Cues would go
    // just as stale — so keep scanning while sizes stay measurable.
    const scan = scanSegmentChildren(webm, payloadStart, webm.length);
    if (!scan) throw new Error('C2PA embed: malformed Matroska Segment');
    const restStart = scan.firstCluster && !scan.firstCluster.unknown
      ? scan.firstCluster.off + scan.firstCluster.idWidth + scan.firstCluster.sizeWidth + scan.firstCluster.size
      : -1;
    const restIds = restStart >= 0 ? scanIdsTolerant(webm, restStart, webm.length) : [];
    if ([...scan.elements.map((e) => e.id), ...restIds].some((id) => id === SEEKHEAD || id === CUES)) {
      throw new Error('C2PA embed: unsupported Matroska shape (unknown-size Segment with an index)');
    }
    if (scan.elements.some((e) => e.id === ATTACHMENTS_NUM && !isC2paAttachments(webm, e))) {
      throw new Error('C2PA embed: Matroska file already has attachments');
    }
    const lastEl = scan.elements[scan.elements.length - 1];
    if (!scan.firstCluster && lastEl) {
      // An EOF append must stay reachable by a child walk: refuse when the
      // walk ended at an unmeasurable (unknown-size or overrunning) element —
      // an attachment past it would be invisible to Lolly's own verifier.
      const lastEnd = lastEl.off + lastEl.idWidth + lastEl.sizeWidth + lastEl.size;
      if (lastEl.unknown || lastEnd > webm.length) {
        throw new Error('C2PA embed: unsupported Matroska shape (unmeasurable Segment tail)');
      }
    }
    const prior = scan.elements.find((e) => isC2paAttachments(webm, e));
    const dropStart = prior ? prior.off : -1;
    const dropEnd = prior ? prior.off + prior.idWidth + prior.sizeWidth + prior.size : -1;
    const at = scan.firstCluster ? scan.firstCluster.off : webm.length;
    if (prior && dropEnd > at) throw new Error('C2PA embed: cannot replace existing Matroska credential');
    const before = prior
      ? concatBytes([webm.subarray(0, dropStart), webm.subarray(dropEnd, at)])
      : webm.subarray(0, at);
    return {
      out: concatBytes([before, attach, webm.subarray(at)]),
      exclusions: [{ start: before.length, length: attach.length }],
    };
  }

  let segEnd = payloadStart + segSize.value;
  if (segEnd > webm.length) throw new Error('C2PA embed: truncated Matroska Segment');
  let bytes = webm;
  let payloadLen = segSize.value;

  // Re-stamp: strip a prior TRAILING C2PA attachment (the only place we write
  // one). Everything indexed sits before it, so no position goes stale — and
  // the replacement lands at the same offset, re-validating any existing
  // SeekHead entry. A C2PA attachment anywhere else is not ours to move, and
  // a foreign attachment (cover art) must not gain a sibling Attachments
  // element (the Matroska schema allows only one).
  const all = walkAllChildren(bytes, payloadStart, segEnd);
  if (all.some((e) => e.id === ATTACHMENTS_NUM && !isC2paAttachments(bytes, e))) {
    throw new Error('C2PA embed: Matroska file already has attachments');
  }
  const priors = all.filter((e) => isC2paAttachments(bytes, e));
  if (priors.length) {
    const last = priors[priors.length - 1]!;
    const lastEnd = last.off + last.idWidth + last.sizeWidth + last.size;
    if (priors.length > 1 || lastEnd !== segEnd) throw new Error('C2PA embed: cannot replace existing Matroska credential');
    payloadLen -= lastEnd - last.off;
    bytes = concatBytes([bytes.subarray(0, last.off), bytes.subarray(lastEnd)]);
    segEnd = last.off;
  }

  const patched = writeVint(payloadLen + attach.length, segSize.width);
  if (!patched) throw new Error('C2PA embed: Segment size does not fit its VINT width');

  // Best-effort SeekHead entry (same reserved-Void trick as the Tags embed) so
  // ffmpeg-style demuxers that stop at the first Cluster still find it. The
  // splice is size-neutral, so it never disturbs the exclusion offsets.
  const scan = scanSegmentChildren(bytes, payloadStart, segEnd);
  const hasEntry = scan && seekHeadHasEntry(bytes, scan, ID_ATTACHMENTS);
  const splice = scan && !hasEntry ? seekHeadEntrySplice(bytes, scan, ID_ATTACHMENTS, payloadLen) : null;
  const payload = splice
    ? concatBytes([bytes.subarray(payloadStart, splice.start), splice.bytes, bytes.subarray(splice.end, segEnd)])
    : bytes.subarray(payloadStart, segEnd);
  const out = concatBytes([
    bytes.subarray(0, segOff + SEGMENT_ID.length),
    patched,
    payload,
    attach,
    bytes.subarray(segEnd),
  ]);
  return { out, exclusions: [{ start: payloadStart + payloadLen, length: attach.length }] };
}

// Walk ALL sibling elements in [start, end) — unlike scanSegmentChildren this
// does not stop at the first Cluster (finalised files have known-size Clusters
// and trailing Cues/Tags/Attachments). Throws on malformed or unknown-size
// children: every read is bounds-checked before use.
function walkAllChildren(bytes: Uint8Array, start: number, end: number): EbmlEl[] {
  const out: EbmlEl[] = [];
  let off = start;
  while (off < end) {
    const id = readIdAt(bytes, off, end);
    const size = id && readVint(bytes, off + id.width);
    if (!id || !size || size.unknown) throw new Error('C2PA embed: malformed Matroska Segment');
    const next = off + id.width + size.width + size.value;
    if (next > end || next <= off) throw new Error('C2PA embed: malformed Matroska Segment');
    out.push({ off, id: id.value, idWidth: id.width, sizeWidth: size.width, size: size.value, unknown: false });
    off = next;
  }
  return out;
}

// Tolerant sibling walk for guards: collect element ids while sizes stay
// known and in-bounds, stop silently otherwise (unknown-size Clusters — the
// streaming case — end measurable structure; nothing beyond them can be
// checked, or shifted, reliably).
function scanIdsTolerant(bytes: Uint8Array, from: number, end: number): number[] {
  const ids: number[] = [];
  let off = from;
  while (off < end) {
    const id = readIdAt(bytes, off, end);
    const size = id && readVint(bytes, off + id.width);
    if (!id || !size || size.unknown) break;
    const next = off + id.width + size.width + size.value;
    if (next > end || next <= off) break;
    ids.push(id.value);
    off = next;
  }
  return ids;
}

// readId with an explicit bound (video-meta's readId checks bytes.length; here
// the walk must not read past its own window).
function readIdAt(bytes: Uint8Array, off: number, end: number): { width: number; value: number } | null {
  const first = bytes[off];
  if (first === undefined || first === 0) return null;
  let width = 1;
  while (width <= 4 && !(first & (0x80 >> (width - 1)))) width++;
  if (width > 4 || off + width > end) return null;
  let value = 0;
  for (let i = 0; i < width; i++) value = value * 256 + bytes[off + i]!;
  return { width, value };
}

// Does the SeekHead already carry an entry whose SeekID is `seekId`? (Set on a
// re-stamp — the prior stamp added it, and the replacement attachment lands at
// the same position, so the entry stays correct.)
function seekHeadHasEntry(bytes: Uint8Array, scan: { elements: EbmlEl[] }, seekId: Uint8Array): boolean {
  const sh = scan.elements.find((e) => e.id === SEEKHEAD && !e.unknown);
  if (!sh) return false;
  const start = sh.off + sh.idWidth + sh.sizeWidth;
  const end = start + sh.size;
  const needle = concatBytes([Uint8Array.of(0x53, 0xab), writeVint(seekId.length)!, seekId]); // SeekID element
  outer: for (let i = start; i + needle.length <= end; i++) {
    for (let j = 0; j < needle.length; j++) if (bytes[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

interface Container {
  place: (container: Uint8Array, manifest: Uint8Array) => PlaceResult;
  mime: string;
  hash?: string;
}

const CONTAINERS: Record<string, Container> = {
  png: { place: placePng, mime: 'image/png' },
  apng: { place: placePng, mime: 'image/png' },
  jpg: { place: placeJpeg, mime: 'image/jpeg' },
  jpeg: { place: placeJpeg, mime: 'image/jpeg' },
  gif: { place: placeGif, mime: 'image/gif' },
  svg: { place: placeSvg, mime: 'image/svg+xml' },
  tiff: { place: placeTiff, mime: 'image/tiff' },
  'cmyk-tiff': { place: placeTiff, mime: 'image/tiff' },
  webp: { place: placeWebp, mime: 'image/webp' },
  mp4: { place: placeMp4, mime: 'video/mp4', hash: 'bmff' },
  webm: { place: placeWebm, mime: 'video/webm' },
};

/** Formats embedC2pa can stamp (plus 'pdf'/'pdf-cmyk' via embedC2paInPdf). */
export const C2PA_FORMATS = Object.freeze(['pdf', 'pdf-cmyk', ...Object.keys(CONTAINERS)]);

/**
 * Embed a signed C2PA manifest into any supported container. `format` is the
 * export format string ('png', 'jpg', 'svg', 'gif', 'tiff', 'cmyk-tiff',
 * 'webp', 'apng', 'mp4', 'webm', 'pdf', 'pdf-cmyk'); PDF routes to the
 * incremental-update embedder, everything else through the container placers
 * above. A container with hash: 'bmff' gets the box-walking c2pa.hash.bmff.v2
 * binding instead of byte-range exclusions. Options:
 * { title, claimGenerator, generatorInfo, environment, author, dates, signer }
 * — signer as documented on buildC2paManifest (external CA-issued credential;
 * the ephemeral self-signed one is generated when absent).
 */
export async function embedC2pa(bytes: Uint8Array, format: string, opts: EmbedOptions = {}): Promise<Uint8Array> {
  if (!(bytes instanceof Uint8Array)) throw new Error('C2PA embed: bytes must be a Uint8Array');
  const fmt = String(format || '').toLowerCase();
  if (fmt === 'pdf' || fmt === 'pdf-cmyk') return embedC2paInPdf(bytes, opts);
  const container = CONTAINERS[fmt];
  if (!container) throw new Error(`C2PA embed: no embedding for format '${format}'`);
  const isBmff = container.hash === 'bmff';

  const { title, claimGenerator, generatorInfo, environment, author, authorship, actions, ingredients, dates = {}, signer } = opts;
  // As in embedC2paInPdf: signer + chain bytes frozen once per embed so every
  // pass across the two-pass layout signs identical protected-header bytes.
  const sig: Signer = signer ?? (await generateSigner(dates));
  const internals = {
    signer: { ...sig, sign: sig.sign && sig.sign.bind(sig), chain: sig.chain ?? [sig.certDer!] },
    manifestLabel: urnUuid(),
    instanceId: urnUuid(),
  };
  const pad = new Uint8Array(8);
  const dummyHash = new Uint8Array(32);
  const build = (hash: Uint8Array, exclusions: Exclusion[], padBytes: Uint8Array): Promise<Uint8Array> => buildC2paManifest({
    title, claimGenerator, generatorInfo, environment, author, authorship, actions, ingredients, dates, format: container.mime,
    assetHash: isBmff ? { bmff: true, hash, pad: padBytes } : { exclusions, hash, pad: padBytes },
    ...internals,
  });

  // Pass 1: fixed point between manifest length and the exclusion offsets its
  // placement produces (offsets feed back into CBOR integer widths; the BMFF
  // assertion carries no offsets, so it converges immediately).
  let manifestLen = (await build(dummyHash, [{ start: bytes.length + 512, length: 4096 }], pad)).length;
  let layout: PlaceResult | null = null;
  let placeholder: Uint8Array | null = null;
  for (let round = 0; round < 8 && !layout; round++) {
    const probe = container.place(bytes, new Uint8Array(manifestLen));
    const m = await build(dummyHash, probe.exclusions, pad);
    if (m.length === manifestLen) { layout = probe; placeholder = m; }
    else manifestLen = m.length;
  }
  if (!layout) throw new Error('C2PA embed: manifest layout did not converge');

  // Hash the placed output with the manifest's home OMITTED — by byte range
  // for most containers, by the BMFF box walk for mp4.
  const digestOf = async (out: Uint8Array): Promise<Uint8Array> => {
    if (isBmff) return bmffDigest(out);
    const spans: Uint8Array[] = [];
    let at = 0;
    for (const e of [...layout!.exclusions].sort((a, b) => a.start - b.start)) {
      spans.push(out.subarray(at, e.start));
      at = e.start + e.length;
    }
    spans.push(out.subarray(at));
    return sha256(concatBytes(spans));
  };
  const staged = container.place(bytes, placeholder!);
  const digest = await digestOf(staged.out);

  // Pass 2: real digest, same length (pad absorbs residual CBOR drift).
  let manifest = await build(digest, layout.exclusions, pad);
  if (manifest.length !== manifestLen) {
    const padLen = pad.length + (manifestLen - manifest.length);
    if (padLen < 0 || padLen >= 24) throw new Error('C2PA embed: manifest length drifted beyond pad range');
    manifest = await build(digest, layout.exclusions, new Uint8Array(padLen));
    if (manifest.length !== manifestLen) throw new Error('C2PA embed: manifest length is not deterministic');
  }
  const final = container.place(bytes, manifest);
  // The placer contract: bytes outside the exclusions depend only on manifest
  // LENGTH — so the digest computed against the placeholder must still be the
  // digest of the final file. Verify rather than trust.
  const check = await digestOf(final.out);
  for (let i = 0; i < 32; i++) {
    if (check[i] !== digest[i]) throw new Error('C2PA embed: container placement is not content-independent');
  }
  return final.out;
}
