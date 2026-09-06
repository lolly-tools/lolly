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
 * the sender's brand pack. Brand-locked/licensed catalog bytes are the exception - 
 * they travel only behind an explicit licensed-content confirmation (`includeLicensed`).
 *
 * This module is PURE + DOM-free: the caller (the shell) fetches the session, the
 * user-asset records, and a `resolveLibrary` for catalog bytes, and assembles the
 * creator block; the round-trip test drives it headlessly against plain data.
 */

import { strToU8 } from 'fflate';
import type { Profile } from '@lolly-tools/core/host-v1';
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
/** The `+zip` structured suffix (RFC 6839) advertises the container to OS/tooling. */
export const LOLLY_MIME = 'application/vnd.lolly+zip';
export const LOLLY_EXT = '.lolly';
/** The sender's design system, as the DTCG document their studio holds. An additive part
 *  (readers before it simply see no `designSystem` in the manifest), so the file also
 *  carries the brand a session was made under - the design-system studio's "Add from a
 *  file" can bring it across without the sender's pack. */
export const DESIGN_SYSTEM_PART = 'design-system.json';

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
  /** Brand-pack / licensed content - carried only when `includeLicensed`. */
  licensed?: boolean;
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
}

export interface LollyManifest {
  format: typeof LOLLY_FILE_FORMAT;
  formatVersion: number;
  minReader: number;
  /** "Lolly x.y.z". */
  app: string;
  /** The engine version at export time (for a reader that wants to check ranges). */
  engineVersion?: string;
  kind: 'session';
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
  integrity?: Record<string, string> | null;
}

/** What `resolveLibrary` hands back for a catalog id it can supply bytes for. */
export interface LollyLibraryAsset {
  bytes: Uint8Array | Blob;
  mime: string;
  type: string;
  format: string;
  label?: string;
  /** Brand-pack / licensed - gated behind `includeLicensed`. */
  licensed?: boolean;
  meta?: Record<string, unknown>;
}

export interface LollySummary {
  /** Assets whose bytes are carried in the file. */
  assetCount: number;
  /** Refs NOT carried (a catalog id the recipient resolves, or a held-back licensed one). */
  byReferenceCount: number;
  /** Total carried asset bytes (session + manifest excluded). */
  totalBytes: number;
  /** Any licensed/brand-pack asset was found in the closure. */
  hasLicensed: boolean;
  /** Licensed assets left out because `includeLicensed` was false. */
  licensedExcluded: number;
  /** The creator name embedded, if any (drives the "includes your name" line). */
  creatorName?: string;
  /** How many tool files were carried (0 = the tool travels by reference, as before). */
  toolFiles: number;
  /** The trust class of the carried tool, when one was embedded. */
  toolTrust?: LollyToolTrust;
}

export interface LollyBuildInput {
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
  const refs = collectSessionAssetRefs(input.session);
  const byId = new Map(input.userAssets.map(r => [r.id, r]));

  const entries: Record<string, BundleEntry> = {};
  const assets: LollyAssetEntry[] = [];
  let totalBytes = 0;
  let hasLicensed = false;
  let licensedExcluded = 0;
  // Full lowercased zip paths already used, so two same-named assets never collide.
  const takenPaths = new Set<string>();

  // Device-local (user/*) assets - carried whenever we hold the bytes, always.
  for (const id of refs.user) {
    const record = byId.get(id);
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

  // Catalog (library) assets - the bit a beam does NOT send. Carry bytes by default;
  // a licensed/brand-pack asset travels only when the caller confirmed it.
  for (const id of refs.library) {
    const lib = input.resolveLibrary ? await input.resolveLibrary(id) : null;
    if (lib?.licensed) hasLicensed = true;
    if (!lib || (lib.licensed && !input.includeLicensed)) {
      if (lib?.licensed) licensedExcluded++;
      assets.push({
        kind: 'asset-ref', id, source: 'library',
        label: lib?.label ?? id, type: lib?.type ?? 'data', format: lib?.format ?? '', mime: lib?.mime ?? '',
        ...(lib?.licensed ? { licensed: true } : {}),
      });
      continue;
    }
    const bytes = await toBytes(lib.bytes);
    const path = assetPath('assets/catalog/', lib.label ?? id, lib.format, lib.mime, takenPaths);
    entries[path] = [bytes, { level: 0 }];
    totalBytes += bytes.length;
    assets.push({
      kind: 'asset', id, source: 'library', path, bytes: bytes.length,
      label: lib.label ?? id, type: lib.type, format: lib.format, mime: lib.mime,
      ...(lib.licensed ? { licensed: true } : {}),
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

  // The session payload, integrity-protected alongside the blobs.
  entries['session.json'] = strToU8(JSON.stringify(input.session ?? null, null, 2));
  // The sender's design system, when they have one - the same document their studio
  // holds, so "Add from a file" on another device installs the look the session wore.
  const designSystem = input.designSystem?.doc != null ? input.designSystem : null;
  if (designSystem) entries[DESIGN_SYSTEM_PART] = strToU8(JSON.stringify(designSystem.doc, null, 2));

  const byReferenceCount = assets.filter(a => a.kind === 'asset-ref').length;
  const summary: LollySummary = {
    assetCount: assets.length - byReferenceCount,
    byReferenceCount,
    totalBytes,
    hasLicensed,
    licensedExcluded,
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
    minReader: LOLLY_MIN_READER,
    app: input.appVersion ?? 'Lolly',
    ...(input.engineVersion ? { engineVersion: input.engineVersion } : {}),
    kind: 'session',
    tool: { id: input.toolId, ...(input.toolVersion ? { version: input.toolVersion } : {}) },
    ...(input.thumb ? { thumb: input.thumb } : {}),
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
  const filename = `${safeBase(input.name || input.toolId)}${LOLLY_EXT}`;
  const blob = new Blob([zipped as BlobPart], { type: LOLLY_MIME });
  return { blob, filename, manifest, summary };
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
  if (typeof manifest.minReader === 'number' && manifest.minReader > LOLLY_MIN_READER) {
    throw new Error('This .lolly file was made with a newer version of Lolly. Update to open it.');
  }
  await verifyIntegrity(files, manifest.integrity, 'This .lolly file');
  const session = readJson(files, 'session.json');
  const designSystem = manifest.designSystem && files[DESIGN_SYSTEM_PART] ? readJson(files, DESIGN_SYSTEM_PART) : undefined;
  return { manifest, session, files: files as Record<string, Uint8Array>, ...(designSystem !== undefined ? { designSystem } : {}) };
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
      const base = id.split('?')[0]!;   // drop a theme/treatment modifier to match the closure id
      const next = rekey.get(base);
      if (next !== undefined) return { ...rec, id: next + id.slice(base.length), source: 'user', url: '' };
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rec)) out[k] = walk(v, depth + 1);
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
  opts: { sanitizeSvg?: BeamSvgSanitiser; onProgress?: (progress: LollyIngestProgress) => void; saveSession?: boolean } = {},
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
    name: manifest.tool.id,
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
    const rewritten = applyLollyRekey(session, ctx.rekey);
    // A brand collection reuses the asset transaction, then saves its real
    // sessions individually. It must never mint a synthetic wrapper Project.
    if (opts.saveSession === false) return { slot: '', toolId: manifest.tool.id, imported, deduped, session: rewritten };
    const taken = new Set((await host.state.list()).map(r => r.slot));
    const slot = mintLollySlot(manifest.tool.id, taken);
    const thumb = typeof manifest.thumb === 'string' ? manifest.thumb : null;
    opts.onProgress?.({ phase: 'session', current: 1, total: 1 });
    await host.state.save(slot, rewritten as object, thumb);
    return { slot, toolId: manifest.tool.id, imported, deduped, session: rewritten };
  } catch (err) {
    await rollbackBeamIngest(ctx);
    throw err;
  }
}
