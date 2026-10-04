// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly design --boxes-data=<rows> --export=pptx` against a published design version
 * that pins its font faces, run through the REAL binary over a fixture catalog.
 *
 * Three defects met on this one command, and each is pinned here:
 *   - The bridge read a release's pinned font bytes through `host.assets` before it
 *     existed, so every such run failed with "Pinned font SUSE is missing or its bytes
 *     changed".
 *   - The deck took its theme fonts from the render projection, where a pinned family
 *     is the internal 'Lolly Release <sha256>' alias no PowerPoint viewer has. A .pptx
 *     is portable output, so it must carry the authored family.
 *   - A run in the `mono` slot named the brand sans face, while the canvas draws it in
 *     the brand's mono face.
 * And one that was there before them: rows imported from a data file carry every
 * field as text, so every shape was placed at 0,0 with a 1px box.
 *
 * Run with: node --test tests/design-pptx-cli-release-fonts.test.ts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { unzipSync, strFromU8 } from 'fflate';

import { seedFrame } from '../engine/src/slide-master.ts';
import { TOKEN_EXT } from '../engine/src/tokens.ts';
import { designFramesToPptx } from '../packages/node-shell/src/design-pptx.ts';
import type { DesignBoxRowV1, SlideMasterFileV1 } from '../packages/core/src/index.ts';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const BIN = join(REPO, 'shells', 'cli', 'bin', 'lolly.ts');
const START = join(REPO, 'brands', 'lolly-start', 'catalog', 'assets', 'lolly');
const MASTERS = join(START, 'slides', 'masters.json');
const TOKENS = join(START, 'tokens', 'brand.json');
const FONT = join(REPO, 'shells', 'web', 'public', 'fonts', 'SUSE[wght].woff2');
const DESIGN = join(REPO, 'community', 'design');
const READY = [MASTERS, TOKENS, FONT, DESIGN].every((p) => existsSync(p));

const root = mkdtempSync(join(tmpdir(), 'lolly-release-fonts-'));
after(() => rmSync(root, { recursive: true, force: true }));

/** The text of every row as a data file states it: strings, the way `parseDataRows` returns them. */
const asText = (row: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'number' ? String(v) : v]));

/** One master-bound title frame, plus a free layer in the sans slot and one in the mono slot. */
function rows(): Record<string, unknown>[] {
  const master = (JSON.parse(readFileSync(MASTERS, 'utf8')) as SlideMasterFileV1).masters[0]!;
  const seeded = seedFrame(master, 'title', { frameId: 'f0', x: 0, y: 0 });
  assert.ok(seeded, 'the starter master seeds a title frame');
  seeded!.frame.order = 0;
  for (const layer of seeded!.layers) if (layer.kind === 'text' && layer.role) layer.text = `title ${layer.role}`;
  return [
    seeded!.frame, ...seeded!.layers,
    { id: 'fs', kind: 'text', frame: 'f0', x: 40, y: 600, w: 600, h: 40, text: 'sans slot', font: 'sans', order: 90 },
    { id: 'fm', kind: 'text', frame: 'f0', x: 40, y: 650, w: 600, h: 40, text: 'mono slot', font: 'mono', order: 91 },
  ] as Record<string, unknown>[];
}

/** A catalog whose design system has one published version, v1, that pins the SUSE face. */
function writeFixture(): void {
  const font = readFileSync(FONT);
  const sha256 = createHash('sha256').update(font).digest('hex');
  const at = (...p: string[]): string => join(root, ...p);
  mkdirSync(at('catalog', 'assets', 'lolly', 'tokens', 'brand'), { recursive: true });
  mkdirSync(at('catalog', 'assets', 'lolly', 'slides'), { recursive: true });
  mkdirSync(at('catalog', 'assets', 'lolly', 'fonts'), { recursive: true });
  mkdirSync(at('catalog', 'tools'), { recursive: true });
  cpSync(DESIGN, at('tools', 'design'), { recursive: true });
  cpSync(MASTERS, at('catalog', 'assets', 'lolly', 'slides', 'masters.json'));
  writeFileSync(at('catalog', 'assets', 'lolly', 'fonts', 'suse.woff2'), font);
  const tokens = JSON.parse(readFileSync(TOKENS, 'utf8')) as Record<string, unknown>;
  writeFileSync(at('catalog', 'assets', 'lolly', 'tokens', 'brand', 'v1.json'), JSON.stringify(tokens));
  const head = structuredClone(tokens) as Record<string, Record<string, unknown>>;
  head.$extensions = {
    ...(head.$extensions ?? {}),
    [TOKEN_EXT]: {
      ...(head.$extensions?.[TOKEN_EXT] as object | undefined),
      versions: {
        list: [{
          slug: 'v1', label: 'v1', date: '2026-09-01T00:00:00.000Z', checksum: 'not-checked-by-the-cli',
          assets: [{ id: 'lolly/fonts/suse', version: '1', sha256, font: { family: 'SUSE', weight: '100 900', style: 'normal' } }],
        }],
        active: 'v1',
      },
    },
  };
  writeFileSync(at('catalog', 'assets', 'lolly', 'tokens', 'brand.json'), JSON.stringify(head));
  const json = (url: string) => [{ format: 'json', url }];
  writeFileSync(at('catalog', 'assets', 'index.json'), JSON.stringify({
    version: '1',
    assets: [
      { id: 'lolly/tokens/brand', type: 'tokens', version: '1.0.0', tier: 'core', formats: json('/catalog/assets/lolly/tokens/brand.json') },
      { id: 'lolly/tokens/brand/v1', type: 'tokens', version: '1.0.0', tier: 'core', formats: json('/catalog/assets/lolly/tokens/brand/v1.json') },
      { id: 'lolly/slides/masters', type: 'data', version: '1.0.0', tier: 'core', tags: ['slide-master'], formats: json('/catalog/assets/lolly/slides/masters.json') },
      { id: 'lolly/fonts/suse', type: 'font', version: '1', tier: 'core', formats: [{ format: 'woff2', url: '/catalog/assets/lolly/fonts/suse.woff2' }] },
    ],
  }));
  writeFileSync(at('catalog', 'tools', 'index.json'), JSON.stringify({
    version: '1',
    tools: [{ id: 'design', name: 'design', status: 'community', description: 'design', category: 'utility', formats: ['pptx'] }],
  }));
  writeFileSync(at('rows.json'), JSON.stringify(rows().map(asText)));
}

function cli(args: string[]): Promise<{ stderr: string; code: number }> {
  return new Promise((done) => {
    const child = spawn(process.execPath, [BIN, ...args], {
      cwd: root,
      env: { ...process.env, LOLLY_ROOT: root, LOLLY_WEB_DIST: join(root, 'no-such-dist'), NO_COLOR: '1' },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    child.stderr!.on('data', (c: Buffer) => { err += c.toString('utf8'); });
    child.on('close', (code) => done({ stderr: err, code: code ?? -1 }));
  });
}

/** The latin typeface of the run whose text is `text`, or '' for a run that states none. */
function runFace(slide: string, text: string): string {
  const at = slide.indexOf(`<a:t>${text}</a:t>`);
  assert.ok(at > 0, `the slide carries a run "${text}"`);
  return /<a:latin typeface="([^"]*)"/.exec(slide.slice(slide.lastIndexOf('<a:r>', at), at))?.[1] ?? '';
}

test('CLI: a pinned-font version with --boxes-data writes the authored faces, the mono face and real geometry', { timeout: 300_000 }, async (t) => {
  if (!READY) { t.skip('brands/lolly-start, community/design or the SUSE web font is not checked out'); return; }
  writeFixture();
  const out = join(root, 'deck.pptx');
  const run = await cli(['run', 'design', `--boxes-data=${join(root, 'rows.json')}`, '--export=pptx', `--output=${out}`]);
  assert.equal(run.code, 0, `the run succeeds: ${run.stderr}`);
  assert.doesNotMatch(run.stderr, /Pinned font/, 'the pinned face was read through host.assets');

  const files = unzipSync(new Uint8Array(readFileSync(out)));
  const theme = strFromU8(files['ppt/theme/theme1.xml']!);
  assert.match(theme, /<a:majorFont><a:latin typeface="SUSE"\/>/, 'the theme carries the authored family');
  assert.match(theme, /<a:minorFont><a:latin typeface="SUSE"\/>/);
  for (const [path, bytes] of Object.entries(files)) {
    assert.doesNotMatch(strFromU8(bytes), /Lolly Release/, `${path} never carries the release alias`);
  }

  const slide = strFromU8(files['ppt/slides/slide1.xml']!);
  assert.equal(runFace(slide, 'mono slot'), 'SUSE Mono', 'a mono run names font.mono');
  assert.equal(runFace(slide, 'sans slot'), 'SUSE');
  assert.doesNotMatch(theme, /SUSE Mono/, 'the mono face is never a theme font');

  // 40px at 9525 EMU/px; the 600px wide sans layer is 5715000 EMU.
  assert.match(slide, /<a:off x="381000" y="5715000"\/><a:ext cx="5715000" cy="381000"\/>/, 'a text-typed row keeps its geometry');
  assert.doesNotMatch(slide, /<a:ext cx="9525" cy="9525"\/>/, 'no shape collapsed to a 1px box');
});

test('designFramesToPptx: numeric fields off a data file (strings) place shapes like numbers do', async () => {
  const frame = asText({ id: 'f1', kind: 'frame', x: 0, y: 0, w: 1280, h: 720, order: 0 }) as DesignBoxRowV1;
  const layer = (row: Record<string, unknown>) => row as DesignBoxRowV1;
  const box = { id: 'b1', kind: 'box', frame: 'f1', x: 44, y: 25, w: 925, h: 80, bg: '#ff0000', order: 1 };
  const xml = async (b: Record<string, unknown>): Promise<string> => {
    const result = await designFramesToPptx({ frames: [{ row: frame, layers: [layer(b)] }] });
    return JSON.stringify(result.slides[0]!.shapes);
  };
  assert.equal(await xml(asText(box)), await xml(box), 'string and number fields lower the same');
  assert.match(await xml(asText(box)), /"x":419100/, 'x 44px is 419100 EMU, not 0');
  assert.match(await xml({ ...box, x: '', w: 'wide' }), /"x":0/, 'an empty or non-numeric field still falls back');
});
