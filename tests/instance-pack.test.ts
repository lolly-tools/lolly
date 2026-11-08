// SPDX-License-Identifier: MPL-2.0
/**
 * Instance-pack builder (plans/131 WP-D, scripts/build-instance-pack.ts).
 *
 * GATED on the private brands/suse pack being mounted (it is `update = none`
 * for public clones/CI - same gating as the other suse-dependent tests). Runs
 * the real builder as a subprocess into a temp dir and inspects the zip it
 * cut: the exclusion guarantees (no photos/campaign/headshots/music/audio -
 * the licence rule is absolute), the inclusion guarantees (fonts incl.
 * SUSE Mono + italics, logos, all 18 tools, the catalog font tree), and the
 * envelope (integrity map covers every part; format constants match the
 * brand-transfer reader - the two are separate codebases on purpose, so a
 * text-level drift guard pins them together).
 *
 * The lolly-demo test is NOT gated: Lolly Demo is public. It covers the variable
 * faces (`Family-Variable.ttf`) and the per-family licence list.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync } from 'fflate';
import { loadTool } from '../engine/src/loader.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suseMounted = existsSync(join(ROOT, 'brands/suse/pack.json'));

const AUDIO_EXT = /\.(mp3|m4a|aac|opus|ogg|oga|wav|flac|aiff?)$/i;
const EXCLUDED = /(photos|campaign|headshots|music)\//;

test('the suse pack builds clean: exclusions hold, fonts/tools/envelope complete', { skip: !suseMounted && 'brands/suse not mounted' }, async () => {
  const out = mkdtempSync(join(tmpdir(), 'lolly-pack-'));
  try {
    execFileSync('node', ['scripts/build-instance-pack.ts', '--out', out], { cwd: ROOT, stdio: 'pipe' });
    // The filename carries the recipe's version (`<brand>-brand-<version>.lolly`),
    // and the version tracks the Lolly release it ships with - read it from the
    // recipe rather than pinning a literal that every release bump would break.
    const { version } = JSON.parse(readFileSync(join(ROOT, 'brands/suse/pack.json'), 'utf8')) as { version: string };
    assert.match(version, /^\d+\.\d+\.\d+$/, 'pack.json version is a plain semver');
    const packPath = join(out, `suse-brand-${version}.lolly`);
    const bytes = readFileSync(packPath);
    const firstNameLength = bytes[26]! | (bytes[27]! << 8);
    assert.equal(bytes.subarray(30, 30 + firstNameLength).toString(), 'manifest.json',
      'streaming preflight can identify the pack immediately');
    const files = unzipSync(new Uint8Array(bytes));
    const names = Object.keys(files);

    // The sha256 sidecar states the exact bytes.
    const sidecar = readFileSync(`${packPath}.sha256`, 'utf8');
    assert.ok(sidecar.startsWith(createHash('sha256').update(bytes).digest('hex')));

    // Exclusions: the media that must never travel, by path and by format.
    for (const name of names) {
      assert.ok(!EXCLUDED.test(name), `excluded family leaked: ${name}`);
      assert.ok(!AUDIO_EXT.test(name), `audio leaked: ${name}`);
    }

    // Fonts: both families, uprights AND italics, as user-font rows...
    const fontRows = JSON.parse(Buffer.from(files['fonts.json']!).toString()) as
      Array<{ meta: { family: string; style: string }; file: string }>;
    const families = new Set(fontRows.map(r => r.meta.family));
    assert.deepEqual([...families].sort(), ['SUSE', 'SUSE Mono']);
    assert.ok(fontRows.some(r => r.meta.family === 'SUSE Mono' && r.meta.style === 'italic'));
    for (const row of fontRows) assert.ok(files[row.file], `font row names a missing part: ${row.file}`);
    // ...and the catalog tree for font-registry's static resolution.
    assert.ok(names.some(n => n.startsWith('catalog/fonts/webfonts/')));
    assert.ok(names.some(n => n.startsWith('catalog/fonts/variable/')));

    // Logos: the full 8-slot matrix.
    const logoRows = JSON.parse(Buffer.from(files['logos.json']!).toString()) as Array<{ id: string }>;
    assert.equal(logoRows.length, 8);

    // Tools: every entry in tools.json has its tool.json bytes aboard.
    const toolsPart = JSON.parse(Buffer.from(files['tools.json']!).toString()) as
      { tools: Array<{ id: string }>; files: Record<string, string[]> };
    // A FLOOR, not a pin: the pack's own tool set shrinks whenever a SUSE tool
    // graduates into the brand-agnostic community pack, and that is a good move,
    // not a regression. What must never happen is the pack shipping a handful.
    // 13 since 2026-09-06: battlecards, pricing-table, meeting-planner, org-chart and
    // work-avatar left for the community pack (they carry no SUSE-only content).
    assert.ok(toolsPart.tools.length >= 13, `expected ≥13 suse tools, got ${toolsPart.tools.length}`);
    for (const t of toolsPart.tools) {
      assert.ok(files[`tools/${t.id}/tool.json`], `tool ${t.id} shipped without its manifest`);
    }
    if (toolsPart.tools.some(t => t.id === '3d-studio')) {
      const studio = await loadTool('3d-studio', async path => {
        const bytes = files[`tools/${path}`];
        if (!bytes) throw new Error(`Missing packed tool file: ${path}`);
        return Buffer.from(bytes).toString();
      });
      assert.equal(studio.manifest.inputs.find(input => input.id === 'modelAsset')?.default, 'suse/model/geeko');
      for (const file of ['template.html', 'styles.css', 'hooks.js']) {
        assert.deepEqual(Buffer.from(files[`tools/3d-studio/${file}`]!), readFileSync(join(ROOT, 'community/3d-studio', file)));
      }
      assert.ok(!JSON.parse(Buffer.from(files['tools/3d-studio/tool.json']!).toString()).extends);
    }
    // The SUSE 3D variant offers the OSS sample models, but the configured
    // community instance already serves the exact same bytes. Do not pay for
    // duplicate copies in the portable brand pack.
    for (const rel of ['assets/cat.glb', 'assets/duck.glb']) {
      assert.ok(!names.includes(`tools/3d/${rel}`), `duplicated community model leaked: ${rel}`);
      assert.ok(!toolsPart.files['3d']?.includes(rel), `tools.json lists omitted community model: ${rel}`);
    }

    // Tokens + the brand's own asset entries.
    assert.ok(files['tokens.json']);
    const catalogPart = JSON.parse(Buffer.from(files['catalog.json']!).toString()) as
      { assets: Array<{ id: string; formats?: Array<{ url: string }> }> };
    assert.ok(catalogPart.assets.length > 100);
    for (const a of catalogPart.assets) {
      for (const f of a.formats ?? []) {
        if (!f.url.startsWith('/catalog/')) continue;
        assert.ok(files[f.url.slice(1)], `${a.id} references ${f.url} but the bytes are not aboard`);
      }
    }

    // Envelope: the integrity map covers every part except itself + the README.
    const manifest = JSON.parse(Buffer.from(files['manifest.json']!).toString());
    assert.equal(manifest.format, 'lolly-brand');
    assert.equal(manifest.pack?.kind, 'instance-pack');
    assert.equal(manifest.counts.fontFamilies, families.size, 'font-family count describes the bundled faces');
    assert.equal(manifest.counts.fontFiles, fontRows.length);
    for (const name of names) {
      if (name === 'manifest.json' || name === 'lolly.txt' || name === 'pack.sig') continue;
      const sri = manifest.integrity?.[name];
      assert.ok(sri, `no integrity entry for ${name}`);
      const digest = 'sha256-' + createHash('sha256').update(files[name]!).digest('base64');
      assert.equal(sri, digest, `integrity mismatch for ${name}`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('the lolly-demo pack builds from variable faces, with each family\'s licence', () => {
  // Lolly Demo is public, so this runs on every clone. Its fonts are variable files only
  // (`Family-Variable.ttf`, `Family-Italic-Variable.ttf`), and each family has its own OFL text.
  const out = mkdtempSync(join(tmpdir(), 'lolly-demo-pack-'));
  try {
    execFileSync('node', ['scripts/build-instance-pack.ts', '--brand', 'lolly-demo', '--out', out], { cwd: ROOT, stdio: 'pipe' });
    const recipe = JSON.parse(readFileSync(join(ROOT, 'brands/lolly-demo/pack.json'), 'utf8')) as
      { version: string; fonts: { families: string[]; license: string[] }; logos: Record<string, string> };
    const bytes = readFileSync(join(out, `lolly-demo-brand-${recipe.version}.lolly`));
    const files = unzipSync(new Uint8Array(bytes));
    const names = Object.keys(files);

    // Fonts: every family, upright and italic where the brand has one, each a variable face
    // labelled by its own extension and stored with its whole wght axis, as an upload is.
    const fontRows = JSON.parse(Buffer.from(files['fonts.json']!).toString()) as
      Array<{ format: string; mime: string; file: string; meta: { family: string; style: string; weight: string } }>;
    assert.deepEqual([...new Set(fontRows.map(r => r.meta.family))].sort(), [...recipe.fonts.families].sort());
    assert.ok(fontRows.some(r => r.meta.family === 'SUSE' && r.meta.style === 'italic'));
    for (const row of fontRows) {
      assert.ok(files[row.file], `font row names a missing part: ${row.file}`);
      assert.equal(row.format, 'ttf');
      assert.equal(row.mime, 'font/ttf');
      assert.match(row.meta.weight, /^\d+ \d+$/, `${row.file} keeps its weight axis`);
    }
    assert.equal(fontRows.find(r => r.meta.family === 'SUSE' && r.meta.style === 'normal')?.meta.weight, '100 900');

    // Every listed licence travels under its own name with its bytes unchanged.
    for (const rel of recipe.fonts.license) {
      const part = `fonts/${rel.slice(rel.lastIndexOf('/') + 1)}`;
      assert.deepEqual(Buffer.from(files[part]!), readFileSync(join(ROOT, 'brands/lolly-demo', rel)), `${part} is the listed licence`);
    }
    assert.ok(!files['fonts/LICENSE.txt'], 'a licence list does not also write the single-licence name');

    // Logos: one row per recipe slot.
    const logoRows = JSON.parse(Buffer.from(files['logos.json']!).toString()) as Array<{ id: string }>;
    assert.deepEqual(logoRows.map(r => r.id).sort(), Object.keys(recipe.logos).map(k => `user/logo/${k}`).sort());

    // No audio and no media family travels; everything the catalog part names is aboard.
    for (const name of names) assert.ok(!AUDIO_EXT.test(name), `audio leaked: ${name}`);
    const catalogPart = JSON.parse(Buffer.from(files['catalog.json']!).toString()) as
      { assets: Array<{ id: string; formats?: Array<{ url: string }> }> };
    for (const a of catalogPart.assets) {
      assert.ok(!/^lolly\/(loops|songs|modules|luts|3d)\//.test(a.id), `excluded family travelled: ${a.id}`);
      for (const f of a.formats ?? []) {
        if (f.url.startsWith('/catalog/')) assert.ok(files[f.url.slice(1)], `${a.id} references ${f.url} but the bytes are not aboard`);
      }
    }
    assert.ok(catalogPart.assets.some(a => a.id === 'lolly/tokens/demo'));

    // Envelope: the integrity map covers every part.
    const manifest = JSON.parse(Buffer.from(files['manifest.json']!).toString());
    assert.equal(manifest.counts.fontFiles, fontRows.length);
    for (const name of names) {
      if (name === 'manifest.json' || name === 'lolly.txt' || name === 'pack.sig') continue;
      assert.equal(manifest.integrity?.[name], 'sha256-' + createHash('sha256').update(files[name]!).digest('base64'), `integrity for ${name}`);
    }
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
});

test('builder format constants match the brand-transfer reader (drift guard)', () => {
  const script = readFileSync(join(ROOT, 'scripts/build-instance-pack.ts'), 'utf8');
  const reader = readFileSync(join(ROOT, 'shells/web/src/brand-transfer.ts'), 'utf8');
  const grab = (src: string, name: string): string => {
    const m = src.match(new RegExp(`${name} = ([^;]+);`));
    assert.ok(m, `${name} not found`);
    return m![1]!.trim();
  };
  for (const name of ['BRAND_FORMAT', 'BRAND_FORMAT_VERSION']) {
    assert.equal(grab(script, `const ${name}`), grab(reader, `export const ${name}`),
      `${name} drifted between scripts/build-instance-pack.ts and brand-transfer.ts`);
  }
  // The builder's BRAND_READER_VERSION is the MIN reader a pack it writes requires;
  // the app's is the newest format it can read. They part ways whenever the reader
  // learns a format the pack builder does not emit (reader 2 imports format-4
  // collections; instance packs stay readable by reader 1), so the guard is that a
  // pack never demands a reader newer than the app ships.
  const needs = Number(grab(script, 'const BRAND_READER_VERSION'));
  const reads = Number(grab(reader, 'export const BRAND_READER_VERSION'));
  assert.ok(Number.isInteger(needs) && Number.isInteger(reads), 'reader versions are integers');
  assert.ok(needs <= reads, `a pack would demand reader ${needs} but the app reads up to ${reads}`);
});
