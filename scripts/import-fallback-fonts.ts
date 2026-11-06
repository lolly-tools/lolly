#!/usr/bin/env node
// SPDX-License-Identifier: MPL-2.0
/** Build the on-demand fallback fonts in community/fallback-fonts from pinned upstream files.
 *
 *    node scripts/import-fallback-fonts.ts [--source=dir] [--write] [--check]
 *
 *  The fonts fill characters a design system's own fonts cannot draw, so an export can
 *  keep those words as vector outlines. They are Noto fonts from google/fonts at the
 *  commit pinned in scripts/data/fallback-fonts.json. Fetch them once with git, so the
 *  commit hash is the content identity, into dist/ (never committed):
 *
 *    git clone --filter=blob:none --no-checkout https://github.com/google/fonts.git dist/fallback-font-sources/gf
 *    git -C dist/fallback-font-sources/gf sparse-checkout set --no-cone \
 *      /ofl/notosansarabic/ /ofl/notosanshebrew/ /ofl/notosansdevanagari/ \
 *      /ofl/notosansbengali/ /ofl/notosansthai/ /ofl/notosans/
 *    git -C dist/fallback-font-sources/gf checkout <commit>
 *
 *  Each upstream file must match its pinned sha256 or nothing is written. Then, per pack:
 *
 *  - the width axis is pinned at its default (100), which halves the file and leaves the
 *    weight axis whole, so every weight a design asks for still draws;
 *  - the Latin, Greek and Cyrillic packs are cut out of Noto Sans by script, each keeping
 *    the spaces, joiners and combining marks its words need, so a Cyrillic word does not
 *    download the Greek letters;
 *  - the result is compressed to WOFF2.
 *
 *  Glyph outlines are not changed. The tools are the subsetter in the pinned harfbuzzjs
 *  (harfbuzz-subset.wasm) and the pinned woff2-encoder, so the same inputs give the same
 *  bytes on any machine. `--write` writes the fonts, one licence text per upstream family
 *  and index.json; `--check` builds in memory and fails when a committed file differs.
 *  With neither, it prints what it would write. Run `pnpm run build:catalog:all` after
 *  `--write` so the catalog dates and checksums follow.
 */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { unicodeRangeOf } from '../packages/node-shell/src/fallback-fonts.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'community/fallback-fonts');
const URL_PREFIX = '/catalog/packs/fallback-fonts/';
const PINS = join(ROOT, 'scripts/data/fallback-fonts.json');
const OFL_URL = 'https://openfontlicense.org/open-font-license-official-text/';

interface UpstreamPin {
  path: string; sha256: string; bytes: number; fontVersion: string; repository: string;
  licence: { path: string; sha256: string };
}
interface PackPin {
  id: string; file: string; upstream: string; family: string; label: string;
  scripts: string[]; style: 'normal' | 'italic'; cut?: string[];
}
interface Pins {
  source: { repository: string; commit: string };
  upstream: Record<string, UpstreamPin>;
  packs: PackPin[];
}

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const WRITE = args.includes('--write');
const CHECK = args.includes('--check');
const SOURCE = resolve(flag('source') ?? join(ROOT, 'dist/fallback-font-sources/gf'));

const sha256Hex = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex');
const sri = (bytes: Uint8Array): string => `sha256-${createHash('sha256').update(bytes).digest('base64')}`;

// ── HarfBuzz's subsetter, driven over its C API ─────────────────────────────

interface SubsetWasm {
  memory: WebAssembly.Memory;
  _initialize?: () => void;
  malloc(n: number): number;
  free(p: number): void;
  hb_blob_create(data: number, length: number, mode: number, user: number, destroy: number): number;
  hb_blob_destroy(blob: number): void;
  hb_blob_get_length(blob: number): number;
  hb_blob_get_data(blob: number, length: number): number;
  hb_face_create(blob: number, index: number): number;
  hb_face_destroy(face: number): void;
  hb_face_reference_blob(face: number): number;
  hb_set_clear(set: number): void;
  hb_set_add(set: number, value: number): void;
  hb_subset_input_create_or_fail(): number;
  hb_subset_input_destroy(input: number): void;
  hb_subset_input_unicode_set(input: number): number;
  hb_subset_input_glyph_set(input: number): number;
  hb_subset_input_keep_everything(input: number): void;
  hb_subset_input_pin_axis_to_default(input: number, face: number, tag: number): number;
  hb_subset_or_fail(face: number, input: number): number;
}

const require = createRequire(import.meta.url);
const tag = (name: string): number => ((name.charCodeAt(0) << 24) | (name.charCodeAt(1) << 16) | (name.charCodeAt(2) << 8) | name.charCodeAt(3)) >>> 0;

async function subsetter(): Promise<SubsetWasm> {
  const bytes = await readFile(require.resolve('harfbuzzjs/dist/harfbuzz-subset.wasm'));
  const { instance } = await WebAssembly.instantiate(bytes, {});
  const wasm = instance.exports as unknown as SubsetWasm;
  wasm._initialize?.();
  return wasm;
}

/**
 * Pin `wdth` at its default and, given `unicodes`, keep only those characters (and the
 * glyphs shaping reaches from them). Everything else in the font is kept: names, layout
 * and the weight axis.
 */
function subset(wasm: SubsetWasm, font: Uint8Array, unicodes: readonly number[] | null): Uint8Array {
  const ptr = wasm.malloc(font.length);
  new Uint8Array(wasm.memory.buffer).set(font, ptr);
  const blob = wasm.hb_blob_create(ptr, font.length, 2 /* HB_MEMORY_MODE_WRITABLE */, 0, 0);
  const face = wasm.hb_face_create(blob, 0);
  const input = wasm.hb_subset_input_create_or_fail();
  if (!input) throw new Error('harfbuzz: no subset input');
  try {
    wasm.hb_subset_input_keep_everything(input);
    if (unicodes) {
      const set = wasm.hb_subset_input_unicode_set(input);
      wasm.hb_set_clear(set);
      for (const cp of unicodes) wasm.hb_set_add(set, cp);
      wasm.hb_set_clear(wasm.hb_subset_input_glyph_set(input));
    }
    if (!wasm.hb_subset_input_pin_axis_to_default(input, face, tag('wdth'))) throw new Error('harfbuzz: the font has no wdth axis to pin');
    const result = wasm.hb_subset_or_fail(face, input);
    if (!result) throw new Error('harfbuzz: subsetting failed');
    const out = wasm.hb_face_reference_blob(result);
    const length = wasm.hb_blob_get_length(out);
    const data = wasm.hb_blob_get_data(out, 0);
    const copy = new Uint8Array(wasm.memory.buffer, data, length).slice();
    wasm.hb_blob_destroy(out);
    wasm.hb_face_destroy(result);
    return copy;
  } finally {
    wasm.hb_subset_input_destroy(input);
    wasm.hb_face_destroy(face);
    wasm.hb_blob_destroy(blob);
    wasm.free(ptr);
  }
}

/** The characters a font maps, read by the same HarfBuzz the shells shape with. */
async function cmapOf(font: Uint8Array): Promise<number[]> {
  const hb = await import('harfbuzzjs');
  const blob = new hb.Blob(font as unknown as ArrayBuffer);
  const face = new hb.Face(blob);
  return [...new Set(face.collectUnicodes())].sort((a, b) => a - b);
}

// ── Which characters a pack keeps, and which it is chosen for ──────────────

const SPACES = /^[\p{Zs}\p{Default_Ignorable_Code_Point}]$/u;
const scriptTest = (code: string): RegExp => (code === 'Zyyy' || code === 'Zinh'
  ? new RegExp(`^\\p{Script=${code}}$`, 'u')
  : new RegExp(`^\\p{Script_Extensions=${code}}$`, 'u'));
const INHERITED = scriptTest('Zinh');

/** A cut keeps its scripts' characters plus the spaces, joiners and marks they combine with. */
function cutOf(cmap: readonly number[], scripts: readonly string[]): number[] {
  const tests = scripts.map(scriptTest);
  return cmap.filter((cp) => {
    const ch = String.fromCodePoint(cp);
    return SPACES.test(ch) || INHERITED.test(ch) || tests.some((t) => t.test(ch));
  });
}

/** The characters a pack is chosen for: its own scripts', never a neighbour's spaces or digits. */
function claimsOf(cmap: readonly number[], scripts: readonly string[]): number[] {
  const tests = scripts.map(scriptTest);
  return cmap.filter((cp) => tests.some((t) => t.test(String.fromCodePoint(cp))));
}

/** `2.012` → `2.12.0`, the catalog's version grammar, as the Noto emoji pack does. */
function packVersion(fontVersion: string): string {
  const [major, minor] = fontVersion.split('.');
  return `${Number(major)}.${Number(minor)}.0`;
}

const slug = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const firstLine = (text: string): string => text.split(/\r?\n/)[0]!.trim();

async function main(): Promise<void> {
  const pins = JSON.parse(await readFile(PINS, 'utf8')) as Pins;
  if (!existsSync(SOURCE)) throw new Error(`No upstream checkout at ${SOURCE}. See this script's header for the git commands.`);

  const upstream = new Map<string, { font: Uint8Array; licence: string }>();
  for (const [key, pin] of Object.entries(pins.upstream)) {
    const font = new Uint8Array(await readFile(join(SOURCE, pin.path)));
    const licence = await readFile(join(SOURCE, pin.licence.path));
    if (sha256Hex(font) !== pin.sha256 || font.length !== pin.bytes) throw new Error(`${pin.path}: does not match its pin (sha256 ${sha256Hex(font)}, ${font.length} bytes)`);
    if (sha256Hex(licence) !== pin.licence.sha256) throw new Error(`${pin.licence.path}: does not match its pin`);
    upstream.set(key, { font, licence: licence.toString('utf8') });
  }

  const wasm = await subsetter();
  const woff2 = (await import('woff2-encoder')) as { compress(b: Uint8Array): Promise<Uint8Array> };
  const files = new Map<string, Uint8Array>();
  const assets: unknown[] = [];
  const report: string[] = [];

  for (const pack of pins.packs) {
    const pin = pins.upstream[pack.upstream];
    const source = upstream.get(pack.upstream);
    if (!pin || !source) throw new Error(`${pack.id}: no upstream "${pack.upstream}"`);
    const sourceCmap = await cmapOf(source.font);
    const sfnt = subset(wasm, source.font, pack.cut ? cutOf(sourceCmap, pack.cut) : null);
    const covers = await cmapOf(sfnt);
    const claims = claimsOf(covers, pack.scripts);
    if (!claims.length) throw new Error(`${pack.id}: claims no characters`);
    const bytes = await woff2.compress(sfnt);
    files.set(pack.file, bytes);

    const licenceFile = `OFL-${slug(pin.repository.split('/').pop()!)}.txt`;
    files.set(licenceFile, new TextEncoder().encode(source.licence));
    const copyright = firstLine(source.licence);
    const changes = pack.cut
      ? `Cut from ${pack.family} ${pin.fontVersion} to the ${pack.label} characters and the spaces and marks they combine with; width axis pinned at its default; converted to WOFF2. Outlines unchanged.`
      : `Width axis pinned at its default; converted to WOFF2. Outlines unchanged.`;
    const sourceUrl = `${pins.source.repository}/blob/${pins.source.commit}/${pin.path}`;
    assets.push({
      id: pack.id,
      name: `${pack.family}${pack.cut ? ` (${pack.label}${pack.style === 'italic' ? ', italic' : ''})` : ''}`,
      description: `${pack.family} ${pin.fontVersion}${pack.style === 'italic' ? ' Italic' : ''}, used only for ${pack.label} characters that a design system's own fonts cannot draw, so an export keeps those words as vector outlines. Downloaded the first time a document needs it, then kept on the device.`,
      type: 'data',
      version: packVersion(pin.fontVersion),
      tier: 'on-demand',
      tags: ['fallback-font', slug(pack.label)],
      formats: [{ format: 'woff2', url: `${URL_PREFIX}${pack.file}`, checksum: sri(bytes), size: bytes.length }],
      license: 'OFL-1.1',
      attribution: copyright,
      meta: {
        fallbackFont: {
          family: pack.family,
          label: pack.label,
          scripts: pack.scripts,
          style: pack.style,
          weight: '100 900',
          claims: unicodeRangeOf(claims),
          covers: unicodeRangeOf(covers),
          upstreamVersion: pin.fontVersion,
          upstream: { repository: pins.source.repository, commit: pins.source.commit, path: pin.path, sha256: `sha256:${pin.sha256}`, project: pin.repository },
          changes,
          licenceFile: `${URL_PREFIX}${licenceFile}`,
        },
      },
      rights: {
        works: [{
          id: pack.id,
          title: `${pack.family} ${pin.fontVersion}`,
          creators: [{ name: 'The Noto Project Authors', role: 'creator' }],
          sourceUrl,
          revision: pins.source.commit,
          rights: [{
            assertedBy: 'catalog',
            declaration: 'OFL-1.1',
            evidence: 'notice-file',
            expression: 'OFL-1.1',
            status: 'parsed',
            textHash: `sha256:${pin.licence.sha256}`,
            url: OFL_URL,
            version: '1.1',
          }],
        }],
      },
    });
    report.push(`${pack.file.padEnd(34)} ${String(bytes.length).padStart(8)} B woff2  ${String(sfnt.length).padStart(8)} B sfnt  ${String(gzipSync(sfnt, { level: 9 }).length).padStart(8)} B sfnt gzip  ${String(covers.length).padStart(5)} chars  ${String(claims.length).padStart(5)} claimed`);
  }

  const index = {
    $comment: 'GENERATED by scripts/import-fallback-fonts.ts from scripts/data/fallback-fonts.json; do not edit by hand. A shared asset root (profiles.json `assets`) served from /catalog/packs/fallback-fonts/ on every profile. Each entry is one font that fills characters a design system cannot draw; meta.fallbackFont.claims is what it is chosen for and covers is every character it maps. Nothing here downloads until a document holds such a character. See docs/fallback-fonts.md.',
    version: 1,
    assets,
  };
  files.set('index.json', new TextEncoder().encode(`${JSON.stringify(index, null, 2)}\n`));

  console.log(report.join('\n'));
  if (CHECK) {
    let stale = 0;
    for (const [name, bytes] of files) {
      if (name === 'index.json') continue; // build:catalog stamps dates into it; the files are the contract
      const path = join(OUT_DIR, name);
      const committed = existsSync(path) ? new Uint8Array(await readFile(path)) : null;
      if (!committed || sha256Hex(committed) !== sha256Hex(bytes)) { stale++; console.error(`stale: ${name}`); }
    }
    if (stale) process.exit(1);
    console.log('community/fallback-fonts matches a fresh build.');
    return;
  }
  if (!WRITE) { console.log('(dry run: pass --write to write community/fallback-fonts)'); return; }
  await mkdir(OUT_DIR, { recursive: true });
  for (const [name, bytes] of files) await writeFile(join(OUT_DIR, name), bytes);
  console.log(`wrote ${files.size} files to ${OUT_DIR}`);
}

await main();
