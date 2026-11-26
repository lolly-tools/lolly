// SPDX-License-Identifier: MPL-2.0
/**
 * QR Code (community/qr-code): the opt-in motion, the alert roles and the Worker's own
 * drawing of the code for the scan check.
 *
 * Loads the real tool from disk and drives it through the engine. What needs a real
 * browser (the clips, their last frame read back by a decoder) is measured by hand
 * and recorded in the pull request that added this file.
 *
 * Run with: node --test tests/qr-code-motion.test.ts
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import type { InputValue } from '../engine/src/inputs.ts';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { createTokenSet } from '../engine/src/tokens.ts';
import { parseUrlState } from '../engine/src/url-mode.ts';
import { analyseIsolation } from '../scripts/tool-isolation.ts';
import { exportFormatDriver } from '../shells/web/src/views/export-format.ts';
import { baseHost } from './helpers/host.ts';

const root = new URL('../community/', import.meta.url);
const read = (path: string): Promise<string> => readFile(new URL(path, root), 'utf8');
const tool = await loadTool('qr-code', read);
const hooksSource = await read('qr-code/hooks.js');
const template = await read('qr-code/template.html');
const demo = JSON.parse(await readFile(new URL('../brands/lolly-demo/catalog/assets/lolly/tokens/demo.json', import.meta.url), 'utf8'));

const LINK = 'https://lolly.tools/gallery';
const CLIPS = ['mp4', 'webm', 'gif', 'apng', 'webp-anim'];

function hostFor(doc: unknown, selection: Record<string, string> = { '': 'light' }) {
  const set = createTokenSet(doc, { selection } as never);
  return baseHost({ tokens: { resolve: async (ref: string) => set.resolve(ref), get: async () => set, colors: async () => [] } });
}

async function page(values: Record<string, InputValue>, host = baseHost()): Promise<string> {
  const runtime = await createRuntime(tool, host, { url: LINK, ...values });
  const html = runtime.getHydrated();
  runtime.destroy();
  return html;
}

async function svg(values: Record<string, InputValue>, host = baseHost()): Promise<string> {
  const runtime = await createRuntime(tool, host, { url: LINK, ...values });
  const out = runtime.getHydratedString('{{{svgContent}}}') as string;
  runtime.destroy();
  return out;
}

/** The motion taken back out of a moving code: what is left must be the still code. */
function withoutMotion(moving: string): string {
  return moving
    .replace(/ data-qr-motion="" data-clip-ms="\d+"/, '')
    .replace(/<style>[\s\S]*?<\/style>/, '')
    .replace(/<path d="[^"]*" fill="[^"]*" fill-rule="evenodd" opacity="0" shape-rendering="crispEdges" style="animation:qr-lift [^"]*"\/>/g, '')
    .replace(/<g style="transform-box:fill-box;transform-origin:center;animation:qr-rise [^"]*">([\s\S]*?<\/text>)<\/g>/, '$1')
    .replace(/<g style="animation:qr-fade [^"]*">([\s\S]*)<\/g>(?=<\/g>|<\/svg>|<g style=|<path d="M[^"]*" fill="none"|<text)/, '$1');
}

const STYLES: Array<Record<string, InputValue>> = [
  {},
  { join: false },
  { moduleShape: 'dot', eyeShape: 'leaf', fill: 'gradient', color: '0c322c', color2: '30ba78' },
  { moduleShape: 'fluid', eyeShape: 'circle', eyeColor: 'aa0000' },
  { logo: 'lolly/logo/primary', logoShape: 'circle' },
  { frame: 'label' },
  { frame: 'badge', frameText: 'Scan me' },
  { frame: 'arrow', frameText: 'Menu' },
  { transparentBg: true, frame: 'label' },
];

test('Motion none draws the same page as the same inputs without the field', async () => {
  for (const style of STYLES) {
    assert.equal(await page({ ...style, motion: 'none' }), await page(style), JSON.stringify(style));
    assert.doesNotMatch(await svg(style), /animation|@keyframes|data-clip-ms|data-qr-motion/, 'a still code carries no motion');
  }
  const link = parseUrlState('url=https%3A%2F%2Flolly.tools&frame=label&motion=none', tool.manifest).values;
  const without = parseUrlState('url=https%3A%2F%2Flolly.tools&frame=label', tool.manifest).values;
  assert.equal(await page(link), await page(without), 'and the same through a link');
});

test('the motion is added around the code and changes nothing of the code', async () => {
  for (const style of STYLES) {
    const still = await svg(style);
    const moving = await svg({ ...style, motion: 'rings' });
    assert.notEqual(moving, still, JSON.stringify(style));
    assert.equal(withoutMotion(moving), still, `${JSON.stringify(style)}: logo, shapes and colours are the still code's`);
  }
});

test('the code lifts outward from its three eyes and every cover rests at nothing', async () => {
  const moving = await svg({ motion: 'rings' });
  const covers = [...moving.matchAll(/<path d="([^"]*)" fill="([^"]*)" fill-rule="evenodd" opacity="0"[^>]*style="animation:qr-lift (\d+)ms linear (\d+)ms both"\/>/g)];
  assert.ok(covers.length >= 3 && covers.length <= 12, `${covers.length} covers`);
  // The first cover hides the whole field; each later one leaves more open around the eyes.
  assert.equal((covers[0]![1]!.match(/M/g) ?? []).length, 1, 'the first cover has no opening');
  assert.equal((covers[1]![1]!.match(/M/g) ?? []).length, 4, 'the second leaves three squares open, one for each eye');
  const delays = covers.map(c => Number(c[4]));
  assert.deepEqual(delays, [...delays].sort((a, b) => a - b), 'covers lift in order, outward');
  assert.equal(delays[0], 0);
  const lift = Number(covers[0]![3]);
  assert.equal(delays.at(-1)! + lift, 700, 'the last cover is gone at the long duration');
  for (const cover of covers) assert.equal(cover[2], '#ffffff', 'a cover is the colour of the background');
  // A renderer that plays nothing reads the attribute, and the code is finished.
  assert.match(moving, /@media \(scripting:none\)\{\[data-qr-motion\] \*\{animation:none!important\}\}/);
  assert.match(moving, /@keyframes qr-lift\{from\{opacity:\.999\}\}/, 'a cover never starts at exactly 1 (see the hooks)');
});

test('the clip holds the finished code for over two seconds', async () => {
  const clip = async (values: Record<string, InputValue>, host = baseHost()): Promise<number> =>
    Number(/data-clip-ms="(\d+)"/.exec(await svg({ motion: 'rings', ...values }, host))?.[1]);
  assert.equal(await clip({}), 700 + 2400, 'the modules, then the hold');
  assert.equal(await clip({ frame: 'label' }), 700 + 400 + 2400, 'the call to action rises after the modules');
  assert.equal(await clip({ frame: 'label', frameText: '' }), 700 + 2400, 'no words, nothing to wait for');
  const label = await svg({ motion: 'rings', frame: 'arrow', frameText: 'Menu' });
  assert.match(label, /animation:qr-rise 400ms cubic-bezier\(0\.05,0\.7,0\.1,1\) 700ms both">.*<path[^>]*stroke[^>]*\/><text/, 'the arrow and the words rise as one group');
});

test('durations and the curve come from the design system', async () => {
  const doc = structuredClone(demo);
  doc.base.motion.duration.long.$value = { value: 1, unit: 's' };
  doc.base.motion.duration.medium.$value = { value: 250, unit: 'ms' };
  doc.base.motion.curve.emphasised.$value = [0.1, 0.9, 0.2, 1];
  const moving = await svg({ motion: 'rings', frame: 'label' }, hostFor(doc));
  assert.match(moving, /animation:qr-rise 250ms cubic-bezier\(0\.1,0\.9,0\.2,1\) 1000ms both/);
  assert.match(moving, /data-clip-ms="3650"/);
  const delays = [...moving.matchAll(/animation:qr-lift (\d+)ms linear (\d+)ms/g)];
  assert.equal(Number(delays.at(-1)![1]) + Number(delays.at(-1)![2]), 1000);
  assert.match(await svg({ motion: 'rings', frame: 'label' }, hostFor(demo)), /qr-rise 400ms cubic-bezier\(0\.05,0\.7,0\.1,1\) 700ms/, 'Lolly Demo as shipped');
});

test('a transparent code has nothing to cover with, so the whole code fades in', async () => {
  const moving = await svg({ motion: 'rings', transparentBg: true });
  assert.doesNotMatch(moving, /qr-lift \d/);
  assert.match(moving, /<g style="animation:qr-fade 700ms linear 0ms both">/);
});

test('motion belongs to the QR symbol and to a code that has something to carry', async () => {
  for (const other of [{ symbology: 'datamatrix' }, { symbology: 'aztec' }, { payload: 'ean13', value: '4006381333931' }, { url: '' }] as Array<Record<string, InputValue>>) {
    assert.equal(await svg({ ...other, motion: 'rings' }), await svg(other), JSON.stringify(other));
  }
});

test('the page shows the replay button and the clock only with motion on', async () => {
  const moving = await page({ motion: 'rings' });
  assert.match(moving, /<button type="button" class="qr-play">Play motion<\/button>/);
  assert.match(moving, /__lollyFrameRender/);
  const still = await page({});
  assert.doesNotMatch(still, /qr-play|__lollyFrameRender|qr-notes/);
  // The button and the warnings sit in one block no export reads.
  assert.match(template, /<div class="qr-notes" data-export-hide>/);
  assert.match(await page({ padding: 1 }), /<div class="qr-notes" data-export-hide>\s*<div class="qr-scan-warn" role="status">/);
});

test('Motion is the last input and it alone offers the clip formats', () => {
  const inputs = tool.manifest.inputs;
  const motion = inputs.at(-1)!;
  assert.equal(motion.id, 'motion');
  assert.equal(motion.default, 'none');
  assert.equal(inputs.findIndex(i => i.id === 'url') < inputs.findIndex(i => i.id === 'motion'), true);
  assert.deepEqual(motion.showIf, inputs.find(i => i.id === 'frame')!.showIf, 'shown where the call to action is: Make mode, the QR symbol');
  const driver = exportFormatDriver(tool.manifest as never)!;
  assert.equal(driver.id, 'motion');
  for (const clip of CLIPS) {
    assert.ok(!driver.formats.none!.includes(clip), `${clip} is not offered with motion off`);
    assert.ok(driver.formats.rings!.includes(clip), `${clip} is offered with motion on`);
    assert.ok(tool.manifest.render.formats.includes(clip));
  }
  // With motion off the bar offers what it offered before the field existed.
  const stills = tool.manifest.render.formats.filter(f => !CLIPS.includes(f));
  assert.deepEqual([...driver.formats.none!].sort(), [...stills].sort());
  assert.deepEqual([...driver.formats.rings!].sort(), [...tool.manifest.render.formats].sort());
});

test('the error panel and the warning cards take the alert roles, measured', async () => {
  const plain = await svg({ payload: 'text', text: 'x'.repeat(3200) });
  assert.match(plain, /fill="#fff5f5"/, 'with no design system the panel is what it always was');
  assert.match(plain, /fill="#bd3314">QR code unavailable/);
  assert.doesNotMatch(await page({ padding: 1 }), /--qr-alert/);

  for (const selection of [{ '': 'light' }, { '': 'dark' }]) {
    const set = createTokenSet(demo, { selection } as never);
    const card = String(set.resolve('{color.role.alert-card}')).toLowerCase();
    const ink = String(set.resolve('{color.role.alert-ink}')).toLowerCase();
    const host = hostFor(demo, selection);
    for (const values of [{ payload: 'text', text: 'x'.repeat(3200) }, { payload: 'ean13', value: '12ab' }, { symbology: 'datamatrix', payload: 'text', text: 'x'.repeat(4000) }] as Array<Record<string, InputValue>>) {
      const panel = await svg(values, host);
      assert.match(panel, new RegExp(`<rect[^>]*fill="${card}"`), `${JSON.stringify(selection)}: the panel is the alert card`);
      assert.doesNotMatch(panel, /#fff5f5|#bd3314/);
    }
    const warned = await page({ padding: 1 }, host);
    const style = /class="qr-scan-warn" role="status" style="([^"]+)"/.exec(warned)?.[1];
    assert.ok(style, 'the warning card carries the roles');
    const vars = Object.fromEntries(style.split(';').map(p => p.split(':')) as [string, string][]);
    assert.equal(vars['--qr-alert-card'], card);
    assert.ok(contrast(vars['--qr-alert-ink']!, card) >= 4.5 || vars['--qr-alert-ink'] !== ink, 'small type is the alert ink only where that reads');
    const scan = await page({ mode: 'scan', source: 'paste', scanText: 'https://bit.ly/x' }, host);
    assert.match(scan, new RegExp(`<div class="sc" data-mode="paste" style="--qr-alert-card:${card};`));
  }
});

function contrast(a: string, b: string): number {
  const lum = (h: string): number => {
    const c = [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255).map(s => (s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
  };
  const [x, y] = [lum(a), lum(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('the scan check draws the code itself where the shell refuses to rasterise', async () => {
  // A hook Worker has an OffscreenCanvas and Path2D and may not call host.raster.decode.
  const drawn: string[] = [];
  let scanned = '';
  class Path2DStub { d: string; constructor(d: string) { this.d = d; } }
  class CanvasStub {
    width: number; height: number;
    constructor(w: number, h: number) { this.width = w; this.height = h; }
    getContext() {
      let fill = '';
      let dx = 0;
      const saved: number[] = [];
      const { width, height } = this;
      return {
        set fillStyle(v: string) { fill = v; },
        fillRect: (x: number, y: number, w: number) => { drawn.push(`rect ${fill} ${Math.round(x + dx)},${Math.round(y)} ${Math.round(w)}`); },
        fill: (p: Path2DStub, rule: string) => { drawn.push(`path ${fill} ${rule} +${dx} ${p.d.length}`); },
        beginPath: () => {}, arc: () => {},
        save: () => { saved.push(dx); }, restore: () => { dx = saved.pop() ?? 0; },
        translate: (x: number) => { dx += x; },
        drawImage: () => { drawn.push('image'); },
        getImageData: () => ({ data: new Uint8ClampedArray(4), width, height }),
      };
    }
  }
  const host = baseHost({
    raster: { canRaster: () => true, decode: async () => { throw new Error('host.raster.decode is not permitted from an isolated hook'); } },
    scan: { detect: async (frame: { width: number; height: number }) => { scanned = `${frame.width}x${frame.height}`; return [{ rawValue: LINK, format: 'qr_code' }]; } },
  });
  const make = new Function('host', 'OffscreenCanvas', 'Path2D', `${hooksSource}\nreturn { onInit };`);
  const hooks = make(host, CanvasStub, Path2DStub);
  const model = (values: Record<string, InputValue>) => tool.manifest.inputs.map(input => ({ ...input, value: values[input.id] ?? input.default }));

  const result = await hooks.onInit({ model: model({ url: LINK, moduleShape: 'dot', frame: 'badge', motion: 'rings', color: '#111111', background: '#ffffff' }), host });
  assert.equal(result.qrLiveScan, 'ok', 'the check ran and read the code back');
  assert.equal(scanned, '692x814', 'the whole framed code was drawn');
  assert.ok(drawn.some(d => /^path #111111 nonzero \+46 /.test(d)), 'the modules, moved in by the frame');
  assert.ok(drawn.some(d => /^path #111111 evenodd \+46 /.test(d)), 'the eyes');
  assert.equal(drawn.filter(d => d.startsWith('rect #ffffff')).length, 3, 'the white field, the frame ground and the code ground; no cover and no stroke');
  assert.ok(!drawn.some(d => d.includes('none')));

  // Read back as something else, or not at all, is the warning.
  const wrong = make({ ...host, scan: { detect: async () => [] } }, CanvasStub, Path2DStub);
  const failed = await wrong.onInit({ model: model({ url: LINK, moduleShape: 'dot' }), host: { ...host, scan: { detect: async () => [] } } });
  assert.equal(failed.qrLiveScanFail, true);
  assert.equal(failed.qrNotes, true);
});

test('the hooks touch nothing a Worker lacks', () => {
  const { clean, realmBound } = analyseIsolation(hooksSource);
  assert.ok(clean, JSON.stringify(realmBound));
  assert.equal(tool.manifest.isolate, true);
});
