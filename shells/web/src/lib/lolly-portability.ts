// SPDX-License-Identifier: MPL-2.0
/**
 * The `.lolly` portability report: one row for each dependency a file needs, and
 * whether the file carries that dependency (plan 203, rank 9).
 *
 * A `.lolly` carries the bytes it may carry. Until this report, a recipient learned
 * what the file did NOT carry only when something failed to draw. Each row now
 * states it up front, with one of five words:
 *
 *  - `embedded`: the bytes are in this file, with the SRI digest the integrity map
 *    vouches for.
 *  - `available`: not in the file, and a reader is expected to supply the
 *    dependency itself (a tool the signed catalog lists, a catalog asset sent by its
 *    id, a catalog font recorded by identity, a face that ships with Lolly).
 *  - `linked`: not in the file on purpose. The reader fetches or renders the
 *    dependency from an address each time the document opens (a web address, a
 *    Lolly tool link, a file on an organisation server).
 *  - `withheld`: the sender had the bytes and a rule kept them out (a brand lock, a
 *    licence condition, or no licence recorded).
 *  - `missing`: the document needs the dependency, the file does not carry the
 *    bytes, and nothing suggests a reader will have them (a stale upload, catalog
 *    bytes the sender's catalog could not supply, a custom tool left out, a
 *    temporary address).
 *
 * Credentials are kept out by rule, not by promise. A web address keeps its scheme,
 * host and path and loses its user name, password, query and fragment. A path
 * segment shaped like a key (long and opaque, a three-part token, or letters with
 * digits scattered through them) reads `{redacted}`. Any other address (`mailto:`, a
 * host and path with no scheme) loses its query and fragment too. Asset ids pass
 * unchanged. The rule looks only at the characters of each segment, so a short key
 * written into a path can remain. The document's own values still hold the full address,
 * because the document needs the address to draw.
 *
 * `checkPortability` is the other half. Given a parsed file and what a receiving
 * device has, it says which dependencies open there with no network at all. An
 * empty receiver with networking off is the strictest case, and the one plan 203
 * asks to verify. The check never fetches anything.
 *
 * Pure and DOM-free. lolly-pack.ts writes the report as `portability.json` under
 * the integrity map, and reads it back.
 */

import { decodeAssetVersion } from '../../../../engine/src/asset-version.ts';
import { parseToolUrl, lollySchemeToHttps } from '../../../../engine/src/tool-url.ts';
import { sha256 } from './bundle.ts';
import type { LollyAssetEntry, LollyBundledTool, LollyFileContents, LollyFontEntry, LollyToolTrust } from './lolly-pack.ts';

/** The zip path of the report: a payload part the integrity map covers. */
export const PORTABILITY_PART = 'portability.json';
export const LOLLY_PORTABILITY_VERSION = 1;

export const LOLLY_DEPENDENCY_STATUSES = ['embedded', 'available', 'linked', 'withheld', 'missing'] as const;
export type LollyDependencyStatus = (typeof LOLLY_DEPENDENCY_STATUSES)[number];
export const LOLLY_DEPENDENCY_KINDS = ['tool', 'asset', 'font', 'design-system', 'templates', 'link'] as const;
export type LollyDependencyKind = (typeof LOLLY_DEPENDENCY_KINDS)[number];

/** One dependency of a `.lolly` and its status. */
export interface LollyDependency {
  kind: LollyDependencyKind;
  /** The dependency's identity: an asset id without its version pin, a tool id, a
   *  font's family, weight and style, or a link with any credential removed. */
  id: string;
  label: string;
  status: LollyDependencyStatus;
  /** Zip path of the carried bytes (`tool/` for a carried tool). Embedded rows only. */
  path?: string;
  /**
   * SRI `sha256-...` digest. For an embedded row, the digest of the bytes in this
   * file. For a carried tool, the digest of its file inventory (each `path` and its
   * digest, sorted, one per line). For a font that does not travel, the digest of
   * the source font file the render used.
   */
  checksum?: string;
  bytes?: number;
  /** The exact version the document asks for: an asset pin or a tool version. */
  version?: string;
  trust?: LollyToolTrust;
  /** Which kind of rule held withheld bytes back. */
  heldBy?: 'policy' | 'licence' | 'unknown';
  /** The canonical licence name, when one was recorded. */
  licence?: string;
  /** The tool a Lolly tool link renders. */
  tool?: string;
  /** Why the bytes are not in this file, in plain words. */
  reason?: string;
}

export interface LollyPortabilityReport {
  version: typeof LOLLY_PORTABILITY_VERSION;
  /** Every dependency is embedded, so the file opens complete on an empty device
   *  with networking off. */
  selfContained: boolean;
  counts: Record<LollyDependencyStatus, number>;
  dependencies: LollyDependency[];
  /** Set when the document held more links than the report lists. */
  truncated?: true;
}

/** What the manifest repeats about the report, so an intake can describe the file
 *  from its first entry without opening the part. */
export interface LollyPortabilitySummary {
  part: typeof PORTABILITY_PART;
  selfContained: boolean;
  counts: Record<LollyDependencyStatus, number>;
}

/** Everything the report is built from. lolly-pack.ts fills it from a manifest. */
export interface LollyPortabilitySources {
  integrity: Readonly<Record<string, string>> | null | undefined;
  assets: readonly LollyAssetEntry[];
  /** The tools the document opens in. A carried tool is reported once, as embedded. */
  tools: ReadonlyArray<{ id: string; version?: string; trust?: LollyToolTrust }>;
  bundledTool?: LollyBundledTool;
  fonts?: readonly LollyFontEntry[];
  /** Carried payload parts that are dependencies too: the design system, the templates. */
  parts?: ReadonlyArray<{ kind: 'design-system' | 'templates'; id: string; label: string; path: string }>;
  links?: readonly LollyDependency[];
  linksTruncated?: boolean;
  /** No catalog was asked for bytes, so a catalog asset not in the file travels by
   *  its id on purpose (`available`). Unset, an unresolved catalog asset is one the
   *  sender's catalog could not supply (`missing`). */
  catalogByReference?: boolean;
}

// The sentences a row carries. They are written into the file, not shown as
// interface text, so they stay in English like the rest of the manifest.
const REASON = {
  toolSigned: 'Not in this file. The signed catalog lists this tool, so a device with that catalog opens the document.',
  toolById: 'Not in this file. A device opens the document in its own copy of this tool.',
  toolCustom: 'Not in this file, and the signed catalog does not list this tool. Only a device that already has the tool can open the document.',
  uploadMissing: 'The upload was not on the sending device when this file was made.',
  catalogById: 'Not in this file. It travels by catalog id, and a reader with the same catalog shows it.',
  catalogMissing: 'The sender\'s catalog could not supply these bytes when this file was made.',
  webLink: 'Fetched from a web address each time the document opens.',
  toolLink: 'Rendered again from a Lolly tool link each time the document opens. A device with that tool renders the link offline.',
  serverLink: 'A file on an organisation server. The reader needs access to that server.',
  temporary: 'A temporary address that only existed on the sending device.',
  fontCatalog: 'Recorded by identity only. No font bytes travel; the reader\'s catalog supplies the face.',
  fontUpload: 'An uploaded font recorded by identity only. Its file is not in this file, so a reader without the same font draws a fallback.',
  fontBundled: 'Ships with Lolly.',
  fontInstalled: 'Drawn with a font installed on the sending machine. No file or digest was recorded, so a reader draws with its own fonts and the result may differ.',
} as const;

const MAX_LINKS = 1000;
const MAX_ROWS = 20_000;
const MAX_WALK_DEPTH = 64;
const MAX_WALK_VISITS = 200_000;

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const SRI_RE = /^sha256-[A-Za-z0-9+/]{43}=$/;
const HEX_RE = /^[0-9a-f]{64}$/i;
const AUTHORITY_RE = /^[a-z][a-z0-9+.-]*:\/\//i;
const TEMPORARY_RE = /^(?:blob|data):/i;
// An asset id: a first segment with no dot (so never a host name), then a path, then
// only the query forms that are part of an asset's identity (`?file=`, a theme or a
// treatment) and the version pin. See engine/src/asset-modifiers.ts and asset-version.ts.
const ASSET_ID_RE = /^[A-Za-z0-9][\w-]*(?:\/[^/?#:\s]+)*(?:\?file=[a-f0-9]{24}(?:&(?:theme|treatment)=[a-z0-9][a-z0-9-]*)?|\?(?:theme|treatment)=[a-z0-9][a-z0-9-]*)?(?:#lolly-version=[^#\s]*)?$/;
// A label that is itself an address: a scheme, a leading slash, or a host and a path.
const ADDRESS_LABEL_RE = /^(?:[a-z][a-z0-9+.-]*:|\/|[\w-]+(?:\.[\w-]+)+\/)/i;

// ── Links without credentials ─────────────────────────────────────────────────

/** A path segment that looks like a capability token rather than a name: long,
 *  opaque and digit-bearing with no file extension, three dotted parts (a JWT), or
 *  ten or more letters and digits with the digits scattered through them (a share
 *  key such as `a1b2c3d4e5f6g7h`). A date or a slug with one run of digits stays. */
function opaqueSegment(segment: string): boolean {
  if (/^[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}$/.test(segment)) return true;
  if (segment.length >= 10 && /^[A-Za-z0-9]+$/.test(segment) && /[A-Za-z]/.test(segment) && (segment.match(/\d+/g)?.length ?? 0) >= 3) return true;
  return segment.length >= 20 && /^[\w~%-]+$/.test(segment) && /\d/.test(segment) && /[A-Za-z]/.test(segment);
}

const redactPath = (path: string): string => path.split('/').map(segment => (opaqueSegment(segment) ? '{redacted}' : segment)).join('/');

/**
 * An address in the form the report may hold. A URL with an authority keeps its scheme,
 * host and path; the user name, password, query and fragment never pass. A `blob:` or
 * `data:` address keeps only its scheme. An asset id (a catalog id, an upload id, a
 * project file id) is an identifier rather than an address and comes back unchanged:
 * `?file=` there is part of the identity. Anything else (a root-relative path such as
 * a shell-served font, `mailto:`, a host and path with no scheme) loses its query and
 * fragment. In every address an opaque path segment reads `{redacted}`.
 */
export function portableLink(raw: string): string {
  const value = raw.trim();
  if (TEMPORARY_RE.test(value)) return value.slice(0, value.indexOf(':') + 1).toLowerCase();
  const address = value.startsWith('//') ? `https:${value}` : lollySchemeToHttps(value);
  if (AUTHORITY_RE.test(address)) {
    let url: URL;
    try { url = new URL(address); } catch { return address.slice(0, address.indexOf(':') + 1).toLowerCase(); }
    return `${url.protocol}//${url.host}${redactPath(url.pathname)}`;
  }
  if (ASSET_ID_RE.test(value)) return value;
  return redactPath(value.split(/[?#]/)[0] ?? '');
}

/** A label in the form the report may hold. A label that is itself an address is
 *  cleaned like one; a name in words keeps its punctuation, so "Photo #2" stays whole. */
function portableLabel(raw: string): string {
  const value = raw.trim();
  return ADDRESS_LABEL_RE.test(value) ? portableLink(value) : value;
}

// ── Linked references in the document ────────────────────────────────────────

function digestOf(value: unknown): string | undefined {
  return typeof value === 'string' && (SRI_RE.test(value) || HEX_RE.test(value)) ? value : undefined;
}

function versionOf(rec: Record<string, unknown>): string | undefined {
  const pin = isRecord(rec.pin) ? rec.pin.version : undefined;
  const version = typeof pin === 'string' ? pin : rec.version;
  return typeof version === 'string' && version && version.length <= 200 ? version : undefined;
}

function linkRow(rec: Record<string, unknown>, raw: string): LollyDependency {
  const meta = isRecord(rec.meta) ? rec.meta : {};
  const id = portableLink(raw);
  const name = typeof meta.name === 'string' ? meta.name.trim().slice(0, 200) : '';
  const version = versionOf(rec), checksum = digestOf(rec.checksum);
  const base = {
    kind: 'link' as const, id, label: name ? portableLabel(name) : id,
    ...(version ? { version } : {}), ...(checksum ? { checksum } : {}),
  };
  if (TEMPORARY_RE.test(raw.trim())) return { ...base, status: 'missing', reason: REASON.temporary };
  const tool = parseToolUrl(raw)?.toolId;
  if (tool) return { ...base, status: 'linked', tool, reason: REASON.toolLink };
  return { ...base, status: 'linked', reason: /^https?:/i.test(raw.trim()) ? REASON.webLink : REASON.serverLink };
}

/**
 * Every `source: 'remote'` reference a document's values hold, as `link` rows: a web
 * address, a Lolly tool link, a shared organisation file, or a temporary address that
 * cannot travel. User and catalog references are the asset closure's job
 * (`collectSessionAssetRefs`), and a baked reference carries its own bytes inside the
 * values, so neither appears here. Bounded like the closure walk, iterative, and
 * stable in first-seen order.
 */
export function collectLinkedDependencies(value: unknown): { links: LollyDependency[]; truncated: boolean } {
  const links = new Map<string, LollyDependency>();
  let truncated = false, visited = 0;
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  while (stack.length) {
    const { value: at, depth } = stack.pop()!;
    if (!at || typeof at !== 'object') continue;
    if (++visited > MAX_WALK_VISITS) { truncated = true; break; }
    const rec = at as Record<string, unknown>;
    if (!Array.isArray(at) && rec.source === 'remote' && typeof rec.id === 'string' && rec.id) {
      const baked = isRecord(rec.meta) && rec.meta.baked === true;
      if (baked) continue;
      const row = linkRow(rec, rec.id);
      const key = JSON.stringify([row.status, row.id, row.tool ?? '', row.label]);
      if (links.has(key)) continue;
      if (links.size >= MAX_LINKS) { truncated = true; continue; }
      links.set(key, row);
      continue;
    }
    if (depth >= MAX_WALK_DEPTH) { truncated = true; continue; }
    const children = Array.isArray(at) ? at : Object.values(rec);
    for (let i = children.length - 1; i >= 0; i--) stack.push({ value: children[i], depth: depth + 1 });
  }
  return { links: [...links.values()], truncated };
}

// ── Building the report ──────────────────────────────────────────────────────

function emptyCounts(): Record<LollyDependencyStatus, number> {
  return { embedded: 0, available: 0, linked: 0, withheld: 0, missing: 0 };
}

function reportOf(rows: LollyDependency[], truncated: boolean): LollyPortabilityReport {
  const counts = emptyCounts();
  for (const row of rows) counts[row.status]++;
  return {
    version: LOLLY_PORTABILITY_VERSION,
    selfContained: !truncated && rows.every(row => row.status === 'embedded'),
    counts,
    dependencies: rows,
    ...(truncated ? { truncated: true as const } : {}),
  };
}

/** An asset id as the report holds it: the version pin split off, and any address
 *  stripped of credentials. */
function assetIdentity(raw: string): { id: string; version?: string } {
  try {
    const decoded = decodeAssetVersion(raw);
    return { id: portableLink(decoded.id), ...(decoded.pin?.version ? { version: decoded.pin.version } : {}) };
  } catch {
    return { id: portableLink(raw) };
  }
}

function assetRow(asset: LollyAssetEntry, src: LollyPortabilitySources): LollyDependency {
  const { integrity } = src;
  const { id, version } = assetIdentity(asset.id);
  const label = asset.label && asset.label !== asset.id ? portableLabel(asset.label) : id;
  const base = {
    kind: 'asset' as const, id, label,
    ...(version ? { version } : {}),
    ...(asset.licence ? { licence: asset.licence } : {}),
  };
  if (asset.kind === 'asset' && asset.path) {
    const checksum = integrity?.[asset.path] ?? digestOf(asset.checksum);
    return {
      ...base, status: 'embedded', path: asset.path,
      ...(checksum ? { checksum } : {}),
      ...(typeof asset.bytes === 'number' ? { bytes: asset.bytes } : {}),
    };
  }
  if (asset.licensed) {
    return {
      ...base, status: 'withheld',
      ...(asset.holdKind ? { heldBy: asset.holdKind } : {}),
      reason: `Held back: ${asset.holdReason || 'a rule kept these bytes out of the file'}.`,
    };
  }
  if (asset.source === 'user') return { ...base, status: 'missing', reason: REASON.uploadMissing };
  if (AUTHORITY_RE.test(asset.id)) return { ...base, status: 'linked', reason: REASON.webLink };
  if (src.catalogByReference) return { ...base, status: 'available', reason: REASON.catalogById };
  return { ...base, status: 'missing', reason: REASON.catalogMissing };
}

function fontRow(font: LollyFontEntry, embedded: ReadonlyMap<string, LollyDependency>): LollyDependency {
  const style = font.style && font.style !== 'normal' ? ` ${font.style}` : '';
  const base = { kind: 'font' as const, id: `${font.family} ${font.weight} ${font.style || 'normal'}`, label: `${font.family} ${font.weight}${style}` };
  // A face whose file is an asset this file carries travels as that asset.
  const carried = font.file ? embedded.get(assetIdentity(font.file).id) : undefined;
  if (carried?.path) return { ...base, status: 'embedded', path: carried.path, ...(carried.checksum ? { checksum: carried.checksum } : {}) };
  const checksum = digestOf(font.sha256);
  const identity = { ...base, ...(checksum ? { checksum } : {}) };
  if (font.source === 'user') return { ...identity, status: 'missing', reason: REASON.fontUpload };
  if (font.source === 'catalog') return { ...identity, status: 'available', reason: REASON.fontCatalog };
  return { ...identity, status: 'available', reason: font.file ? REASON.fontBundled : REASON.fontInstalled };
}

/**
 * The digest of a carried tool's file inventory: each `path` and its SRI digest,
 * sorted, one per line. One value that changes when any file of the tool changes.
 * Undefined when a file has no digest (a writer without Web Crypto).
 */
export async function toolInventoryDigest(
  files: ReadonlyArray<{ path: string; checksum?: string }>,
  integrity: LollyPortabilitySources['integrity'],
): Promise<string | undefined> {
  const lines: string[] = [];
  for (const file of files) {
    const digest = integrity?.[file.path] ?? file.checksum;
    if (!digest) return undefined;
    lines.push(`${file.path} ${digest}`);
  }
  try { return await sha256(new TextEncoder().encode(lines.sort().join('\n'))); } catch { return undefined; }
}

/** Build the report: tools first, then assets, fonts, carried parts and links. */
export async function buildPortabilityReport(src: LollyPortabilitySources): Promise<LollyPortabilityReport> {
  const rows: LollyDependency[] = [];
  const carriedTool = src.bundledTool;
  if (carriedTool) {
    const checksum = await toolInventoryDigest(carriedTool.files ?? [], src.integrity);
    rows.push({
      kind: 'tool', id: carriedTool.id, label: carriedTool.id, status: 'embedded', path: 'tool/', trust: carriedTool.trust,
      ...(carriedTool.version ? { version: carriedTool.version } : {}),
      ...(checksum ? { checksum } : {}),
    });
  }
  for (const tool of src.tools) {
    if (tool.id === carriedTool?.id) continue;
    const custom = tool.trust === 'custom';
    rows.push({
      kind: 'tool', id: tool.id, label: tool.id, status: custom ? 'missing' : 'available',
      ...(tool.version ? { version: tool.version } : {}),
      ...(tool.trust ? { trust: tool.trust } : {}),
      reason: custom ? REASON.toolCustom : tool.trust === 'signed-catalog' ? REASON.toolSigned : REASON.toolById,
    });
  }
  const embedded = new Map<string, LollyDependency>();
  for (const asset of src.assets) {
    const row = assetRow(asset, src);
    rows.push(row);
    if (row.status === 'embedded' && !embedded.has(row.id)) embedded.set(row.id, row);
  }
  for (const font of src.fonts ?? []) rows.push(fontRow(font, embedded));
  for (const part of src.parts ?? []) {
    const checksum = src.integrity?.[part.path];
    rows.push({ kind: part.kind, id: part.id, label: part.label, status: 'embedded', path: part.path, ...(checksum ? { checksum } : {}) });
  }
  rows.push(...(src.links ?? []));
  return reportOf(rows, src.linksTruncated === true);
}

/** The manifest's copy of a report's totals. */
export function portabilitySummary(report: LollyPortabilityReport): LollyPortabilitySummary {
  return { part: PORTABILITY_PART, selfContained: report.selfContained, counts: { ...report.counts } };
}

// ── Reading a report back ────────────────────────────────────────────────────

const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length <= 2048;
const optionalText = (v: unknown): boolean => v === undefined || text(v);

function readRow(raw: unknown): LollyDependency | null {
  if (!isRecord(raw)) return null;
  const { kind, id, label, status, path, checksum, bytes, version, trust, heldBy, licence, tool, reason } = raw;
  if (!(LOLLY_DEPENDENCY_KINDS as readonly unknown[]).includes(kind)) return null;
  if (!(LOLLY_DEPENDENCY_STATUSES as readonly unknown[]).includes(status)) return null;
  if (!text(id) || !text(label)) return null;
  if (![path, checksum, version, licence, tool, reason].every(optionalText)) return null;
  if (bytes !== undefined && !(typeof bytes === 'number' && Number.isFinite(bytes) && bytes >= 0)) return null;
  if (trust !== undefined && trust !== 'signed-catalog' && trust !== 'custom') return null;
  if (heldBy !== undefined && heldBy !== 'policy' && heldBy !== 'licence' && heldBy !== 'unknown') return null;
  return {
    kind: kind as LollyDependencyKind, id, label, status: status as LollyDependencyStatus,
    ...(path !== undefined ? { path: path as string } : {}),
    ...(checksum !== undefined ? { checksum: checksum as string } : {}),
    ...(bytes !== undefined ? { bytes: bytes as number } : {}),
    ...(version !== undefined ? { version: version as string } : {}),
    ...(trust !== undefined ? { trust: trust as LollyToolTrust } : {}),
    ...(heldBy !== undefined ? { heldBy: heldBy as LollyDependency['heldBy'] } : {}),
    ...(licence !== undefined ? { licence: licence as string } : {}),
    ...(tool !== undefined ? { tool: tool as string } : {}),
    ...(reason !== undefined ? { reason: reason as string } : {}),
  };
}

/**
 * A report read off someone else's file. Every row is checked rather than trusted;
 * a malformed row is dropped, and the totals are counted again from the rows that
 * remain, never copied. Null when the part is not a report this reader knows.
 */
export function readPortabilityReport(raw: unknown): LollyPortabilityReport | null {
  if (!isRecord(raw) || raw.version !== LOLLY_PORTABILITY_VERSION || !Array.isArray(raw.dependencies)) return null;
  const rows: LollyDependency[] = [];
  for (const entry of raw.dependencies.slice(0, MAX_ROWS)) {
    const row = readRow(entry);
    if (row) rows.push(row);
  }
  return reportOf(rows, raw.truncated === true || raw.dependencies.length > MAX_ROWS);
}

// ── Checking a file against a receiving device ───────────────────────────────

/**
 * What a receiving device already has. Every answer must come from local state: the
 * check exists to say what opens with networking off, so an answer that needs the
 * network is a wrong answer. An empty object is an empty profile.
 */
export interface LollyReceiver {
  hasAsset?(id: string, version?: string): boolean | Promise<boolean>;
  hasTool?(id: string, version?: string): boolean | Promise<boolean>;
  hasFont?(font: { id: string; label: string; checksum?: string }): boolean | Promise<boolean>;
}

/**
 * How one dependency fares on the receiving device:
 *  - `ready`: it opens there with no network (carried and verified, or already present).
 *  - `needs-network`: a link, and the device cannot satisfy it offline.
 *  - `held-back`: withheld by the sender and not already on the device.
 *  - `unavailable`: neither carried nor present.
 *  - `damaged`: the report says it is carried, and the bytes or digest disagree.
 */
export type LollyDependencyOutcome = 'ready' | 'needs-network' | 'held-back' | 'unavailable' | 'damaged';

export interface LollyCheckedDependency extends LollyDependency {
  outcome: LollyDependencyOutcome;
}

export interface LollyPortabilityCheck {
  /** Every dependency is ready on this device with networking off. */
  ready: boolean;
  outcomes: Record<LollyDependencyOutcome, number>;
  dependencies: LollyCheckedDependency[];
}

async function carriedIntact(dep: LollyDependency, contents: Pick<LollyFileContents, 'manifest' | 'files'>): Promise<boolean> {
  const integrity = contents.manifest.integrity ?? null;
  if (dep.kind === 'tool') {
    const tool = contents.manifest.bundledTool;
    if (!tool || tool.id !== dep.id || !Array.isArray(tool.files) || !tool.files.length) return false;
    if (tool.files.some(file => !contents.files[file.path] || (integrity && !integrity[file.path]))) return false;
    if (!dep.checksum || !integrity) return true;
    return (await toolInventoryDigest(tool.files, integrity)) === dep.checksum;
  }
  const bytes = dep.path ? contents.files[dep.path] : undefined;
  if (!dep.path || !bytes) return false;
  const vouched = integrity?.[dep.path];
  if (integrity && !vouched) return false;
  if (!dep.checksum) return true;
  if (vouched) return vouched === dep.checksum;
  try { return (await sha256(bytes)) === dep.checksum; } catch { return true; }
}

async function receiverHas(dep: LollyDependency, receiver: LollyReceiver): Promise<boolean> {
  try {
    if (dep.kind === 'asset' && dep.status !== 'linked') return (await receiver.hasAsset?.(dep.id, dep.version)) === true;
    if (dep.kind === 'tool') return (await receiver.hasTool?.(dep.id, dep.version)) === true;
    if (dep.kind === 'link' && dep.tool) return (await receiver.hasTool?.(dep.tool)) === true;
    if (dep.kind === 'font') return (await receiver.hasFont?.({ id: dep.id, label: dep.label, ...(dep.checksum ? { checksum: dep.checksum } : {}) })) === true;
  } catch { /* a receiver that cannot answer does not have the dependency */ }
  return false;
}

/**
 * Check a parsed `.lolly` against a receiving device, with no network. Carried rows
 * are verified against the file's own bytes and integrity map; every other row asks
 * the receiver. Nothing is fetched and nothing is written.
 */
export async function checkPortability(
  contents: Pick<LollyFileContents, 'manifest' | 'files'>,
  report: LollyPortabilityReport,
  receiver: LollyReceiver = {},
): Promise<LollyPortabilityCheck> {
  const outcomes: Record<LollyDependencyOutcome, number> = { ready: 0, 'needs-network': 0, 'held-back': 0, unavailable: 0, damaged: 0 };
  const dependencies: LollyCheckedDependency[] = [];
  for (const dep of report.dependencies) {
    let outcome: LollyDependencyOutcome;
    if (dep.status === 'embedded') outcome = (await carriedIntact(dep, contents)) ? 'ready' : 'damaged';
    else if (await receiverHas(dep, receiver)) outcome = 'ready';
    else outcome = dep.status === 'linked' ? 'needs-network' : dep.status === 'withheld' ? 'held-back' : 'unavailable';
    outcomes[outcome]++;
    dependencies.push({ ...dep, outcome });
  }
  return { ready: report.truncated !== true && outcomes.ready === dependencies.length, outcomes, dependencies };
}
