#!/usr/bin/env node
/**
 * Tracker-module (and other audio) catalog ingest — DRY RUN BY DEFAULT.
 *
 * Run as:
 *   node scripts/ingest-audio.ts <srcDir> --brand <lolly-start|suse> --prefix <id/prefix>
 *        [--licence <SPDX-or-LicenseRef>] [--author "Name"] [--tag <t>]… [--neurospicy] [--write]
 *
 * Turns a directory of tracker modules into `type: "audio"` entries in a BRAND's
 * catalog (`brands/<brand>/catalog/assets/index.json`) plus the byte copies beside
 * them. libopenmpt decodes .mod/.xm/.s3m/.it/.stm/.mtm faithfully in the web shell
 * (shells/web/src/lib/mod-worker.ts), so a module is a first-class playable and
 * analysable asset — the format badge is its REAL extension, never transcoded.
 *
 * ── WHY THIS SCRIPT REFUSES TO GUESS A LICENCE ──────────────────────────────
 * There is no "community catalog": community/ holds TOOLS, catalogs are PER BRAND.
 * So every asset ingested here lands in either a PUBLIC repo (brands/lolly-start,
 * inside this parent repo) or a private one (brands/suse). This catalog has already
 * been burned once by third-party music that had to be torn back out of an OSS repo
 * (the PremiumBeat episode). Tracker modules from the demoscene are works by named,
 * identifiable authors — an unlicensed one shipped in a public repo is the single
 * worst outcome this script could produce, worse than shipping nothing.
 *
 * Therefore: a licence is REQUIRED per file, from `--licence` or a per-file sidecar
 * (`<file>.licence.json`). There is NO default and no fallback. A file with no
 * licence is reported as REFUSED, is never emitted, and — under `--write` — aborts
 * the entire run before a single byte is copied. Do not "fix" this by adding a
 * default. `--licence unknown`/`none`/`?` is rejected too: silence and a placeholder
 * are the same mistake wearing different hats.
 *
 * ── DRY RUN ─────────────────────────────────────────────────────────────────
 * Without `--write` nothing is created, copied or modified: the script prints the
 * exact JSON entries it WOULD append and the file copies it WOULD make. `--write`
 * must be explicit, and it writes to the brand pack directly (never to the
 * gitignored tools/ + catalog/ profile VIEWS).
 *
 * ── PROVENANCE OF THE FIELDS ────────────────────────────────────────────────
 * name        the module's OWN embedded title, read out of its header (MOD: 20 bytes
 *             at 0; XM: 20 at 17 after "Extended Module: "; IT: 26 at 4 after "IMPM";
 *             S3M: 28 at 0; STM: 20 at 0; MTM: 20 at 4), prettified. Falls back to a
 *             prettified filename only when the header carries no title.
 * id          `<prefix>/<slug-of-title>` — checked against asset.schema.json's id
 *             pattern, which forbids '-' in the FIRST segment ('lolly-start/…' is
 *             illegal; use 'lolly/…').
 * format      the file's real extension (mod/xm/it/…). libopenmpt sniffs the format
 *             from the bytes, so this is cosmetic — but the badge and the downloaded
 *             filename have to stay honest.
 * checksum    SRI sha256-<base64>, byte-identical to scripts/checksum-assets.ts's
 *             `sriForFile`. That module is NOT imported because it self-executes on
 *             import (it calls run() at top level and rewrites the ACTIVE catalog),
 *             so the four lines are restated here rather than a second convention
 *             invented. If checksum-assets.ts ever grows a main-module guard, delete
 *             `sri()` below and import it instead.
 * durationMs  measured, not guessed: the vendored libopenmpt WASM
 *             (shells/web/src/vendor/libopenmpt) loads under Node too, so the exact
 *             `openmpt_module_get_duration_seconds` is used when the web shell is
 *             mounted. When it is not (public clone without the shell submodule) the
 *             field falls back to a sidecar `durationMs` and is otherwise OMITTED —
 *             the schema allows that, and an invented number would be a lie the
 *             player would visibly contradict.
 *
 * ── SIDECARS ────────────────────────────────────────────────────────────────
 * `<file>.licence.json` (also accepted: `<file>.license.json`), any subset of:
 *   { "licence": "CC-BY-4.0", "author": "adkd", "title": "Absalon Junction",
 *     "description": "…", "tags": ["chiptune"], "durationMs": 155520,
 *     "source": "https://modarchive.org/…", "neurospicy": false }
 * Sidecar values beat the matching CLI flag; the CLI flag is the batch default.
 */

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const USAGE = `Usage:
  node scripts/ingest-audio.ts <srcDir> --brand <brand> --prefix <id/prefix> [options]

  <srcDir>       directory of tracker modules (${'.mod .xm .s3m .it .stm .mtm'})
  --brand        a key from profiles.json (e.g. lolly-start, suse) — decides which
                 brand pack's catalog receives the entries
  --prefix       asset-id prefix, e.g. 'lolly/modules'. First segment must be
                 [a-z0-9]+ with NO hyphen (asset.schema.json id pattern).
  --licence      SPDX id or LicenseRef-* applied to every file lacking a sidecar.
                 REQUIRED unless every file has a sidecar. There is no default.
  --author       credit applied to every file lacking a sidecar author
  --tag          extra tag (repeatable)
  --neurospicy   tag these as focus-music (see the note in decideTags) — default OFF
  --tier         core | catalog | on-demand   (default: on-demand)
  --write        actually copy the files and update the brand's assets/index.json.
                 Omit for a DRY RUN, which is the default and touches nothing.`;

/** The tracker formats libopenmpt decodes for us — mirrors MODULE_FORMATS in
 *  shells/web/src/lib/mod-render.ts. Kept as a literal so this script has no
 *  dependency on the web shell being mounted. */
export const MODULE_FORMATS = ['mod', 'xm', 's3m', 'it', 'stm', 'mtm'] as const;

/** asset.schema.json's id pattern. Restated so a bad id fails HERE, loudly, rather
 *  than in validate-catalog after the bytes have already been copied. */
export const ASSET_ID_RE = /^[a-z0-9]+(\/[a-z0-9][a-z0-9-]*)+$/;

/** Licence strings that mean "we don't know" and must never reach an entry. */
const NON_LICENCES = new Set(['', 'unknown', 'none', 'n/a', 'na', '?', 'tbd', 'todo', 'unlicensed']);

// ── header title extraction ─────────────────────────────────────────────────

/** Read a fixed-width, NUL-padded field as latin1 text (tracker headers are 8-bit). */
function field(buf: Uint8Array, offset: number, length: number): string {
  if (offset + length > buf.length) return '';
  let end = offset;
  while (end < offset + length && buf[end] !== 0) end++;
  return Buffer.from(buf.subarray(offset, end)).toString('latin1');
}

function magic(buf: Uint8Array, offset: number, text: string): boolean {
  return field(buf, offset, text.length) === text
    || Buffer.from(buf.subarray(offset, offset + text.length)).toString('latin1') === text;
}

/**
 * The module's own embedded title, or '' when the header carries none.
 * `ext` steers the layout; the magic bytes are checked where the format has them so
 * a mislabelled file doesn't yield 20 bytes of sample data as a display name.
 */
export function embeddedTitle(bytes: Uint8Array, ext: string): string {
  let raw = '';
  switch (ext) {
    case 'xm':
      if (!magic(bytes, 0, 'Extended Module: ')) return '';
      raw = field(bytes, 17, 20);
      break;
    case 'it':
      if (!magic(bytes, 0, 'IMPM')) return '';
      raw = field(bytes, 4, 26);
      break;
    case 's3m':
      if (!magic(bytes, 0x2c, 'SCRM')) return '';
      raw = field(bytes, 0, 28);
      break;
    case 'mtm':
      if (!magic(bytes, 0, 'MTM')) return '';
      raw = field(bytes, 4, 20);
      break;
    case 'mod':
    case 'stm':
      // MOD has no leading magic (the 4-byte tag sits at 1080 and varies by
      // channel count), STM's tag is at 20 — both put the title first.
      raw = field(bytes, 0, 20);
      break;
    default:
      return '';
  }
  // Blank out control bytes (tracker headers are raw 8-bit, not text), then drop the
  // scene decoration crusted onto the ends ("|- sunlight -|", "*** foo ***").
  const printable = Array.from(raw, ch => (ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f ? ' ' : ch)).join('');
  return printable.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N})\]]+$/gu, '').trim();
}

/** "sweet_vibez" / "adkd_-_absalon_junction" → "Sweet Vibez" / "Adkd Absalon Junction". */
export function prettify(s: string): string {
  const words = s.replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  return words
    .map(w => (/[A-Z]/.test(w.slice(1)) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(' ');
}

/** Display name: the embedded title if there is one, else the prettified filename. */
export function displayName(bytes: Uint8Array, filename: string): { name: string; from: 'header' | 'filename' } {
  const ext = extname(filename).slice(1).toLowerCase();
  const title = embeddedTitle(bytes, ext);
  if (title) return { name: prettify(title), from: 'header' };
  return { name: prettify(filename.slice(0, filename.length - extname(filename).length)), from: 'filename' };
}

/** Title → id slug: lowercase, non-alphanumerics collapsed to single hyphens. */
export function slugify(name: string): string {
  return name
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── checksum (identical convention to scripts/checksum-assets.ts) ───────────

/** SRI SHA-256 + byte size, exactly as scripts/checksum-assets.ts computes them. */
export function sri(bytes: Uint8Array): { checksum: string; size: number } {
  return { checksum: `sha256-${createHash('sha256').update(bytes).digest('base64')}`, size: bytes.length };
}

// ── tagging ─────────────────────────────────────────────────────────────────

/**
 * Tags for a module entry.
 *
 * On `neurospicy`: the tag does NOT gate whether a track is playable in the focus
 * player — lib/neurospicy.ts queries ALL `type:'audio'` catalog assets and groups
 * the untagged ones under a separate "Catalog" section, and views/tool-actions.ts
 * lists every audio asset in the video music-bed select regardless. What the tag
 * actually decides is PLACEMENT: tagged tracks sort into the ambient/beats focus
 * groups and into the "Focus loops (Neurospicy)" optgroup above the music beds.
 *
 * Default OFF for tracker modules, deliberately. The existing `neurospicy` entries
 * are short seamless CC0 loops built to disappear behind work; these are composed
 * scene tracks of 1–6 minutes with intros, breaks and arrangement changes — exactly
 * the attention-grabbing shape focus music is meant not to have. They belong in the
 * "Catalog" / "Music beds" group, where they read as selectable music rather than
 * as the default focus bed. `--neurospicy` opts an ingest in when the batch really
 * is loop-shaped.
 */
export function decideTags(ext: string, extra: string[], neurospicy: boolean): string[] {
  const tags = ['audio', 'music', 'module', 'tracker', ext];
  if (neurospicy) tags.push('neurospicy');
  for (const t of extra) if (!tags.includes(t)) tags.push(t);
  return tags;
}

/** Description: the credit is part of the asset, not a comment — these are named works. */
export function buildDescription(o: {
  ext: string; author?: string; licence: string; source?: string; durationMs?: number; override?: string;
}): string {
  if (o.override) return o.override;
  const secs = o.durationMs != null ? ` — ${Math.round(o.durationMs / 1000)} s` : '';
  const by = o.author ? ` by ${o.author}` : '';
  const src = o.source ? ` Source: ${o.source}.` : '';
  return `Tracker module (${o.ext.toUpperCase()})${by}${secs} — decoded on-device by libopenmpt; `
    + `selectable as a video music bed and in the focus player. Licence: ${o.licence}.${src}`;
}

// ── sidecars + args ─────────────────────────────────────────────────────────

export interface Sidecar {
  licence?: string; license?: string; author?: string; title?: string; description?: string;
  tags?: string[]; durationMs?: number; source?: string; neurospicy?: boolean;
}

export function readSidecar(absFile: string): Sidecar | null {
  for (const suffix of ['.licence.json', '.license.json']) {
    const p = absFile + suffix;
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf8')) as Sidecar;
  }
  return null;
}

/** A licence string we are willing to record, or null (which means: refuse). */
export function normaliseLicence(raw: string | undefined): string | null {
  const v = (raw ?? '').trim();
  if (NON_LICENCES.has(v.toLowerCase())) return null;
  return v;
}

interface Args {
  srcDir: string; brand: string; prefix: string;
  licence?: string; author?: string; tags: string[];
  neurospicy: boolean; tier: string; write: boolean;
}

function fail(msg: string): never {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

export function parseArgs(argv: string[]): Args {
  if (!argv.length || argv.includes('--help') || argv.includes('-h')) {
    console.log(USAGE);
    process.exit(argv.length ? 0 : 1);
  }
  const flags: Record<string, string | boolean> = {};
  const tags: string[] = [];
  const positional: string[] = [];
  const VALUED = ['brand', 'prefix', 'licence', 'license', 'author', 'tag', 'tier'];
  const BOOLS = ['write', 'neurospicy'];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) { positional.push(a); continue; }
    const eq = a.indexOf('=');
    const key = eq === -1 ? a.slice(2) : a.slice(2, eq);
    if (BOOLS.includes(key)) { flags[key] = true; continue; }
    if (!VALUED.includes(key)) fail(`unknown flag --${key}\n\n${USAGE}`);
    const value = eq === -1 ? argv[++i] : a.slice(eq + 1);
    if (value === undefined) fail(`--${key} needs a value`);
    if (key === 'tag') tags.push(value); else flags[key] = value;
  }
  if (positional.length !== 1) fail(`expected exactly one <srcDir>, got ${positional.length}\n\n${USAGE}`);

  const brand = typeof flags.brand === 'string' ? flags.brand : fail(`--brand is required\n\n${USAGE}`);
  const prefix = (typeof flags.prefix === 'string' ? flags.prefix : fail(`--prefix is required\n\n${USAGE}`))
    .replace(/^\/+|\/+$/g, '');
  // Validate the prefix by probing a complete id — the pattern's first-segment rule
  // ('lolly-start/…' is illegal) only shows up on the whole string.
  if (!ASSET_ID_RE.test(`${prefix}/probe`)) {
    fail(`--prefix "${prefix}" cannot form a legal asset id (asset.schema.json: ${ASSET_ID_RE}).\n`
      + `  The FIRST segment must be [a-z0-9]+ with no hyphen — for the lolly-start brand use e.g. "lolly/modules".`);
  }
  const tier = typeof flags.tier === 'string' ? flags.tier : 'on-demand';
  if (!['core', 'catalog', 'on-demand'].includes(tier)) fail(`--tier "${tier}" must be core | catalog | on-demand`);

  return {
    srcDir: positional[0]!,
    brand,
    prefix,
    licence: (typeof flags.licence === 'string' ? flags.licence : undefined)
      ?? (typeof flags.license === 'string' ? flags.license : undefined),
    author: typeof flags.author === 'string' ? flags.author : undefined,
    tags,
    neurospicy: flags.neurospicy === true,
    tier,
    write: flags.write === true,
  };
}

/** brands/<brand>/catalog for a profiles.json key — never the gitignored catalog/ VIEW. */
export function catalogDirForBrand(brand: string, profiles: { profiles: Record<string, { catalog: string }> }): string {
  const p = profiles.profiles[brand];
  if (!p) {
    fail(`--brand "${brand}" is not in profiles.json (known: ${Object.keys(profiles.profiles).join(', ')})`);
  }
  if (/^(catalog|tools)(\/|$)/.test(p.catalog)) {
    fail(`profile "${brand}" points at the ${p.catalog} profile VIEW — refusing to write through a symlink farm`);
  }
  return p.catalog;
}

// ── duration ────────────────────────────────────────────────────────────────

interface Openmpt {
  cwrap(n: string, r: string | null, a: string[]): (...args: number[]) => number;
  _malloc(n: number): number;
  _free(p: number): void;
  HEAPU8: Uint8Array;
}
let mptPromise: Promise<Openmpt | null> | null = null;

/**
 * The vendored libopenmpt WASM, if the web shell is mounted. It is an
 * `ENVIRONMENT=web,worker` SINGLE_FILE build, but it loads under Node all the same,
 * which is what lets durationMs be MEASURED here instead of guessed. Returns null
 * when the submodule is absent — the caller then omits durationMs.
 */
async function openmpt(): Promise<Openmpt | null> {
  if (!mptPromise) {
    mptPromise = (async () => {
      const p = join(ROOT, 'shells/web/src/vendor/libopenmpt/libopenmpt.mjs');
      if (!existsSync(p)) return null;
      try {
        const mod = await import(p) as { default: () => Promise<Openmpt> };
        return await mod.default();
      } catch { return null; }
    })();
  }
  return mptPromise;
}

/** Exact playback length in ms via openmpt_module_get_duration_seconds, or null. */
export async function measureDurationMs(bytes: Uint8Array): Promise<number | null> {
  const M = await openmpt();
  if (!M) return null;
  const create = M.cwrap('openmpt_module_create_from_memory2', 'number',
    ['number', 'number', 'number', 'number', 'number', 'number', 'number', 'number', 'number']);
  const seconds = M.cwrap('openmpt_module_get_duration_seconds', 'number', ['number']);
  const destroy = M.cwrap('openmpt_module_destroy', null, ['number']);
  const ptr = M._malloc(bytes.length);
  try {
    M.HEAPU8.set(bytes, ptr);
    const handle = create(ptr, bytes.length, 0, 0, 0, 0, 0, 0, 0);
    if (!handle) return null;
    try {
      const s = seconds(handle);
      return Number.isFinite(s) && s > 0 ? Math.round(s * 1000) : null;
    } finally { destroy(handle); }
  } finally { M._free(ptr); }
}

// ── planning ────────────────────────────────────────────────────────────────

export interface AssetFormat {
  format: string; url: string; checksum: string; size: number; durationMs?: number;
}
export interface AssetEntry {
  id: string; name: string; description: string; type: 'audio';
  version: string; tier: string; tags: string[]; formats: AssetFormat[]; license: string;
}
export interface PlannedFile {
  src: string; file: string; ok: boolean; reason?: string;
  entry?: AssetEntry; destRel?: string; titleFrom?: 'header' | 'filename';
}

export function listModules(srcDir: string): string[] {
  if (!existsSync(srcDir) || !statSync(srcDir).isDirectory()) fail(`<srcDir> "${srcDir}" is not a directory`);
  return readdirSync(srcDir)
    .filter(f => (MODULE_FORMATS as readonly string[]).includes(extname(f).slice(1).toLowerCase()))
    .sort();
}

/** Build the entry a file WOULD get, or an `ok: false` refusal explaining why not. */
export async function planFile(absSrc: string, file: string, args: Args, existingIds: Set<string>): Promise<PlannedFile> {
  const bytes = new Uint8Array(readFileSync(absSrc));
  const ext = extname(file).slice(1).toLowerCase();
  const side = readSidecar(absSrc) ?? {};

  const licence = normaliseLicence(side.licence ?? side.license ?? args.licence);
  if (!licence) {
    return {
      src: absSrc, file, ok: false,
      reason: 'NO LICENCE. Pass --licence <SPDX-or-LicenseRef-…>, or drop a '
        + `"${file}.licence.json" sidecar beside it. This script never defaults a licence: `
        + 'a named scene work with no recorded terms must not enter a brand catalog.',
    };
  }

  const named = side.title ? { name: prettify(side.title), from: 'header' as const } : displayName(bytes, file);
  const slug = slugify(named.name);
  const id = `${args.prefix}/${slug}`;
  if (!ASSET_ID_RE.test(id)) return { src: absSrc, file, ok: false, reason: `derived id "${id}" is not a legal asset id` };
  if (existingIds.has(id)) {
    return { src: absSrc, file, ok: false, reason: `id "${id}" already exists in this catalog — asset ids are permanent and never reused` };
  }

  const { checksum, size } = sri(bytes);
  const durationMs = side.durationMs ?? (await measureDurationMs(bytes)) ?? undefined;
  const destRel = `catalog/assets/${id}.${ext}`;

  const format: AssetFormat = { format: ext, url: `/${destRel}`, checksum, size };
  if (durationMs != null) format.durationMs = durationMs;

  return {
    src: absSrc, file, ok: true, destRel, titleFrom: named.from,
    entry: {
      id,
      name: named.name,
      description: buildDescription({
        ext, author: side.author ?? args.author, licence, source: side.source, durationMs,
        override: side.description,
      }),
      type: 'audio',
      version: '1.0.0',
      tier: args.tier,
      tags: decideTags(ext, [...args.tags, ...(side.tags ?? [])], side.neurospicy ?? args.neurospicy),
      formats: [format],
      license: licence,
    },
  };
}

// ── main ────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const profiles = JSON.parse(readFileSync(join(ROOT, 'profiles.json'), 'utf8')) as
    { profiles: Record<string, { catalog: string }> };
  const catalogRel = catalogDirForBrand(args.brand, profiles);
  const indexPath = join(ROOT, catalogRel, 'assets/index.json');
  if (!existsSync(indexPath)) fail(`${catalogRel}/assets/index.json not found — is the "${args.brand}" pack mounted? (git submodule update --init)`);
  const index = JSON.parse(readFileSync(indexPath, 'utf8')) as { assets: AssetEntry[]; generatedAt?: string };
  const existingIds = new Set(index.assets.map(a => a.id));

  const srcDir = resolve(args.srcDir);
  const files = listModules(srcDir);
  const mode = args.write ? 'WRITE' : 'DRY RUN';

  console.log(`\n${mode} · brand "${args.brand}" → ${catalogRel}/assets/index.json`);
  console.log(`prefix "${args.prefix}" · tier ${args.tier} · ${files.length} module file(s) in ${srcDir}`);
  const M = await openmpt();
  console.log(M
    ? 'durationMs: MEASURED via vendored libopenmpt (shells/web/src/vendor/libopenmpt)'
    : 'durationMs: OMITTED — vendored libopenmpt not available under this checkout; supply it per file via a sidecar "durationMs" if you need it');
  console.log('');

  const planned: PlannedFile[] = [];
  for (const f of files) planned.push(await planFile(join(srcDir, f), f, args, existingIds));

  const ok = planned.filter(p => p.ok);
  const refused = planned.filter(p => !p.ok);

  for (const p of ok) {
    console.log(`─ ${p.file}   (name from ${p.titleFrom})`);
    console.log(`  COPY  ${p.src}`);
    console.log(`     →  ${catalogRel}/${p.destRel!.replace(/^catalog\//, '')}`);
    console.log(`  ENTRY ${JSON.stringify(p.entry, null, 2).split('\n').join('\n  ')}`);
    console.log('');
  }
  for (const p of refused) {
    console.log(`─ ${p.file}`);
    console.log(`  ✗ REFUSED — ${p.reason}`);
    console.log('');
  }

  console.log(`${ok.length} entr${ok.length === 1 ? 'y' : 'ies'} planned · ${refused.length} refused`);

  if (!args.write) {
    console.log('\nDRY RUN — nothing was written. Re-run with --write once every file has a licence.');
    return;
  }
  if (refused.length) {
    fail(`${refused.length} file(s) refused (see above). Nothing was written: a partial ingest that `
      + 'silently drops the unlicensed files is how an unlicensed asset gets shipped later by hand.');
  }
  for (const p of ok) {
    const dest = join(ROOT, catalogRel, p.destRel!.replace(/^catalog\//, ''));
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(p.src, dest);
    index.assets.push(p.entry!);
  }
  writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  console.log(`\n✓ wrote ${ok.length} asset(s) into ${catalogRel}. Now run: npm run build:catalog:all && npm run validate:catalog:all`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => fail(String(e)));
}
