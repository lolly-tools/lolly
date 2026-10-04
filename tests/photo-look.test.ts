// SPDX-License-Identifier: MPL-2.0
/**
 * Brand photo looks baked into pixels (plan 291 W7, engine/src/photo-look.ts): the
 * look definitions (`gradient-map` and `lut` kinds, theme variants) as the catalog
 * reader accepts them, the theme key and cache key a bridge bakes under, the bake
 * itself, its determinism guard, the brand check for a treated upload, the derived
 * Tone look every pack now gets, and the theme choice reaching asset reads.
 *
 * Filter parity lives in tests/photo-look-drift.test.ts.
 *
 * Run with: node --test tests/photo-look.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PHOTO_LOOK_RECIPE,
  applyPhotoLook,
  isRasterPhotoLook,
  photoLookCacheKey,
  photoLookDefinitionHash,
  photoLookStops,
  photoLookThemeKey,
  resolvePhotoLook,
} from '../engine/src/photo-look.ts';
import { parsePhotoTreatmentsDoc, treatmentFilterSvg, type PhotoTreatment } from '../engine/src/photo-treatment.ts';
import { derivePhotoTreatmentsDoc } from '../engine/src/brand-treatments.ts';
import { checkBrandDesign } from '../engine/src/brand-check.ts';
import { withTokenSelection } from '../engine/src/token-context.ts';
import type { GradeLut } from '../engine/src/grade.ts';
import type { HostV1 } from '../engine/src/bridge/host-v1.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const LOOK: PhotoTreatment = {
  id: 'grade', kind: 'gradient-map', stops: ['#1b2a33', '#7a9a8c', '#f4f1ea'], amount: 90, contrast: 12, lightness: 6,
  themes: { dark: { stops: ['#050608', '#1b2a33', '#b8d4c8'], amount: 95, contrast: 20, lightness: 0 } },
};

/** A deterministic 64x48 frame: a colour sweep with a dark and a bright corner and a translucent stripe. */
function frame(): { data: Uint8ClampedArray; w: number; h: number } {
  const w = 64, h = 48;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4;
    data[i] = (x * 4 + y) & 255;
    data[i + 1] = (y * 5 + (x >> 1)) & 255;
    data[i + 2] = (255 - x * 3 + y * 2) & 255;
    data[i + 3] = y === 10 ? 128 : 255;
  }
  return { data, w, h };
}
const sha = (bytes: Uint8ClampedArray): string => createHash('sha256').update(bytes).digest('hex').slice(0, 16);

test('the catalog reader keeps gradient-map and lut looks and drops malformed ones', () => {
  const kept = parsePhotoTreatmentsDoc({ treatments: [
    LOOK,
    { id: 'positioned', kind: 'gradient-map', stops: [{ color: '#000000', pos: 0 }, { color: '#808080', pos: 40 }, { color: '#ffffff', pos: 100 }] },
    { id: 'graded', kind: 'lut', lut: 'lolly/luts/mono-fine', amount: 80 },
    { id: 'one-stop', kind: 'gradient-map', stops: ['#000000'] },
    { id: 'bad-colour', kind: 'gradient-map', stops: ['#000000', 'teal'] },
    { id: 'falling', kind: 'gradient-map', stops: [{ color: '#000000', pos: 60 }, { color: '#ffffff', pos: 20 }] },
    { id: 'too-much', kind: 'gradient-map', stops: ['#000000', '#ffffff'], amount: 140 },
    { id: 'nested', kind: 'gradient-map', stops: ['#000000', '#ffffff'], themes: { dark: { themes: {} } } },
    { id: 'bad-variant', kind: 'gradient-map', stops: ['#000000', '#ffffff'], themes: { dark: { contrast: 500 } } },
    { id: 'lut-url', kind: 'lut', lut: 'https://example.com/x.cube' },
    { id: 'future', kind: 'hologram' },
  ] });
  assert.deepEqual(kept.map(t => t.id), ['grade', 'positioned', 'graded']);
  assert.equal(isRasterPhotoLook(kept[0]), true);
  assert.equal(isRasterPhotoLook(kept[2]), true);
  assert.equal(isRasterPhotoLook({ kind: 'duotone' }), false);
  assert.deepEqual(photoLookStops(kept[1]!).map(s => s.pos), [0, 0.4, 1]);
  assert.deepEqual(photoLookStops(LOOK).map(s => s.pos), [0, 0.5, 1]);
});

test('the reader refuses a look whose placed and unplaced stops run backwards, so no stop silently drops out', () => {
  const kept = parsePhotoTreatmentsDoc({ treatments: [
    // Effective positions 0, 50, 20: grey 128 and above all mapped to the last stop.
    { id: 'late-placed', kind: 'gradient-map', stops: ['#ff0000', '#00ff00', { color: '#0000ff', pos: 20 }] },
    // Effective positions 80, 50, 100: red never appeared at any grey.
    { id: 'early-placed', kind: 'gradient-map', stops: [{ color: '#ff0000', pos: 80 }, '#00ff00', '#0000ff'] },
    // The same mix in order is fine: 0, 30, 100.
    { id: 'mixed-ok', kind: 'gradient-map', stops: ['#000000', { color: '#808080', pos: 30 }, '#ffffff'] },
    // A variant is held to the same rule.
    { id: 'bad-dark', kind: 'gradient-map', stops: ['#000000', '#ffffff'], themes: { dark: { stops: ['#000000', '#808080', { color: '#ffffff', pos: 10 }] } } },
  ] });
  assert.deepEqual(kept.map(t => t.id), ['mixed-ok']);
  const positions = photoLookStops(kept[0]!).map(s => s.pos);
  assert.deepEqual(positions, [0, 0.3, 1]);
});

test('a theme variant merges over the base, and a selection names the variant it activates', () => {
  const dark = resolvePhotoLook(LOOK, 'dark');
  assert.deepEqual(dark.stops, LOOK.themes!.dark!.stops);
  assert.equal(dark.amount, 95);
  assert.equal(dark.themes, undefined);
  assert.equal(dark.id, 'grade');
  assert.deepEqual(resolvePhotoLook(LOOK, 'sepia').stops, LOOK.stops);
  assert.equal(photoLookThemeKey(LOOK, { '': 'dark' }), 'dark');
  assert.equal(photoLookThemeKey(LOOK, { mode: 'dark', density: 'roomy' }), 'dark');
  assert.equal(photoLookThemeKey(LOOK, { '': 'light' }), 'base');
  assert.equal(photoLookThemeKey(LOOK, 'dark'), 'dark');
  assert.equal(photoLookThemeKey(LOOK, undefined), 'base');
  assert.equal(photoLookThemeKey({ id: 'flat', kind: 'greyscale' }, { '': 'dark' }), 'base', 'a look with no variants never splits its cache by theme');
});

test('the cache key names the picture, its version, the look, its definition and the theme', () => {
  const key = photoLookCacheKey('user/media/abc', 3, LOOK, 'dark');
  assert.match(key, /^user:user\/media\/abc:3:look:grade:[0-9a-f]{8}:dark$/);
  assert.match(photoLookCacheKey('lolly/demo/photo', '1.0.0', LOOK, 'base'), /^library:lolly\/demo\/photo:1\.0\.0:look:grade:[0-9a-f]{8}:base$/);
  assert.notEqual(photoLookDefinitionHash(LOOK), photoLookDefinitionHash({ ...LOOK, contrast: 13 }), 'an edited look re-bakes');
  assert.equal(photoLookDefinitionHash(LOOK), photoLookDefinitionHash(JSON.parse(JSON.stringify({ ...LOOK }))), 'key order and copies do not matter');
  assert.equal(PHOTO_LOOK_RECIPE, 'photo-look-v1');
});

test('the bake is pinned: the same frame and look give these exact bytes on every host', () => {
  // A change here means the colour core moved. On another engine (JavaScriptCore) a
  // different hash is the failure E25 exists to catch: the core must stay + - * / only.
  const base = frame();
  applyPhotoLook(base.data, base.w, base.h, LOOK);
  const dark = frame();
  applyPhotoLook(dark.data, dark.w, dark.h, LOOK, { theme: 'dark' });
  assert.equal(sha(base.data), '09fb41a8d6ca5dc5');
  assert.equal(sha(dark.data), '46eb3750abf707a8');
  assert.notEqual(sha(base.data), sha(dark.data));
  const unknown = frame();
  applyPhotoLook(unknown.data, unknown.w, unknown.h, LOOK, { theme: 'sepia' });
  assert.equal(sha(unknown.data), sha(base.data), 'an unknown theme is the base look');
});

test('the colour core uses no transcendental function', () => {
  const src = readFileSync(join(ROOT, 'engine/src/photo-look.ts'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const banned of ['Math.pow', 'Math.cbrt', 'Math.exp', 'Math.log', 'Math.sqrt', 'Math.sin', 'Math.cos', 'Math.hypot', '**']) {
    assert.ok(!src.includes(banned), `photo-look.ts calls ${banned}; V8 and JavaScriptCore can disagree on it`);
  }
});

test('alpha is left alone and the legacy kinds bake as their SVG filters do', () => {
  const f = frame();
  const alpha = f.data.filter((_, i) => i % 4 === 3);
  applyPhotoLook(f.data, f.w, f.h, LOOK);
  assert.deepEqual(f.data.filter((_, i) => i % 4 === 3), alpha);

  const g = frame();
  applyPhotoLook(g.data, g.w, g.h, { id: 'greyscale', kind: 'greyscale' });
  for (let i = 0; i < g.data.length; i += 4) assert.ok(g.data[i] === g.data[i + 1] && g.data[i + 1] === g.data[i + 2]);

  const px = new Uint8ClampedArray([200, 100, 50, 255]);
  applyPhotoLook(px, 1, 1, { id: 'bw', kind: 'duotone', shadow: '#000000', highlight: '#ffffff' });
  const y = Math.round((0.2126 * 200 + 0.7152 * 100 + 0.0722 * 50));
  assert.ok(Math.abs(px[0]! - y) <= 1 && px[0] === px[1] && px[1] === px[2], `duotone black to white is Rec.709 luma (${px[0]} vs ${y})`);
});

test('amount 0 leaves only the grade, and a lut look needs its LUT', () => {
  const f = frame();
  const before = f.data.slice();
  applyPhotoLook(f.data, f.w, f.h, { id: 'none', kind: 'gradient-map', stops: ['#000000', '#ffffff'], amount: 0 });
  assert.deepEqual(f.data, before);

  const identity: GradeLut = { kind: '3d', size: 2, domainMin: [0, 0, 0], domainMax: [1, 1, 1], title: '', data: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 0, 1, 1, 0, 1, 0, 1, 1, 1, 1, 1]) };
  const l = frame();
  applyPhotoLook(l.data, l.w, l.h, { id: 'film', kind: 'lut', lut: 'x/luts/film' }, { lut: identity });
  for (let i = 0; i < l.data.length; i++) assert.ok(Math.abs(l.data[i]! - before[i]!) <= 1);
  assert.throws(() => applyPhotoLook(frame().data, 64, 48, { id: 'film', kind: 'lut', lut: 'x/luts/film' }), /LUT/);
  assert.throws(() => applyPhotoLook(new Uint8ClampedArray(8), 3, 1, LOOK), /does not match/);
});

test('a gradient map previews as a sampled filter table and a lut as the plain photo', () => {
  const svg = treatmentFilterSvg(LOOK, 'f');
  const table = /<feFuncR type="table" tableValues="([^"]+)"/.exec(svg)?.[1] ?? '';
  assert.equal(table.split(' ').length, 17);
  assert.match(treatmentFilterSvg({ id: 'film', kind: 'lut', lut: 'x/luts/film' }, 'f'), /type="identity"/);
});

test("the filter preview of a gradient map carries the look's contrast and lightness grade, so a grey previews as it bakes", async () => {
  const { photoLookPreviewTable } = await import('../engine/src/photo-look.ts');
  for (const theme of [undefined, 'dark']) {
    const def = resolvePhotoLook(LOOK, theme);
    const rows = photoLookPreviewTable(def, 18); // 255 / 17 = 15: every sample is a whole 8-bit grey
    let worst = 0;
    rows.forEach((row, j) => {
      const v = j * 15;
      const px = new Uint8ClampedArray([v, v, v, 255]);
      applyPhotoLook(px, 1, 1, def);
      for (let c = 0; c < 3; c += 1) worst = Math.max(worst, Math.abs(row[c]! * 255 - px[c]!));
    });
    assert.ok(worst <= 1.5, `${theme ?? 'base'}: the preview of every grey is within 1.5/255 of the bake (worst ${worst.toFixed(2)})`);
  }
});

test('a treated upload names a look the design system must declare', () => {
  const boxes = [
    { id: 'p', kind: 'image', image: { id: 'user/media/abc?treatment=grade', source: 'user' } },
    { id: 'q', kind: 'image', image: { id: 'user/media/abc?treatment=neon', source: 'user' } },
    { id: 'r', kind: 'image', image: 'user/media/abc' },
  ];
  const report = checkBrandDesign(boxes, {}, { treatments: ['grade'] });
  assert.equal(report.uploads, 3);
  assert.deepEqual(report.findings.filter(f => f.kind === 'reference').map(f => [f.layerId, f.status]), [['q', 'unknown']]);
});

test('every derived pack gets the Tone look, with a dark variant and no copied brand hex', () => {
  const tokens = JSON.parse(readFileSync(join(ROOT, 'brands/lolly-start/catalog/assets/lolly/tokens/brand.json'), 'utf8'));
  const doc = derivePhotoTreatmentsDoc(tokens);
  const tone = doc.treatments.find(t => t.id === 'tone')!;
  assert.equal(tone.kind, 'gradient-map');
  assert.equal(tone.stops?.length, 3);
  assert.ok(tone.themes?.dark?.stops);
  assert.deepEqual(parsePhotoTreatmentsDoc(doc).map(t => t.id), doc.treatments.map(t => t.id));
  const shipped = parsePhotoTreatmentsDoc(JSON.parse(readFileSync(join(ROOT, 'brands/lolly-start/catalog/assets/lolly/palette/photo-treatments.json'), 'utf8')));
  const look = shipped.find(t => t.id === 'tone')!;
  assert.ok(look, 'lolly-start ships the Tone look');
  const light = frame(), dark = frame();
  applyPhotoLook(light.data, light.w, light.h, look, { theme: photoLookThemeKey(look, { '': 'light' }) === 'base' ? undefined : 'light' });
  applyPhotoLook(dark.data, dark.w, dark.h, look, { theme: photoLookThemeKey(look, { '': 'dark' }) });
  assert.notEqual(sha(light.data), sha(dark.data), 'one look id gives the light grade in light and the dark grade in dark');
});

test("a document's theme choice reaches asset reads, so a look bakes that theme's variant", async () => {
  const seen: unknown[] = [];
  const host = {
    assets: { get: async (id: string, opts?: unknown) => { seen.push(opts); return { id } as never; }, query: async () => [] },
    tokens: { get: async () => ({}), colors: async () => [], resolve: async () => undefined },
  } as unknown as HostV1;
  const scoped = withTokenSelection(host, { '': 'dark' });
  await scoped.assets.get('user/media/abc?treatment=grade');
  await scoped.assets.get('x', { version: '2' });
  assert.deepEqual(seen, [{ tokenSelection: { '': 'dark' } }, { version: '2', tokenSelection: { '': 'dark' } }]);
  assert.equal(typeof scoped.assets.query, 'function', 'the other asset methods stay');
});

test('the runtime reads assets with the live theme choice, and a theme switch re-reads them with the new one', async () => {
  const { createRuntime } = await import('../engine/src/runtime.ts');
  const calls: Array<[string, unknown]> = [];
  const host = {
    version: '1', shell: 'test', profile: { get: async () => ({}) }, log: () => {},
    assets: { get: async (id: string, opts?: unknown) => { calls.push([id, opts]); return { id, source: 'user', type: 'raster', format: 'jpg', url: 'blob:x' }; } },
    tokens: { get: async () => ({}), colors: async () => [], resolve: async () => undefined },
  } as unknown as HostV1;
  const tool = {
    manifest: { id: 'photo-look-runtime', name: 'Look', version: '1.0.0', engineVersion: '^1.0.0', status: 'official', render: { width: 10, height: 10, formats: ['png'] }, inputs: [{ id: 'img', type: 'asset' }] },
    template: '<b>x</b>',
  };
  const rt = await createRuntime(tool as never, host, { img: { id: 'user/media/abc?treatment=grade' } });
  assert.deepEqual(calls.at(-1), ['user/media/abc?treatment=grade', undefined], 'no theme choice: the base look');
  await rt.setTokenSelection({ '': 'dark' });
  assert.deepEqual(calls.at(-1), ['user/media/abc?treatment=grade', { tokenSelection: { '': 'dark' } }]);
});

test("with no explicit choice, a look follows the design system's stored active theme, as the tokens do", async () => {
  const { createRuntime } = await import('../engine/src/runtime.ts');
  const { resolveTokenSelection } = await import('../engine/src/token-selection.ts');
  // The lolly-start tokens with the stored choice the token workspace's "Apply choices" writes.
  const doc = JSON.parse(readFileSync(join(ROOT, 'brands/lolly-start/catalog/assets/lolly/tokens/brand.json'), 'utf8'));
  doc.$metadata = { ...doc.$metadata, activeThemeSelection: { '': 'dark' } };
  const choices = resolveTokenSelection(doc).choices;
  assert.deepEqual(choices, { '': 'dark' }, 'the tokens resolve to the stored dark theme');
  const looks = parsePhotoTreatmentsDoc(JSON.parse(readFileSync(join(ROOT, 'brands/lolly-start/catalog/assets/lolly/palette/photo-treatments.json'), 'utf8')));
  const tone = looks.find(t => t.id === 'tone')!;
  const calls: Array<[string, { tokenSelection?: Record<string, string> } | undefined]> = [];
  const host = {
    version: '1', shell: 'test', profile: { get: async () => ({}) }, log: () => {},
    assets: { get: async (id: string, opts?: { tokenSelection?: Record<string, string> }) => { calls.push([id, opts]); return { id, source: 'user', type: 'raster', format: 'jpg', url: 'blob:x' }; } },
    tokens: {
      get: async () => ({}), colors: async () => [], resolve: async () => undefined,
      snapshot: async () => ({ document: doc, system: null, version: null, selection: { choices: resolveTokenSelection(doc).choices } }),
    },
  } as unknown as HostV1;
  const tool = {
    manifest: { id: 'photo-look-stored', name: 'Look', version: '1.0.0', engineVersion: '^1.0.0', status: 'official', render: { width: 10, height: 10, formats: ['png'] }, inputs: [{ id: 'img', type: 'asset' }, { id: 'logo', type: 'asset' }] },
    template: '<b>x</b>',
  };
  const rt = await createRuntime(tool as never, host, { img: { id: 'user/media/abc?treatment=tone' }, logo: { id: 'lolly/logo/primary' } });
  const look = calls.find(([id]) => id === 'user/media/abc?treatment=tone');
  assert.deepEqual(look?.[1], { tokenSelection: { '': 'dark' } }, 'the treated read carries the effective choice');
  assert.equal(photoLookThemeKey(tone, look?.[1]?.tokenSelection), 'dark', 'so the bridge bakes the dark grade');
  assert.equal(calls.find(([id]) => id === 'lolly/logo/primary')?.[1], undefined, 'a read with no look is left as it was');
  // An explicit choice still wins over the stored one.
  await rt.setTokenSelection({ '': 'light' });
  assert.deepEqual(calls.at(-1)?.[1], { tokenSelection: { '': 'light' } });
});

test('the public Tone look keeps a white title legible over a bright sky, and its dark grade is clearly darker', () => {
  // A bright, slightly blue sky with the range of the public twin's cover photo under its
  // title (tests/fixtures/rebrand/recreate.pptx: luminance 0.30 mean, 0.54 at the 90th
  // percentile, so sRGB greys of about 140 to 205).
  const w = 64, h = 16;
  const sky = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, p = 0; p < w * h; p += 1, i += 4) {
    const v = 140 + Math.round((65 * (p % w)) / (w - 1));
    sky[i] = v - 12; sky[i + 1] = v - 4; sky[i + 2] = v; sky[i + 3] = 255;
  }
  const lin = (v: number): number => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (d: Uint8ClampedArray): number[] => {
    const out: number[] = [];
    for (let i = 0; i < d.length; i += 4) out.push(0.2126 * lin(d[i]!) + 0.7152 * lin(d[i + 1]!) + 0.0722 * lin(d[i + 2]!));
    return out.sort((a, b) => a - b);
  };
  const shipped = parsePhotoTreatmentsDoc(JSON.parse(readFileSync(join(ROOT, 'brands/lolly-start/catalog/assets/lolly/palette/photo-treatments.json'), 'utf8')));
  const look = shipped.find(t => t.id === 'tone')!;
  const light = sky.slice(), dark = sky.slice();
  applyPhotoLook(light, w, h, look);
  applyPhotoLook(dark, w, h, look, { theme: 'dark' });
  const L = lum(light), D = lum(dark);
  const p90 = (ys: number[]): number => ys[Math.floor(ys.length * 0.9)]!;
  const mean = (ys: number[]): number => ys.reduce((a, b) => a + b, 0) / ys.length;
  const whiteContrast = (y: number): number => 1.05 / (y + 0.05);
  assert.ok(whiteContrast(p90(L)) >= 3, `light: white type over the brightest sky is at least 3:1 (got ${whiteContrast(p90(L)).toFixed(2)})`);
  assert.ok(whiteContrast(p90(D)) >= 6, `dark: at least 6:1 (got ${whiteContrast(p90(D)).toFixed(2)})`);
  assert.ok(mean(D) <= mean(L) / 2, `the dark grade is at most half the light grade's luminance (${mean(D).toFixed(3)} vs ${mean(L).toFixed(3)})`);
});
