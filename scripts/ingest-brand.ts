#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/**
 * Brand pack hydrator - turns a design-tokens export into a `brands/<name>`
 * pack, ready to register as a profile (see profiles.json / use-profile.ts).
 *
 * Run as:
 *   npm run ingest:brand -- <source> --name <brand> [--label "Label"]
 *   node scripts/ingest-brand.ts <source> --name <brand> [--label "Label"]
 *        [--out brands/<brand>] [--register] [--activate] [--force]
 *
 * <source> is any of the containers Penpot/Tokens Studio/Lolly export the same
 * token document in (engine/src/brand-import.ts owns the reassembly):
 *
 *   tokens.json         monolithic Tokens-Studio or plain-DTCG document
 *   a directory         one-file-per-set export ($metadata.json/$themes.json
 *                       + '<set>.json'; nested dirs = '/' in set names)
 *   project.penpot      a Penpot project archive (zip; tokens per file)
 *   LollyBrand-*.zip    a design system pack exported by the studio
 *                       (manifest.json `format: "lolly-brand"` + tokens.json).
 *                       Its published VERSIONS travel too (plans/97 section 6a):
 *                       versions/<slug>.json and the frozen/ bytes they pin land
 *                       as ordinary catalog assets beside the head. The pack's
 *                       fonts/ and logos/ still stay in the source zip, and the
 *                       ✓ line says so.
 *   sets.zip            a plain zip of loose token-set files: the directory
 *                       shape one level of packaging up (one wrapper folder is
 *                       stripped, since $metadata.json/$themes.json are only
 *                       recognised at the root)
 *
 * The emitted pack mirrors brands/lolly-start/catalog: the extracted document
 * lands verbatim at catalog/assets/<name>/tokens/brand.json, indexed as the
 * pack's core-tier `tokens` asset (the web shell's token bridge discovers the
 * first `type:"tokens"` asset generically, so the colour picker lights up with
 * the brand's palette as soon as the profile is active). Photo-treatment and
 * icon-theme palette docs are DERIVED from the same document (engine
 * brand-treatments.ts) and written under catalog/assets/<name>/palette/, so
 * uploaded photos and themable icons get one-tap on-brand washes/pairings out
 * of the box - the icon-themes doc is skipped when the palette has no accent.
 * catalog/tools/index.json is NOT written here - `npm run build:catalog`
 * generates it once the profile is active.
 *
 * --register  upserts profiles.json: profiles[<name>] = community tools (+ the
 *             pack's own tools/ root if one exists) + this catalog. Never
 *             touches the "default" key; re-running updates the entry in place.
 * --activate  implies --register, then chains use-profile.ts <name> →
 *             build:catalog → validate:catalog, propagating the first failure.
 */

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import {
  assembleTokenSetFiles, coerceTokensDoc, extractPenpotProject, summarizeTokensDoc,
} from '../engine/src/brand-import.ts';
import type { TokensExtraction } from '../engine/src/brand-import.ts';
import { deriveIconThemesDoc, derivePhotoTreatmentsDoc } from '../engine/src/brand-treatments.ts';
// The version ledger (plans/97 section 6a) is read and rewritten through the ONE shared
// model, never by hand: a pack's published versions have to mean the same thing
// here as they do in the shell that exported them.
import { readVersionIndex, versionAssetId, withVersionIndex } from '../engine/src/design-version.ts';
import type { VersionIndex } from '../engine/src/design-version.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `Usage:
  node scripts/ingest-brand.ts <source> --name <brand> [--label "Label"] [--out brands/<brand>] [--register] [--activate] [--force]

  <source>      a monolithic tokens .json (Tokens Studio or plain DTCG),
                a DIRECTORY of per-set token files ($metadata.json/$themes.json + <set>.json),
                a .penpot project file (zip), a Lolly design system pack (.zip),
                or a zip of loose token-set files
  --name        brand id - lowercase [a-z0-9-]. The asset-id namespace is the name
                with hyphens stripped (asset ids forbid '-' in the first segment:
                'lolly-start' → 'lolly...' would be illegal, so 'lollystart/tokens/brand')
  --label       human label (default: capitalised name)
  --out         pack directory, inside the repo (default: brands/<name>)
  --register    upsert the profile into profiles.json (never touches "default")
  --activate    implies --register, then: use-profile <name> && build:catalog && validate:catalog
  --force       write into an existing non-empty --out`;

/** Human name for each container shape, for console + README provenance. */
const CONTAINER_LABEL: Record<TokensExtraction['source'], string> = {
  'dtcg': 'monolithic DTCG tokens file',
  'tokens-studio': 'monolithic Tokens Studio export',
  'token-set-files': 'one-file-per-set token directory',
  'penpot-project': 'Penpot project archive (.penpot)',
};

/** The web shell's pack format id (shells/web/src/brand-transfer.ts BRAND_FORMAT).
 *  Copied, not imported: a script must not pull a shell module (and that one is
 *  DOM-bound). The value is a permanent contract, so a copy cannot drift. */
const BRAND_PACK_FORMAT = 'lolly-brand';
const PACK_LABEL = 'Lolly design system pack (.zip)';

/**
 * What extract() found. The engine's `TokensExtraction['source']` names the
 * DOCUMENT shape, not the box it arrived in - a pack's tokens.json really is a
 * DTCG/Tokens-Studio document, so widening that contract type to carry a
 * container name would buy nothing. The container label rides alongside instead,
 * with any notes main() should print after the ✓.
 */
interface Extracted {
  extraction: TokensExtraction;
  containerLabel: string;
  notes: string[];
  /** Published design-system versions the container carried (plans/97 section 6a). */
  versions?: PackVersion[];
  /** Bytes a published version pins, re-homed into the pack's own namespace. */
  frozen?: PackFrozen[];
}

/** One published version, ready to be written beside the head document. */
interface PackVersion { slug: string; label: string; doc: unknown }

/** One preserved file. `id` is already the PACK's id, not the device's. */
interface PackFrozen { id: string; ext: string; bytes: Uint8Array }

/** Where a device keeps preserved bytes (shells/web/src/bridge/version-assets.ts).
 *  Copied, not imported, for the same reason BRAND_PACK_FORMAT is. */
const DEVICE_FROZEN_PREFIX = 'user/frozen/';

interface Args {
  source: string; name: string; label: string; out: string;
  /** Asset-id namespace: `name` with hyphens stripped - asset.schema.json's id
   * pattern (`^[a-z0-9]+(/…)+$`) forbids '-' in the first segment. */
  ns: string;
  register: boolean; activate: boolean; force: boolean;
}

function parseArgs(argv: string[]): Args {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    process.exit(argv.length ? 0 : 1);
  }
  const flags: Record<string, string | boolean> = {};
  const positional: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const eq = a.indexOf('=');
    const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
    if (['register', 'activate', 'force'].includes(key)) { flags[key] = true; continue; }
    if (!['name', 'label', 'out'].includes(key)) fail(`unknown flag --${key}\n\n${USAGE}`);
    const value = eq === -1 ? argv[++i] : a.slice(eq + 1);
    if (value === undefined) fail(`--${key} needs a value`);
    flags[key] = value;
  }
  if (positional.length !== 1) fail(`expected exactly one <source>, got ${positional.length}\n\n${USAGE}`);
  const name = typeof flags.name === 'string' ? flags.name : fail('--name is required');
  if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
    fail(`--name "${name}" is invalid - lowercase [a-z0-9-], starting alphanumeric`);
  }

  // The pack must live INSIDE the repo: profiles.json paths are joined onto the
  // repo root by use-profile.ts (an absolute/outside path would register a
  // broken profile), and it must never be the repo root or the tools/ +
  // catalog/ SYMLINK VIEWS - writing "into" a view lands in whatever pack is
  // active (--force could clobber brands/suse's real assets/index.json).
  const rawOut = typeof flags.out === 'string' ? flags.out : join('brands', name);
  const outRel = relative(ROOT, resolve(ROOT, rawOut)).split(sep).join('/');
  if (outRel === '' || outRel.startsWith('..')) {
    fail(`--out ${rawOut} resolves outside the repo (or to the repo root) - packs must live inside it, e.g. brands/${name}`);
  }
  if (/^(catalog|tools)(\/|$)/.test(outRel)) {
    fail(`--out ${rawOut} points into the ${outRel.split('/')[0]}/ profile VIEW - write to a real pack dir instead, e.g. brands/${name}`);
  }

  return {
    source: positional[0]!,
    name,
    ns: name.replace(/-/g, ''),
    label: typeof flags.label === 'string' ? flags.label : name.charAt(0).toUpperCase() + name.slice(1),
    out: outRel,
    register: flags.register === true || flags.activate === true, // --activate implies --register
    activate: flags.activate === true,
    force: flags.force === true,
  };
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

/** Recursively collect parsed `*.json` under `dir`, keyed by POSIX rel path. */
function walkJsonFiles(dir: string, base: string, files: Record<string, unknown>, warnings: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) { walkJsonFiles(full, base, files, warnings); continue; }
    if (!entry.name.endsWith('.json')) continue; // README, .DS_Store, … - not set files
    const rel = relative(base, full).split(sep).join('/');
    try {
      files[rel] = JSON.parse(readFileSync(full, 'utf8'));
    } catch (e) {
      warnings.push(`${rel}: ${e instanceof Error ? e.message : 'unparseable JSON'} - skipped`);
    }
  }
}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]; // PK\x03\x04 - local file header

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** One inflated `.json` member, parsed; `undefined` when absent or unparseable. */
function parseZipJson(entries: Record<string, Uint8Array>, path: string): unknown {
  const raw = entries[path];
  if (!raw) return undefined;
  try {
    return JSON.parse(Buffer.from(raw).toString('utf8'));
  } catch {
    return undefined;
  }
}

const rowCount = (v: unknown): number => (Array.isArray(v) ? v.length : 0);

/**
 * Parse every `.json` member as a token-set file, keyed the way
 * `assembleTokenSetFiles` reads a DIRECTORY. Resource forks (`__MACOSX/`, `._*`)
 * are dropped, and ONE common leading directory is stripped: real exports are
 * routinely zipped inside a wrapper folder, and `$metadata.json`/`$themes.json`
 * are only recognised at the root.
 */
function parseZipSetFiles(entries: Record<string, Uint8Array>): { files: Record<string, unknown>; warnings: string[] } {
  const warnings: string[] = [];
  // Null-prototype, for the same reason assembleTokenSetFiles uses one: a set
  // file legitimately named "__proto__.json" must become an own key.
  const parsed: Record<string, unknown> = Object.create(null);
  for (const [path, raw] of Object.entries(entries)) {
    if (path.startsWith('__MACOSX/') || (path.split('/').pop() ?? '').startsWith('._')) continue;
    try {
      parsed[path] = JSON.parse(Buffer.from(raw).toString('utf8'));
    } catch (e) {
      warnings.push(`${path}: ${e instanceof Error ? e.message : 'unparseable JSON'} - skipped`);
    }
  }

  const paths = Object.keys(parsed);
  // Two paths minimum, matching the web importer's stripCommonPrefix
  // (shells/web/src/lib/design-system/sources/file.ts): one member's leading
  // directory is not evidence of a wrapper, it is just where that file lives.
  // The rule has to be the same on both sides - the same zip fed to the CLI and
  // to the studio must produce the same set names, and it did not: `export/
  // core.json` alone strips here and does not there, so one names the set `core`
  // and the other `export/core`.
  const prefix = paths.length > 1 ? `${paths[0]!.split('/')[0]}/` : '';
  if (!prefix || prefix === '/' || !paths.every(p => p.startsWith(prefix) && p.length > prefix.length)) {
    return { files: parsed, warnings };
  }
  const stripped: Record<string, unknown> = Object.create(null);
  for (const [p, v] of Object.entries(parsed)) stripped[p.slice(prefix.length)] = v;
  return { files: stripped, warnings };
}

/**
 * Verify a pack against the integrity map it carries, the way the web importer
 * does before it trusts any member (`verifyIntegrity`, shells/web/src/lib/
 * bundle.ts): each entry is an SRI-style `sha256-<base64>` over that part's
 * bytes. A pack whose tokens.json was swapped after export fails on web import,
 * and must fail here too - otherwise the CLI is the soft way in, and the README
 * it writes records "Container: Lolly design system pack (.zip)" as provenance
 * for a document the pack never vouched for.
 *
 * Scope is honest about what this process holds: only `.json` members are
 * inflated, so binary parts (fonts/, logos/) are skipped rather than reported
 * missing. Absent map → nothing to check, exactly as on the web: an older pack
 * carries none, and can't-verify is not the same as corrupt.
 */
function verifyPackIntegrity(entries: Record<string, Uint8Array>, manifest: Record<string, unknown>, abs: string): void {
  const integrity = manifest.integrity;
  if (!isRecord(integrity)) return;
  for (const [path, expected] of Object.entries(integrity)) {
    const bytes = entries[path];
    if (!bytes || typeof expected !== 'string') continue; // a part we did not inflate
    const actual = `sha256-${createHash('sha256').update(bytes).digest('base64')}`;
    if (actual !== expected) {
      fail(`${abs} appears corrupted - "${path}" failed the integrity check the pack carries. Export the pack again from the studio.`);
    }
  }
}

/**
 * The published versions a pack carries, and the head document that must ship
 * with them (plans/97 section 6a).
 *
 * The HEAD DOCUMENT'S LEDGER is the authority, not `versions.json`: the ledger is
 * what every consumer reads once the pack is installed, so anything the emitted
 * catalog cannot actually serve is dropped from it here rather than left naming a
 * version that will not load. `versions.json` is the same list as exported, and
 * is deliberately not read twice.
 *
 * Two ids are rewritten on the way in, and only these two:
 *   - the version ASSET moves from the device's `user/tokens/brand/<slug>` to the
 *     pack's `<ns>/tokens/brand/<slug>` simply by where it is written;
 *   - a pin's `frozenId` is re-homed from `user/frozen/<sha12>` to
 *     `<ns>/frozen/<sha12>`. It has to be: `user/…` is the DEVICE's namespace (the
 *     web bridge routes those ids to the on-device store, not the catalog), so a
 *     pack shipping one would name bytes that can never resolve. The pin's `id`
 *     and the version documents are untouched - the id is a lookup key matched
 *     against the document's own asset tokens, and both sides still say `user/…`.
 */
function readPackVersions(
  entries: Record<string, Uint8Array>, tokens: unknown, ns: string,
): { doc: unknown; versions: PackVersion[]; frozen: PackFrozen[]; warnings: string[] } {
  const warnings: string[] = [];
  const index = readVersionIndex(tokens);
  if (!index.versions.length) return { doc: tokens, versions: [], frozen: [], warnings };

  const versions: PackVersion[] = [];
  const kept: VersionIndex = { versions: [], active: null };
  const frozenById = new Map<string, PackFrozen>();
  const frozenRows = parseZipJson(entries, 'frozen.json');
  const rowByFrozenId = new Map<string, Record<string, unknown>>();
  if (Array.isArray(frozenRows)) {
    for (const row of frozenRows) if (isRecord(row) && typeof row.id === 'string') rowByFrozenId.set(row.id, row);
  }

  for (const entry of index.versions) {
    const doc = parseZipJson(entries, `versions/${entry.slug}.json`);
    if (doc === undefined) {
      warnings.push(`published version "${entry.slug}" has no readable versions/${entry.slug}.json - dropped from the pack's version list`);
      continue;
    }
    const pins = (entry.assets ?? []).map((pin) => {
      if (!pin.frozenId?.startsWith(DEVICE_FROZEN_PREFIX)) return pin;
      const key = pin.frozenId.slice(DEVICE_FROZEN_PREFIX.length);
      const row = rowByFrozenId.get(pin.frozenId);
      const file = row && typeof row.file === 'string' ? row.file : null;
      const bytes = file !== null ? entries[file] : undefined;
      if (!bytes || file === null) {
        // The pin claims preserved bytes the pack did not carry. Dropping the
        // frozenId is the honest repair: the version then resolves the head id,
        // which is wrong-but-present rather than a dead reference.
        warnings.push(`published version "${entry.slug}" pins preserved bytes (${pin.frozenId}) that the pack does not carry - the pin falls back to the live asset`);
        const { frozenId: _drop, ...rest } = pin;
        return rest;
      }
      const id = `${ns}/frozen/${key}`;
      const ext = (file.split('.').pop() || 'bin').toLowerCase();
      frozenById.set(id, { id, ext, bytes });
      return { ...pin, frozenId: id };
    });
    versions.push({ slug: entry.slug, label: entry.label, doc });
    // An empty pin list reads back as "no assets" (readPinnedAssets drops it), so
    // this one shape covers both a pinned and an unpinned version.
    kept.versions.push({ ...entry, assets: pins });
  }
  kept.active = index.active && kept.versions.some(v => v.slug === index.active) ? index.active : null;

  return { doc: withVersionIndex(tokens, kept), versions, frozen: [...frozenById.values()], warnings };
}

/**
 * The three zip shapes, in sniff order: a Lolly design system pack, a Penpot
 * project, then a plain zip of loose token-set files. The caller inflates the
 * `.json` members plus a pack's `frozen/` binaries, which is why the pack's
 * font/logo binaries are still never in hand here.
 */
function extractZip(entries: Record<string, Uint8Array>, abs: string, ns: string): Extracted {
  const manifest = parseZipJson(entries, 'manifest.json');

  if (isRecord(manifest) && manifest.format === BRAND_PACK_FORMAT) {
    verifyPackIntegrity(entries, manifest, abs);
    const tokens = parseZipJson(entries, 'tokens.json');
    if (tokens === undefined) {
      fail(`${abs} is a ${PACK_LABEL} but carries no readable tokens.json - export the pack again from the studio`);
    }
    const fonts = rowCount(parseZipJson(entries, 'fonts.json'));
    const logos = rowCount(parseZipJson(entries, 'logos.json'));
    const pack = readPackVersions(entries, tokens, ns);
    const extraction = coerceTokensDoc(pack.doc);
    extraction.warnings.unshift(...pack.warnings);
    return {
      extraction,
      containerLabel: PACK_LABEL,
      notes: [
        `pack assets are not imported yet: fonts/ (${fonts}) and logos/ (${logos}) stay in the source zip. Re-add them in the studio.`,
      ],
      versions: pack.versions,
      frozen: pack.frozen,
    };
  }

  const looksPenpot = (isRecord(manifest) && (manifest.type === 'penpot/export-files' || Array.isArray(manifest.files)))
    || Object.keys(entries).some(p => /^files\/[^/]+\/tokens\.json$/.test(p));
  if (looksPenpot) {
    const extraction = extractPenpotProject(entries);
    return { extraction, containerLabel: CONTAINER_LABEL[extraction.source], notes: [] };
  }

  // A plain zip of loose token-set files - the shape assembleTokenSetFiles has
  // always read for a directory, one level of packaging up.
  const { files, warnings } = parseZipSetFiles(entries);
  const extraction = assembleTokenSetFiles(files);
  extraction.warnings.unshift(...warnings);
  return {
    extraction,
    containerLabel: `${CONTAINER_LABEL['token-set-files']} (zipped)`,
    notes: [],
  };
}

/** Detect the container shape from the path/bytes and extract the token doc.
 *  `ns` is the pack's asset-id namespace - a design system pack's preserved files
 *  are re-homed into it as they are read (see readPackVersions). */
function extract(source: string, ns: string): Extracted {
  const abs = resolve(source);
  if (!existsSync(abs)) fail(`source not found: ${abs}`);

  if (statSync(abs).isDirectory()) {
    const files: Record<string, unknown> = {};
    const ioWarnings: string[] = [];
    walkJsonFiles(abs, abs, files, ioWarnings);
    const ex = assembleTokenSetFiles(files);
    ex.warnings.unshift(...ioWarnings);
    return { extraction: ex, containerLabel: CONTAINER_LABEL[ex.source], notes: [] };
  }

  const bytes = readFileSync(abs);
  if (bytes.length >= 4 && ZIP_MAGIC.every((b, i) => bytes[i] === b)) {
    let entries: Record<string, Uint8Array>;
    try {
      // The .json members, plus a design system pack's `frozen/` binaries - the
      // bytes a published version pins, which have to travel or the version is a
      // reference to nothing. Everything else stays compressed: a .penpot carries
      // images/media, and a pack carries font + logo binaries this script does
      // not take yet.
      entries = unzipSync(new Uint8Array(bytes), {
        filter: (f) => f.name.endsWith('.json') || f.name.startsWith('frozen/'),
      });
    } catch (e) {
      return fail(`cannot unzip ${abs}: ${e instanceof Error ? e.message : e}`);
    }
    return extractZip(entries, abs, ns);
  }

  try {
    const ex = coerceTokensDoc(JSON.parse(bytes.toString('utf8')));
    return { extraction: ex, containerLabel: CONTAINER_LABEL[ex.source], notes: [] };
  } catch (e) {
    return fail(`${abs} is neither a zip nor parseable JSON: ${e instanceof Error ? e.message : e}`);
  }
}

/** Write the pack skeleton, mirroring brands/lolly-start/catalog exactly. */
function emitPack(
  args: Args, doc: Record<string, unknown>, containerLabel: string,
  summary: ReturnType<typeof summarizeTokensDoc>,
  published: { versions: PackVersion[]; frozen: PackFrozen[] } = { versions: [], frozen: [] },
): void {
  const out = resolve(ROOT, args.out);
  if (existsSync(out)) {
    // A file here breaks every later mkdir/write with a raw ENOTDIR - refuse
    // it readably, and regardless of --force (force can't help a file).
    if (!statSync(out).isDirectory()) fail(`--out ${args.out} exists and is not a directory`);
    if (!args.force && readdirSync(out).length > 0) {
      fail(`--out ${args.out} exists and is not empty - pass --force to write into it anyway`);
    }
  }

  const tokensDir = join(out, 'catalog/assets', args.ns, 'tokens');
  mkdirSync(tokensDir, { recursive: true });
  // tools/ stays empty here - build:catalog generates its index.json later.
  for (const d of ['catalog/tools', 'catalog/previews', 'catalog/og/views', 'catalog/fonts']) {
    mkdirSync(join(out, d), { recursive: true });
  }
  for (const k of ['catalog/previews/.gitkeep', 'catalog/og/views/.gitkeep', 'catalog/fonts/.gitkeep']) {
    writeFileSync(join(out, k), '');
  }

  // The extracted document verbatim - this file IS the brand.
  const brandBytes = Buffer.from(JSON.stringify(doc, null, 2) + '\n');
  writeFileSync(join(tokensDir, 'brand.json'), brandBytes);

  // Same SRI form as scripts/checksum-assets.ts, so build:catalog is a no-op on it.
  const checksum = `sha256-${createHash('sha256').update(brandBytes).digest('base64')}`;
  const assets: Record<string, unknown>[] = [{
    id: `${args.ns}/tokens/brand`,
    name: `${args.label} Design Tokens`,
    type: 'tokens',
    version: '1.0.0',
    tier: 'core',
    tags: ['tokens', 'brand', 'dtcg'],
    formats: [{
      format: 'json',
      url: `/catalog/assets/${args.ns}/tokens/brand.json`,
      checksum,
      size: brandBytes.length,
    }],
  }];

  // Published design-system versions (plans/97 section 6a) - sibling assets of the head,
  // exactly as they are on a device: `<ns>/tokens/brand/<slug>`, the file
  // `brand.json` and the directory `brand/` living side by side. The ledger is
  // already in the head document, so nothing extra is written to describe them.
  // A version is IMMUTABLE, so each is written byte for byte as the pack shipped
  // it: re-serialising would break the checksum the ledger records.
  for (const v of published.versions) {
    const dir = join(out, 'catalog/assets', args.ns, 'tokens', 'brand');
    mkdirSync(dir, { recursive: true });
    const bytes = Buffer.from(JSON.stringify(v.doc, null, 2) + '\n');
    writeFileSync(join(dir, `${v.slug}.json`), bytes);
    assets.push({
      id: versionAssetId(`${args.ns}/tokens/brand`, v.slug),
      name: `${args.label} Design Tokens - ${v.label}`,
      description: 'A published, immutable version of this design system.',
      type: 'tokens',
      version: '1.0.0',
      tier: 'core',
      tags: ['tokens', 'brand', 'dtcg', 'design-version'],
      formats: [{
        format: 'json',
        url: `/catalog/assets/${args.ns}/tokens/brand/${v.slug}.json`,
        checksum: `sha256-${createHash('sha256').update(bytes).digest('base64')}`,
        size: bytes.length,
      }],
    });
  }

  // Preserved files: bytes a published version pins, kept because the head's own
  // copy moved on. Content-keyed ids (`<ns>/frozen/<sha12>`), so two versions
  // pinning identical bytes share one file here as they did on the device.
  for (const f of published.frozen) {
    const dir = join(out, 'catalog/assets', args.ns, 'frozen');
    mkdirSync(dir, { recursive: true });
    const key = f.id.split('/').pop()!;
    writeFileSync(join(dir, `${key}.${f.ext}`), f.bytes);
    assets.push({
      id: f.id,
      name: `Preserved file ${key}`,
      description: 'Bytes a published version of this design system pins. Never replace or re-key this file: the version that names it would lose what it published with.',
      type: f.ext === 'svg' ? 'vector' : 'raster',
      version: '1.0.0',
      tier: 'core',
      tags: ['frozen', 'design-version'],
      formats: [{
        format: f.ext,
        url: `/catalog/assets/${args.ns}/frozen/${key}.${f.ext}`,
        checksum: `sha256-${createHash('sha256').update(f.bytes).digest('base64')}`,
        size: f.bytes.length,
      }],
    });
  }

  // Derived palette docs (engine brand-treatments.ts): photo treatments always
  // (greyscale survives even an accent-free palette); icon themes only when the
  // palette yields at least one pairing (the validator rejects an empty
  // themes[] doc). Written + indexed exactly like a hand-authored catalog's.
  const paletteDir = join(out, 'catalog/assets', args.ns, 'palette');
  const paletteDocs: [slug: string, payload: { name: string; description: string } | null, blurb: string][] = [
    ['photo-treatments', derivePhotoTreatmentsDoc(doc),
      'Colour treatments for photo assets, derived from the brand tokens: greyscale + soft duotone washes.'],
    [
      'icon-themes',
      (() => { const d = deriveIconThemesDoc(doc); return d.themes.length ? d : null; })(),
      'Colour pairings for themable two-colour icons (c1 accent / c2 base), derived from the brand tokens.',
    ],
  ];
  const derivedSlugs: string[] = [];
  for (const [slug, payload, blurb] of paletteDocs) {
    if (!payload) continue;
    derivedSlugs.push(slug);
    mkdirSync(paletteDir, { recursive: true });
    const bytes = Buffer.from(JSON.stringify(payload, null, 2) + '\n');
    writeFileSync(join(paletteDir, `${slug}.json`), bytes);
    assets.push({
      id: `${args.ns}/palette/${slug}`,
      name: payload.name,
      description: blurb,
      type: 'palette',
      version: '1.0.0',
      tier: 'on-demand',
      tags: ['palette', slug],
      formats: [{
        format: 'json',
        url: `/catalog/assets/${args.ns}/palette/${slug}.json`,
        checksum: `sha256-${createHash('sha256').update(bytes).digest('base64')}`,
        size: bytes.length,
      }],
    });
  }

  const index = {
    version: '1',
    generatedAt: new Date().toISOString(),
    assets,
  };
  writeFileSync(join(out, 'catalog/assets/index.json'), JSON.stringify(index, null, 2) + '\n');

  const { sets, themes, tokenCount, colorCount } = summary;
  writeFileSync(join(out, 'README.md'), `# brands/${args.name} - ${args.label} brand pack

Hydrated by \`scripts/ingest-brand.ts\`. The token document at
\`catalog/assets/${args.ns}/tokens/brand.json\` is the extracted source
verbatim - re-run the ingest to refresh it, or hand-edit and bump the asset
version in \`catalog/assets/index.json\`.

## Provenance

- **Source:** \`${resolve(args.source)}\`
- **Container:** ${containerLabel}
- **Ingested:** ${new Date().toISOString().slice(0, 10)}
- **Contents:** ${sets.length} sets · ${themes.length} themes · ${tokenCount} tokens (${colorCount} colors)${published.versions.length ? `
- **Published versions:** ${published.versions.map(v => v.slug).join(', ')} (${published.frozen.length} preserved file${published.frozen.length === 1 ? '' : 's'}).
  Each is an immutable sibling asset under \`catalog/assets/${args.ns}/tokens/brand/\`.
  Never edit one: a tool pinned to it, or \`?designv=\`, resolves against exactly
  these bytes, and \`npm run validate:catalog\` reads the checksum the ledger records.` : ''}

## Next steps

1. Register the profile (if you didn't pass \`--register\`): add
   \`profiles.json → profiles.${args.name}\` pointing \`catalog\` here.
2. Activate and build the generated tool index:
   \`node scripts/use-profile.ts ${args.name} && npm run build:catalog && npm run validate:catalog\`
   (\`--activate\` does all three).
3. Grow the pack: brand tools under \`${args.out}/tools/\` (append that path to
   the profile's \`tools\` roots), fonts under \`catalog/fonts/\`, previews via
   \`npm run previews\`.
`);

  const derived = derivedSlugs.join(' + ') || 'none';
  const published_ = published.versions.length
    ? `; ${published.versions.length} version${published.versions.length === 1 ? '' : 's'}, ${published.frozen.length} preserved file${published.frozen.length === 1 ? '' : 's'}`
    : '';
  console.log(`✓ brand pack written to ${args.out} (brand.json ${brandBytes.length} bytes, ${checksum}; derived palette docs: ${derived}${published_})`);
}

interface ProfilesFile {
  default: string;
  profiles: Record<string, { label?: string; tools: string[]; catalog: string }>;
}

/** Guarded profiles.json read - a broken file must fail BEFORE the pack is
 * written (main() pre-flights this when --register is set), not crash with a
 * raw stack after, when a re-run would additionally need --force. */
function readProfilesFile(): ProfilesFile {
  const path = join(ROOT, 'profiles.json');
  let cfg: unknown;
  try {
    cfg = JSON.parse(readFileSync(path, 'utf8'));
  } catch (e) {
    return fail(`profiles.json is missing or not valid JSON (${e instanceof Error ? e.message : e}) - fix it before --register`);
  }
  if (typeof cfg !== 'object' || cfg === null || typeof (cfg as ProfilesFile).profiles !== 'object' || (cfg as ProfilesFile).profiles === null) {
    return fail('profiles.json has no "profiles" object - fix it before --register');
  }
  return cfg as ProfilesFile;
}

/** Upsert profiles.json - never touches "default"; re-runs update in place. */
function registerProfile(args: Args): void {
  const cfg = readProfilesFile();
  const packTools = join(ROOT, args.out, 'tools'); // pack-owned tools root, sibling of catalog/
  cfg.profiles[args.name] = {
    label: args.label,
    tools: ['community', ...(existsSync(packTools) ? [`${args.out}/tools`] : [])],
    catalog: `${args.out}/catalog`,
  };
  writeFileSync(join(ROOT, 'profiles.json'), JSON.stringify(cfg, null, 2) + '\n');
  console.log(`✓ registered profile "${args.name}" in profiles.json (default stays "${cfg.default}")`);
}

/** use-profile <name> → build:catalog → validate:catalog; first failure wins. */
function activateProfile(name: string): void {
  const steps: [string, string[]][] = [
    [process.execPath, [join(ROOT, 'scripts/use-profile.ts'), name]],
    ['npm', ['run', 'build:catalog']],
    ['npm', ['run', 'validate:catalog']],
  ];
  for (const [cmd, cmdArgs] of steps) {
    const r = spawnSync(cmd, cmdArgs, { stdio: 'inherit', cwd: ROOT });
    if (r.status !== 0) {
      console.error(`✗ ${cmd} ${cmdArgs.join(' ')} failed (exit ${r.status ?? 'signal'})`);
      process.exit(r.status ?? 1);
    }
  }
  console.log(`✓ profile "${name}" active - catalog built and validated`);
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  if (args.register) readProfilesFile(); // pre-flight: fail before the pack is written
  const { extraction, containerLabel, notes, versions = [], frozen = [] } = extract(args.source, args.ns);

  // Extraction never throws - problems land here, and they matter: a partially
  // merged doc can silently miss whole sets, so show every warning up front.
  for (const w of extraction.warnings) console.warn(`⚠ ${w}`);

  if (!extraction.doc) {
    fail(`no usable token document in ${args.source} - see warnings above`);
  }
  const summary = summarizeTokensDoc(extraction.doc);
  if (summary.colorCount === 0) {
    fail(`extracted ${summary.tokenCount} tokens but ZERO resolvable colors - a brand pack without colors is almost certainly the wrong source (${containerLabel}: ${args.source})`);
  }
  console.log(
    `✓ extracted ${containerLabel}: ` +
    `${summary.sets.length} sets · ${summary.themes.length} themes · ` +
    `${summary.tokenCount} tokens (${summary.colorCount} colors)` +
    (versions.length ? ` · ${versions.length} versions, ${frozen.length} preserved files` : ''),
  );
  // What the container carried and this script does NOT take - said out loud,
  // right under the ✓, so a partial import is never mistaken for a whole one.
  for (const n of notes) console.log(`· ${n}`);

  emitPack(args, extraction.doc, containerLabel, summary, { versions, frozen });
  if (args.register) registerProfile(args);
  if (args.activate) activateProfile(args.name);
}

main();
