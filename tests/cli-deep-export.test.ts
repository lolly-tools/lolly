// SPDX-License-Identifier: MPL-2.0
/**
 * The pro float formats through the REAL CLI mechanism (plans/61-deeprichpixels.md
 * section 6 Phase B3, section 10 item 4 "CLI first for pro formats"): `--export=exr` and
 * `--export=hdr` on a native-<svg> fixture tool, driven by `runToolCli` exactly
 * as a terminal invocation would - jsdom, createCliBridge, resvg, the engine's
 * own OpenEXR / Radiance writers.
 *
 * Sibling of tests/cli-export-golden.test.ts and hermetic the same way: a
 * self-contained fixture repo with LOLLY_ROOT pinned BEFORE the dynamic import,
 * so the whole run → bridge chain resolves against the fixture regardless of the
 * active content profile. NOT a golden-byte suite - these files are asserted by
 * decoding them, because the point of the feature is that other people's
 * software can read them.
 *
 * WHAT IS ACTUALLY BEING CLAIMED, and how each claim is checked:
 *
 *   1. The REFUSAL is the essential half. The CLI's pixel source is an 8-bit
 *      sRGB resvg raster, so a float file made from it without `hdr=` would be
 *      padding - section 10's "depth follows provenance" forbids shipping that as
 *      quality. `refuses …` asserts the sentence, that it is not swallowed by
 *      run.ts's fall-back-to-HTML catch, and that no file is left behind.
 *   2. With `hdr=1` the float is EARNED: the view transform pushes near-whites
 *      to peakNits/203 in linear light - above 1.0, which no integer container
 *      can hold. `above-1.0 headroom` decodes the file and measures it, with the
 *      SDR PNG of the same design as the negative control (its brightest sample
 *      is 255 and cannot be anything else).
 *   3. `depth=float` is the CLI's FIRST consumer of the depth param. Asserted by
 *      the channel type an INDEPENDENT decoder reports, with the default (half)
 *      as the control.
 *
 * EXTERNAL ORACLE: ffmpeg/ffprobe, which have had their own OpenEXR and Radiance
 * decoders since long before this writer existed. Every structural claim is read
 * back by ffprobe (pixel format, dimensions) and every pixel claim by piping the
 * file through ffmpeg into raw float. `sharp` is the second oracle for the
 * premultiplied-alpha correction. Cases that need a tool skip with a stated
 * reason rather than silently passing.
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const exec = promisify(execFile);

// ── external tools (each case says so when it skips) ────────────────────────
async function haveTool(bin: string): Promise<boolean> {
  try { await exec(bin, ['-version']); return true; } catch { return false; }
}
const HAVE_FFMPEG = await haveTool('ffprobe') && await haveTool('ffmpeg');
const SKIP_NO_FFMPEG = HAVE_FFMPEG ? false
  : 'ffprobe/ffmpeg not on PATH - the independent EXR/Radiance decoder is the whole point of these cases';

type SharpFn = (typeof import('sharp'))['default'];
let sharp: SharpFn | null = null;
try { sharp = (await import('sharp')).default; } catch { sharp = null; }
const SKIP_NO_SHARP = sharp ? false : 'sharp not installed - needed as the straight-alpha oracle';

// ── self-contained fixture repo ─────────────────────────────────────────────
const root = await mkdtemp(join(tmpdir(), 'lolly-deep-export-'));
after(() => rm(root, { recursive: true, force: true }));

function manifest(id: string, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    id, name: id, version: '1.0.0', engineVersion: '^1.0.0', status: 'community',
    render: { width: 40, height: 20, formats: ['svg', 'png'] },
    inputs: [],
    ...overrides,
  });
}

// swatch: a two-half image - pure white on the left, pure black on the right.
// White is what the HDR view transform's includeWhite default boosts (so the left
// half must land above 1.0); black is the fixed point (it must stay exactly 0).
// NOTE the declared formats deliberately DO NOT include exr/hdr: the pro formats
// are admitted without a manifest declaration, and this fixture proves it.
const SWATCH = (fill: string): string =>
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 20" width="40" height="20">' +
  `<rect x="0" y="0" width="20" height="20" fill="${fill}"/>` +
  '<rect x="20" y="0" width="20" height="20" fill="#000000"/></svg>';

// alpha-mark: one 50%-alpha rect. resvg hands back PREMULTIPLIED bytes; the
// straight-alpha correction in rasterizeSvgToRgba is what this fixture checks.
const ALPHA_MARK =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 2" width="4" height="2">' +
  '<rect width="4" height="2" fill="#ff0000" fill-opacity="0.5"/></svg>';

// HTML-layout tool: no root <svg>, so the pro formats must refuse with the
// "needs layout" message rather than producing a plausible-looking wrong file.
const HTML_LAYOUT = '<div><h1>heading</h1><p>body</p></div>';

await mkdir(join(root, 'catalog', 'tools'), { recursive: true });
await mkdir(join(root, 'catalog', 'assets'), { recursive: true });
await writeFile(join(root, 'catalog', 'tools', 'index.json'),
  JSON.stringify({ version: '1', tools: [{ id: 'swatch' }, { id: 'alpha-mark' }, { id: 'html-layout' }] }));
await writeFile(join(root, 'catalog', 'assets', 'index.json'), JSON.stringify({ assets: [] }));

for (const [id, files] of Object.entries({
  swatch: {
    'tool.json': manifest('swatch', {
      render: { width: 40, height: 20, formats: ['svg', 'png'] },
      inputs: [{ id: 'fill', type: 'color', label: 'Fill', default: '#ffffff' }],
    }),
    'template.html': SWATCH('{{fill}}'),
  },
  'alpha-mark': {
    'tool.json': manifest('alpha-mark', { render: { width: 4, height: 2, formats: ['svg'] } }),
    'template.html': ALPHA_MARK,
  },
  'html-layout': {
    'tool.json': manifest('html-layout', { render: { width: 40, height: 20, formats: ['html'] } }),
    'template.html': HTML_LAYOUT,
  },
} as Record<string, Record<string, string>>)) {
  await mkdir(join(root, 'tools', id), { recursive: true });
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(root, 'tools', id, name), content);
  }
}

process.env.LOLLY_ROOT = root;
const { runToolCli } = await import('../shells/cli/src/run.ts');

let seq = 0;
/** Run the REAL CLI entry point. Returns the output path (which may not exist). */
async function cli(
  toolId: string, format: string, params: Record<string, string> = {},
): Promise<string> {
  const out = join(root, `out-${toolId}-${format}-${seq++}.${format}`);
  await runToolCli({ toolId, params, outputPath: out, format });
  return out;
}

// ── decoders (ffmpeg is a decoder written by people who never saw this code) ──

/** ffprobe's own verdict on the file: codec + pixel format + dimensions. */
async function probe(path: string): Promise<{ codec: string; pixFmt: string; width: number; height: number }> {
  const { stdout } = await exec('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,pix_fmt,width,height',
    '-of', 'json', path,
  ]);
  const s = JSON.parse(stdout).streams[0];
  return { codec: s.codec_name, pixFmt: s.pix_fmt, width: s.width, height: s.height };
}

/**
 * Read one pixel's RGB out of a FLOAT32 EXR via ffmpeg.
 *
 * float32 ONLY, and that restriction is a finding, not a convenience: ffmpeg's
 * decoder emits `gbrapf32le` natively for a FLOAT EXR, so `-f rawvideo -pix_fmt
 * gbrapf32le` is a passthrough and above-1.0 samples survive. Ask it to convert a
 * HALF EXR to f32 and the conversion goes through swscale, which CLAMPS to [0,1] - 
 * measured: the same white pixel reads 4.75 out of the float file and exactly
 * 1.0 out of the half file. So the half files are asserted structurally here, and
 * every pixel-VALUE claim is made against a `depth=float` render. (`gbrap` is
 * planar G,B,R,A - ffmpeg's plane order, spelled out rather than assumed.)
 */
async function pixelRgb(path: string, w: number, h: number, x: number, y: number): Promise<[number, number, number]> {
  assert.equal((await probe(path)).pixFmt, 'gbrapf32le',
    'pixelRgb needs a float32 source - ffmpeg clamps a half→float conversion to [0,1]');
  const raw = join(root, `raw-${seq++}.bin`);
  await exec('ffmpeg', ['-v', 'error', '-y', '-i', path, '-f', 'rawvideo', '-pix_fmt', 'gbrapf32le', raw]);
  const buf = await readFile(raw);
  const plane = w * h * 4;
  assert.equal(buf.length, plane * 4, 'unexpected raw size from ffmpeg');
  const i = (y * w + x) * 4;
  const g = buf.readFloatLE(i);
  const b = buf.readFloatLE(plane + i);
  const r = buf.readFloatLE(plane * 2 + i);
  return [r, g, b];
}

// ── 1. the refusal (the essential half) ──────────────────────────────────

// Adversarial review (2026-07-31): the gate used to check only that hdr= was
// PASSED, not that the view transform actually lifted anything. hdrViewTransform
// only boosts pixels that clear its lightness knee AND match a boost target
// (near-white by default), so a dark design could ask for HDR and get an
// unchanged SDR frame written out as float -- exactly the padding the plan
// refuses. The rule is now enforced on the OUTPUT.
test('refuses exr when hdr=1 was asked for but the render has nothing to lift', async () => {
  const out = join(root, 'no-headroom.exr');
  await assert.rejects(
    // Both halves dark: the left rect is overridden to near-black, the right is
    // already #000, so no pixel clears the knee and nothing exceeds 1.0.
    () => runToolCli({ toolId: 'swatch', params: { fill: '#050505', hdr: '1' }, outputPath: out, format: 'exr' }),
    (e: Error) => {
      assert.match(e.message, /found nothing in this render to lift above 1\.0/);
      assert.match(e.message, /depth follows provenance/);
      // Must NOT tell the user to add hdr=1 -- they already did.
      assert.doesNotMatch(e.message, /Add hdr=1/);
      return true;
    },
  );
  assert.equal(existsSync(out), false, 'a refused export must leave no file behind');
});

test('refuses exr over an 8-bit-only source, naming why, and writes nothing', async () => {
  const out = join(root, 'refused.exr');
  await assert.rejects(
    () => runToolCli({ toolId: 'swatch', params: {}, outputPath: out, format: 'exr' }),
    (e: Error) => {
      // The exact user-facing sentence, in the pieces that carry the meaning.
      assert.match(e.message, /"exr" is a floating-point format/);
      assert.match(e.message, /this render has no floating-point pixels behind it/);
      assert.match(e.message, /8-bit sRGB \(resvg\)/);
      assert.match(e.message, /pad 8 bits of picture/);
      assert.match(e.message, /Add hdr=1/);
      assert.match(e.message, /depth follows provenance/);
      // NEGATIVE CONTROL on the wording itself: run.ts falls back to writing HTML
      // when a message matches this signature, which would turn a refusal into a
      // silently wrong file. The refusal must not look like a missing-browser error.
      assert.doesNotMatch(e.message, /<svg>|requires an|browser engine|needs a browser|no built web shell|chromium/i);
      return true;
    },
  );
  assert.equal(existsSync(out), false, 'a refused export must leave no file behind');
  assert.equal(existsSync(out.replace(/\.exr$/, '.html')), false, 'and must not fall back to HTML');
});

test('refuses .hdr over an 8-bit-only source too (same rule, format named)', async () => {
  await assert.rejects(
    () => runToolCli({ toolId: 'swatch', params: {}, outputPath: join(root, 'refused.hdr'), format: 'hdr' }),
    /"hdr" is a floating-point format/,
  );
});

test('refuses an HTML-layout tool: no vector root, and it does NOT become a .html file', async () => {
  const out = join(root, 'layout.exr');
  await assert.rejects(
    () => runToolCli({ toolId: 'html-layout', params: { hdr: '1' }, outputPath: out, format: 'exr' }),
    /root drawable to be a vector image/,
  );
  assert.equal(existsSync(out), false);
  assert.equal(existsSync(join(root, 'layout.html')), false);
});

// ── 2. the positive path, read back by an independent decoder ───────────────

test('exr: file is a real OpenEXR half-float RGBA image (ffprobe)', { skip: SKIP_NO_FFMPEG }, async () => {
  const out = await cli('swatch', 'exr', { hdr: '1' });
  const bytes = await readFile(out);
  // EXR magic 0x01312f76, little-endian on disk.
  assert.deepEqual([...bytes.subarray(0, 4)], [0x76, 0x2f, 0x31, 0x01], 'EXR magic');
  const p = await probe(out);
  assert.equal(p.codec, 'exr');
  assert.equal(p.pixFmt, 'gbrapf16le', 'default sample type is HALF, with alpha');
  assert.equal(p.width, 40);
  assert.equal(p.height, 20);
});

test('hdr: file is a real Radiance RGBE image (ffprobe + magic)', { skip: SKIP_NO_FFMPEG }, async () => {
  const out = await cli('swatch', 'hdr', { hdr: '1' });
  const bytes = await readFile(out);
  assert.equal(bytes.subarray(0, 10).toString('latin1'), '#?RADIANCE', 'Radiance magic');
  const p = await probe(out);
  assert.equal(p.codec, 'hdr');
  assert.equal(p.width, 40);
  assert.equal(p.height, 20);
});

test('the tool never declared exr/hdr - the pro formats need no manifest entry', async () => {
  const tool = JSON.parse(await readFile(join(root, 'tools', 'swatch', 'tool.json'), 'utf8'));
  assert.deepEqual(tool.render.formats, ['svg', 'png'],
    'fixture drifted: the point of these cases is that exr/hdr are undeclared');
});

test('an undeclared format that is NOT a pro float format is still refused', async () => {
  await assert.rejects(
    () => runToolCli({ toolId: 'swatch', params: {}, outputPath: join(root, 'no.tiff'), format: 'tiff' }),
    /does not support format "tiff"/,
  );
});

// ── 3. the bits are EARNED, not padded ──────────────────────────────────────

test('exr carries genuine above-1.0 headroom; the SDR png of the same design cannot',
  { skip: SKIP_NO_FFMPEG || SKIP_NO_SHARP }, async () => {
    const exr = await cli('swatch', 'exr', { hdr: '1', depth: 'float' });
    const [r, g, b] = await pixelRgb(exr, 40, 20, 5, 10);      // the white half
    // hdr.ts: includeWhite gives a matched white gain peakNits/sdrWhiteNits =
    // 1000/203 ~ 4.93 in LINEAR light relative to SDR reference white.
    assert.ok(r > 1.0 && g > 1.0 && b > 1.0, `white must exceed 1.0, got ${r},${g},${b}`);
    // Exactly peakNits/sdrWhiteNits = 1000/203 for a pure white, to float precision.
    assert.ok(Math.abs(r - 1000 / 203) < 1e-3, `white should be 1000/203 = 4.926, got ${r}`);
    // Black is the fixed point of the transform - nothing invents light.
    const [kr, kg, kb] = await pixelRgb(exr, 40, 20, 35, 10);
    assert.ok(Math.abs(kr) < 1e-4 && Math.abs(kg) < 1e-4 && Math.abs(kb) < 1e-4,
      `black must stay 0, got ${kr},${kg},${kb}`);

    // NEGATIVE CONTROL: the same render as an ordinary 8-bit PNG. Its brightest
    // sample is 255 by construction - there is no encoding of "brighter than
    // white" in it, which is precisely the range the EXR adds.
    const png = await cli('swatch', 'png', {});
    const stats = await sharp!(png).stats();
    assert.equal(Math.round(stats.channels[0]!.max), 255,
      'the 8-bit control should be saturated at 255 - nothing above white exists there');
  });

test('.hdr carries the same above-1.0 headroom (engine reader over the CLI file)', async () => {
  // ffmpeg confirms the CONTAINER above; RGBE sample values are read back with the
  // engine's own reader here, because ffmpeg's Radiance decode goes through the same
  // clamping conversion as the half EXR. A weaker oracle, and labelled as one.
  const { readRadiance } = await import('../engine/src/radiance.ts');
  const out = await cli('swatch', 'hdr', { hdr: '1' });
  const frame = readRadiance(await readFile(out));
  assert.ok(frame, 'the CLI .hdr must be readable');
  const at = (x: number, y: number): number => frame!.data[(y * frame!.width + x) * 4]!;
  assert.ok(at(5, 10) > 4 && at(5, 10) < 6, `white should land near 1000/203, got ${at(5, 10)}`);
  assert.ok(at(35, 10) < 1e-3, `black should stay black, got ${at(35, 10)}`);
});

test('depth=float writes 32-bit samples; the default writes 16-bit (negative control)',
  { skip: SKIP_NO_FFMPEG }, async () => {
    const half = await cli('swatch', 'exr', { hdr: '1' });
    const flt = await cli('swatch', 'exr', { hdr: '1', depth: 'float' });
    assert.equal((await probe(half)).pixFmt, 'gbrapf16le');
    assert.equal((await probe(flt)).pixFmt, 'gbrapf32le', 'depth=float must reach the EXR sample type');
    // Not merely a header flag: a float32 file of the same image is strictly larger.
    assert.ok((await readFile(flt)).length > (await readFile(half)).length);
  });

test('depth=16 and depth=8 do NOT become EXR sample types - half is kept',
  { skip: SKIP_NO_FFMPEG }, async () => {
    for (const depth of ['16', '8']) {
      const out = await cli('swatch', 'exr', { hdr: '1', depth });
      assert.equal((await probe(out)).pixFmt, 'gbrapf16le', `depth=${depth} must not change the sample type`);
    }
  });

test('the HDR dials reach the transform: a lower peak makes a dimmer white',
  { skip: SKIP_NO_FFMPEG }, async () => {
    const bright = await cli('swatch', 'exr', { hdr: '1', depth: 'float' });
    // url-mode's compact tuned form: <peakNits>-<reach>-<lift>-<richness>.
    const dim = await cli('swatch', 'exr', { hdr: '406-45-0-40', depth: 'float' });
    const [br] = await pixelRgb(bright, 40, 20, 5, 10);
    const [dr] = await pixelRgb(dim, 40, 20, 5, 10);
    assert.ok(dr < br * 0.6, `peakNits=406 should be far dimmer than 1000 (got ${dr} vs ${br})`);
    assert.ok(dr > 1.5 && dr < 2.5, `406/203 = 2.0 expected, got ${dr}`);
  });

// ── 4. premultiplied alpha: the correction resvg forces on us ───────────────

test('resvg pixels are premultiplied, and rasterizeSvgToRgba undoes it (sharp oracle)',
  { skip: SKIP_NO_SHARP }, async () => {
    const { rasterizeSvgToRgba } = await import('../packages/node-shell/src/raster.ts');
    const { Resvg } = await import('@resvg/resvg-js');
    const svg = ALPHA_MARK;

    // The raw resvg buffer, unmodified: this is the claim the correction rests on.
    const raw = new Resvg(svg, { fitTo: { mode: 'original' } }).render().pixels;
    assert.deepEqual([...raw.subarray(0, 4)], [128, 0, 0, 128],
      'resvg changed its alpha convention - the un-premultiply in rasterizeSvgToRgba must be revisited');

    // Ours, after the correction.
    const ours = await rasterizeSvgToRgba(svg, 4, 2);
    // sharp decoding resvg's OWN PNG: PNG is straight alpha by specification, so
    // this is an independent answer to "what colour is that pixel really".
    const png = new Resvg(svg, { fitTo: { mode: 'original' } }).render().asPng();
    const { data } = await sharp!(Buffer.from(png)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 0; i < 4; i++) {
      assert.ok(Math.abs(ours.data[i]! - data[i]!) <= 1,
        `sample ${i}: ours ${ours.data[i]} vs sharp ${data[i]}`);
    }
    assert.equal(ours.data[3], 128, 'alpha is preserved, not folded into the colour');
  });

// ── 5. the MCP format tables (services/mcp/src/render.ts) ───────────────────

test('MCP: exr/hdr are browser-free (TIER_A), binary, and correctly typed', async () => {
  const m = await import('../services/mcp/src/render.ts');
  assert.ok(m.TIER_A.has('exr'), 'exr must be reachable on the browser-free MCP tier');
  assert.ok(m.TIER_A.has('hdr'));
  assert.equal(m.mimeForFormat('exr'), 'image/x-exr');
  assert.equal(m.mimeForFormat('hdr'), 'image/vnd.radiance');
  // Binary - a text content-type would corrupt them over the HTTP surface.
  assert.equal(m.isTextFormat('exr'), false);
  assert.equal(m.isTextFormat('hdr'), false);
  // The tables must not have drifted from the CLI's.
  const shell = await import('../packages/node-shell/src/raster.ts');
  assert.equal(shell.deepFormatMime('exr'), m.mimeForFormat('exr'));
  assert.equal(shell.deepFormatMime('hdr'), m.mimeForFormat('hdr'));
  for (const f of shell.DEEP_FORMATS) {
    assert.ok(shell.NODE_FORMATS.includes(f), `${f} must be in NODE_FORMATS`);
    assert.ok(m.TIER_A.has(f), `${f} must be in MCP TIER_A`);
  }
});
