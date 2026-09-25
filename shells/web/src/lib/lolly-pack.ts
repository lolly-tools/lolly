// SPDX-License-Identifier: MPL-2.0
/**
 * The `.lolly` share file - one saved tool session, the assets it references, and a
 * provenance block on who made it, in a single portable zip.
 *
 * It exists because a share LINK cannot carry everything (plans/114): device-local
 * uploads never ride in a URL, and long text / big designs blow the URL ceiling. A
 * `.lolly` is the faithful vehicle - the thing you download, AirDrop, or beam when a
 * link would open empty.
 *
 * Architecturally it is the intersection of two shapes the codebase already has:
 *   - the signed-zip ENVELOPE (`lib/bundle.ts`) that backups + brand packs speak
 *     (fflate entries, a `minReader`-gated manifest, an SRI integrity map, a README);
 *   - the beam's session CLOSURE (`collectSessionAssetRefs`) - exactly which assets a
 *     session references, split into device-local `user/*` and catalog `library`.
 *
 * The one deliberate DIFFERENCE from a beam: a `.lolly` carries the `library` bytes a
 * beam sends only by reference, so the file opens faithfully on a device that lacks
 * the sender's brand pack. Bytes the caller's redistribution() answer held back are
 * the exception - a brand-locked pack, and since plan 253 also a work whose licence
 * was never recorded or is not yet interpreted, because missing licence information
 * is not evidence of free redistribution. Those travel only behind an explicit
 * confirmation (`includeLicensed`), and CREDITS.txt records what happened either way.
 *
 * This module is PURE + DOM-free: the caller (the shell) fetches the session, the
 * user-asset records, and a `resolveLibrary` for catalog bytes, and assembles the
 * creator block; the round-trip test drives it headlessly against plain data.
 */

import { strToU8 } from 'fflate';
import type { Profile, UserTemplateRecord } from '@lolly-tools/core/host-v1';
import { mapTextFontAssets } from '../../../../engine/src/text-assets.ts';
import { assetDependency, encodeAssetVersion } from '../../../../engine/src/asset-version.ts';
import { ensureSceneManifest } from '../bridge/asset-dependencies.ts';
import { base64ToBytes, bytesToBin } from '../../../../engine/src/bytes.ts';
import { resolveSessionUserAsset, rebaseImportedAssetPins } from './session-asset-versions.ts';
import { zipAsync } from './zip.ts';
import {
  type BundleEntry,
  README_NAME,
  BUNDLE_HEADER,
  buildIntegrity,
  verifyIntegrity,
  unzipBundle,
  readJson,
} from './bundle.ts';
import {
  collectSessionAssetRefs,
  createBeamIngest,
  ingestBeamItem,
  rollbackBeamIngest,
  BEAM_PACK_FORMAT,
  BEAM_PACK_FORMAT_VERSION,
  type BeamAssetRecord,
  type BeamPackHost,
  type BeamPackAssetEntry,
  type BeamPackManifest,
  type BeamSvgSanitiser,
} from './beam-pack.ts';

// ── Format constants ──────────────────────────────────────────────────────────

export const LOLLY_FILE_FORMAT = 'lolly-share' as const;
export const LOLLY_FILE_VERSION = 1;
/** Readers gate on this, never `formatVersion` - additive parts stay compatible. */
export const LOLLY_MIN_READER = 1;
export const LOLLY_READER_VERSION = 4;
/** A project file (a folder tree and its sessions) needs a reader that knows the
 *  `project` kind, so it asks for 3: a reader from before it says "update" instead of
 *  opening the first session and dropping the rest. */
export const LOLLY_PROJECT_MIN_READER = 3;
/** The manifest's `tool.id` for a project file, which holds many tools' sessions. */
export const LOLLY_PROJECT_TOOL_ID = 'lolly-project';
/** Bounds on one project file, so a hostile archive cannot mint unbounded records. */
export const LOLLY_MAX_PROJECT_SESSIONS = 2000;
export const LOLLY_MAX_PROJECT_FOLDERS = 500;
/** The `+zip` structured suffix (RFC 6839) advertises the container to OS/tooling. */
export const LOLLY_MIME = 'application/vnd.lolly+zip';
export const LOLLY_EXT = '.lolly';
/** The sender's design system, as the DTCG document their studio holds. An additive part
 *  (readers before it simply see no `designSystem` in the manifest), so the file also
 *  carries the brand a session was made under - the design-system studio's "Add from a
 *  file" can bring it across without the sender's pack. */
export const DESIGN_SYSTEM_PART = 'design-system.json';
/** The templates the file carries (plans/226 section 4.7), as `{ templates: [...] }`.
 *  Additive exactly like `design-system.json`: `minReader` stays 1, so a reader that
 *  predates the part simply never looks for it and the file still opens as the document
 *  in `session.json`. On import the records are re-minted into the receiver's own store,
 *  so the sender's ids never travel as identity - only as content. */
export const TEMPLATES_PART = 'templates.json';
/** How many templates one file may hand over. A share is a handful, not a library;
 *  the cap bounds a hostile archive without needing a second size guard. */
export const LOLLY_MAX_TEMPLATES = 200;
/** The readable credits file (plan 253): what travelled, what did not and why.
 *  Written only when the closure held at least one catalog work, so an ordinary
 *  share of your own uploads carries no extra file. Additive: `minReader` stays 1
 *  and a reader that predates it simply never looks for it. */
export const CREDITS_PART = 'CREDITS.txt';

// ── Renovation projects (plan 274 section 3.5) ────────────────────────────────

/** The manifest's `tool.id` for a file whose payload is a renovation project. */
export const LOLLY_RENOVATION_TOOL_ID = 'lolly-renovation';
/** The project record: which source was renovated, the checkpoint, the design-system
 *  snapshot and the ids of the big parts. Small on purpose, so a reader can describe
 *  the file without inflating a census. */
export const RENOVATION_PROJECT_PART = 'renovation/project.json';
/** The four big parts, each written at `renovation/<kind>.json` when it exists. The
 *  names are `PROJECT_PART_KINDS` from the rebrand contract, kept as plain strings
 *  here so the envelope stays free of the renovation types themselves. */
export const RENOVATION_PART_KINDS = ['sourceDeck', 'census', 'plan', 'compiled'] as const;
export type LollyRenovationPartKind = (typeof RENOVATION_PART_KINDS)[number];
/** The one zip path a part of that kind may occupy. The reader compares the manifest's
 *  declared path against this, so nothing is ever read from a path the writer would
 *  not have written. */
export function renovationPartPath(kind: LollyRenovationPartKind): string {
  return `renovation/${kind}.json`;
}
/**
 * A renovation asks for reader 4, unlike `design-system.json` and `templates.json`
 * which are additive at reader 1.
 *
 * The difference is what an older reader would do with the file rather than what it
 * would miss. A renovation-only file carries no `session.json`, so a reader from
 * before this part opens it as an empty saved session and files that under the
 * renovation's tool id: the person is told the file opened, and what they get is a
 * blank document with the whole project silently dropped. "Update to open it" is the
 * true answer, so the gate says so.
 */
export const LOLLY_RENOVATION_MIN_READER = 4;
/** How many media refs one renovation may name. A deck's pictures, not a library;
 *  the cap bounds a hostile archive without needing a second size guard. */
export const LOLLY_MAX_RENOVATION_ASSETS = 5000;

/** The manifest block for a carried renovation project. */
export interface LollyRenovationManifest {
  /** The sender's project id. Re-minted on import, exactly like a folder id. */
  id: string;
  name: string;
  /** Always `RENOVATION_PROJECT_PART`; spelled out so the block reads on its own. */
  project: string;
  /** Zip path per big part that travelled. A part with nothing written is absent. */
  parts: Partial<Record<LollyRenovationPartKind, string>>;
  /** The media refs the project and its parts point at, in first-seen order. Their
   *  bytes ride in `manifest.assets` like every other carried asset. */
  assets: string[];
}

/** A renovation handed to the builder. The values travel verbatim as JSON; the
 *  rebrand contract types live in `@lolly-tools/core` and are checked by the caller
 *  (`lib/lolly-renovation.ts`), not by the envelope. */
export interface LollyRenovationInput {
  id: string;
  name: string;
  project: unknown;
  parts?: Partial<Record<LollyRenovationPartKind, unknown>>;
  assets?: readonly string[];
}

/** A read renovation: the project record and whichever parts the file carried. */
export interface LollyRenovationContents {
  id: string;
  name: string;
  project: Record<string, unknown>;
  parts: Partial<Record<LollyRenovationPartKind, Record<string, unknown>>>;
  assets: string[];
}

// Read caps - a .lolly can legitimately carry a video, so allow well past the
// brand-pack defaults while still bounding a malicious archive.
const LOLLY_MAX_ENTRY_BYTES = 512 * 1024 * 1024;
const LOLLY_MAX_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

// ── Types ─────────────────────────────────────────────────────────────────────

/** Who made this - embedded only with the user's opt-in (`Profile.useDetails`).
 *  `createdWith`/`createdAt` are not personal and always travel. */
export interface LollyCreator {
  /** "First Last" - only when the user opted into using their details. */
  name?: string;
  /** Contact email - only when opted in. */
  email?: string;
  /** Organisation - `Profile.org` when opted in, else the instance name (org context). */
  org?: string;
  /** "Lolly x.y.z" - the app that wrote the file. */
  createdWith: string;
  /** ISO timestamp of export. */
  createdAt: string;
}

/** One asset the session references. `kind:'asset'` carries bytes at `path`;
 *  `kind:'asset-ref'` is resolve-locally (a catalog id the recipient already has,
 *  or a licensed asset the sender chose not to embed). */
export interface LollyAssetEntry {
  kind: 'asset' | 'asset-ref';
  /** The sender's base asset id - matched to a receiver-local id on import. */
  id: string;
  source: 'user' | 'library';
  label: string;
  type: string;
  format: string;
  mime: string;
  /** Present for carried bytes. */
  bytes?: number;
  /** SRI `sha256-…` of the carried bytes (also in `manifest.integrity[path]`). */
  checksum?: string;
  /** Zip path of the carried bytes (`assets/blobs/…`). */
  path?: string;
  /** Held-back content - carried only when `includeLicensed`. */
  licensed?: boolean;
  /** Why the bytes were held back, in plain words (plan 253). */
  holdReason?: string;
  /** The canonical licence name, when one was recorded. */
  licence?: string;
  /** The readable credit the source asks for, when one was recorded. */
  credit?: string;
  meta?: Record<string, unknown>;
}

/**
 * How much a carried tool's code can be trusted on the receiving device.
 *  - `signed-catalog`: every file byte-matched the official signed catalog at pack
 *    time, so it is identical to what the CDN would serve - trust-equivalent to a
 *    normal install, safe to auto-provision (the importer re-verifies).
 *  - `custom`: a fork / private-brand / hand-authored tool. Its `hooks.js` runs
 *    unsandboxed in-realm (it is NOT a security boundary), so it may only be
 *    provisioned behind an explicit "do you trust the author?" gate on import.
 */
export type LollyToolTrust = 'signed-catalog' | 'custom';

/** The tool's files the caller resolved for embedding. Keys are tool-dir-relative
 *  paths (`tool.json`, `template.html`, `hooks.js`, `assets/x.svg`, `i18n/fr.json`);
 *  the shell fetches + integrity-checks them (that is where `trust` is decided). */
export interface LollyToolBundle {
  id: string;
  version?: string;
  trust: LollyToolTrust;
  files: Record<string, Uint8Array | Blob>;
}

/** One carried tool file, recorded in the manifest for verify + extraction. */
export interface LollyBundledToolFile {
  /** Zip path (`tool/…`). */
  path: string;
  /** SRI `sha256-…` (also in `manifest.integrity[path]`). */
  checksum?: string;
}

/** The manifest record for an embedded tool (present only when one was carried). */
export interface LollyBundledTool {
  id: string;
  version?: string;
  trust: LollyToolTrust;
  files: LollyBundledToolFile[];
}

/**
 * One font face the session's render depended on, as IDENTITY - never bytes.
 *
 * `sha256` is the SRI digest (`sha256-<base64>`, same spelling as `manifest.integrity`)
 * of the WHOLE source file, so a rebuild on another machine can say "same face" or "a
 * different file claiming that name". Font subsetting is planned, and a subset is a
 * function of the text, so the embedded bytes are deliberately not what is hashed.
 *
 * `source: 'platform'` with no `file`/`sha256` is the honest record of a run that drew in
 * whatever the machine happened to have installed. See lib/session-fonts.ts.
 */
export interface LollyFontEntry {
  family: string;
  /** '400', or a variable face's declared range ('100 900'). */
  weight: string;
  style: string;
  source: 'catalog' | 'user' | 'platform';
  file?: string;
  sha256?: string;
  faceIndex?: number;
  axes?: Record<string, number>;
  features?: Record<string, number>;
}

export interface LollyManifest {
  format: typeof LOLLY_FILE_FORMAT;
  formatVersion: number;
  minReader: number;
  /** "Lolly x.y.z". */
  app: string;
  /** The engine version at export time (for a reader that wants to check ranges). */
  engineVersion?: string;
  kind: 'session' | 'tool' | 'project';
  tool: { id: string; version?: string };
  /** Session thumbnail as a data URL, so an importer has a tile immediately. */
  thumb?: string | null;
  exportedAt: string;
  counts: { assets: number; byReference: number; bytes: number };
  creator: LollyCreator | null;
  assets: LollyAssetEntry[];
  /** The font faces the render used, by identity. Absent on files written before the
   *  receipt existed, and on a session with no text. */
  fonts?: LollyFontEntry[];
  /** The tool's own files, when the sender chose to carry it (Wave 7 / plans 114). */
  bundledTool?: LollyBundledTool;
  /** Present when `design-system.json` travels: the sender's design system by name,
   *  and (plans/186 section 3.8) its id and where it came from - a hosted system
   *  names its instance so the recipient can add it by link and keep it current. */
  designSystem?: { label?: string; id?: string; source?: { kind: string; instance?: string } };
  /** Present when `templates.json` travels: how many starting points the file carries.
   *  The count is a preview convenience (an intake can say "1 template" without
   *  inflating the part); the part itself is what import reads. */
  templates?: { count: number };
  /** Present on a project file (`kind: 'project'`): the folder tree and the sessions it
   *  files, each session's values in its own `sessions/<key>.json` part. */
  project?: LollyProjectManifest;
  /** Present when a renovation project travels (plan 274 section 3.5). Orthogonal to
   *  `kind`: a file may carry a renovation on its own, or beside a project's sessions. */
  renovation?: LollyRenovationManifest;
  integrity?: Record<string, string> | null;
}

/** One folder of a project file. `items` name sessions by their file-local `key` and
 *  images by the sender's asset id; ids are the sender's and are re-minted on import. */
export interface LollyProjectFolder {
  id: string;
  name: string;
  parentId: string | null;
  items: Array<{ type: 'session' | 'image'; ref: string }>;
  color?: string;
  emoji?: string;
  tags?: string[];
}

/** One session of a project file, as the manifest lists it. */
export interface LollyProjectSessionEntry {
  /** File-local id: letters, digits, `_` and `-`. */
  key: string;
  toolId: string;
  toolVersion?: string;
  label?: string;
  /** Zip path of the saved values (`sessions/<key>.json`). */
  path: string;
  /** Zip path of the tile image (`thumbs/<key>.<ext>`), when the sender had one. */
  thumb?: string;
}

export interface LollyProjectManifest {
  name: string;
  folders: LollyProjectFolder[];
  sessions: LollyProjectSessionEntry[];
}

/** A session handed to the project builder. */
export interface LollyProjectSessionInput {
  key: string;
  toolId: string;
  toolVersion?: string;
  label?: string;
  data: unknown;
  /** The tile image as a data URL. */
  thumb?: string | null;
}

export interface LollyProjectInput {
  name: string;
  folders: LollyProjectFolder[];
  sessions: LollyProjectSessionInput[];
}

/** A read project: the manifest block with each session's values and tile restored. */
export interface LollyProjectContents {
  name: string;
  folders: LollyProjectFolder[];
  sessions: Array<LollyProjectSessionEntry & { data: Record<string, unknown>; thumbUrl: string | null }>;
}

/** One catalog work whose bytes travelled inside the pack. */
export interface PackCreditEntry {
  label: string;
  id: string;
  path: string;
  licence?: string;
  credit?: string;
  notices?: string[];
  /** True when the sender chose to include bytes that were held back by default. */
  includedByChoice?: true;
}

/** One catalog work whose bytes did NOT travel, and the reason. */
export interface PackHoldEntry {
  label: string;
  id: string;
  reason: string;
  /**
   * Whether a deployment rule or a licence condition held the bytes back.
   * Printed as its own line, because a catalog lock read as a licence condition
   * would misrepresent a brand policy as an extra copyright term on open
   * material (plan 253 section 11).
   */
  kind?: 'policy' | 'licence' | 'unknown';
  licence?: string;
}

/** What `resolveLibrary` hands back for a catalog id it can supply bytes for. */
export interface LollyLibraryAsset {
  bytes: Uint8Array | Blob;
  mime: string;
  type: string;
  format: string;
  label?: string;
  /** Held back unless `includeLicensed` - see redistribution() in tool-lolly-vehicle.ts. */
  licensed?: boolean;
  /** Why it is held back, in plain words. */
  holdReason?: string;
  /** Whether a deployment rule or a licence condition held it back. */
  holdKind?: 'policy' | 'licence' | 'unknown';
  /** The canonical licence name, when one was recorded. */
  licence?: string;
  /** The readable credit the source asks for, when one was recorded. */
  credit?: string;
  /** Notice texts the licence asks to travel with the bytes. */
  notices?: string[];
  meta?: Record<string, unknown>;
}

export interface LollySummary {
  /** Assets whose bytes are carried in the file. */
  assetCount: number;
  /** Refs NOT carried (a catalog id the recipient resolves, or a held-back licensed one). */
  byReferenceCount: number;
  /** Total carried asset bytes (session + manifest excluded). */
  totalBytes: number;
  /** Any held-back asset was found in the closure (see redistribution()). */
  hasLicensed: boolean;
  /** Held-back assets left out because `includeLicensed` was false. */
  licensedExcluded: number;
  /** True when the file carries CREDITS.txt (any catalog work was involved). */
  credits: boolean;
  /** The creator name embedded, if any (drives the "includes your name" line). */
  creatorName?: string;
  /** How many tool files were carried (0 = the tool travels by reference, as before). */
  toolFiles: number;
  /** The trust class of the carried tool, when one was embedded. */
  toolTrust?: LollyToolTrust;
}

export interface LollyBuildInput {
  kind?: 'session' | 'tool' | 'project';
  toolCredits?: string;
  /** The saved session - `sessionSnapshot()`'s `SavedStateData` (or a slot's data). */
  session: unknown;
  toolId: string;
  toolVersion?: string;
  /** Display name for the file + manifest (defaults to the tool id). */
  name?: string;
  /** Session thumbnail data URL. */
  thumb?: string | null;
  /** Every user asset record (`host.assets._exportUserAssets()`); the referenced ones travel. */
  userAssets: readonly BeamAssetRecord[];
  resolveUser?: (id: string, version?: string) => Promise<BeamAssetRecord | null>;
  /** Resolve a catalog id's bytes for embedding, or null → it travels as a ref. */
  resolveLibrary?: (id: string) => Promise<LollyLibraryAsset | null>;
  /** Carry brand-pack / licensed catalog bytes (after the licensed-content confirmation). */
  includeLicensed?: boolean;
  /** Embed the tool's own files, so the `.lolly` opens on a device that lacks it. The
   *  shell resolves + integrity-checks the files and decides `trust`; this module just
   *  writes them under `tool/` and records them. Omit ⇒ the tool travels by reference. */
  tool?: LollyToolBundle;
  creator?: LollyCreator | null;
  /** The font faces the rendered canvas used, collected by the shell (lib/session-fonts.ts).
   *  Identity only - no font bytes ever travel in a `.lolly`. */
  fonts?: readonly LollyFontEntry[];
  /** "Lolly x.y.z". */
  appVersion?: string;
  engineVersion?: string;
  /** The sender's design system (the user tokens document) and its name, carried as
   *  `design-system.json` so the receiving studio can install the same look. Omit when
   *  the sender has none of their own. */
  designSystem?: { doc: unknown; label?: string; id?: string; source?: { kind: string; instance?: string } } | null;
  /** Starting points to hand over beside the session (plans/226 section 4.7). The
   *  records travel verbatim; the receiver re-mints their ids when it saves them, so
   *  two devices never fight over one id. Omit ⇒ no `templates.json` part at all. */
  templates?: readonly UserTemplateRecord[];
  /** The folder tree and sessions of a project file (`kind: 'project'`). `session` is
   *  ignored for a project; `toolId` is conventionally LOLLY_PROJECT_TOOL_ID. */
  project?: LollyProjectInput;
  /** A renovation project to carry (plan 274 section 3.5). With no `session` beside it
   *  the file has no `session.json` at all, which is what raises `minReader` to 4. */
  renovation?: LollyRenovationInput;
}

export interface LollyBuildResult {
  blob: Blob;
  filename: string;
  manifest: LollyManifest;
  summary: LollySummary;
}

/** Parsed, integrity-verified contents of a `.lolly` - the input to ingest. */
export interface LollyFileContents {
  manifest: LollyManifest;
  session: unknown;
  /** The carried design system document, when the manifest announces one. */
  designSystem?: unknown;
  /** The carried templates, validated and junk-free. Always an array - a file written
   *  before the part existed reads as `[]`, so callers never branch on its absence. */
  templates: UserTemplateRecord[];
  /** The folder tree and sessions, on a project file only. */
  project?: LollyProjectContents;
  /** The renovation project, when the file carried one. */
  renovation?: LollyRenovationContents;
  /** The unzipped parts, so ingest can pull each asset's bytes by `entry.path`. */
  files: Record<string, Uint8Array>;
}

// ── Creator block ───────────────────────────────────────────────────────────

/**
 * Assemble the creator block from the user profile. Name / email / org are embedded
 * ONLY when the user opted into `useDetails` (same gate as export provenance in
 * engine/src/metadata.ts) - with no opt-in, the block is just "made with Lolly, when".
 * `orgFallback` is the control-plane instance name, used for the org line when the
 * user has no `Profile.org` of their own (org context, not personal identity).
 */
export function creatorFromProfile(
  profile: Partial<Profile> | null | undefined,
  opts: { appVersion?: string; orgFallback?: string; now?: string } = {},
): LollyCreator {
  const creator: LollyCreator = {
    createdWith: opts.appVersion ?? 'Lolly',
    createdAt: opts.now ?? new Date().toISOString(),
  };
  if (!profile?.useDetails) return creator;   // no opt-in ⇒ no personal identity travels
  const name = [profile.firstname, profile.lastname].filter(Boolean).join(' ').trim();
  if (name) creator.name = name;
  if (profile.email) creator.email = profile.email;
  const org = profile.org || opts.orgFallback;
  if (org) creator.org = org;
  return creator;
}

// ── Build ─────────────────────────────────────────────────────────────────────

// Not `lib/util/bytes.ts`'s conversions: this one takes a Blob and is async.
function toBytes(v: Uint8Array | Blob): Promise<Uint8Array> {
  return v instanceof Uint8Array ? Promise.resolve(v) : v.arrayBuffer().then(b => new Uint8Array(b));
}

/** A filesystem-safe basename (no extension) from a display name or tool id. */
function safeBase(name: string): string {
  const cleaned = name.trim().replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  return cleaned || 'lolly';
}

/**
 * A file extension for a carried asset. Prefers the asset's own `format` (already the
 * short token we stored - `svg`, `png`, `webp`, `json` for lottie, `mp4`, `zzfxm`),
 * falling back to a compact mime→ext ladder. Mirrors `views/picker-formats.ts
 * extFromMime`, kept local so this module stays self-contained + DOM-free.
 */
function extForAsset(format: string, mime: string): string {
  const f = (format || '').toLowerCase();
  if (/^[a-z0-9]{1,5}$/.test(f)) return f === 'jpeg' ? 'jpg' : f;
  const m = (mime || '').toLowerCase();
  if (m.includes('svg')) return 'svg';
  if (m.includes('png')) return 'png';
  if (m.includes('jpeg') || m.includes('jpg')) return 'jpg';
  if (m.includes('webp')) return 'webp';
  if (m.includes('gif')) return 'gif';
  if (m.includes('avif')) return 'avif';
  if (m.includes('json')) return 'json';
  if (m.includes('pdf')) return 'pdf';
  if (m.includes('tiff')) return 'tiff';
  if (m.includes('webm')) return 'webm';
  if (m.includes('quicktime')) return 'mov';
  if (m.includes('mp4') || m.includes('m4v')) return 'mp4';
  if (m.startsWith('audio/')) return 'mp3';
  return 'bin';
}

/**
 * A usable, human-legible zip path for a carried asset's bytes - so unzipping a `.lolly`
 * yields real files (`assets/uploads/hero-photo.jpg`, `assets/catalog/suse-logo.svg`)
 * instead of opaque `assets/blobs/0`. The base name is the asset's own label / original
 * upload filename (`meta.name`); the extension matches the stored bytes. Deduped within
 * its folder (`-2`, `-3`) against `taken` (full lowercased paths), so two same-named
 * assets never collide. Paths are the only place the byte location is recorded - the
 * manifest carries `path` per asset and the integrity map is keyed by it - so this is
 * purely cosmetic to the wire format and transparent to import.
 */
function assetPath(dir: string, base: string, format: string, mime: string, taken: Set<string>): string {
  const ext = extForAsset(format, mime);
  let stem = (base.split(/[\\/]/).pop() ?? base);           // last segment of an id-shaped name
  const dot = stem.lastIndexOf('.');                        // drop an already-matching extension
  if (dot > 0 && stem.slice(dot + 1).toLowerCase() === ext) stem = stem.slice(0, dot);
  stem = safeBase(stem) || 'asset';
  let name = `${stem}.${ext}`;
  for (let n = 2; taken.has((dir + name).toLowerCase()); n++) name = `${stem}-${n}.${ext}`;
  const full = dir + name;
  taken.add(full.toLowerCase());
  return full;
}

/**
 * Build a `.lolly` file for one saved session. Pure: everything platform-specific
 * (the session, the user records, catalog byte resolution, the creator identity) is
 * supplied by the caller. Reuses `lib/bundle.ts` for the envelope exactly as
 * `data-transfer.ts` does, so integrity + `minReader` behave identically.
 */
export async function buildLollyFile(input: LollyBuildInput): Promise<LollyBuildResult> {
  if (input.kind === 'tool' && (!input.tool || input.session != null || input.templates?.length || input.designSystem || input.renovation)) throw new Error('A tool file carries exactly one tool, without a saved session or design-system install.');
  const renovation = input.renovation ? renovationBlock(input.renovation) : null;
  if (renovation) {
    const problem = renovationShapeProblem(renovation);
    if (problem) throw new Error(problem);
  }
  const project = input.kind === 'project' ? input.project : undefined;
  if (input.kind === 'project') {
    if (!project) throw new Error('A project file needs its folders and sessions.');
    if (input.tool || input.templates?.length) throw new Error('A project file carries saved sessions, not a tool or templates.');
    const problem = projectShapeProblem(project.name, project.folders, project.sessions);
    if (problem) throw new Error(problem);
  }
  // A 3D scene box carries its uploads as ids inside its `scene` query, and only the 3D
  // Studio manifest can find them (plan 265 milestone 3). Primed HERE as well as in
  // beam-pack's own walk, because a pack built from Projects never had the Design view
  // open, so nothing else had a reason to load that manifest and the scene's upload would
  // have been left out of the file.
  await ensureSceneManifest();
  // A project's closure is every session plus every image filed in its folders, so a
  // folder's pictures travel with it even when no session uses them. A renovation adds
  // the media its project and parts point at - added to the project's closure rather
  // than instead of it, so a file carrying both keeps both sets of pictures.
  const refs = collectSessionAssetRefs(
    project
      ? (renovation ? { project: projectClosure(project), renovationMedia: renovationMedia(renovation) } : projectClosure(project))
      : renovation ? renovationClosure(renovation, input.session)
      : input.session,
  );
  const byId = new Map(input.userAssets.map(r => [r.id, r]));

  const entries: Record<string, BundleEntry> = {};
  if (input.kind === 'tool' && input.toolCredits) entries[CREDITS_PART] = strToU8(input.toolCredits);
  const assets: LollyAssetEntry[] = [];
  let totalBytes = 0;
  let hasLicensed = false;
  let licensedExcluded = 0;
  // What the credits file is written from: one row per catalog work that
  // travelled, one per work that did not, each with the reason.
  const carried: PackCreditEntry[] = [];
  const heldBack: PackHoldEntry[] = [];
  // Full lowercased zip paths already used, so two same-named assets never collide.
  const takenPaths = new Set<string>();

  // Device-local (user/*) assets - carried whenever we hold the bytes, always.
  for (const id of refs.user) {
    const record = await resolveSessionUserAsset(id, byId, input.resolveUser);
    const blob = record?.blob;
    if (!record || !blob) {
      // Referenced but the bytes aren't here (a stale ref) - record it honestly so
      // the recipient sees a broken ref rather than the image vanishing silently.
      assets.push({ kind: 'asset-ref', id, source: 'user', label: id, type: 'data', format: '', mime: '' });
      continue;
    }
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const label = labelOf(record.meta) ?? id;
    const format = record.format ?? '';
    const mime = blob.type || '';
    const path = assetPath('assets/uploads/', label, format, mime, takenPaths);
    entries[path] = [bytes, { level: 0 }];   // already-compressed image/av bytes
    totalBytes += bytes.length;
    assets.push({
      kind: 'asset', id, source: 'user', path, bytes: bytes.length,
      label, type: record.type ?? 'data', format, mime,
      ...(record.meta ? { meta: record.meta } : {}),
    });
  }

  // Catalog (library) assets - the bit a beam does NOT send. Whether the bytes may
  // be passed on is the caller's `redistribution()` answer, not a guess made here;
  // an asset it holds back travels only when the sender said so, and either way the
  // credits file below records what happened and why (plan 253).
  for (const id of refs.library) {
    const lib = input.resolveLibrary ? await input.resolveLibrary(id) : null;
    if (lib?.licensed) hasLicensed = true;
    if (!lib || (lib.licensed && !input.includeLicensed)) {
      if (lib?.licensed) {
        licensedExcluded++;
        heldBack.push({ label: lib.label ?? id, id, reason: lib.holdReason ?? 'held back', ...(lib.holdKind ? { kind: lib.holdKind } : {}), ...(lib.licence ? { licence: lib.licence } : {}) });
      }
      assets.push({
        kind: 'asset-ref', id, source: 'library',
        label: lib?.label ?? id, type: lib?.type ?? 'data', format: lib?.format ?? '', mime: lib?.mime ?? '',
        ...(lib?.licensed ? { licensed: true } : {}),
        ...(lib?.holdReason ? { holdReason: lib.holdReason } : {}),
        ...(lib?.licence ? { licence: lib.licence } : {}),
        ...(lib?.credit ? { credit: lib.credit } : {}),
      });
      continue;
    }
    const bytes = await toBytes(lib.bytes);
    const path = assetPath('assets/catalog/', lib.label ?? id, lib.format, lib.mime, takenPaths);
    entries[path] = [bytes, { level: 0 }];
    totalBytes += bytes.length;
    carried.push({
      label: lib.label ?? id, id, path,
      ...(lib.licence ? { licence: lib.licence } : {}),
      ...(lib.credit ? { credit: lib.credit } : {}),
      ...(lib.notices?.length ? { notices: [...lib.notices] } : {}),
      ...(lib.licensed ? { includedByChoice: true as const } : {}),
    });
    assets.push({
      kind: 'asset', id, source: 'library', path, bytes: bytes.length,
      label: lib.label ?? id, type: lib.type, format: lib.format, mime: lib.mime,
      ...(lib.licensed ? { licensed: true } : {}),
      ...(lib.holdReason ? { holdReason: lib.holdReason } : {}),
      ...(lib.licence ? { licence: lib.licence } : {}),
      ...(lib.credit ? { credit: lib.credit } : {}),
      ...(lib.meta ? { meta: lib.meta } : {}),
    });
  }

  // The tool's own files, when the sender chose to carry it - under `tool/`, folded
  // into the same integrity map so a reader verifies the code exactly like the assets.
  // Text (tool.json/template/hooks/css/i18n) deflates; already-compressed binaries
  // (thumb, fonts, tool-local media) are stored. The `trust` marker is the shell's
  // call (signed-catalog byte-match vs custom); this module only records it.
  const bundledTool = input.tool && Object.keys(input.tool.files).length
    ? await packBundledTool(input.tool, entries)
    : null;

  // The session payload, integrity-protected alongside the blobs. A project writes one
  // part per session instead, plus each session's tile image.
  let projectManifest: LollyProjectManifest | null = null;
  if (project) projectManifest = packProjectSessions(project, entries);
  // A renovation on its own writes no `session.json`: there is no document yet, and an
  // empty one would land on the receiver as a blank saved session.
  else if (input.kind !== 'tool' && !(renovation && input.session == null)) entries['session.json'] = strToU8(JSON.stringify(input.session ?? null, null, 2));
  if (renovation && input.renovation) packRenovation(input.renovation, renovation, entries);
  // The sender's design system, when they have one - the same document their studio
  // holds, so "Add from a file" on another device installs the look the session wore.
  const designSystem = input.designSystem?.doc != null ? input.designSystem : null;
  if (designSystem) entries[DESIGN_SYSTEM_PART] = strToU8(JSON.stringify(designSystem.doc, null, 2));
  // The starting points, when the sender is handing some over. A separate part rather
  // than a manifest field so it rides the integrity map like every other payload and
  // costs a file without templates nothing at all.
  const templates = (input.templates ?? []).slice(0, LOLLY_MAX_TEMPLATES);
  if (templates.length) entries[TEMPLATES_PART] = strToU8(JSON.stringify({ templates }, null, 2));
  // The credits, as a payload part so it rides the integrity map like everything
  // else. Written whenever any catalog work was involved, carried or not: a
  // recipient has to be able to read what is missing as well as what is here.
  const credits = packCreditsText(carried, heldBack);
  if (credits) entries[CREDITS_PART] = strToU8(credits);

  const byReferenceCount = assets.filter(a => a.kind === 'asset-ref').length;
  const summary: LollySummary = {
    assetCount: assets.length - byReferenceCount,
    byReferenceCount,
    totalBytes,
    hasLicensed,
    licensedExcluded,
    credits: Boolean(credits || input.toolCredits),
    ...(input.creator?.name ? { creatorName: input.creator.name } : {}),
    toolFiles: bundledTool?.files.length ?? 0,
    ...(bundledTool ? { toolTrust: bundledTool.trust } : {}),
  };

  // Integrity over every payload part (session + blobs + tool files), BEFORE the
  // manifest (which carries the map) and the README - mirroring bundle.ts's contract.
  const integrity = await buildIntegrity(entries);
  if (integrity) {
    for (const a of assets) if (a.path) a.checksum = integrity[a.path];
    if (bundledTool) for (const f of bundledTool.files) f.checksum = integrity[f.path];
  }

  const manifest: LollyManifest = {
    format: LOLLY_FILE_FORMAT,
    formatVersion: LOLLY_FILE_VERSION,
    minReader: renovation ? LOLLY_RENOVATION_MIN_READER : input.kind === 'project' ? LOLLY_PROJECT_MIN_READER : input.kind === 'tool' ? 2 : 1,
    app: input.appVersion ?? 'Lolly',
    ...(input.engineVersion ? { engineVersion: input.engineVersion } : {}),
    kind: input.kind ?? 'session',
    tool: { id: input.toolId, ...(input.toolVersion ? { version: input.toolVersion } : {}) },
    ...(input.thumb ? { thumb: input.thumb } : project?.sessions.find(x => x.thumb)?.thumb ? { thumb: project.sessions.find(x => x.thumb)!.thumb } : {}),
    exportedAt: new Date().toISOString(),
    counts: { assets: summary.assetCount, byReference: byReferenceCount, bytes: totalBytes },
    creator: input.creator ?? null,
    assets,
    ...(input.fonts?.length ? { fonts: [...input.fonts] } : {}),
    ...(bundledTool ? { bundledTool } : {}),
    ...(designSystem ? { designSystem: {
      ...(designSystem.label ? { label: designSystem.label } : {}),
      ...(designSystem.id ? { id: designSystem.id } : {}),
      ...(designSystem.source ? { source: designSystem.source } : {}),
    } } : {}),
    ...(templates.length ? { templates: { count: templates.length } } : {}),
    ...(projectManifest ? { project: projectManifest } : {}),
    ...(renovation ? { renovation } : {}),
    ...(integrity ? { integrity } : {}),
  };
  // Put the routing manifest first. The universal intake can then describe a
  // multi-hundred-megabyte file after reading only its first ZIP entry instead
  // of scanning past every embedded video before it can ask what to do.
  const zipped = await zipAsync({
    'manifest.json': strToU8(JSON.stringify(manifest, null, 2)),
    [README_NAME]: strToU8(lollyReadme(manifest, summary)),
    ...entries,
  });
  const filename = `${safeBase(input.name || project?.name || input.toolId)}${LOLLY_EXT}`;
  const blob = new Blob([zipped as BlobPart], { type: LOLLY_MIME });
  return { blob, filename, manifest, summary };
}

// ── Project files ─────────────────────────────────────────────────────────────

const PROJECT_KEY_RE = /^[A-Za-z0-9_-]{1,64}$/;
const PROJECT_TOOL_RE = /^[A-Za-z0-9][\w.-]{0,127}$/;
const THUMB_EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif', 'image/svg+xml': 'svg',
};
const THUMB_MIME: Record<string, string> = Object.fromEntries(Object.entries(THUMB_EXT).map(([mime, ext]) => [ext, mime]));

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const shortText = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max;

/**
 * What is wrong with a project's shape, in a sentence, or null when it is sound. The
 * builder and the reader share it, so a file this module writes is always one it reads:
 * keys and ids are unique, every parent exists and no folder is its own ancestor, and a
 * session is filed in at most one folder.
 */
export function projectShapeProblem(name: unknown, folders: unknown, sessions: unknown): string | null {
  if (!shortText(name, 200)) return 'This project has no name.';
  if (!Array.isArray(folders) || folders.length > LOLLY_MAX_PROJECT_FOLDERS) return 'This project has an unreadable folder list.';
  if (!Array.isArray(sessions) || sessions.length > LOLLY_MAX_PROJECT_SESSIONS) return 'This project has an unreadable session list.';
  if (!folders.length && !sessions.length) return 'This project is empty.';
  const keys = new Set<string>();
  for (const entry of sessions) {
    if (!isRecord(entry) || typeof entry.key !== 'string' || !PROJECT_KEY_RE.test(entry.key) || keys.has(entry.key)) return 'A session in this project has a missing or repeated key.';
    if (typeof entry.toolId !== 'string' || !PROJECT_TOOL_RE.test(entry.toolId)) return `The session "${entry.key}" names no tool.`;
    keys.add(entry.key);
  }
  const ids = new Map<string, Record<string, unknown>>();
  for (const folder of folders) {
    if (!isRecord(folder) || !shortText(folder.id, 128) || ids.has(folder.id)) return 'A folder in this project has a missing or repeated id.';
    if (!shortText(folder.name, 200)) return 'A folder in this project has no name.';
    if (!Array.isArray(folder.items) || folder.items.length > 10000) return `The folder "${folder.name}" has an unreadable item list.`;
    ids.set(folder.id, folder);
  }
  const filed = new Set<string>();
  for (const folder of ids.values()) {
    const parent = folder.parentId;
    if (parent !== null && parent !== undefined && (typeof parent !== 'string' || !ids.has(parent) || parent === folder.id)) return `The folder "${folder.name}" names a parent that is not in this project.`;
    // Walk up: a chain longer than the folder count has looped.
    let at: unknown = parent, steps = 0;
    while (typeof at === 'string' && steps++ <= ids.size) at = ids.get(at)?.parentId;
    if (steps > ids.size) return `The folder "${folder.name}" is inside itself.`;
    for (const item of folder.items as unknown[]) {
      if (!isRecord(item) || typeof item.ref !== 'string') return `The folder "${folder.name}" has an unreadable item.`;
      if (item.type === 'session') {
        if (!keys.has(item.ref) || filed.has(item.ref)) return `The folder "${folder.name}" files a session that is missing or filed twice.`;
        filed.add(item.ref);
      } else if (item.type !== 'image' || !item.ref || item.ref.length > 2048) {
        return `The folder "${folder.name}" has an unreadable item.`;
      }
    }
  }
  return null;
}

/** The value the asset closure walks for a project: every session, and every image a
 *  folder files, as a ref in the id's own namespace. */
function projectClosure(project: LollyProjectInput): unknown {
  const images = project.folders.flatMap(f => f.items.filter(i => i.type === 'image'))
    .map(i => ({ id: i.ref, source: i.ref.startsWith('user/') ? 'user' : 'library' }));
  return { sessions: project.sessions.map(x => x.data), images };
}

/** A data URL's bytes and type, for an image type a tile can use; null otherwise. */
function thumbBytes(url: string): { bytes: Uint8Array; mime: string } | null {
  const comma = url.indexOf(',');
  if (!/^data:/i.test(url) || comma < 0) return null;
  const header = url.slice(5, comma);
  const mime = (header.split(';')[0] || '').toLowerCase();
  if (!THUMB_EXT[mime]) return null;
  const body = url.slice(comma + 1);
  try {
    const bytes = /;base64$/i.test(header) ? base64ToBytes(body) : strToU8(decodeURIComponent(body));
    return { bytes, mime };
  } catch { return null; }
}

/** Write each session (and its tile) as its own part; return the manifest block. */
function packProjectSessions(project: LollyProjectInput, entries: Record<string, BundleEntry>): LollyProjectManifest {
  const sessions: LollyProjectSessionEntry[] = project.sessions.map((x) => {
    const path = `sessions/${x.key}.json`;
    entries[path] = strToU8(JSON.stringify(x.data ?? null, null, 2));
    const thumb = x.thumb ? thumbBytes(x.thumb) : null;
    let thumbPath: string | undefined;
    if (thumb) {
      const ext = THUMB_EXT[thumb.mime]!;
      thumbPath = `thumbs/${x.key}.${ext}`;
      entries[thumbPath] = ext === 'svg' ? thumb.bytes : [thumb.bytes, { level: 0 }];
    }
    return {
      key: x.key, toolId: x.toolId, path,
      ...(x.toolVersion ? { toolVersion: x.toolVersion } : {}),
      ...(x.label ? { label: x.label } : {}),
      ...(thumbPath ? { thumb: thumbPath } : {}),
    };
  });
  const folders = project.folders.map(f => ({
    id: f.id, name: f.name, parentId: f.parentId ?? null,
    items: f.items.map(i => ({ type: i.type, ref: i.ref })),
    ...(f.color ? { color: f.color } : {}),
    ...(f.emoji ? { emoji: f.emoji } : {}),
    ...(f.tags?.length ? { tags: [...f.tags] } : {}),
  }));
  return { name: project.name, folders, sessions };
}

/**
 * Read a project file's block back, checking every part it names. The integrity map
 * has already vouched for the bytes; this checks that the parts are the ones the
 * manifest promises, and nothing is read from a path the manifest did not declare.
 */
function readProjectPart(manifest: LollyManifest, files: Parameters<typeof readJson>[0]): LollyProjectContents {
  const block = manifest.project;
  if (!isRecord(block)) throw new Error('This project file has no project.');
  const problem = projectShapeProblem(block.name, block.folders, block.sessions);
  if (problem) throw new Error(problem);
  const sessions = block.sessions.map((entry) => {
    const path = `sessions/${entry.key}.json`;
    if (entry.path !== path || !files[path] || !manifest.integrity?.[path]) throw new Error(`This project file is missing the session "${entry.label || entry.key}".`);
    const data = readJson(files, path);
    if (!isRecord(data)) throw new Error(`The session "${entry.label || entry.key}" in this project is unreadable.`);
    let thumbUrl: string | null = null;
    if (entry.thumb !== undefined) {
      const m = /^thumbs\/([A-Za-z0-9_-]{1,64})\.([a-z]{3,4})$/.exec(String(entry.thumb));
      const mime = m && m[1] === entry.key ? THUMB_MIME[m[2]!] : undefined;
      if (mime && files[entry.thumb] && manifest.integrity?.[entry.thumb]) thumbUrl = `data:${mime};base64,${btoa(bytesToBin(files[entry.thumb]!))}`;
    }
    return { ...entry, data, thumbUrl };
  });
  const folders = block.folders.map(f => ({
    id: f.id, name: f.name.trim(), parentId: f.parentId ?? null,
    items: f.items.map(i => ({ type: i.type, ref: i.ref })),
    // The colour is written into a style attribute and the emoji into a tile, so only a plain
    // hex colour and a short emoji survive; anything else is dropped, not repaired.
    ...(typeof f.color === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(f.color) ? { color: f.color } : {}),
    ...(typeof f.emoji === 'string' && f.emoji.length <= 16 ? { emoji: f.emoji } : {}),
    ...(Array.isArray(f.tags) ? { tags: f.tags.filter((tag): tag is string => typeof tag === 'string' && tag.length <= 60).slice(0, 20) } : {}),
  }));
  return { name: block.name.trim(), folders, sessions };
}

// ── Renovation projects ───────────────────────────────────────────────────────

/**
 * The manifest block a renovation input produces, before it is checked.
 *
 * The payloads are judged here as well as the block, because a part the reader would
 * refuse must never become a file a person was told had saved: a stage that has not run
 * hands back nothing, and a stage that hands back a non-object is a bug worth hearing
 * about at write time. `id` and `name` are trimmed once, here, so the written manifest is
 * already normalised and every reader files the project under the same id.
 */
function renovationBlock(input: LollyRenovationInput): LollyRenovationManifest {
  if (!isRecord(input.project)) throw new Error('The project record in this renovation is unreadable.');
  const parts: Partial<Record<LollyRenovationPartKind, string>> = {};
  for (const kind of RENOVATION_PART_KINDS) {
    const value = input.parts?.[kind];
    if (value === undefined) continue;
    if (!isRecord(value)) throw new Error(`The "${kind}" part of this renovation is unreadable.`);
    parts[kind] = renovationPartPath(kind);
  }
  const assets: string[] = [];
  const seen = new Set<string>();
  for (const ref of input.assets ?? []) {
    if (typeof ref !== 'string' || !ref || seen.has(ref)) continue;
    seen.add(ref);
    assets.push(ref);
  }
  const id = typeof input.id === 'string' ? input.id.trim() : '';
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  return { id, name, project: RENOVATION_PROJECT_PART, parts, assets };
}

/**
 * What is wrong with a renovation block, in a sentence, or null when it is sound. The
 * builder and the reader share it, so a file this module writes is always one it reads:
 * the project part sits at its one path, every declared part sits at the path its kind
 * owns, and the media list is bounded and free of repeats.
 */
export function renovationShapeProblem(block: unknown): string | null {
  if (!isRecord(block)) return 'This renovation has no project record.';
  if (!shortText(block.id, 128)) return 'This renovation has no id.';
  if (!shortText(block.name, 200)) return 'This renovation has no name.';
  if (block.project !== RENOVATION_PROJECT_PART) return 'This renovation names an unexpected project record.';
  if (!isRecord(block.parts)) return 'This renovation has an unreadable part list.';
  for (const [kind, path] of Object.entries(block.parts)) {
    if (!(RENOVATION_PART_KINDS as readonly string[]).includes(kind)) return `This renovation names a part this reader does not know ("${kind}").`;
    if (path !== renovationPartPath(kind as LollyRenovationPartKind)) return `The "${kind}" part of this renovation is at an unexpected path.`;
  }
  if (!Array.isArray(block.assets) || block.assets.length > LOLLY_MAX_RENOVATION_ASSETS) return 'This renovation has an unreadable media list.';
  const seen = new Set<string>();
  for (const ref of block.assets) {
    if (typeof ref !== 'string' || !ref || ref.length > 2048 || seen.has(ref)) return 'This renovation names a missing or repeated picture.';
    seen.add(ref);
  }
  return null;
}

/**
 * The value the asset closure walks for a renovation. Every ref is asked for as a
 * `user` one: a renovation's media are the bytes of the person's own file, kept in the
 * user asset store (plan 274 section 3.5), so they are never catalog works and never go
 * past the redistribution gate. A ref the store cannot supply is recorded as an
 * `asset-ref`, so the recipient reads a missing picture rather than losing it quietly.
 */
function renovationMedia(block: LollyRenovationManifest): unknown {
  return block.assets.map(ref => ({ id: ref, source: 'user' }));
}

function renovationClosure(block: LollyRenovationManifest, session: unknown): unknown {
  return { session, renovationMedia: renovationMedia(block) };
}

/**
 * The manifest row carrying one renovation ref's bytes, or undefined when nothing in
 * the file answers to it.
 *
 * A row is filed under the closure's own key, which strips a `?modifier` off the ref,
 * so a ref that carries one would otherwise be looked up under a name the manifest
 * never wrote. Both readers go through here, so they agree on the answer. A ref whose
 * pin cannot be decoded resolves to nothing rather than throwing: this is a read of
 * someone else's file, and a broken link is a missing picture, not a crash.
 */
export function renovationAssetRow(manifest: LollyManifest, ref: string): LollyAssetEntry | undefined {
  const rows = Array.isArray(manifest.assets) ? manifest.assets : [];
  const direct = rows.find(row => row.id === ref);
  if (direct) return direct;
  let key: string;
  try { key = assetDependency({ id: ref }).key; } catch { return undefined; }
  return key === ref ? undefined : rows.find(row => row.id === key);
}

/** Write the project record and each big part that travelled. */
function packRenovation(input: LollyRenovationInput, block: LollyRenovationManifest, entries: Record<string, BundleEntry>): void {
  entries[RENOVATION_PROJECT_PART] = strToU8(JSON.stringify(input.project ?? null, null, 2));
  for (const kind of RENOVATION_PART_KINDS) {
    const path = block.parts[kind];
    if (path === undefined) continue;
    entries[path] = strToU8(JSON.stringify(input.parts?.[kind] ?? null, null, 2));
  }
}

/**
 * Read a renovation block back, checking every part it names. The integrity map has
 * already vouched for the bytes; this checks that the parts are the ones the manifest
 * promises, and nothing is read from a path the manifest did not declare.
 */
function readRenovationPart(manifest: LollyManifest, files: Parameters<typeof readJson>[0]): LollyRenovationContents {
  const problem = renovationShapeProblem(manifest.renovation);
  if (problem) throw new Error(problem);
  const block = manifest.renovation!;
  if (!files[RENOVATION_PROJECT_PART] || !manifest.integrity?.[RENOVATION_PROJECT_PART]) throw new Error('This renovation is missing its project record.');
  const project = readJson(files, RENOVATION_PROJECT_PART);
  if (!isRecord(project)) throw new Error('The project record in this renovation is unreadable.');
  const parts: Partial<Record<LollyRenovationPartKind, Record<string, unknown>>> = {};
  for (const kind of RENOVATION_PART_KINDS) {
    const path = block.parts[kind];
    if (path === undefined) continue;
    if (!files[path] || !manifest.integrity?.[path]) throw new Error(`This renovation is missing its "${kind}" part.`);
    const value = readJson(files, path);
    if (!isRecord(value)) throw new Error(`The "${kind}" part of this renovation is unreadable.`);
    parts[kind] = value;
  }
  // The pictures get the gate the parts get. `verifyIntegrity` walks the map's own
  // entries, so bytes at a path the map never mentions are bytes nothing vouched for -
  // and the manifest is not itself covered, because the map lives inside it. A ref that
  // travelled as a reference carries no bytes and is nothing to check.
  for (const ref of block.assets) {
    const row = renovationAssetRow(manifest, ref);
    if (row?.kind !== 'asset' || !row.path) continue;
    const vouched = manifest.integrity?.[row.path];
    if (!files[row.path] || !vouched || (row.checksum && row.checksum !== vouched)) {
      throw new Error(`This renovation's picture "${row.label || ref}" is not covered by the file's integrity map.`);
    }
  }
  return { id: block.id.trim(), name: block.name.trim(), project, parts, assets: [...block.assets] };
}

/**
 * The pack's readable credits: every catalog work whose bytes travelled, with its
 * licence, credit and any notice the licence asks to travel, then every work that
 * was held back with the reason it was.
 *
 * It is a record, not a clearance. It says what this file carries and what it does
 * not; it does not say a use is permitted, and a work with no licence recorded
 * reads exactly that way. Returns '' when no catalog work was involved at all.
 */
const HOLD_KIND: Record<'policy' | 'licence' | 'unknown', string> = {
  policy: 'deployment policy',
  licence: 'licence condition',
  unknown: 'nothing recorded about passing these bytes on',
};

export function packCreditsText(carried: readonly PackCreditEntry[], heldBack: readonly PackHoldEntry[]): string {
  if (!carried.length && !heldBack.length) return '';
  const lines: string[] = ['Credits for the catalog works in this file.', ''];
  if (carried.length) {
    lines.push(`Travelled with this file (${carried.length}):`, '');
    for (const entry of carried) {
      lines.push(`- ${entry.label} (${entry.id})`);
      lines.push(`  file:    ${entry.path}`);
      lines.push(`  licence: ${entry.licence || 'not recorded'}`);
      if (entry.credit) lines.push(`  credit:  ${entry.credit}`);
      if (entry.includedByChoice) lines.push('  included by the sender, who chose to carry bytes held back by default');
      for (const notice of entry.notices ?? []) lines.push(`  notice:  ${notice}`);
      lines.push('');
    }
  }
  if (heldBack.length) {
    lines.push(`Held back (${heldBack.length}) - referenced, but the bytes are not in this file:`, '');
    for (const entry of heldBack) {
      lines.push(`- ${entry.label} (${entry.id})`);
      lines.push(`  licence: ${entry.licence || 'not recorded'}`);
      lines.push(`  held by: ${HOLD_KIND[entry.kind ?? 'unknown']}`);
      lines.push(`  reason:  ${entry.reason}`);
      lines.push('');
    }
    lines.push('Open the file on a device that already has these works, or ask the sender.', '');
  }
  lines.push('Keep this file with the design when you pass it on.');
  return lines.join('\n');
}

/** Binary tool files store verbatim; text (tool.json/template/hooks/css/i18n) deflates. */
const TOOL_BINARY_RE = /\.(png|jpe?g|webp|gif|avif|ico|woff2?|ttf|otf|mp4|webm|mp3|wav|ogg|pdf)$/i;

/**
 * Write a carried tool's files under `tool/` into the zip entries and return its
 * manifest record. A tool-dir-relative path is normalised to a zip-safe `tool/…`
 * path (leading slashes and any `..` segment stripped, so a malicious manifest can
 * never escape the folder). Checksums are stamped later from the integrity map.
 */
async function packBundledTool(tool: LollyToolBundle, entries: Record<string, BundleEntry>): Promise<LollyBundledTool> {
  const files: LollyBundledToolFile[] = [];
  for (const [rel, data] of Object.entries(tool.files)) {
    const segs = rel.split(/[\\/]/);
    if (segs.some(seg => seg === '..')) continue;   // reject traversal outright, never relocate
    const safeRel = segs.filter(seg => seg && seg !== '.').join('/');
    if (!safeRel) continue;
    const path = `tool/${safeRel}`;
    const bytes = await toBytes(data);
    entries[path] = TOOL_BINARY_RE.test(safeRel) ? [bytes, { level: 0 }] : bytes;
    files.push({ path });
  }
  return {
    id: tool.id,
    ...(tool.version ? { version: tool.version } : {}),
    trust: tool.trust,
    files,
  };
}

function labelOf(meta: Record<string, unknown> | undefined): string | undefined {
  const name = meta?.name;
  return typeof name === 'string' && name ? name : undefined;
}

function lollyReadme(manifest: LollyManifest, summary: LollySummary): string {
  if (manifest.kind === 'tool') return [
    BUNDLE_HEADER, '', 'A reusable Lolly tool', '',
    'Open this file in Lolly and review the tool before installing it.',
    'Change the declared inputs, then export the finished artwork.',
    'The designer controls the editable properties, layouts and export formats.',
    'This file contains one tool and its dependencies, without an editable Design master.',
    `Tool: ${manifest.tool.id}`, `Version: ${manifest.tool.version || manifest.bundledTool?.version || ''}`,
    '', 'Help: https://lolly.tools/info/create/create-a-tool.html', '',
  ].join('\n');
  const lines = [
    BUNDLE_HEADER,
    '',
    'This is a .lolly file - a design created with Lolly.',
    `Open it in Lolly (https://lolly.tools) to keep editing: drop it onto the app, or use Open.`,
    '',
    `Tool:     ${manifest.tool.id}${manifest.bundledTool ? ' (included)' : ''}`,
    `Assets:   ${summary.assetCount} embedded, ${summary.byReferenceCount} by reference`,
    `Exported: ${manifest.exportedAt}`,
  ];
  if (manifest.bundledTool) {
    lines.push('', `This file includes the tool itself (under tool/), so it opens even on a`,
      `device that doesn't already have "${manifest.bundledTool.id}".`);
  }
  const templateCount = manifest.templates?.count ?? 0;
  if (templateCount) {
    lines.push('', `It also carries ${templateCount} template${templateCount === 1 ? '' : 's'} (templates.json) - saved starting`,
      'points that join your own templates for this tool when you open the file.');
  }
  if (summary.credits) {
    lines.push('', 'CREDITS.txt lists the catalog works this design uses: what travelled with the',
      'file, the licence and credit each one carries, and anything held back with the',
      'reason. Keep it with the design when you pass it on.');
  }
  if (summary.assetCount > 0) {
    // A .lolly is a plain zip: rename it .zip and open it. The embedded assets are
    // ordinary files under assets/ with their original names + extensions, so a
    // designer can lift any one out directly. manifest.json maps each back to its id.
    lines.push('', 'The embedded assets are under assets/uploads/ (your files) and',
      'assets/catalog/ (brand + catalog art), with their real names and extensions -',
      'rename this file to .zip to browse them. manifest.json lists each one.');
  }
  const c = manifest.creator;
  if (c?.name || c?.org) {
    lines.push('', '[ Created by ]');
    if (c.name) lines.push(`  ${c.name}`);
    if (c.email) lines.push(`  ${c.email}`);
    if (c.org) lines.push(`  ${c.org}`);
  }
  return lines.join('\n') + '\n';
}

// ── Read (parse + verify; ingest is the shell's job) ──────────────────────────

/**
 * Read the `templates.json` part into records this device is willing to store.
 *
 * The bytes came off someone else's machine, so every field is checked rather than
 * trusted: a row needs a string `id`, `toolId` and `name` and a plain-object `values`,
 * and anything else about it is optional. A row that fails is DROPPED, never repaired
 * and never fatal - one malformed template must not cost the recipient the rest of the
 * file. `id` is carried through only so a caller can match the row against the session
 * it came with; the user-template store mints its own on save.
 */
function readTemplatesPart(raw: unknown): UserTemplateRecord[] {
  const rows = (raw as { templates?: unknown } | null | undefined)?.templates;
  if (!Array.isArray(rows)) return [];
  const out: UserTemplateRecord[] = [];
  for (const row of rows.slice(0, LOLLY_MAX_TEMPLATES)) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
    const r = row as Record<string, unknown>;
    const { id, toolId, name, values, description, from, variationOf, designSystem, createdAt, updatedAt } = r;
    if (typeof id !== 'string' || !id) continue;
    if (typeof toolId !== 'string' || !toolId) continue;
    if (typeof name !== 'string' || !name.trim()) continue;
    if (!values || typeof values !== 'object' || Array.isArray(values)) continue;
    const stamp = designSystem && typeof designSystem === 'object' && !Array.isArray(designSystem)
      ? designSystem as { id?: unknown; label?: unknown } : null;
    out.push({
      id, toolId, name,
      ...(typeof description === 'string' && description ? { description } : {}),
      values: values as Record<string, unknown>,
      ...(stamp && typeof stamp.id === 'string' && typeof stamp.label === 'string'
        ? { designSystem: { id: stamp.id, label: stamp.label } } : {}),
      ...(typeof from === 'string' && from ? { from } : {}),
      ...(typeof variationOf === 'string' && variationOf ? { variationOf } : {}),
      createdAt: typeof createdAt === 'string' ? createdAt : '',
      updatedAt: typeof updatedAt === 'string' ? updatedAt : '',
    });
  }
  return out;
}

/**
 * Parse and integrity-verify a `.lolly`'s bytes. Refuses a genuinely newer format
 * (`minReader`) and a corrupted transfer (integrity) with a plain message, exactly
 * like the backup reader. The returned `files` let the shell's ingest pull each
 * asset's bytes by `entry.path` and rewrite refs - that wiring lives with the host.
 */
export async function readLollyFile(bytes: ArrayBuffer | Uint8Array): Promise<LollyFileContents> {
  const files = await unzipBundle(bytes, {
    tooLarge: (name) => `This .lolly file has an oversized part ("${name}") and was not opened.`,
    invalid: 'This does not look like a .lolly file.',
    maxEntryBytes: LOLLY_MAX_ENTRY_BYTES,
    maxTotalBytes: LOLLY_MAX_TOTAL_BYTES,
  });
  const manifest = readJson(files, 'manifest.json') as LollyManifest | null;
  if (!manifest || manifest.format !== LOLLY_FILE_FORMAT) {
    throw new Error('This does not look like a .lolly file.');
  }
  if (typeof manifest.minReader === 'number' && manifest.minReader > LOLLY_READER_VERSION) {
    throw new Error('This .lolly file was made with a newer version of Lolly. Update to open it.');
  }
  await verifyIntegrity(files, manifest.integrity, 'This .lolly file');
  if (manifest.kind !== 'tool' && manifest.kind !== 'session' && manifest.kind !== 'project') throw new Error('This .lolly payload kind is not supported.');
  if (manifest.kind === 'project' && (manifest.minReader < LOLLY_PROJECT_MIN_READER || !manifest.integrity || files['session.json'] || manifest.bundledTool || manifest.templates)) throw new Error('This project file has an invalid payload.');
  if (manifest.kind === 'tool' && (!manifest.bundledTool || manifest.minReader < 2 || !manifest.integrity || files['session.json'] || manifest.templates || manifest.designSystem)) throw new Error('This tool file has an invalid payload.');
  if (manifest.kind === 'tool') {
    const bundle = manifest.bundledTool!;
    if (bundle.id !== manifest.tool.id || !Array.isArray(bundle.files) || !bundle.files.length) throw new Error('This tool file has inconsistent identity.');
    const paths = new Set<string>();
    for (const entry of bundle.files) {
      if (!/^tool\/[\w./-]+$/.test(entry.path) || entry.path.split('/').some(part => part === '.' || part === '..') || paths.has(entry.path) || !files[entry.path] || !manifest.integrity?.[entry.path]) throw new Error('This tool file has an invalid or unverified part.');
      paths.add(entry.path);
    }
    if (Object.keys(files).some(path => path.startsWith('tool/') && !paths.has(path)) || !paths.has('tool/tool.json') || !paths.has('tool/template.html')) throw new Error('This tool file has an incomplete inventory.');
    const toolManifest = readJson(files, 'tool/tool.json') as { id?: string; version?: string } | null;
    if (toolManifest?.id !== bundle.id || bundle.version && bundle.version !== toolManifest.version) throw new Error('This tool file has inconsistent identity.');
  }
  // A manifest that lost its gate cannot smuggle a renovation past an older reader:
  // the block travels only in a file that asked for reader 4 in the first place.
  // `minReader` comes off untrusted JSON, so a deleted field has to fail the gate the
  // way a downgraded one does - `undefined < 4` is false, and that is not a pass.
  if (manifest.renovation !== undefined && (typeof manifest.minReader !== 'number' || manifest.minReader < LOLLY_RENOVATION_MIN_READER || !manifest.integrity)) throw new Error('This renovation has an invalid payload.');
  const project = manifest.kind === 'project' ? readProjectPart(manifest, files) : undefined;
  const renovation = manifest.renovation !== undefined ? readRenovationPart(manifest, files) : undefined;
  const session = manifest.kind === 'tool' || project ? null : readJson(files, 'session.json');
  const designSystem = manifest.designSystem && files[DESIGN_SYSTEM_PART] ? readJson(files, DESIGN_SYSTEM_PART) : undefined;
  // The part is read whenever it is THERE, not whenever the manifest mentions it: the
  // integrity map already vouched for its bytes, and a file whose manifest lost the
  // count would otherwise hand back templates it plainly carries.
  const templates = files[TEMPLATES_PART] ? readTemplatesPart(readJson(files, TEMPLATES_PART)) : [];
  return { manifest, session, templates, files: files as Record<string, Uint8Array>, ...(designSystem !== undefined ? { designSystem } : {}), ...(project ? { project } : {}), ...(renovation ? { renovation } : {}) };
}

/** A carried tool pulled out of a parsed `.lolly`, ready to hand to the installer.
 *  `files` are keyed by tool-dir-relative path (the `tool/` prefix stripped), exactly
 *  the shape `loadTool`'s `fetchFile` expects. */
export interface LollyToolContents {
  id: string;
  version?: string;
  trust: LollyToolTrust;
  files: Record<string, Uint8Array>;
}

/**
 * Extract the embedded tool from a parsed `.lolly`, or null when none was carried.
 * The bytes are already integrity-verified by `readLollyFile`; this only maps the
 * manifest's `bundledTool.files` back to their bytes and strips the `tool/` prefix.
 * The caller still decides whether to install it (trust gate) - extraction is inert.
 */
export function extractBundledTool(contents: LollyFileContents): LollyToolContents | null {
  const bt = contents.manifest.bundledTool;
  if (!bt || !Array.isArray(bt.files) || !bt.files.length) return null;
  const files: Record<string, Uint8Array> = {};
  for (const f of bt.files) {
    const bytes = contents.files[f.path];
    if (bytes) files[f.path.replace(/^tool\//, '')] = bytes;
  }
  return {
    id: bt.id,
    ...(bt.version ? { version: bt.version } : {}),
    trust: bt.trust === 'signed-catalog' ? 'signed-catalog' : 'custom',
    files,
  };
}

// ── Import (ingest) ───────────────────────────────────────────────────────────

export interface LollyIngestResult {
  /** The saved-session slot the imported session landed in. */
  slot: string;
  toolId: string;
  /** Assets written to the user store. */
  imported: number;
  /** Assets already present (matched by checksum) and reused. */
  deduped: number;
  /** The rewritten session (its asset refs point at the receiver-local ids). */
  session: unknown;
  /** On a project file: the new top-level folders and every session slot written. */
  project?: { folderIds: string[]; slots: string[] };
  /**
   * On a renovation file: the project the file carried, plus the sender-id to
   * receiver-id map the asset ingest minted.
   *
   * The map is the whole point. Media that arrive get freshly minted local ids (or dedup
   * onto ids already here), so without it the refs inside `renovation/project.json` and
   * its parts name nothing on this device. A session rewrites its own refs through
   * `applyLollyRekey` before it is saved; a renovation is stored elsewhere, so the map
   * is handed back for the store to rebase instead.
   */
  renovation?: { contents: LollyRenovationContents; rekey: ReadonlyMap<string, string> };
}

/**
 * Where a project's folders land. The web shell hands in its folder store; a host
 * without folders omits it and the sessions arrive unfiled.
 */
export interface LollyProjectFolderSink {
  /** Recreate `tree` (its root first) under `parentId` with fresh ids. Session items
   *  map through `slotMap` (file key to new slot) and image items through `assetMap`
   *  (sender asset id to receiver id). Returns the new root. */
  instantiateSubtree(tree: readonly LollyProjectFolder[], parentId: string | null, slotMap: ReadonlyMap<string, string>, assetMap: ReadonlyMap<string, string>): Promise<{ id: string } | null>;
  /** Undo one of this import's folder trees when a later step fails. */
  removeSubtree?(folderId: string): Promise<unknown>;
}

export interface LollyIngestProgress {
  phase: 'assets' | 'session';
  current: number;
  total: number;
  label?: string;
}

/**
 * Rewrite a session's asset refs to the receiver-local ids a `.lolly` import minted.
 * Generalises the beam's user-only `rewriteSessionAssetRefs`: a `.lolly` carries
 * catalog (`library`) bytes too, which land as user assets, so ANY ref - user or
 * library - whose id was re-keyed becomes a `source:'user'` ref at the new id. A ref
 * NOT in the map (a catalog asset the receiver already resolves, or a licensed one held
 * back) is left untouched; baked refs (own bytes) are never rewritten. Pure + immutable.
 */
export function applyLollyRekey<T>(data: T, rekey: ReadonlyMap<string, string>): T {
  const walk = (value: unknown, depth: number): unknown => {
    if (!value || typeof value !== 'object' || depth > 64) return value;
    if (Array.isArray(value)) return value.map(v => walk(v, depth + 1));
    const rec = value as Record<string, unknown>;
    const id = rec.id;
    const baked = !!rec.meta && typeof rec.meta === 'object' && (rec.meta as { baked?: unknown }).baked === true;
    if (typeof id === 'string' && id && rec.source !== undefined && !baked) {
      const dep = assetDependency(rec as { id: string });
      const next = rekey.get(dep.key);
      if (next !== undefined) return { ...rec, id: next + dep.modifier, ...(dep.pin ? { pin: dep.pin } : {}), source: 'user', url: '', original: undefined };
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) out[k] = k === 'textDocument' ? mapTextFontAssets(v, id => {
      const dep = assetDependency({ id }), next = rekey.get(dep.key);
      return next === undefined ? id : encodeAssetVersion(next + dep.modifier, dep.pin);
    }) : walk(v, depth + 1);
    return out;
  };
  return walk(data, 0) as T;
}

/** A collision-free new slot for the imported session (never overwrites - same rule as a beam). */
function mintLollySlot(toolId: string, taken: ReadonlySet<string>): string {
  const base = `${toolId}:${Date.now()}`;
  let slot = base;
  let n = 1;
  while (taken.has(slot)) slot = `${base}-${n++}`;
  return slot;
}

/**
 * Open a `.lolly`: land its assets and its session onto this device. Reuses the beam
 * ingest wholesale (`ingestBeamItem` - SVG sanitising, checksum dedup, byte-exact
 * verify, provenance re-extraction, rollback-on-failure), translating the file's carried
 * assets into the beam's item shape. Then rewrites the session's refs (user AND carried
 * library) to the receiver-local ids and saves it as a new slot - never overwriting.
 *
 * `host` is the beam host slice (the shell casts its web host to it, as `beam-session.ts`
 * does). A file may carry its tool, but the intake layer handles that separate trust and
 * installation decision before calling this data-only session ingest. A file without the
 * tool still lands as a saved session when its referenced tool is unavailable.
 */
export async function ingestLollyFile(
  source: ArrayBuffer | Uint8Array | LollyFileContents,
  host: BeamPackHost,
  opts: {
    sanitizeSvg?: BeamSvgSanitiser; onProgress?: (progress: LollyIngestProgress) => void; saveSession?: boolean;
    /** A project file's folders land here, under `parentFolderId` (top level when absent). */
    folders?: LollyProjectFolderSink; parentFolderId?: string | null;
  } = {},
): Promise<LollyIngestResult> {
  // The universal intake has already parsed + integrity-verified the bundle in
  // order to describe it before committing. Accept that result directly so an
  // opened `.lolly` is never inflated a second time merely to begin ingest.
  const parsed = source instanceof ArrayBuffer || source instanceof Uint8Array
    ? await readLollyFile(source)
    : source;
  const { manifest, session, files } = parsed;

  const ctx = createBeamIngest(host, {
    ...(manifest.creator?.name ? { fromName: manifest.creator.name } : {}),
    ...(opts.sanitizeSvg ? { sanitizeSvg: opts.sanitizeSvg } : {}),
  });

  // Translate carried assets (user + library) into beam entries + items so
  // ingestBeamItem can land them with all its guarantees.
  const entries: BeamPackAssetEntry[] = [];
  const items: { id: string; label: string; bytes: number; checksum: string; blob: Blob }[] = [];
  let idx = 0;
  for (const a of manifest.assets ?? []) {
    if (a.kind !== 'asset' || !a.path) continue;   // asset-ref entries carry no bytes
    const raw = files[a.path];
    if (!raw) continue;
    const itemId = `lolly:${idx++}`;
    const size = typeof a.bytes === 'number' ? a.bytes : raw.length;
    entries.push({
      kind: 'asset', itemId, sourceId: a.id, label: a.label,
      bytes: size, checksum: a.checksum ?? '',
      type: a.type, format: a.format, mime: a.mime,
      ...(a.meta ? { meta: a.meta } : {}),
    });
    items.push({ id: itemId, label: a.label, bytes: size, checksum: a.checksum ?? '', blob: new Blob([raw as BlobPart], { type: a.mime || '' }) });
  }
  ctx.manifest = {
    format: BEAM_PACK_FORMAT,
    formatVersion: BEAM_PACK_FORMAT_VERSION,
    minReader: 1,
    kind: 'assets' as BeamPackManifest['kind'],
    name: parsed.project?.name ?? manifest.tool.id,
    entries,
  };

  let imported = 0;
  let deduped = 0;
  try {
    for (const [itemIndex, it] of items.entries()) {
      opts.onProgress?.({ phase: 'assets', current: itemIndex + 1, total: items.length, label: it.label });
      const r = await ingestBeamItem({ id: it.id, label: it.label, bytes: it.bytes, checksum: it.checksum }, it.blob, ctx);
      if (r.kind === 'asset') { if (r.deduped) deduped++; else imported++; }
    }
    // A carried renovation comes back on every path it can travel on, not only on the
    // one where it arrived alone: the media are written under freshly minted local ids,
    // so the re-key map is the only way the project record's refs can be rebased, and a
    // file that also carried a document would otherwise drop it here in silence.
    const carried = parsed.renovation ? { renovation: { contents: parsed.renovation, rekey: ctx.rekey } } : {};
    if (parsed.project) {
      const landed = await ingestProjectSessions(parsed.project, host, ctx.rekey, opts);
      return { slot: landed.slots[0] ?? '', toolId: manifest.tool.id, imported, deduped, session: null, project: landed, ...carried };
    }
    // A renovation with no document beside it brings its media across and nothing else:
    // the project record goes to the renovation store, which is not this ingest's job,
    // and minting a blank saved session for it would misreport what arrived.
    if (parsed.renovation && session == null) {
      return { slot: '', toolId: manifest.tool.id, imported, deduped, session: null, ...carried };
    }
    const rewritten = rebaseImportedAssetPins(applyLollyRekey(session, ctx.rekey), ctx.rekey, await host.assets._exportUserAssets());
    // A brand collection reuses the asset transaction, then saves its real
    // sessions individually. It must never mint a synthetic wrapper Project.
    if (manifest.kind === 'tool' || opts.saveSession === false) return { slot: '', toolId: manifest.tool.id, imported, deduped, session: rewritten, ...carried };
    const taken = new Set((await host.state.list()).map(r => r.slot));
    const slot = mintLollySlot(manifest.tool.id, taken);
    const thumb = typeof manifest.thumb === 'string' ? manifest.thumb : null;
    opts.onProgress?.({ phase: 'session', current: 1, total: 1 });
    await host.state.save(slot, rewritten as object, thumb);
    return { slot, toolId: manifest.tool.id, imported, deduped, session: rewritten, ...carried };
  } catch (err) {
    await rollbackBeamIngest(ctx);
    throw err;
  }
}

/** A folder and everything under it, the folder first. */
function projectSubtree(folders: readonly LollyProjectFolder[], rootId: string): LollyProjectFolder[] {
  const out: LollyProjectFolder[] = [];
  const queue = [rootId];
  for (let at = queue.shift(); at !== undefined; at = queue.shift()) {
    const folder = folders.find(f => f.id === at);
    if (!folder) continue;
    out.push(folder);
    for (const child of folders) if (child.parentId === at) queue.push(child.id);
  }
  return out;
}

/**
 * Save a project's sessions as new slots and rebuild its folder tree over them. The
 * assets are already stored, so refs are rewritten through `rekey` exactly as a single
 * session's are. Any failure removes what this step wrote before rethrowing, and the
 * caller then rolls back the assets, so a half-imported project never remains.
 */
async function ingestProjectSessions(
  project: LollyProjectContents, host: BeamPackHost, rekey: ReadonlyMap<string, string>,
  opts: { onProgress?: (progress: LollyIngestProgress) => void; folders?: LollyProjectFolderSink; parentFolderId?: string | null },
): Promise<{ folderIds: string[]; slots: string[] }> {
  const userAssets = await host.assets._exportUserAssets();
  const taken = new Set((await host.state.list()).map(r => r.slot));
  const slotMap = new Map<string, string>();
  const slots: string[] = [];
  const folderIds: string[] = [];
  try {
    for (const [n, entry] of project.sessions.entries()) {
      opts.onProgress?.({ phase: 'session', current: n + 1, total: project.sessions.length, ...(entry.label ? { label: entry.label } : {}) });
      const data = rebaseImportedAssetPins(applyLollyRekey(entry.data, rekey), rekey, userAssets) as Record<string, unknown>;
      // The record's tool comes from the manifest entry the reader checked, never
      // from whatever the values claim.
      const record = { ...data, __toolId: entry.toolId, ...(data.__label === undefined && entry.label ? { __label: entry.label } : {}) };
      const slot = mintLollySlot(entry.toolId, taken);
      taken.add(slot);
      await host.state.save(slot, record, entry.thumbUrl);
      slots.push(slot);
      slotMap.set(entry.key, slot);
    }
    if (opts.folders) {
      for (const root of project.folders.filter(f => !f.parentId)) {
        const made = await opts.folders.instantiateSubtree(projectSubtree(project.folders, root.id), opts.parentFolderId ?? null, slotMap, rekey);
        if (made) folderIds.push(made.id);
      }
    }
    return { folderIds, slots };
  } catch (err) {
    for (const id of folderIds) { try { await opts.folders?.removeSubtree?.(id); } catch { /* keep unwinding */ } }
    await Promise.allSettled(slots.map(slot => host.state.delete?.(slot)));
    throw err;
  }
}
