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
  // The button sits in a block no export reads.
  assert.match(template, /<div class="qr-notes" data-export-hide>/);
});

async function notices(values: Record<string, InputValue>, host = baseHost()) {
  const runtime = await createRuntime(tool, host, { url: LINK, ...values });
  const out = runtime.getNotices();
  runtime.destroy();
  return out;
}

test('each warning is a notice under the input that causes it, and nothing is drawn for it', async () => {
  const warned = await notices({ padding: 1, color: '#ffffff', background: '#222222' });
  assert.deepEqual(Object.keys(warned).sort(), ['background', 'padding']);
  assert.equal(warned.padding!.tone, 'warning');
  assert.match(warned.padding!.text, /^Quiet zone is 1 module\./);
  assert.match(warned.background!.text, /lighter than the background/);

  // Contrast goes to the weakest ink: the module colour, the eyes or the second colour.
  assert.match((await notices({ color: '#cccccc', background: '#ffffff' })).color!.text, /^Low contrast \(1\.6:1\)\. .*darken the modules/);
  assert.match((await notices({ eyeColor: '#dddddd', background: '#ffffff' })).eyeColor!.text, /darken the eyes/);
  assert.match((await notices({ fill: 'gradient', color: '#0c322c', color2: '#eef7ee', background: '#ffffff' })).color2!.text, /darken the second colour/);
  // The logo is counted on the symbol: the default plate is quiet, a large one warns and
  // one past what error correction can rebuild is an error. Padding counts as the plate does.
  const logo = { logo: 'lolly/logo/primary' };
  assert.equal((await notices({ ...logo })).logoScale, undefined);
  assert.equal((await notices({ ...logo, logoScale: 32, logoPad: 0 })).logoScale, undefined);
  const near = (await notices({ ...logo, logoScale: 32, logoPad: 1 })).logoScale!;
  assert.equal(near.tone, 'warning');
  assert.match(near.text, /^The logo uses about 88% of what error correction can rebuild/);
  const past = (await notices({ ...logo, logoScale: 32, logoPad: 2 })).logoScale!;
  assert.equal(past.tone, 'error');
  assert.match(past.text, /^The logo hides more of the code than error correction can rebuild/);
  assert.equal((await notices({ ...logo, logoScale: 8, logoPad: 4, url: 'https://lolly.tools' })).logoScale!.tone, 'error', 'a small mark with a wide ring on a small code');

  // Fixed, a barcode and scan mode: the set is empty again.
  assert.deepEqual(await notices({}), {});
  assert.deepEqual(await notices({ padding: 1, payload: 'ean13', value: '4006381333931' }), {});
  assert.deepEqual(await notices({ padding: 1, mode: 'scan', source: 'paste', scanText: 'hello' }), {});
  const runtime = await createRuntime(tool, baseHost(), { url: LINK, padding: 1 });
  assert.ok(runtime.getNotices().padding);
  await runtime.setInput('padding', 4);
  assert.deepEqual(runtime.getNotices(), {}, 'the notice goes when the value is fixed');
  await runtime.setInput('padding', 0);
  await runtime.setInput('mode', 'scan');
  assert.deepEqual(runtime.getNotices(), {}, 'and when the tool leaves make mode');
  runtime.destroy();

  // Nothing reaches the page: no list, no script that makes room, no text of a warning.
  const page1 = await page({ padding: 1, color: '#ffffff', background: '#222222' });
  assert.doesNotMatch(page1, /qr-warn|qr-notes|data-foot|role="status"|Quiet zone is|inputNotices/);
  assert.doesNotMatch(template, /qr-warn|qrListed|qrWarnings/);
  // With motion on, the replay button is all that hangs under the canvas.
  const moving = await page({ padding: 1, motion: 'rings' });
  assert.match(moving, /<div class="qr-notes" data-export-hide>\s*<button type="button" class="qr-play">Play motion<\/button>\s*<\/div>/);
  const css = await read('qr-code/styles.css');
  assert.match(css, /\.qr-notes \{ display: none; \}/);
  assert.match(css, /\.qr-notes\[data-foot\] \{[^}]*top: 100%;/);
  assert.doesNotMatch(css, /qr-warn/);
});

test('the reader shows no result panel before a result', async () => {
  for (const source of ['camera', 'image', 'paste']) {
    const idle = await page({ mode: 'scan', source });
    assert.doesNotMatch(idle, /sc-result|sc-empty|Nothing decoded/, source);
  }
  const found = await page({ mode: 'scan', source: 'paste', scanText: 'https://lolly.tools' });
  assert.equal(found.match(/class="sc-result"/g)?.length, 1);
  assert.match(found, /data-copy="https:\/\/lolly\.tools">Copy<\/button>/);
  assert.match(found, /data-open>Open link/);
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

test('the error panel and the warnings take the alert roles, measured', async () => {
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
    const reader = await page({ mode: 'scan', source: 'paste', scanText: 'https://bit.ly/x' }, host);
    const style = /<div class="sc" data-mode="paste" style="([^"]+)"/.exec(reader)?.[1];
    assert.ok(style, 'the reader carries the roles');
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
  assert.equal(failed.qrNotes, false, 'nothing hangs under the canvas for it');
  assert.deepEqual(failed.inputNotices, { moduleShape: { tone: 'error', text: 'A test read of this code came back empty. Reduce the logo, raise the contrast or simplify the module shape.' } }, 'the failed read is a notice under the styling most likely to cause it');
  assert.deepEqual(result.inputNotices, {}, 'a code that reads back carries none');
});

test('the hooks touch nothing a Worker lacks', () => {
  const { clean, realmBound } = analyseIsolation(hooksSource);
  assert.ok(clean, JSON.stringify(realmBound));
  assert.equal(tool.manifest.isolate, true);
});

test('the logo count walks the symbol as the encoder lays it out, for every version and level', () => {
  const qr = new Function(`${hooksSource}\nreturn { QRRSBlock, _qbLogoLoad };`)() as {
    QRRSBlock: { getRSBlocks(type: number, level: number): Array<{ totalCount: number; dataCount: number }> };
    _qbLogoLoad(model: { moduleCount: number; typeNumber: number; errorCorrectLevel: number }, logo: { scale: number; pad: number; shape: string }): { hidden: number; capacity: number; total: number; worst: number; dataModules: number };
  };
  // Remainder bits per version (ISO/IEC 18004, table 1): data modules = codewords * 8 + these.
  const REMAINDER = [0, 7, 7, 7, 7, 7, 0, 0, 0, 0, 0, 0, 0, 3, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 3, 3, 3, 3, 3, 3, 3, 0, 0, 0, 0, 0, 0];
  for (let type = 1; type <= 40; type++) for (const level of [0, 1, 2, 3]) {
    const blocks = qr.QRRSBlock.getRSBlocks(type, level);
    const total = blocks.reduce((sum, b) => sum + b.totalCount, 0);
    const none = qr._qbLogoLoad({ moduleCount: 17 + 4 * type, typeNumber: type, errorCorrectLevel: level }, { scale: 0, pad: 0, shape: 'square' });
    assert.equal(none.total, total, `version ${type}`);
    assert.equal(none.dataModules, total * 8 + REMAINDER[type - 1]!, `version ${type} data modules`);
    assert.equal(none.capacity, blocks.reduce((sum, b) => sum + Math.floor((b.totalCount - b.dataCount) / 2), 0));
  }
  // A plate over the whole symbol hides every codeword; a circle hides fewer than its square.
  const model = { moduleCount: 29, typeNumber: 3, errorCorrectLevel: 2 };
  const all = qr._qbLogoLoad(model, { scale: 1, pad: 0, shape: 'square' });
  assert.equal(all.hidden, all.total);
  assert.ok(all.worst > 1);
  const square = qr._qbLogoLoad(model, { scale: 0.32, pad: 1, shape: 'square' }), circle = qr._qbLogoLoad(model, { scale: 0.32, pad: 1, shape: 'circle' });
  assert.ok(circle.hidden < square.hidden && circle.hidden > 0);
});
