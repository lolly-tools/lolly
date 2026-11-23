// SPDX-License-Identifier: MPL-2.0
/**
 * The lolly-render Node binding (plan 371, M3b slice 3): the loader in
 * packages/node-shell/src/lolly-render.ts, and the opt-in Design PNG route
 * `LOLLY_DESIGN_RASTER=lolly-render` (packages/node-shell/src/design-still.ts), which
 * tries the crate first and falls back to the default route when the crate refuses the
 * page or the binding is not here, saying which and why.
 *
 * The binding and the crate's test binary are built with cargo, which a plain clone does
 * not run, so the tests that draw through them skip by name with the command that builds
 * them. The loader's absent case and the absent-binding fallback need neither and always run.
 *
 * Run with: node --test tests/lolly-render-addon.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { designPageDrawing } from '../engine/src/design-page-svg.ts';
import { encodeDesignPng, lollyRenderBinding, lollyRenderEnvelope, lollyRenderState, renderDesignPage, renderDesignPageRgba } from '../packages/node-shell/src/lolly-render.ts';
import { repoRoot } from '../packages/node-shell/src/repo-root.ts';
import { LOLLY_RENDER_NOT_BUILT } from './fuzz/lolly-render-targets.ts';
import { decodePng } from './helpers/raster-oracle.ts';

const ROOT = repoRoot();
const CRATE = join(ROOT, 'crates', 'lolly-render');
const BIN = [process.env.LOLLY_RENDER_BIN, join(CRATE, 'target', 'release', 'lolly-render'), join(CRATE, 'target', 'debug', 'lolly-render')]
  .find((path): path is string => !!path && existsSync(path));
const BIN_NOT_BUILT = 'lolly-render is not built here: run `cargo build --release` in crates/lolly-render (or set LOLLY_RENDER_BIN)';
const ADDON = lollyRenderState().present;
const NEEDS_ADDON = ADDON ? false : LOLLY_RENDER_NOT_BUILT;
const NEEDS_BOTH = !ADDON ? LOLLY_RENDER_NOT_BUILT : BIN ? false : BIN_NOT_BUILT;

const fixtures = readdirSync(join(CRATE, 'tests', 'fixtures')).filter((f) => f.endsWith('.json')).sort();

test('the loader reports a missing binding as absent, with the reason, and never throws', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-render-absent-'));
  try {
    const missing = { LOLLY_RENDER_ADDON: join(dir, 'nothing-here.node') };
    const state = lollyRenderState(missing);
    assert.equal(state.present, false);
    assert.match(!state.present ? state.reason : '', /LOLLY_RENDER_ADDON names a binding that is not usable: .*does not exist/);
    const drawn = await renderDesignPage('{}', missing);
    assert.equal(drawn.ok, false);
    assert.equal(!drawn.ok && drawn.code, 'absent');
    // A file that is not a library at all is reported the same way.
    const stray = join(dir, 'stray.node');
    writeFileSync(stray, 'not a library');
    const strayState = lollyRenderState({ LOLLY_RENDER_ADDON: stray });
    assert.match(!strayState.present ? strayState.reason : '', /could not be loaded/);
    assert.equal(lollyRenderBinding({ LOLLY_RENDER_ADDON: stray }), null);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('the binding draws each core fixture to the bytes the test binary writes, on the thread pool too', { skip: NEEDS_BOTH }, async () => {
  for (const file of fixtures) {
    const input = readFileSync(join(CRATE, 'tests', 'fixtures', file));
    const binary = spawnSync(BIN!, ['-', '-'], { input, maxBuffer: 64 << 20 });
    assert.equal(binary.status, 0, file);
    const drawn = await renderDesignPage(input);
    assert.ok(drawn.ok, `${file}: ${!drawn.ok ? `${drawn.code} ${drawn.detail}` : ''}`);
    assert.equal(Buffer.compare(Buffer.from(drawn.png), binary.stdout), 0, `${file}: the binding wrote other bytes than the binary`);
    const sync = lollyRenderBinding()!.renderPng(input);
    assert.equal(Buffer.compare(Buffer.from(sync.png!), binary.stdout), 0, `${file}: the calling thread wrote other bytes`);
    const pixels = await renderDesignPageRgba(input.toString('utf8'));
    assert.ok(pixels.ok);
    assert.deepEqual(Buffer.from(pixels.rgba), Buffer.from(decodePng(binary.stdout).pixels), `${file}: the RGBA is not the PNG's pixels`);
    // The encoder the route finishes with writes the same pixels, without a resolution chunk.
    const encoded = await encodeDesignPng(pixels.rgba, pixels.width, pixels.height);
    assert.ok(encoded && !Buffer.from(encoded).includes('pHYs'), file);
    assert.deepEqual(Buffer.from(decodePng(encoded).pixels), Buffer.from(pixels.rgba), `${file}: the encoder changed the pixels`);
  }
  // The thread pool leaves the event loop free: a timer keeps firing while a large page draws.
  const large = JSON.parse(readFileSync(join(CRATE, 'tests', 'fixtures', 'pictures.json'), 'utf8')) as { output: { width: number; height: number } };
  large.output = { ...large.output, width: large.output.width * 2, height: large.output.height * 2 };
  let ticks = 0;
  const timer = setInterval(() => { ticks++; }, 1);
  const started = performance.now();
  const drawn = await renderDesignPage(JSON.stringify(large));
  const took = performance.now() - started;
  clearInterval(timer);
  assert.ok(drawn.ok);
  if (took > 20) assert.ok(ticks > 0, `no timer fired in ${took.toFixed(0)} ms of drawing`);
});

test('a refused page comes back as a value with its stable codes, the first one named', { skip: NEEDS_ADDON }, async () => {
  const versioned = await renderDesignPage({ format: 'lolly-render-input', version: 2 } as never);
  assert.equal(versioned.ok, false);
  assert.ok(!versioned.ok && versioned.refusals.length >= 1);
  assert.equal(!versioned.ok && versioned.code, !versioned.ok ? versioned.refusals[0]!.code : '');
  const codes = new Set(lollyRenderBinding()!.refusalCodes());
  const malformed = JSON.parse(readFileSync(join(CRATE, 'tests', 'malformed', 'manifest.json'), 'utf8')) as { cases: Array<{ file: string; codes: string[] }> };
  for (const { file, codes: expected } of malformed.cases) {
    const result = await renderDesignPage(readFileSync(join(CRATE, 'tests', 'malformed', file)));
    assert.equal(result.ok, false, file);
    if (!result.ok) {
      assert.equal(result.code, expected[0], file);
      assert.ok(result.refusals.every((r) => codes.has(r.code)), file);
    }
  }
  const tooLarge = await renderDesignPage(Buffer.alloc(64 * 1024 * 1024 + 1, 0x20));
  assert.equal(!tooLarge.ok && tooLarge.code, 'input-bytes');
  const misfit = lollyRenderBinding()!.encodePng(Buffer.alloc(12), 2, 2);
  assert.equal(misfit.ok, false, 'pixels of another size than stated are refused');
  assert.equal(misfit.code, 'output-size');
  const unwritable = await renderDesignPage({ page: 1n } as never);
  assert.equal(!unwritable.ok && unwritable.code, 'input-json', 'an envelope JSON cannot hold is refused, not thrown');
});

/** A page of shapes only, so the CLI's host and this file's host compile it alike. */
const boxes = [
  { id: 'cover', kind: 'frame', x: 0, y: 0, w: 320, h: 200, bg: '#f4f1ea', order: 0 },
  { id: 'chip', kind: 'box', x: 20, y: 30, w: 160, h: 80, bg: '#1c7ed6', shape: 'rounded', radius: 16, stroke: '#0b7285', strokeW: 4, frame: 'cover' },
  { id: 'bar', kind: 'box', x: 200, y: 40, w: 90, h: 120, bg: '#e8590c', frame: 'cover' },
];

/** The CLI with no browser tier unless `env` lends one, asking for lolly-render; the route's own lines on stderr. */
function cli(dir: string, args: string[], env: Record<string, string> = {}) {
  const base: Record<string, string | undefined> = {
    ...process.env, LOLLY_PROFILE: 'lolly-demo', LOLLY_STATE_DIR: join(dir, 'state'), NO_COLOR: '1',
    LOLLY_WEB_DIST: join(dir, 'no-web-build'), LOLLY_RENDERER: 'chromium', LOLLY_DESIGN_RASTER: 'lolly-render',
  };
  delete base.LOLLY_WEB_BASE; delete base.LOLLY_EXPORT_ROUTE; delete base.LOLLY_RENDER_ADDON;
  return spawnSync(process.execPath, ['shells/cli/bin/lolly.ts', 'design', ...args, '--export=png', '--imprint=0'], { cwd: ROOT, encoding: 'utf8', timeout: 90_000, env: { ...base, ...env } });
}

test('LOLLY_DESIGN_RASTER=lolly-render draws the page with the crate, the same pixels as the test binary', { skip: NEEDS_BOTH }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-render-route-'));
  try {
    const out = join(dir, 'cover.png');
    const run = cli(dir, [`--boxes=${JSON.stringify(boxes)}`, '--s=cover', `--output=${out}`]);
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stderr, /drawn from the drawing operations \(design-draw-v\d+\+lolly-render-[\d.]+\+tiny-skia-[\d.]+-scalar\) because LOLLY_DESIGN_RASTER=lolly-render asks for this route/);
    assert.match(run.stderr, /Note: This Design page was drawn without a browser, by lolly-render from its drawing operations/);
    const host = { shaper: { measure: () => { throw new Error('no text on this page'); } }, picture: async () => null } as never;
    const drawing = await designPageDrawing({ boxes }, 'cover', host, { dpi: 96 });
    const binary = spawnSync(BIN!, ['-', '-'], { input: JSON.stringify(lollyRenderEnvelope(drawing, { width: 320, height: 200, dpi: 96 })), maxBuffer: 64 << 20 });
    assert.equal(binary.status, 0, binary.stdout.toString());
    const route = decodePng(new Uint8Array(await readFile(out)));
    const reference = decodePng(binary.stdout);
    assert.deepEqual([route.width, route.height], [320, 200]);
    assert.ok(Buffer.compare(Buffer.from(route.pixels), Buffer.from(reference.pixels)) === 0, 'the route drew other pixels than the binary');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('a page the crate refuses goes on to the default route, and the log says why', { skip: NEEDS_ADDON }, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-render-refused-'));
  try {
    // A rounded frame: the crate refuses its edge (frame-edge); resvg draws a page whose content stays inside.
    const rounded = boxes.map((b) => (b.id === 'cover' ? { ...b, shape: 'rounded', radius: 24 } : b));
    const args = [`--boxes=${JSON.stringify(rounded)}`, '--s=cover'];
    const out = join(dir, 'resvg.png');
    const here = cli(dir, [...args, `--output=${out}`]);
    assert.equal(here.status, 0, here.stderr);
    assert.match(here.stderr, /drawn from the drawing operations \(design-draw-v\d+\+resvg-js-[\d.]+\) because no browser render tier is available/);
    assert.match(here.stderr, /Note: lolly-render did not draw this Design page because it refused .*\[frame-edge\]\. This Design page was drawn without a browser, by resvg/);
    assert.ok(existsSync(out));
    // With a browser tier configured, the page goes there instead, with the crate's reason.
    const tier = { LOLLY_WEB_BASE: 'http://127.0.0.1:9', LOLLY_BROWSER_PATH: join(dir, 'no-chromium') };
    const browser = cli(dir, [...args, `--output=${join(dir, 'browser.png')}`], tier);
    assert.notEqual(browser.status, 0, 'the configured browser tier cannot answer');
    assert.match(browser.stderr, /Design PNG export: handed to the browser render tier because lolly-render did not draw the page because it refused .*\[frame-edge\]/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('with no binding the opt-in falls back to the default route and says so', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'lolly-render-absent-route-'));
  try {
    const out = join(dir, 'cover.png');
    const run = cli(dir, [`--boxes=${JSON.stringify(boxes)}`, '--s=cover', `--output=${out}`], { LOLLY_RENDER_ADDON: join(dir, 'no-binding.node') });
    assert.equal(run.status, 0, run.stderr);
    assert.match(run.stderr, /drawn from the drawing operations \(design-draw-v\d+\+resvg-js-[\d.]+\) because no browser render tier is available/);
    assert.match(run.stderr, /Note: lolly-render did not draw this Design page because LOLLY_RENDER_ADDON names a binding that is not usable: .*does not exist\. This Design page was drawn without a browser, by resvg/);
    assert.ok(existsSync(out));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
