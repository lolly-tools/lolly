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

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const suseMounted = existsSync(join(ROOT, 'brands/suse/pack.json'));

const AUDIO_EXT = /\.(mp3|m4a|aac|opus|ogg|oga|wav|flac|aiff?)$/i;
const EXCLUDED = /(photos|campaign|headshots|music)\//;

test('the suse pack builds clean: exclusions hold, fonts/tools/envelope complete', { skip: !suseMounted && 'brands/suse not mounted' }, () => {
  const out = mkdtempSync(join(tmpdir(), 'lolly-pack-'));
  try {
    execFileSync('node', ['scripts/build-instance-pack.ts', '--out', out], { cwd: ROOT, stdio: 'pipe' });
    const packPath = join(out, 'suse-brand-1.0.0.lolly');
    const bytes = readFileSync(packPath);
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
    assert.ok(toolsPart.tools.length >= 15, `expected ≥15 suse tools, got ${toolsPart.tools.length}`);
    for (const t of toolsPart.tools) {
      assert.ok(files[`tools/${t.id}/tool.json`], `tool ${t.id} shipped without its manifest`);
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

test('builder format constants match the brand-transfer reader (drift guard)', () => {
  const script = readFileSync(join(ROOT, 'scripts/build-instance-pack.ts'), 'utf8');
  const reader = readFileSync(join(ROOT, 'shells/web/src/brand-transfer.ts'), 'utf8');
  const grab = (src: string, name: string): string => {
    const m = src.match(new RegExp(`${name} = ([^;]+);`));
    assert.ok(m, `${name} not found`);
    return m![1]!.trim();
  };
  for (const name of ['BRAND_FORMAT', 'BRAND_FORMAT_VERSION', 'BRAND_READER_VERSION']) {
    assert.equal(grab(script, `const ${name}`), grab(reader, `export const ${name}`),
      `${name} drifted between scripts/build-instance-pack.ts and brand-transfer.ts`);
  }
});
