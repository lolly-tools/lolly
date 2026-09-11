// SPDX-License-Identifier: MPL-2.0
/**
 * beam-pack - what a **Beam** actually carries, and what happens to it on arrival
 * (plan 100 section 6.4, section 11.15a, section 11.16, section 11.18, section 11.24).
 *
 * `collab/beam-protocol.ts` is the wire: frames, consent, ordering, integrity. It
 * knows nothing about sessions, uploads, or IndexedDB. THIS module is the
 * other half - the two ends that touch the user's own data:
 *
 *   - **build** (`buildBeamOffer`) turns a saved session, a hand-picked set of files,
 *     or "everything tagged *event-berlin*" into the protocol's offer + a byte source;
 *   - **ingest** (`ingestBeamItem`) turns one received item back into a row in the
 *     receiver's own library or a new session slot.
 *
 * ── The pack layout ───────────────────────────────────────────────────────────
 *
 * A beam is NOT a zip. section 6.4 says "nothing new on disk format", and the backup bundle
 * (`data-transfer.ts`) already answers the shape question: metadata in one JSON part
 * (`assets.json`), each file's bytes in a part of their own (`assets/blobs/*`). A beam
 * uses that same split, streamed instead of archived:
 *
 *   item 0        `lolly/beam-manifest`  the JSON manifest: kind, name, one entry per
 *                                        payload item, plus the by-reference entries
 *                                        that carry no payload at all
 *   items 1…k     one per user-local ASSET, the stored blob's bytes, verbatim
 *   items k+1…n   one per SESSION, the `SavedStateData` JSON
 *
 * A zip would lose the two properties the beam needs. Byte-exactness: a
 * received asset's checksum must equal the one the sender's catalog already holds,
 * or receiver-side dedup stops being a string compare and C2PA credentials stop
 * surviving the trip (section 6.4). And streaming: the protocol discloses a per-item size and
 * stages each item as it lands (section 11.15a), which a single archive member cannot do.
 *
 * **Assets before sessions is essential, not tidiness.** A session's asset refs are
 * rewritten to the receiver's re-keyed ids at ingest (section 11.18), so every asset a session
 * points at must already have landed - and the protocol sends items strictly in
 * declared order, so ordering them here is the whole mechanism.
 *
 * ── The closure rule (section 11.16, stated so it can be tested) ─────────────────────
 *
 * "Send the assets this session uses" means exactly the ones the receiver could not
 * otherwise resolve. Walking the saved session JSON, every asset ref lands in one of
 * three buckets:
 *
 *   - `source: 'user'` (an upload, a recording, a capture) - **transferred**. These
 *     exist on one device only; without them the session renders broken refs.
 *   - `source: 'library'` (a catalog asset) - **listed by reference, never sent**, as
 *     an `asset-ref` entry marked `resolve: 'local'`. Two reasons, and only one is
 *     size: a catalog asset is brand-pack content, not the user's own work, so beaming
 *     it would push a private brand pack across a profile boundary that the receiver
 *     never opted into. A receiver on the same profile resolves it for free; a
 *     receiver on a different one gets the existing broken-ref affordance and the
 *     manifest says plainly which ids those were. That is section 11.16's cross-profile
 *     honesty: the pack never claims a cross-profile render will be faithful.
 *   - a **baked** ref (`meta.baked === true`) - nothing to do, its bytes ride inside
 *     the session JSON as a `data:` URL and resolve on any device.
 *
 * ── Ingest (section 11.18) ──────────────────────────────────────────────────────────
 *
 *   - **Ids are re-keyed.** A user-upload id is receiver-local, unlike the permanent
 *     catalog-id contract, so an arriving asset gets a fresh `user/beam/*` id and the
 *     session's refs are rewritten to match. Nothing on the receiver is addressed by
 *     a sender-chosen id, so a peer cannot aim a write at an id it guessed.
 *   - **Dedup by checksum.** An identical asset already in the library is reused: no
 *     second row, no second copy of the bytes, and the re-key map points the session's
 *     refs at the row that was already there.
 *   - **Sessions never overwrite.** A received session is a NEW slot, always, and its
 *     `__label` is suffixed "(from <name>)" so the library says where it came from.
 *   - **Byte-exactness.** Bytes are stored exactly as they arrived - no re-encode, no
 *     re-wrap, no downscale (which is why this does NOT go through the picker's
 *     `storeUserUpload`, whose job is normalising an unknown file). The digest
 *     is checked against the manifest before the write and, by default, re-read from
 *     the store and checked again after it, so "in === out" is asserted, not assumed.
 *     The ONE deliberate exception is markup (section 11.22, below), which is sanitised -
 *     and markup is exactly the family that carries no C2PA hard binding, so nothing
 *     the byte-exactness rule exists to protect is inside it.
 *   - **Nothing the peer SAYS about a file describes the row.** See below.
 *
 * ── What a beam does not trust (section 11.21, section 11.22, section 11.24) ──────────────────────
 *
 * The manifest is peer-controlled input, and the receiver's own device is what acts on
 * it. Three classes of manifest field used to be essential on the receiving side.
 * They are now derived from the BYTES instead, because a declaration is not evidence:
 *
 *   - **`type` / `format` / MIME.** Sniffed (`sniffFormat`/`sniffContainer`) from the
 *     received bytes. A peer-declared `type: 'audio', format: 'wav'` is exactly the
 *     shape `lib/tts-provenance.ts` uses to re-arm the on-device speech credential
 *     heal, which would make the receiver's own enrolled identity sign the SENDER's
 *     bytes as its own AI synthesis. Unsniffable bytes fall back to a whitelisted
 *     peer LABEL with the MIME forced to `application/octet-stream`, never `vector` -
 *     so no unrecognised blob can present as markup, and no object URL of one is
 *     executable in this origin.
 *   - **Provenance.** `credential`/`aiGenerated` are not on the wire at all. What a
 *     received file carries is read out of it here with the same `extractC2paStore`
 *     the upload path uses (`views/picker.ts`), so an AI origin can neither be
 *     laundered away by omitting it from the manifest nor asserted onto a photo that
 *     has none. The honest cost, stated: a sender whose record held a SIDECAR chain
 *     that no longer binds to its own stored bytes does not get that chain re-asserted
 *     on the receiver's device - re-asserting an unverifiable claim is exactly what
 *     this refuses to do.
 *   - **`meta`.** Bounded and key-filtered ({@link META_REJECTED_KEYS}): Lolly's own
 *     bookkeeping keys never arrive from outside, and no string value may carry a
 *     remote URL scheme - `views/catalog.ts` paints `meta.thumbUrl` straight into an
 *     `<img src>`, so an unfiltered one would turn accepting a beam into an outbound
 *     beacon. The same rule governs a received session's `thumb`, which must be a
 *     `data:` image or nothing.
 *
 * Markup is sanitised. Bytes that sniff as SVG go through DOMPurify before they are
 * stored, exactly as an upload does (`views/picker.ts`'s "script bytes never reach
 * disk"), because a received SVG is later re-parsed and INLINED by the vector export
 * path - a peer's `<script>` would otherwise ride into a file the receiver exports
 * under their own name. The sanitiser is injected ({@link BeamSvgSanitiser}) and the
 * default fails CLOSED: a runtime with no DOM refuses the item rather than storing it.
 *
 * ── Where the heavy work runs (section 11.15a) ──────────────────────────────────────
 *
 * Hashing is the expensive part of a build (a tag pack is tens of MB) and it is the
 * one part that is pure and DOM-free, so it runs in `beam-pack-worker.ts`. The worker
 * imports the SAME `sriSha256` the receiver verifies with - one implementation, so a
 * worker and a fallback build can never disagree about the same bytes. If worker
 * construction fails (no `Worker`, a CSP that refuses it, a headless test), the build
 * falls back to hashing in place. The API is async either way, so no caller can tell.
 */

import { extractC2paStore, sniffFormat } from '../../../../engine/src/c2pa-extract.ts';
import { sniffContainer } from '../../../../engine/src/media-sniff.ts';
import { assetDependency } from '../../../../engine/src/asset-version.ts';
import { resolveSessionUserAsset, rebaseImportedAssetPins } from './session-asset-versions.ts';
import {
  MAX_ITEM_BYTES,
  MAX_MESSAGE_CHARS,
  MAX_TOTAL_BYTES,
  sriSha256,
} from '../collab/beam-protocol.ts';
import type { BeamItem, BeamKind, BeamOfferDraft, BeamSource } from '../collab/beam-protocol.ts';
import { loadNamespace, tRaw } from '../i18n.ts';

// ── Copy ──────────────────────────────────────────────────────────────────────
//
// One map, one namespace. Every word this module shows a human lives here. The
// consent sheet reads the offer's `name` and each item's `label` straight off the
// wire, and the attribution written onto a received row is read back in the library.
// Each value IS its own catalog key (i18n.ts looks a translation up by the English
// source), and every use below goes through `tRaw(…)`, which fills the `{slot}`
// placeholders in the same call. Use `tRaw`, not `t`: none of this reaches an HTML
// sink. It becomes a pack label, a library row's name, or a note on a stored asset,
// and escaping a name into `O&#39;Brien` would persist it that way.
//
// These strings are WRITTEN INTO DATA, not only painted: a received session's label and
// a received file's note are stored. They are stored in whatever language the receiving
// device was set to when the transfer landed. That is the honest choice: it is that
// person's own library, and re-labelling their rows on a language switch would be worse.

export const STRINGS = {
  /** Item 0's label in the consent sheet - the pack's own details, not a file. */
  manifestLabel: 'Pack details',
  /** A saved session with no name of its own. */
  untitledSession: 'Untitled session',
  /** A file with no name of its own. */
  untitledAsset: 'Untitled file',
  /** Offer name for a hand-picked set of files. */
  filePack: '{count} files',
  /** Offer name when exactly one file was picked. */
  filePackOne: '1 file',
  /** Offer name for "everything tagged X". */
  tagPack: 'Everything tagged {tag}',
  /** A received session's name in the library. */
  receivedSession: '{label} (from {name})',
  /** Provenance written onto a received file. */
  receivedFrom: 'From {name}',
  /** Stand-in when the sender chose not to give a name. */
  someone: 'someone',
};

/**
 * Fill `{placeholder}` slots in a copy string.
 *
 * A named re-export of `tRaw`, kept so this module's test suite can use the verb it
 * always had. In English the two do the same substitution. In any other language
 * `tRaw` looks the source up in the `collab` catalog first.
 *
 * @deprecated for new code - call {@link tRaw} directly.
 */
export const fill = tRaw;

// ── Format ────────────────────────────────────────────────────────────────────

/** The manifest's `format` tag - the pack's own name, distinct from `lolly-backup`. */
export const BEAM_PACK_FORMAT = 'lolly-beam-pack';
/** The layout this build WRITES. Bump on any change to the entry set or shapes. */
export const BEAM_PACK_FORMAT_VERSION = 1;
/** The oldest reader that can still make sense of what we write. Readers gate on the
 *  manifest's `minReader`, never on `formatVersion` (the bundle rule, `lib/bundle.ts`),
 *  so an additive future pack still ingests here. */
export const BEAM_PACK_MIN_READER = 1;
/** The newest `minReader` this build can satisfy. */
export const BEAM_PACK_READER_VERSION = 1;

/** Item 0, always. A fixed id so a receiver recognises it before parsing anything. */
export const MANIFEST_ITEM_ID = 'lolly/beam-manifest';

/**
 * Payload items per pack, ABOVE which the builder refuses and the caller splits.
 *
 * Lower than the protocol's own `MAX_ITEMS` (512), for one concrete reason: the offer
 * is a single JSON control frame, and `decodeBeamMessage` caps a control frame at
 * `MAX_MESSAGE_CHARS` (128 KB). 512 items of id + label + SRI digest go over that
 * limit, so the pack would be refused by the receiver's parser, not by anything a
 * human could act on. The clamps below (id, label) plus this ceiling keep the worst
 * case comfortably inside the limit, and `buildBeamOffer` measures the encoded offer
 * anyway.
 */
export const PACK_MAX_ITEMS = 256;
/** Item ids are clamped well under the protocol's 128, to keep the offer frame small. */
export const PACK_MAX_ID_CHARS = 64;
/** Ditto labels, under the protocol's 200. */
export const PACK_MAX_LABEL_CHARS = 80;

/** The id namespace every beamed asset lands in. Receiver-local by construction
 *  (section 11.18), and distinguishable from `user/upload/*` in the manage-uploads UI. */
export const BEAM_ID_PREFIX = 'user/beam/';

// ── Manifest ──────────────────────────────────────────────────────────────────

/** One transferred user-local asset. `sourceId` is the SENDER's id: used to match a
 *  session's refs to their re-keyed replacements, never as an address here. */
export interface BeamPackAssetEntry {
  readonly kind: 'asset';
  /** The `BeamItem.id` this entry describes. */
  readonly itemId: string;
  readonly sourceId: string;
  readonly label: string;
  readonly bytes: number;
  readonly checksum: string;
  /** `AssetRef['type']` - raster/vector/video/audio/lottie/data/…
   *  A HINT ONLY: the receiver sniffs the bytes and uses this solely as a fallback
   *  label for a container it does not recognise. */
  readonly type: string;
  /** Ditto - a label, not a decision. */
  readonly format: string;
  /** The sender's stored Blob MIME. Advisory: the receiver derives the MIME it stores
   *  from the bytes, because a MIME is what makes an object URL executable. */
  readonly mime: string;
  readonly version?: string;
  readonly width?: number;
  readonly height?: number;
  /** Free-form sender metadata. Filtered on arrival - see {@link META_REJECTED_KEYS}. */
  readonly meta?: Record<string, unknown>;
}

/**
 * There is deliberately NO `credential`/`aiGenerated` on the wire.
 *
 * Provenance that is IN the bytes survives a beam because the bytes do (section 6.4). A
 * provenance CLAIM travelling beside them would let a peer tell the receiver's device
 * what to assert about a file, including "this is AI-generated" onto a photograph,
 * or the reverse: omitting the claim to launder a real AI origin away. The receiver
 * reads what is actually there (`extractC2paStore`) and asserts nothing else.
 */

/** One transferred saved session. The payload is the `SavedStateData` JSON. */
export interface BeamPackSessionEntry {
  readonly kind: 'session';
  readonly itemId: string;
  /** The sender's slot. Never reused: a received session always mints a new one. */
  readonly sourceId: string;
  readonly label: string;
  readonly bytes: number;
  readonly checksum: string;
  readonly toolId?: string;
  readonly toolVersion?: string;
  /** The session's thumbnail data-URL, so the received slot has a tile straight away. */
  readonly thumb?: string | null;
  /** What this session references, split by who can resolve it (the closure rule). */
  readonly uses: {
    /** Sender-local upload ids - every one of them is a payload item in this pack. */
    readonly user: readonly string[];
    /** Catalog ids - listed, never sent; see the `asset-ref` entries. */
    readonly library: readonly string[];
  };
}

/** A catalog asset a session uses. Carries NO payload item; the receiver resolves it
 *  from its own catalog, or shows a broken ref (section 11.16). The marker is the point. */
export interface BeamPackRefEntry {
  readonly kind: 'asset-ref';
  readonly sourceId: string;
  readonly label: string;
  readonly resolve: 'local';
}

export type BeamPackEntry = BeamPackAssetEntry | BeamPackSessionEntry | BeamPackRefEntry;

export interface BeamPackManifest {
  readonly format: typeof BEAM_PACK_FORMAT;
  readonly formatVersion: number;
  readonly minReader: number;
  readonly kind: BeamKind;
  readonly name: string;
  /** The sender's chosen display name (section 11.23: chosen, never leaked). Optional. */
  readonly fromName?: string;
  readonly entries: readonly BeamPackEntry[];
}

// ── Errors ────────────────────────────────────────────────────────────────────

export type BeamPackErrorCode =
  /** The source named nothing that can be sent. */
  | 'empty'
  /** More payload items than one pack may carry - split it. */
  | 'too-many-items'
  /** One item, or the whole pack, is past the protocol's ceiling. */
  | 'too-large'
  /** The saved session named by the source does not exist. */
  | 'no-session'
  /** The manifest item was malformed, or from a reader-incompatible writer. */
  | 'bad-manifest'
  /** The received bytes do not match the checksum they were offered under. */
  | 'checksum-mismatch'
  /** The item is not described by the manifest. */
  | 'unknown-item'
  /** The item is markup and this device has no way to make it safe to store. */
  | 'unsafe-item'
  /** The local store refused the write (quota, IDB failure). */
  | 'store-failed';

/** A typed failure, so a driver can say the true thing rather than surface a stack. */
export class BeamPackError extends Error {
  readonly code: BeamPackErrorCode;
  constructor(code: BeamPackErrorCode, message: string) {
    super(message);
    this.name = 'BeamPackError';
    this.code = code;
  }
}

// ── The host slice ────────────────────────────────────────────────────────────

/** One saved-session row, as `host.state.list()` returns it. */
export interface BeamSessionRow {
  slot: string;
  toolId?: unknown;
  toolVersion?: unknown;
  label?: unknown;
  thumb?: string | null;
}

/** One user-asset record, as the assets bridge stores it (`bridge/assets.ts`). Typed
 *  structurally rather than imported: that interface is not exported, and the same
 *  shape is what `data-transfer.ts` and `views/catalog.ts` already write against. */
export interface BeamAssetRecord {
  id: string;
  type: string;
  format: string;
  blob?: Blob;
  version?: string;
  checksum?: string;
  width?: number;
  height?: number;
  meta?: Record<string, unknown>;
  credential?: Uint8Array;
  credentialFormat?: string;
  aiGenerated?: 'full' | 'partial';
}

/** Exactly the bridge surface a beam touches - the `data-transfer.ts` pattern, so the
 *  whole build/ingest round trip runs headlessly against an in-memory host. */
export interface BeamPackHost {
  state: {
    list(): Promise<readonly BeamSessionRow[]>;
    load(slot: string): Promise<unknown>;
    save(slot: string, data: unknown, thumb?: string | null): Promise<unknown>;
    /** Undo one of THIS beam's own writes. Optional only so a build-side caller can
     *  pass a read-only host; without it a failed ingest cannot be rolled back, which
     *  {@link rollbackBeamIngest} reports rather than hides. */
    delete?(slot: string): Promise<unknown>;
  };
  assets: {
    _exportUserAssets(): Promise<readonly BeamAssetRecord[]>;
    _uploadUserAsset(record: BeamAssetRecord): Promise<unknown>;
    _getUserRecord?(id: string, version?: string): Promise<BeamAssetRecord | null>;
    /** Ditto - the compensating delete for a row this beam wrote. */
    _deleteUserAsset?(id: string): Promise<unknown>;
  };
  log?: (level: string, message: string, meta?: unknown) => void;
}

// ── What the BYTES say (never what the manifest claims) ──────────────────────

/** What a received file is, decided by reading it. */
export interface BeamAssetKind {
  /** `AssetRef['type']`. */
  readonly type: string;
  /** The stored row's format label. */
  readonly format: string;
  /** The MIME the stored Blob gets. Never a peer's string: a MIME is what decides
   *  whether an object URL of these bytes runs as a document in this origin. */
  readonly mime: string;
  /** Markup - must be sanitised before it is stored, and again on the way out. */
  readonly markup: boolean;
  /** False when nothing recognised the bytes and the peer's label was used. */
  readonly sniffed: boolean;
}

/** Sniffed container → what a row for it looks like. Two sniffers cover it: the C2PA
 *  reader's (`sniffFormat`: the credential-bearing image/av/pdf family, plus SVG) and
 *  the ingest backstop's (`sniffContainer`: bmp/archives/fonts). */
const KIND_BY_FORMAT: Readonly<Record<string, { type: string; format: string; mime: string; markup?: boolean }>> = {
  png:  { type: 'raster', format: 'png',  mime: 'image/png' },
  jpeg: { type: 'raster', format: 'jpg',  mime: 'image/jpeg' },
  gif:  { type: 'raster', format: 'gif',  mime: 'image/gif' },
  webp: { type: 'raster', format: 'webp', mime: 'image/webp' },
  avif: { type: 'raster', format: 'avif', mime: 'image/avif' },
  tiff: { type: 'raster', format: 'tiff', mime: 'image/tiff' },
  bmp:  { type: 'raster', format: 'bmp',  mime: 'image/bmp' },
  svg:  { type: 'vector', format: 'svg',  mime: 'image/svg+xml', markup: true },
  mp4:  { type: 'video',  format: 'mp4',  mime: 'video/mp4' },
  webm: { type: 'video',  format: 'webm', mime: 'video/webm' },
  mkv:  { type: 'video',  format: 'mkv',  mime: 'video/x-matroska' },
  mp3:  { type: 'audio',  format: 'mp3',  mime: 'audio/mpeg' },
  wav:  { type: 'audio',  format: 'wav',  mime: 'audio/wav' },
  pdf:  { type: 'data',   format: 'pdf',  mime: 'application/pdf' },
  zip:  { type: 'data',   format: 'zip',  mime: 'application/zip' },
  gzip: { type: 'data',   format: 'gz',   mime: 'application/gzip' },
  tar:  { type: 'data',   format: 'tar',  mime: 'application/x-tar' },
  ttf:  { type: 'font',   format: 'ttf',  mime: 'font/ttf' },
  otf:  { type: 'font',   format: 'otf',  mime: 'font/otf' },
  woff: { type: 'font',   format: 'woff', mime: 'font/woff' },
  woff2:{ type: 'font',   format: 'woff2', mime: 'font/woff2' },
};

/**
 * The `AssetRef['type']` values a peer's LABEL may still choose when nothing
 * recognised the bytes.
 *
 * `vector` is the one that is missing on purpose. It is the type the vector export path
 * re-parses and inlines as markup, so it may only ever be reached by bytes that
 * actually sniffed as SVG - and therefore went through the sanitiser.
 */
const FALLBACK_TYPES = new Set(['raster', 'video', 'audio', 'lottie', 'font', 'text', 'data']);

/** No sniffer knew these bytes, so nothing may treat them as a document. */
const OPAQUE_MIME = 'application/octet-stream';

/**
 * What to store a received file as, read out of the file (section 11.21).
 *
 * The manifest's `type`/`format` survive only as a label on an unrecognised container,
 * and even then the MIME is forced opaque. That is the whole defence against a peer
 * choosing the structure of the receiver's row: `lib/tts-provenance.ts` gates the on-device
 * speech-credential heal on `type: 'audio'` + `format: 'wav'`, and a Blob's MIME
 * decides whether its object URL can execute in this origin.
 */
export function sniffBeamAsset(bytes: Uint8Array, declared?: { type?: unknown; format?: unknown }): BeamAssetKind {
  const format = sniffFormat(bytes) ?? sniffContainer(bytes);
  const known = format ? KIND_BY_FORMAT[format] : undefined;
  if (known) return { type: known.type, format: known.format, mime: known.mime, markup: known.markup === true, sniffed: true };
  const label = safeText(declared?.type, 32, '');
  return {
    type: FALLBACK_TYPES.has(label) ? label : 'data',
    format: safeText(declared?.format, 32, 'bin').replace(/[^a-z0-9]/gi, '').slice(0, 16) || 'bin',
    mime: OPAQUE_MIME,
    markup: false,
    sniffed: false,
  };
}

/** Mirrors `views/picker.ts` / `bridge/assets.ts`: past this, a credential scan costs
 *  more than the credential is worth. */
const CREDENTIAL_SCAN_MAX_BYTES = 64 * 1024 * 1024;

/**
 * The C2PA manifest store these bytes actually carry, or null.
 *
 * This applies the upload path's rule (`views/picker.ts`) to the one other door
 * foreign bytes come in through: provenance is EXTRACTED, never accepted as a
 * declaration. The AI-disclosure flag is deliberately not set here at all.
 * `_uploadUserAsset` computes it from this store with the real verifier, which is
 * the only reading of it that counts as evidence rather than assertion.
 */
function provenanceOf(bytes: Uint8Array): { credential: Uint8Array; credentialFormat: string } | null {
  if (bytes.length > CREDENTIAL_SCAN_MAX_BYTES) return null;
  try {
    const found = extractC2paStore(bytes);
    return found ? { credential: found.store, credentialFormat: found.format } : null;
  } catch {
    return null;                        // a malformed container is not a reason to lose the file
  }
}

// ── Markup (the sanitiser seam) ───────────────────────────────────────────────

/** Make received markup safe to store, or throw. Injected so this module needs no DOM
 *  of its own and a headless caller can supply its own implementation. */
export type BeamSvgSanitiser = (bytes: Uint8Array) => Uint8Array | Promise<Uint8Array>;

/**
 * The default: DOMPurify's SVG profile, the same treatment an upload gets
 * (`views/picker.ts`). Sanitise to a DOM NODE and serialise with `XMLSerializer`, not
 * DOMPurify's HTML string output. That output turns a literal U+00A0 into `&nbsp;`,
 * which is undefined in XML and blanks the file on the next strict re-parse.
 *
 * It FAILS CLOSED. A runtime with no DOM (the CLI, a test, a worker) cannot make an
 * SVG safe, so it refuses the item instead of storing markup it did not read. This is
 * the opposite of the rest of this module's degrade-gracefully posture, on purpose:
 * everything else degrades toward losing a nicety; this would degrade toward writing
 * a peer's script to disk.
 */
async function defaultSanitizeSvg(bytes: Uint8Array): Promise<Uint8Array> {
  const g = globalThis as { DOMParser?: unknown; XMLSerializer?: unknown };
  if (typeof g.DOMParser !== 'function' || typeof g.XMLSerializer !== 'function') {
    throw new BeamPackError('unsafe-item', 'no SVG sanitiser on this device');
  }
  const DOMPurify = (await import('dompurify')).default;
  const dom = DOMPurify.sanitize(new TextDecoder().decode(bytes), {
    USE_PROFILES: { svg: true, svgFilters: true },
    RETURN_DOM: true,
  }) as unknown as ParentNode;
  const svg = dom.querySelector('svg');
  const clean = svg ? new XMLSerializer().serializeToString(svg) : '';
  // An "SVG" that does not survive with an <svg> root was not one. Storing the empty
  // result would be a blank asset; storing the original would be the hole this closes.
  if (!/<svg[\s>]/i.test(clean)) throw new BeamPackError('unsafe-item', 'nothing drawable survived sanitisation');
  return new TextEncoder().encode(clean);
}

// ── The asset-ref walk ────────────────────────────────────────────────────────

/**
 * Depth cap on the saved-session walk. A session is JSON, so it cannot be cyclic, but
 * it CAN be deep. On the ingest side it is peer-controlled input, where unbounded
 * recursion risks a stack overflow (section 11.21's JSON depth cap, applied to the one
 * recursive read this module does).
 */
const MAX_WALK_DEPTH = 64;

/** Every asset id a saved session references, split by who can resolve it. */
export interface SessionAssetRefs {
  /** Sender-local uploads - these must travel, or the session renders broken. */
  readonly user: readonly string[];
  /** Catalog assets - listed only; the receiver resolves them locally (section 11.16). */
  readonly library: readonly string[];
}

/** True for the object shape an `asset` input persists: a resolved `AssetRef`. */
function refIdOf(value: Record<string, unknown>): string | null {
  const id = value.id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

function isBaked(value: Record<string, unknown>): boolean {
  const meta = value.meta;
  return !!meta && typeof meta === 'object' && (meta as { baked?: unknown }).baked === true;
}

/** Which bucket a ref belongs to, or null when it is neither (a remote render, a tool
 *  URL, a plain object that merely happens to have an `id`). */
function refKind(value: Record<string, unknown>, id: string): 'user' | 'library' | null {
  const source = value.source;
  if (source === 'user') return 'user';
  if (source === 'library') return 'library';
  if (source !== undefined) return null;            // 'remote' and anything unknown
  // A saved value written before `source` existed, or a bare `{ id }` from URL mode.
  // The id namespace is the only evidence left, and `user/` is ours.
  if (id.startsWith('user/')) return 'user';
  return null;
}

/**
 * Walk a saved session and collect the asset ids it references. Order is stable
 * (first-seen), duplicates collapse, and a photo-treatment / theme modifier
 * (`<id>?treatment=warm`) resolves to its BASE id - the id the blob is stored under,
 * exactly as `bridge/state.ts`'s pruning walk does it.
 */
export function collectSessionAssetRefs(data: unknown): SessionAssetRefs {
  const user: string[] = [];
  const library: string[] = [];
  const seenUser = new Set<string>();
  const seenLibrary = new Set<string>();

  const walk = (value: unknown, depth: number): void => {
    if (!value || typeof value !== 'object' || depth > MAX_WALK_DEPTH) return;
    if (Array.isArray(value)) {
      for (const item of value) walk(item, depth + 1);
      return;
    }
    const record = value as Record<string, unknown>;
    const id = refIdOf(record);
    if (id !== null) {
      // A baked ref carries its own bytes in a `data:` URL. Nothing to send, and
      // nothing below it worth walking (that URL can be megabytes of base64).
      if (isBaked(record)) return;
      const kind = refKind(record, id);
      if (kind === 'user') {
        const base = assetDependency(record as { id: string }).key;
        if (!seenUser.has(base)) { seenUser.add(base); user.push(base); }
        return;
      }
      if (kind === 'library') {
        const base = assetDependency(record as { id: string }).key;
        if (!seenLibrary.has(base)) { seenLibrary.add(base); library.push(base); }
        return;
      }
    }
    for (const v of Object.values(record)) walk(v, depth + 1);
  };

  walk(data, 0);
  return { user, library };
}

/** What a ref rewrite did - enough for a driver to be honest about the result. */
export interface RefRewriteResult<T> {
  readonly data: T;
  /** Refs pointed at a re-keyed id. */
  readonly rewritten: number;
  /** User refs with no replacement in this pack: they will render as broken refs. */
  readonly unresolved: readonly string[];
}

/**
 * Rewrite a received session's user-asset refs to the receiver's re-keyed ids
 * (section 11.18). Pure, immutable, and the exact inverse of the closure rule above:
 *
 *   - a `user` ref whose base id is in `rekey` gets the new id (its modifier suffix
 *     rides along) and loses its `url`. A sender's `blob:` URL is meaningless here,
 *     and the runtime re-resolves any ref that carries an id anyway.
 *   - a `user` ref with no replacement is left untouched and REPORTED, so the caller
 *     can say so instead of the render silently losing an image.
 *   - `library` refs and baked refs are never touched. The receiver resolves the
 *     first from its own catalog and the second from its own bytes.
 */
export function rewriteSessionAssetRefs<T>(data: T, rekey: ReadonlyMap<string, string>): RefRewriteResult<T> {
  let rewritten = 0;
  const unresolved: string[] = [];
  const seenUnresolved = new Set<string>();

  const walk = (value: unknown, depth: number): unknown => {
    if (!value || typeof value !== 'object' || depth > MAX_WALK_DEPTH) return value;
    if (Array.isArray(value)) return value.map(item => walk(item, depth + 1));
    const record = value as Record<string, unknown>;
    const id = refIdOf(record);
    if (id !== null && !isBaked(record) && refKind(record, id) === 'user') {
      const dep = assetDependency(record as { id: string });
      const base = dep.key;
      const next = rekey.get(base);
      if (next === undefined) {
        if (!seenUnresolved.has(base)) { seenUnresolved.add(base); unresolved.push(base); }
        return record;
      }
      rewritten++;
      return { ...record, id: next + dep.modifier, ...(dep.pin ? { pin: dep.pin } : {}), source: 'user', url: '' };
    }
    const out: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(record)) out[key] = walk(v, depth + 1);
    return out;
  };

  return { data: walk(data, 0) as T, rewritten, unresolved };
}

// ── Hashing (the worker, and the fallback) ────────────────────────────────────

/** The narrow slice of `Worker` this module uses. Structural, so a test can stand in
 *  a fake without a DOM and without `lib.dom` types leaking into the contract. */
export interface BeamPackWorkerLike {
  postMessage(message: unknown): void;
  terminate(): void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export type BeamPackWorkerFactory = () => BeamPackWorkerLike;

/** One hash request/reply. Mirrored in `beam-pack-worker.ts`. */
interface HashReply {
  id?: number;
  checksums?: unknown;
  error?: unknown;
}

/** The real worker. `new URL(..., import.meta.url)` is the bundler-visible form the
 *  shell already uses for `audio-analyse-worker` and the speech workers. */
function defaultWorkerFactory(): BeamPackWorkerLike {
  return new Worker(new URL('./beam-pack-worker.ts', import.meta.url), { type: 'module' }) as unknown as BeamPackWorkerLike;
}

/** Hash in place. The section 11.15a fallback, and what the CLI-shaped/headless path uses. */
async function hashHere(blobs: readonly Blob[]): Promise<string[]> {
  const out: string[] = [];
  for (const blob of blobs) out.push(await sriSha256(new Uint8Array(await blob.arrayBuffer())));
  return out;
}

/** How long a worker may stay silent before the build gives up on it and hashes in
 *  place. Generous and size-scaled, because the fallback re-does the whole job. A
 *  premature timeout costs a second hash, never a wrong one. */
export function hashTimeoutFor(blobs: readonly Blob[]): number {
  let bytes = 0;
  for (const blob of blobs) bytes += blob.size;
  return 30_000 + Math.ceil(bytes / 1_000_000) * 1_000;
}

/**
 * SRI SHA-256 for each blob, off the main thread when that is possible at all.
 *
 * Blobs cross by structured clone, so the bytes are not copied into the message. The
 * worker reads each one and releases it before the next, which keeps a 38 MB pack
 * from sitting in renderer RAM (section 11.15a). Every failure mode resolves the same way,
 * by hashing in place: no `Worker` constructor, a CSP that refuses the URL, a worker
 * that dies mid-hash, or a worker that simply never answers (a throttled background
 * tab, a blob whose backing store went away mid-read). That last case is why there is
 * a timeout at all: `buildBeamOffer` awaits this before it emits ANYTHING, so a
 * silent worker would leave the sender with no offer, no error, and nothing to cancel.
 * The API is async either way, so a caller cannot tell which path ran, and the digest
 * is identical because both call the same `sriSha256`.
 */
export function hashBlobs(
  blobs: readonly Blob[],
  opts: { workerFactory?: BeamPackWorkerFactory | null; timeoutMs?: number } = {},
): Promise<string[]> {
  if (blobs.length === 0) return Promise.resolve([]);
  const factory = opts.workerFactory === undefined ? defaultWorkerFactory : opts.workerFactory;
  if (!factory) return hashHere(blobs);

  let worker: BeamPackWorkerLike;
  try {
    worker = factory();
  } catch {
    return hashHere(blobs);           // no Worker, a refusing CSP, a headless runtime
  }

  return new Promise<string[]>((resolve) => {
    let settled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const finish = (run: () => Promise<string[]> | string[]): void => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      worker.onmessage = null;
      worker.onerror = null;
      try { worker.terminate(); } catch { /* already gone */ }
      resolve(Promise.resolve(run()) as Promise<string[]>);
    };
    timer = setTimeout(() => finish(() => hashHere(blobs)), opts.timeoutMs ?? hashTimeoutFor(blobs));
    worker.onmessage = (event) => {
      const reply = (event?.data ?? {}) as HashReply;
      const list = reply.checksums;
      if (Array.isArray(list) && list.length === blobs.length && list.every(v => typeof v === 'string')) {
        finish(() => list as string[]);
        return;
      }
      // A worker that answered wrong is a broken worker, not a broken beam.
      finish(() => hashHere(blobs));
    };
    worker.onerror = () => finish(() => hashHere(blobs));
    try {
      worker.postMessage({ id: 1, blobs });
    } catch {
      finish(() => hashHere(blobs));  // a runtime that cannot clone a Blob into a worker
    }
  });
}

// ── Build ─────────────────────────────────────────────────────────────────────

/** What to beam. One argument, because a driver builds an offer from one intent. */
export type BeamPackSource =
  /** A saved tool session, plus exactly the user-local assets it references. */
  | {
      readonly from: 'session';
      readonly host: BeamPackHost;
      readonly slot: string;
      readonly name?: string;
      readonly fromName?: string;
      readonly workerFactory?: BeamPackWorkerFactory | null;
    }
  /** A hand-picked set of the user's own files. */
  | {
      readonly from: 'assets';
      readonly host: BeamPackHost;
      readonly ids: readonly string[];
      readonly name?: string;
      readonly fromName?: string;
      readonly workerFactory?: BeamPackWorkerFactory | null;
    }
  /** "Everything tagged X" - the tag pack (section 6.4). */
  | {
      readonly from: 'tag';
      readonly host: BeamPackHost;
      readonly tag: string;
      readonly name?: string;
      readonly fromName?: string;
      readonly workerFactory?: BeamPackWorkerFactory | null;
    };

/** A built pack: the protocol's offer, its byte source, and what is inside it. */
export interface BuiltBeamOffer {
  readonly offer: BeamOfferDraft;
  readonly manifest: BeamPackManifest;
  /** Feed straight to `createBeamSender({ source })`. */
  readonly source: BeamSource;
  readonly totalBytes: number;
  /** Catalog ids this pack expects the receiver to resolve locally (section 11.16). Surfaced
   *  so the sender's UI can say "3 brand images resolve on their device" honestly. */
  readonly byReference: readonly string[];
  /** Release the retained blobs once the beam is over. */
  dispose(): void;
}

/** Cut a string to `max` characters. Not the numeric clamp - this one takes text. */
function truncate(text: string, max: number): string {
  const s = String(text ?? '');
  return s.length <= max ? s : s.slice(0, max);
}

/** A pack-local item address. The index prefix guarantees uniqueness (the protocol
 *  refuses duplicate ids) even when two source ids truncate to the same string. */
function itemIdFor(index: number, sourceId: string): string {
  const head = `${index}/`;
  return head + truncate(sourceId, PACK_MAX_ID_CHARS - head.length);
}

function assetLabel(record: BeamAssetRecord): string {
  const name = record.meta?.name;
  return truncate(typeof name === 'string' && name ? name : (record.id.split('/').pop() || tRaw(STRINGS.untitledAsset)), PACK_MAX_LABEL_CHARS);
}

function sessionLabel(row: BeamSessionRow | undefined, data: Record<string, unknown>): string {
  const fromData = data.__label;
  const label = (typeof fromData === 'string' && fromData) ? fromData
    : (typeof row?.label === 'string' && row.label) ? row.label
    : tRaw(STRINGS.untitledSession);
  return truncate(label, PACK_MAX_LABEL_CHARS);
}

function tagsOf(record: BeamAssetRecord): string[] {
  const tags = record.meta?.tags;
  return Array.isArray(tags) ? tags.filter((v): v is string => typeof v === 'string') : [];
}

const encoder = new TextEncoder();

/**
 * Build the offer for one beam.
 *
 * Everything expensive happens once, here: the records are read, the blobs are hashed
 * (in the worker), and the manifest is sealed. After this returns, `source.read()` is
 * a pure slice, so the transport's pace is the only thing that governs the transfer.
 * That is the property `nextChunk()` backpressure depends on (section 11.6).
 */
export async function buildBeamOffer(source: BeamPackSource): Promise<BuiltBeamOffer> {
  // The pack's own labels (STRINGS) ride the lazy `collab` namespace. Awaited here, at
  // the one async door into building a pack, so a label is never minted in English on a
  // device set to another language. A no-op in English; a namespace that fails to load
  // leaves the labels English, which is i18n.ts's ordinary missing-key behaviour.
  await loadNamespace('collab');
  const host = source.host;
  const kind: BeamKind = source.from === 'session' ? 'session' : source.from === 'tag' ? 'tag-pack' : 'assets';

  // What travels, gathered first so the item ORDER (manifest, assets, sessions) is
  // decided in one place - the ordering the ingest re-key depends on.
  let sessionSlot: string | null = null;
  let sessionData: Record<string, unknown> | null = null;
  let sessionRow: BeamSessionRow | undefined;
  let wantedAssetIds: readonly string[] = [];
  let libraryIds: readonly string[] = [];

  if (source.from === 'session') {
    const loaded = await host.state.load(source.slot);
    if (!loaded || typeof loaded !== 'object') {
      throw new BeamPackError('no-session', `no saved session at ${source.slot}`);
    }
    sessionSlot = source.slot;
    sessionData = loaded as Record<string, unknown>;
    sessionRow = (await host.state.list()).find(r => r.slot === source.slot);
    const refs = collectSessionAssetRefs(sessionData);
    wantedAssetIds = refs.user;
    libraryIds = refs.library;
  }

  const records = await host.assets._exportUserAssets();
  const byId = new Map<string, BeamAssetRecord>();
  for (const record of records) if (record?.id) byId.set(record.id, record);

  let assets: BeamAssetRecord[];
  if (source.from === 'assets') {
    // Order follows the caller's selection; a missing id is skipped, not fatal - a
    // library changes under a user's hands, and a picked-then-deleted file should not
    // sink the whole beam.
    const seen = new Set<string>();
    assets = [];
    for (const id of source.ids) {
      const record = byId.get(id);
      if (record?.blob && !seen.has(id)) { seen.add(id); assets.push(record); }
    }
  } else if (source.from === 'tag') {
    const want = source.tag.trim().toLowerCase();
    assets = want
      ? records.filter(r => r.blob && tagsOf(r).some(tag => tag.trim().toLowerCase() === want))
      : [];
  } else {
    assets = [];
    for (const id of wantedAssetIds) {
      const record = await resolveSessionUserAsset(id, byId, host.assets._getUserRecord?.bind(host.assets));
      if (record?.blob) assets.push(record);
      // A ref pointing at an upload that no longer exists is already broken on THIS
      // device; it stays broken on the other one rather than failing the beam.
    }
  }

  if (assets.length === 0 && !sessionData) throw new BeamPackError('empty', 'nothing to beam');

  const sessionBytes = sessionData ? encoder.encode(JSON.stringify(sessionData)) : null;
  const payloadCount = assets.length + (sessionBytes ? 1 : 0);
  if (payloadCount + 1 > PACK_MAX_ITEMS) {
    throw new BeamPackError('too-many-items', `${payloadCount} items - split the pack`);
  }

  // The one genuinely expensive step, and the only one that leaves the main thread.
  const checksums = await hashBlobs(assets.map(r => r.blob!), { workerFactory: source.workerFactory });

  const entries: BeamPackEntry[] = [];
  const items: BeamItem[] = [];
  const payloads: (Blob | Uint8Array)[] = [];

  // Item 0 - the manifest. Its own bytes are filled in below, once the entries exist.
  items.push({ id: MANIFEST_ITEM_ID, label: tRaw(STRINGS.manifestLabel), bytes: 0, checksum: '' });
  payloads.push(new Uint8Array(0));

  assets.forEach((record, i) => {
    const index = items.length;
    const itemId = itemIdFor(index, record.id);
    const blob = record.blob!;
    const entry: BeamPackAssetEntry = {
      kind: 'asset',
      itemId,
      sourceId: record.id,
      label: assetLabel(record),
      bytes: blob.size,
      checksum: checksums[i]!,
      type: String(record.type ?? 'raster'),
      format: String(record.format ?? 'bin'),
      mime: blob.type || '',
      ...(record.version ? { version: record.version } : {}),
      ...(typeof record.width === 'number' ? { width: record.width } : {}),
      ...(typeof record.height === 'number' ? { height: record.height } : {}),
      ...(record.meta ? { meta: record.meta } : {}),
      // No credential/aiGenerated: see BeamPackAssetEntry. What is in the bytes travels
      // in the bytes; what is only claimed does not travel at all.
    };
    entries.push(entry);
    items.push({ id: itemId, label: entry.label, bytes: entry.bytes, checksum: entry.checksum });
    payloads.push(blob);
  });

  // The by-reference entries: catalog assets the session uses. No payload, a marker,
  // and the receiver's own catalog does the rest (section 11.16).
  for (const id of libraryIds) {
    entries.push({ kind: 'asset-ref', sourceId: id, label: truncate(id, PACK_MAX_LABEL_CHARS), resolve: 'local' });
  }

  // Sessions LAST - every asset they reference has landed and been re-keyed by the
  // time the receiver rewrites their refs.
  if (sessionBytes && sessionData && sessionSlot) {
    const index = items.length;
    const itemId = itemIdFor(index, sessionSlot);
    const entry: BeamPackSessionEntry = {
      kind: 'session',
      itemId,
      sourceId: sessionSlot,
      label: sessionLabel(sessionRow, sessionData),
      bytes: sessionBytes.length,
      checksum: await sriSha256(sessionBytes),
      ...(typeof sessionData.__toolId === 'string' ? { toolId: sessionData.__toolId } : {}),
      ...(typeof sessionData.__toolVersion === 'string' ? { toolVersion: sessionData.__toolVersion } : {}),
      ...(sessionRow?.thumb ? { thumb: sessionRow.thumb } : {}),
      uses: { user: assets.map(r => r.id), library: [...libraryIds] },
    };
    entries.push(entry);
    items.push({ id: itemId, label: entry.label, bytes: entry.bytes, checksum: entry.checksum });
    payloads.push(sessionBytes);
  }

  const name = truncate(
    source.name
      ?? (source.from === 'session' ? sessionLabel(sessionRow, sessionData ?? {})
        : source.from === 'tag' ? tRaw(STRINGS.tagPack, { tag: source.tag })
        : assets.length === 1 ? tRaw(STRINGS.filePackOne) : tRaw(STRINGS.filePack, { count: assets.length })),
    // The protocol clamps names at 120; keep the offer frame honest at the source.
    120,
  );

  const manifest: BeamPackManifest = {
    format: BEAM_PACK_FORMAT,
    formatVersion: BEAM_PACK_FORMAT_VERSION,
    minReader: BEAM_PACK_MIN_READER,
    kind,
    name,
    ...(source.fromName ? { fromName: truncate(source.fromName, PACK_MAX_LABEL_CHARS) } : {}),
    entries,
  };

  const manifestBytes = encoder.encode(JSON.stringify(manifest));
  items[0] = {
    id: MANIFEST_ITEM_ID,
    label: tRaw(STRINGS.manifestLabel),
    bytes: manifestBytes.length,
    checksum: await sriSha256(manifestBytes),
  };
  payloads[0] = manifestBytes;

  let totalBytes = 0;
  for (const item of items) {
    if (item.bytes > MAX_ITEM_BYTES) throw new BeamPackError('too-large', `${item.label} is ${item.bytes} bytes`);
    totalBytes += item.bytes;
  }
  if (totalBytes > MAX_TOTAL_BYTES) throw new BeamPackError('too-large', `${totalBytes} bytes`);

  // The offer is ONE control frame and the receiver's decoder caps a frame's length.
  // Measure the thing that will actually be sent rather than trusting the clamps - 
  // a pack refused by a parser is a worse failure than one refused here, by name.
  const framed = JSON.stringify({ v: 1, beamId: 'X'.repeat(26), t: 'offer', kind, name, items, totalBytes });
  if (framed.length > MAX_MESSAGE_CHARS) {
    throw new BeamPackError('too-many-items', `offer frame is ${framed.length} chars - split the pack`);
  }

  let live: (Blob | Uint8Array)[] | null = payloads;

  const byteSource: BeamSource = {
    async read(itemIndex, offset, length) {
      const payload = live?.[itemIndex];
      if (!payload) throw new BeamPackError('unknown-item', `no payload for item ${itemIndex}`);
      if (payload instanceof Uint8Array) return payload.subarray(offset, offset + length);
      return new Uint8Array(await payload.slice(offset, offset + length).arrayBuffer());
    },
  };

  return {
    offer: { kind, name, items },
    manifest,
    source: byteSource,
    totalBytes,
    byReference: [...libraryIds],
    dispose() { live = null; },
  };
}

// ── Ingest ────────────────────────────────────────────────────────────────────

/**
 * The state one beam's ingest carries between items: the manifest (item 0), and the
 * sender-id → receiver-id map the session rewrite reads. Held by the caller rather
 * than a module-global, so two beams can land at once and neither can see the other.
 */
export interface BeamIngestContext {
  readonly host: BeamPackHost;
  /** The peer's chosen display name, for attribution. Never a profile field (section 11.23). */
  readonly fromName?: string;
  /** Set by ingesting item 0. */
  manifest?: BeamPackManifest;
  /** Sender asset id → receiver asset id (section 11.18's re-key). */
  readonly rekey: Map<string, string>;
  /** Slots minted during THIS beam, so two sessions in one pack cannot collide. */
  readonly minted: Set<string>;
  /**
   * Every row and slot THIS beam has written, in write order - the undo log
   * {@link rollbackBeamIngest} replays backwards. A deduped asset is NOT here: no row
   * was written for it, and deleting the one that was already there would destroy the
   * receiver's own file.
   */
  readonly written: BeamWrite[];
  /**
   * Re-read each stored asset and check its digest after the write (default true).
   * The plan's promise is that a beam is byte-exact; this is the assertion of it
   * rather than the assumption. Costs one extra read per received file.
   */
  readonly verifyStored?: boolean;
  /** How markup is made safe before it is stored. Defaults to DOMPurify's SVG profile,
   *  which refuses the item on a runtime with no DOM. */
  readonly sanitizeSvg?: BeamSvgSanitiser;
}

/** One thing this beam put on the device. */
export type BeamWrite =
  | { readonly kind: 'asset'; readonly id: string }
  | { readonly kind: 'session'; readonly slot: string };

/** Start an ingest. One per beam. */
export function createBeamIngest(
  host: BeamPackHost,
  opts: { fromName?: string; verifyStored?: boolean; sanitizeSvg?: BeamSvgSanitiser } = {},
): BeamIngestContext {
  return {
    host,
    ...(opts.fromName ? { fromName: opts.fromName } : {}),
    rekey: new Map(),
    minted: new Set(),
    written: [],
    verifyStored: opts.verifyStored !== false,
    ...(opts.sanitizeSvg ? { sanitizeSvg: opts.sanitizeSvg } : {}),
  };
}

/**
 * Undo everything this beam wrote (section 11.18's "no partial ingest", completed).
 *
 * `ingestBeamItem` is per-item by construction: the sink hands items over one at a
 * time, so a pack that fails on item 9 of 14 has already put eight rows on the device.
 * Without this, that leaves eight orphans attributed "From <peer>" with no session to
 * use them. That is a routine outcome of a quota refusal partway through a 38 MB
 * pack, not an exotic one.
 *
 * Replayed in REVERSE write order, so a session goes before the assets its refs point
 * at. Every delete is best-effort and independent: one failure is counted, and never
 * stops the rest. A host with no delete surface reports every write as `failed`,
 * which is the truth rather than a silent success.
 */
export async function rollbackBeamIngest(ctx: BeamIngestContext): Promise<{ removed: number; failed: number }> {
  let removed = 0;
  let failed = 0;
  for (const write of [...ctx.written].reverse()) {
    try {
      if (write.kind === 'asset') {
        if (!ctx.host.assets._deleteUserAsset) { failed++; continue; }
        await ctx.host.assets._deleteUserAsset(write.id);
      } else {
        if (!ctx.host.state.delete) { failed++; continue; }
        await ctx.host.state.delete(write.slot);
        ctx.minted.delete(write.slot);
      }
      removed++;
    } catch (err) {
      failed++;
      ctx.host.log?.('warn', `beam rollback could not undo ${write.kind}`, { write, error: String(err) });
    }
  }
  ctx.written.length = 0;
  ctx.rekey.clear();
  return { removed, failed };
}

/** Drop one write this beam made, and forget it. Best-effort: a store that cannot
 *  delete leaves the row, which the caller's own error already says is not usable. */
async function undoWrite(ctx: BeamIngestContext, write: BeamWrite): Promise<void> {
  const key = (w: BeamWrite): string => (w.kind === 'asset' ? `a:${w.id}` : `s:${w.slot}`);
  const at = ctx.written.findIndex(w => key(w) === key(write));
  if (at >= 0) ctx.written.splice(at, 1);
  try {
    if (write.kind === 'asset') await ctx.host.assets._deleteUserAsset?.(write.id);
    else if (ctx.host.state.delete) {
      await ctx.host.state.delete(write.slot);
      // Only now is the name free again. A store that cannot delete may still hold a
      // half-written slot under it, and reusing it would overwrite that.
      ctx.minted.delete(write.slot);
    }
  } catch (err) {
    ctx.host.log?.('warn', 'beam could not undo its own failed write', { write, error: String(err) });
  }
}

export type BeamIngestResult =
  | { readonly kind: 'manifest'; readonly manifest: BeamPackManifest }
  | {
      readonly kind: 'asset';
      /** The receiver-local id. Equals an existing row's id when deduped. */
      readonly id: string;
      readonly sourceId: string;
      readonly label: string;
      /** True when identical bytes were already here and no second row was written. */
      readonly deduped: boolean;
    }
  | {
      readonly kind: 'session';
      readonly slot: string;
      readonly label: string;
      /** Refs pointed at a re-keyed asset. */
      readonly rewritten: number;
      /** User refs this pack did not carry - they render as broken refs (section 11.16). */
      readonly unresolved: readonly string[];
    };

/** Parse + gate the manifest item. Peer-controlled input, so nothing is assumed. */
function parseManifest(text: string): BeamPackManifest {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BeamPackError('bad-manifest', 'manifest is not JSON');
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BeamPackError('bad-manifest', 'manifest is not an object');
  }
  const m = raw as Record<string, unknown>;
  if (m.format !== BEAM_PACK_FORMAT) throw new BeamPackError('bad-manifest', `format=${String(m.format)}`);
  // Gate on minReader, never the writer's formatVersion - an additive future pack
  // still ingests (the `lib/bundle.ts` rule, kept identical on purpose).
  const minReader = typeof m.minReader === 'number' ? m.minReader : Number.NaN;
  if (!Number.isFinite(minReader) || minReader > BEAM_PACK_READER_VERSION) {
    throw new BeamPackError('bad-manifest', `minReader=${String(m.minReader)}`);
  }
  if (!Array.isArray(m.entries)) throw new BeamPackError('bad-manifest', 'entries');
  const entries: BeamPackEntry[] = [];
  for (const raw2 of m.entries) {
    if (!raw2 || typeof raw2 !== 'object' || Array.isArray(raw2)) continue;
    const e = raw2 as Record<string, unknown>;
    // Unknown entry kinds are DROPPED, not fatal: a newer writer may describe things
    // this build has no idea what to do with, and its payload items simply have no
    // entry - which `ingestBeamItem` already reports as `unknown-item`.
    if (e.kind === 'asset' || e.kind === 'session' || e.kind === 'asset-ref') {
      entries.push(e as unknown as BeamPackEntry);
    }
  }
  return {
    format: BEAM_PACK_FORMAT,
    formatVersion: typeof m.formatVersion === 'number' ? m.formatVersion : 0,
    minReader,
    kind: (typeof m.kind === 'string' ? m.kind : 'assets') as BeamKind,
    name: typeof m.name === 'string' ? m.name : '',
    ...(typeof m.fromName === 'string' ? { fromName: m.fromName } : {}),
    entries,
  };
}

/**
 * Peer-controlled metadata, made safe to carry onto a local record (section 11.21 applied to
 * the one free-form field a beam has).
 *
 * `meta` is the assets bridge's open bag: the widest surface an ingest exposes, and
 * the one place where "the sender's own metadata rides along" collides with "a local
 * reader assumes this device wrote it". Four things are enforced:
 *
 *   - the well-known prototype keys never survive as own properties (JSON.parse
 *     produces them as data properties, and spread would carry them into the record);
 *   - {@link META_REJECTED_KEYS} - Lolly's own bookkeeping - never arrives from outside;
 *   - no string value anywhere inside may carry a fetchable/executable URL scheme;
 *   - the key count is capped and the whole thing must serialise inside a sane budget,
 *     so one received file cannot carry a megabyte of side data.
 */
const META_MAX_KEYS = 64;
const META_MAX_CHARS = 16 * 1024;
const META_MAX_DEPTH = 8;
const POISON_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Keys a peer may never write onto a row on this device, each because something local
 * reads it back as though THIS device had written it:
 *
 *   - `tts` - `lib/tts-provenance.ts` re-arms the on-device speech-credential heal off
 *     `meta.tts.text`/`.voice`, and `views/catalog.ts` fires that heal automatically
 *     when the details dialog opens. Carrying a peer's block would make the receiver's
 *     own enrolled identity sign the SENDER's audio as its own AI synthesis, rewriting
 *     the received bytes to do it;
 *   - `aiGenerated`/`credential`/`credentialFormat`/`c2pa` - provenance is read from
 *     the bytes (see {@link sniffBeamAsset}'s neighbours), never declared;
 *   - `beamFrom`/`beamNote`/`beamSourceId` - this ingest's own attribution, written
 *     below. A peer choosing its own "From …" line is a forged origin;
 *   - `baked` - "my bytes are already in the ref", which the closure walk trusts;
 *   - the URL-bearing keys - `views/catalog.ts` paints `meta.thumbUrl` straight into an
 *     `<img src>` with no `source` guard, so one accepted beam would beacon out of the
 *     receiver's library on every paint.
 */
export const META_REJECTED_KEYS: readonly string[] = [
  'tts',
  'aiGenerated', 'credential', 'credentialFormat', 'c2pa',
  'beamFrom', 'beamNote', 'beamSourceId',
  'baked',
  'thumbUrl', 'posterUrl', 'animationUrl', 'url', 'src', 'href',
];
const REJECTED_KEYS = new Set(META_REJECTED_KEYS);

/** A string that would make something on this device reach out, or run. `data:` is the
 *  only scheme a beam has any business carrying - and not the two `data:` types that
 *  are documents. */
const FETCHABLE_URL = /^\s*(?:(?:https?|blob|filesystem|file|ftp|wss?|javascript|vbscript|about|chrome|resource):|\/\/)/i;
const DOCUMENT_DATA_URL = /^\s*data:\s*(?:text\/html|image\/svg\+xml|application\/xhtml)/i;

/** True for a string value that must not be carried onto a local row. */
function isUnsafeMetaText(value: string): boolean {
  return FETCHABLE_URL.test(value) || DOCUMENT_DATA_URL.test(value);
}

/** Ceiling on a received session's thumbnail data-URL. */
const MAX_THUMB_CHARS = 512 * 1024;
/** A session tile is a small raster `data:` URL and nothing else - never a remote URL
 *  (the tile is painted into `<img src>` by five different views), never an SVG. */
const THUMB_DATA_URL = /^data:image\/(?:png|jpeg|jpg|webp|gif|avif);base64,[A-Za-z0-9+/=\s]*$/;

function scrubMetaValue(value: unknown, depth: number): unknown {
  if (typeof value === 'string') return isUnsafeMetaText(value) ? undefined : value;
  if (!value || typeof value !== 'object') return value;
  if (depth >= META_MAX_DEPTH) return undefined;
  if (Array.isArray(value)) return value.map(v => scrubMetaValue(v, depth + 1)).filter(v => v !== undefined);
  const out: Record<string, unknown> = {};
  let keys = 0;
  for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
    if (POISON_KEYS.has(key) || REJECTED_KEYS.has(key)) continue;
    if (++keys > META_MAX_KEYS) break;
    const kept = scrubMetaValue(v, depth + 1);
    if (kept !== undefined) out[key] = kept;
  }
  return out;
}

function safeMeta(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const out = scrubMetaValue(value, 0) as Record<string, unknown> | undefined;
  if (!out) return undefined;
  try {
    if (JSON.stringify(out).length > META_MAX_CHARS) return undefined;
  } catch {
    return undefined;                 // not serialisable ⇒ not something we wrote
  }
  return out;
}

/** A peer-supplied string, bounded. Non-strings become the fallback, never `undefined`
 *  leaking into a field a local reader assumes is present. */
function safeText(value: unknown, max: number, fallback = ''): string {
  return typeof value === 'string' && value.length > 0 ? value.slice(0, max) : fallback;
}

/** The entry describing one payload item. `asset-ref` entries are excluded by type,
 *  not by accident: they are the entries that deliberately have no item. */
function entryFor(ctx: BeamIngestContext, itemId: string): BeamPackAssetEntry | BeamPackSessionEntry | null {
  const entries = ctx.manifest?.entries ?? [];
  for (const entry of entries) {
    if (entry.kind !== 'asset-ref' && entry.itemId === itemId) return entry;
  }
  return null;
}

/** A filename-safe tail for a minted id, so the manage-uploads list stays readable. */
function idTail(label: string, format: string): string {
  const base = label.replace(/[^a-z0-9.\-_]/gi, '_').slice(0, 48) || 'file';
  return base.includes('.') ? base : `${base}.${format.replace(/[^a-z0-9]/gi, '') || 'bin'}`;
}

/** Mint an id nothing on this device already uses. */
function mintAssetId(label: string, format: string, taken: ReadonlySet<string>): string {
  const tail = idTail(label, format);
  const stamp = Date.now();
  let id = `${BEAM_ID_PREFIX}${stamp}-${tail}`;
  for (let n = 2; taken.has(id); n++) id = `${BEAM_ID_PREFIX}${stamp}-${n}-${tail}`;
  return id;
}

/** Mint a slot nothing on this device already uses, and nothing in this beam has. */
function mintSlot(toolId: string, taken: ReadonlySet<string>): string {
  const stamp = Date.now();
  let slot = `${toolId}:${stamp}`;
  for (let n = 2; taken.has(slot); n++) slot = `${toolId}:${stamp}-${n}`;
  return slot;
}

/**
 * Id prefixes a dedup must never land on.
 *
 * `_exportUserAssets()` is a raw read of every `user-assets` row, but the user's LIBRARY
 * is not: `_listUserAssets` filters the machine-owned rows out (`bridge/assets.ts`), and
 * `bridge/version-assets.ts` says explicitly that a frozen row is "hidden from the
 * user's library listing". Deduping onto one would report "Saved to your library - N
 * files" while nothing appeared in Manage uploads, and would point the session that
 * follows at bytes the copy-on-write machinery owns and may reclaim. `user/tokens/*`
 * is excluded for the same reason: it is addressed by the token installer, not by a
 * received session's refs.
 */
export const MACHINE_ID_PREFIXES: readonly string[] = ['user/frozen/', 'user/tokens/'];

/** True when a row is one the user can actually see and act on. */
function isLibraryRow(id: string): boolean {
  return !MACHINE_ID_PREFIXES.some(prefix => id.startsWith(prefix));
}

/**
 * An existing row holding exactly these bytes, or null - the section 6.4 dedup.
 *
 * The size prefilter keeps this cheap: hashing is the whole cost, and only a row of
 * the identical byte length can possibly match. A row that already carries a
 * `checksum` (every beam-ingested one does, using the same string as the catalog
 * convention) is compared without touching its bytes at all. Ordinary uploads do NOT
 * carry a checksum (`views/picker.ts` writes none), so the slow path is the common
 * one, and the scan is size-bounded rather than free.
 */
async function findDuplicate(
  checksum: string,
  bytes: number,
  records: readonly BeamAssetRecord[],
): Promise<string | null> {
  for (const record of records) {
    if (!record.blob || record.blob.size !== bytes) continue;
    if (!isLibraryRow(String(record.id))) continue;
    if (record.checksum) {
      if (record.checksum === checksum) return record.id;
      continue;
    }
    if (await sriSha256(new Uint8Array(await record.blob.arrayBuffer())) === checksum) return record.id;
  }
  return null;
}

/**
 * Ingest ONE received item.
 *
 * Items arrive in the order the pack declared them: manifest, then assets, then
 * sessions. This function depends on that order: a session's refs are rewritten from
 * `ctx.rekey`, which the asset items filled in. Call it in receive order and nothing
 * else is required of the caller.
 *
 * `blob` is the staged bytes, exactly as they arrived, and, for everything except
 * markup, exactly what is stored: no re-encode, no downscale, no metadata strip. This
 * is why ingest does not reuse the picker's `storeUserUpload`, whose job is to
 * normalise an unknown file. Doing that here would change the bytes, break the checksum
 * the sender disclosed, and destroy the embedded C2PA binding the beam exists to
 * preserve (section 6.4). The digest is checked before the write and, by default, re-read from
 * the store and checked again after it. A read-back that disagrees deletes the row it
 * just wrote rather than leaving a corrupt one behind.
 *
 * Markup is the one exception: bytes that sniff as SVG go through the sanitiser
 * first, so what is stored is what the picker would have stored. Nothing that can
 * carry a C2PA hard binding is in that family, so byte-exactness stays intact exactly
 * where it matters.
 *
 * The manifest describes; it does not decide. `type`/`format`/MIME come from the bytes,
 * provenance is extracted from the bytes, `meta` is filtered, and the row's NAME is the
 * label the human was actually shown in the consent sheet (`item.label`), not the
 * manifest's own copy of it. A peer can make those two differ.
 *
 * Failures are per-item and clean up after themselves. Undoing items from BEFORE a
 * failure is the caller's job: {@link rollbackBeamIngest}.
 */
export async function ingestBeamItem(
  item: Pick<BeamItem, 'id' | 'label' | 'bytes' | 'checksum'>,
  blob: Blob,
  ctx: BeamIngestContext,
): Promise<BeamIngestResult> {
  await loadNamespace('collab'); // see buildBeamOffer - the attribution copy is written, not painted
  const bytes = new Uint8Array(await blob.arrayBuffer());

  // Integrity first, always: an item whose bytes are not the bytes it was offered
  // under never reaches storage. The protocol checks this too, as a second layer,
  // because this function is also the path a non-protocol driver (a file, a test)
  // uses, and the guarantee must not depend on which door was used.
  const actual = await sriSha256(bytes);
  if (item.checksum && actual !== item.checksum) {
    throw new BeamPackError('checksum-mismatch', `${item.id}: staged bytes ≠ ${item.checksum}`);
  }

  if (item.id === MANIFEST_ITEM_ID) {
    const manifest = parseManifest(new TextDecoder().decode(bytes));
    ctx.manifest = manifest;
    return { kind: 'manifest', manifest };
  }

  const entry = entryFor(ctx, item.id);
  if (!entry) throw new BeamPackError('unknown-item', `${item.id} is not in the manifest`);
  // The consent sheet was sized from the OFFER; the manifest is a second, separate
  // description of the same item. Where they disagree, the pack no longer describes
  // what was accepted, so it is refused rather than reconciled.
  if (typeof entry.bytes === 'number' && Number.isFinite(entry.bytes) && entry.bytes !== bytes.length) {
    throw new BeamPackError('bad-manifest', `${item.id}: manifest says ${entry.bytes} bytes, ${bytes.length} arrived`);
  }

  const from = safeText(ctx.fromName, PACK_MAX_LABEL_CHARS, tRaw(STRINGS.someone));
  // The disclosed label wins. `buildBeamOffer` keeps the two equal; a hostile sender
  // could offer "cat.png" and name the stored row something else entirely.
  const label = safeText(item.label, PACK_MAX_LABEL_CHARS, safeText(entry.label, PACK_MAX_LABEL_CHARS, tRaw(STRINGS.untitledAsset)));
  const sourceId = safeText(entry.sourceId, PACK_MAX_ID_CHARS * 2, '');

  if (entry.kind === 'asset') {
    // What this file IS, read out of it - never what the manifest says it is.
    const kind = sniffBeamAsset(bytes, entry);
    // Markup is sanitised before anything else touches it, and the sanitised bytes are
    // what everything downstream (dedup, digest, the row) sees. The sanitiser throws
    // 'unsafe-item' when it cannot do the job, which is the whole point of it.
    const storedBytes = kind.markup ? await (ctx.sanitizeSvg ?? defaultSanitizeSvg)(bytes) : bytes;
    const storedChecksum = storedBytes === bytes ? actual : await sriSha256(storedBytes);

    const records = await ctx.host.assets._exportUserAssets();
    const existing = await findDuplicate(storedChecksum, storedBytes.length, records);
    if (existing) {
      // Dedup by checksum (section 6.4). The re-key still records the mapping, so a session
      // arriving later points at the row that was already here.
      if (sourceId) ctx.rekey.set(sourceId, existing);
      return { kind: 'asset', id: existing, sourceId, label, deduped: true };
    }

    const id = mintAssetId(label || sourceId, kind.format, new Set(records.map(r => r.id)));
    // Re-wrapping a Blob to attach its MIME copies the handle, not the bytes - the
    // digest below is over the same bytes either way.
    const stored = storedBytes === bytes
      ? (blob.type === kind.mime ? blob : new Blob([blob], { type: kind.mime }))
      : new Blob([storedBytes as unknown as BlobPart], { type: kind.mime });
    // Provenance comes out of the file. `aiGenerated` is deliberately left unset: the
    // assets bridge computes it from this store with the real verifier at write time.
    // That is the only reading of it that counts as evidence.
    const provenance = provenanceOf(storedBytes);
    const record: BeamAssetRecord = {
      id,
      type: kind.type,
      format: kind.format,
      blob: stored,
      checksum: storedChecksum,
      version: entry.version ? safeText(entry.version, 256, '1.0.0') : crypto.randomUUID(),
      ...(Number.isFinite(entry.width) ? { width: entry.width } : {}),
      ...(Number.isFinite(entry.height) ? { height: entry.height } : {}),
      ...(provenance ?? {}),
      meta: {
        ...(safeMeta(entry.meta) ?? {}),
        name: label,
        // Attribution (section 6.4: received items land attributed). `meta` is the record's
        // free-form field; there is no dedicated provenance column. So the source
        // is written both as data (`beamFrom`) and as copy (`beamNote`), and the
        // sender's own id is kept so a re-beam can be recognised as the same file.
        // Written LAST so a peer's own `meta` cannot pre-empt any of the three
        // (they are also rejected on the way in, as a second layer).
        beamFrom: from,
        beamNote: tRaw(STRINGS.receivedFrom, { name: from }),
        beamSourceId: sourceId,
      },
    };

    try {
      await ctx.host.assets._uploadUserAsset(record);
    } catch (err) {
      throw new BeamPackError('store-failed', `${label}: ${err instanceof Error ? err.message : String(err)}`);
    }
    ctx.written.push({ kind: 'asset', id });

    // "In === out", asserted rather than assumed: the bytes are read back out of the
    // store and re-digested. Without this, the byte-exactness promise (section 6.4, and the
    // C2PA binding that depends on it) would rest on nobody ever adding a normalising
    // step to the write path. A disagreement DELETES the row: otherwise the failure
    // this catches would leave a permanently corrupt file in the library plus a
    // failed beam, which is strictly worse than not writing it at all.
    if (ctx.verifyStored !== false && ctx.host.assets._getUserRecord) {
      const back = await ctx.host.assets._getUserRecord(id);
      const outBytes = back?.blob ? new Uint8Array(await back.blob.arrayBuffer()) : null;
      const out = outBytes ? await sriSha256(outBytes) : null;
      if (out !== storedChecksum) {
        await undoWrite(ctx, { kind: 'asset', id });
        throw new BeamPackError('checksum-mismatch', `${id}: stored bytes ≠ received bytes`);
      }
    }

    if (sourceId) ctx.rekey.set(sourceId, id);
    return { kind: 'asset', id, sourceId, label, deduped: false };
  }

  // A session. Never overwrites: a new slot, always (section 11.18).
  let data: Record<string, unknown>;
  try {
    const parsed = JSON.parse(new TextDecoder().decode(bytes));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object');
    data = parsed as Record<string, unknown>;
  } catch {
    throw new BeamPackError('bad-manifest', `${item.id}: session payload is not a saved session`);
  }

  const { data: mapped, rewritten, unresolved } = rewriteSessionAssetRefs(data, ctx.rekey);
  const rewrittenData = rebaseImportedAssetPins(mapped, ctx.rekey, await ctx.host.assets._exportUserAssets());
  const toolId = safeText(rewrittenData.__toolId, 128, safeText(entry.toolId, 128, 'session'));
  const sessionLabel = tRaw(STRINGS.receivedSession, { label, name: from });
  // A session thumbnail is a small data-URL (the shell captures ~tens of KB). Anything
  // past the cap is not really a thumbnail, and a session with no tile is a far
  // smaller loss than a megabyte of base64 in a slot record. It must also BE a raster
  // data-URL: five views paint this string straight into an `<img src>`, so a remote
  // URL here would be a tracking pixel on every gallery paint, and an SVG one would
  // be markup nobody sanitised.
  const thumb = typeof entry.thumb === 'string'
    && entry.thumb.length <= MAX_THUMB_CHARS
    && THUMB_DATA_URL.test(entry.thumb)
    ? entry.thumb
    : null;

  const taken = new Set<string>(ctx.minted);
  for (const row of await ctx.host.state.list()) taken.add(row.slot);
  const slot = mintSlot(toolId, taken);
  ctx.minted.add(slot);

  try {
    await ctx.host.state.save(slot, { ...rewrittenData, __label: sessionLabel }, thumb);
  } catch (err) {
    // A save that threw may still have landed in part; the slot was minted either way.
    // Drop it rather than leave a half-written session behind a failed beam.
    await undoWrite(ctx, { kind: 'session', slot });
    throw new BeamPackError('store-failed', `${sessionLabel}: ${err instanceof Error ? err.message : String(err)}`);
  }
  ctx.written.push({ kind: 'session', slot });

  return { kind: 'session', slot, label: sessionLabel, rewritten, unresolved };
}
