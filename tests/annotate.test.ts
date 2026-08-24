// SPDX-License-Identifier: MPL-2.0
/**
 * Annotate (community/annotate) - overlay contract.
 *
 * Loads the REAL tool from the community pack (manifest + template + hooks) and
 * drives it through the engine with the shared baseHost, so every assertion is
 * about what the tool actually draws rather than a fixture of it.
 *
 * What is pinned here:
 *  - each mark kind emits its own group, and a spotlight emits none (it is a
 *    hole in the dim, not a shape);
 *  - the normalised rows: an arrow keeps its signed run, every box kind folds a
 *    negative extent back into x/y, a pin has no size, and an unrecognised row
 *    keeps its index rather than shifting the ones after it;
 *  - step pins number themselves from their position among the pins;
 *  - the spotlight dim is ONE evenodd path: the whole frame, minus one rounded
 *    subpath per spotlight, mapped by the frame's aspect;
 *  - the sketchy wobble is deterministic - same rows, same path; a different
 *    position in the list, a different path;
 *  - a callout's words shrink into the box they were drawn in;
 *  - exportFile hands back non-empty bytes for a tiny synthetic PNG;
 *  - a loaded picture's own pixel aspect becomes the overlay's space;
 *  - the text-anchor rail only exists where a reader does;
 *  - a junk accent falls back and never becomes a fetch;
 *  - every shipped example hydrates and draws.
 *
 * Run with: node --import ./tests/css-stub.mjs --test tests/annotate.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { baseHost } from './helpers/host.ts';

// Load from the SOURCE pack, not the gitignored tools/ profile view, so the
// suite is profile-independent: skip only when community/ is not checked out.
const COMMUNITY = join(dirname(fileURLToPath(import.meta.url)), '..', 'community');
const fetchFile = (path: string) => readFile(join(COMMUNITY, path), 'utf8');

const PACK_MOUNTED = existsSync(COMMUNITY);
const SKIP = !PACK_MOUNTED && 'community pack not mounted (clone without submodules)';
if (PACK_MOUNTED) {
  assert.ok(existsSync(join(COMMUNITY, 'annotate', 'tool.json')),
    'community/annotate/tool.json is missing - pack is mounted, so the tool was renamed or deleted');
}

const tool: any = SKIP ? null : await loadTool('annotate', fetchFile);

async function render(state: Record<string, any>, overrides: Record<string, unknown> = {}): Promise<string> {
  const rt = await createRuntime(tool, baseHost(overrides), state);
  return rt.getHydrated() as string;
}

// The stage's data-* payloads are Handlebars-escaped into an attribute, so they
// come back through the same four entities the escaper writes.
function attrJson(html: string, name: string): any {
  const m = new RegExp(`${name}="([^"]*)"`).exec(html);
  assert.ok(m, `${name} is not on the stage`);
  const raw = m![1]!
    .replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  return JSON.parse(raw);
}

const mark = (kind: string, x: number, y: number, w = 0, h = 0, text = '') =>
  ({ kind, x, y, w, h, text });

// The placeholder the tool draws when no picture is loaded: 1600 x 1000, so one
// overlay unit is 1% of 1600 and the viewBox is 100 x 62.5.
const VB_H = 62.5;

test('each kind draws its own group, and a spotlight draws a hole instead', { skip: SKIP }, async () => {
  const html = await render({
    annotations: [
      mark('arrow', 10, 10, 20, 15),
      mark('box', 40, 10, 20, 15),
      mark('pin', 70, 10, 0, 0, 'Here'),
      mark('callout', 10, 60, 30, 12, 'Words'),
      mark('highlight', 50, 60, 20, 6),
      mark('spotlight', 75, 40, 20, 20),
    ],
  });
  // Matched against the drawn group, not a bare attribute: the rail buttons in
  // the workspace carry a data-kind of their own.
  for (const [i, kind] of ['arrow', 'box', 'pin', 'callout', 'highlight'].entries()) {
    assert.ok(html.includes(`class="an-mark" data-idx="${i}" data-kind="${kind}"`), `${kind} drew no group`);
  }
  assert.equal((html.match(/class="an-mark"/g) ?? []).length, 5,
    'a spotlight is a hole in the dim, never a shape of its own');
  assert.ok(html.includes('class="an-dim"'), 'the spotlight drew no dim');
  assert.ok(html.includes('>1</text>'), 'the step pin drew no number');
  assert.ok(html.includes('>Here</text>'), 'the step pin drew no caption');
  assert.ok(html.includes('>Words</text>'), 'the callout drew no words');
});

test('rows normalise: signed arrows, folded boxes, sizeless pins, index kept', { skip: SKIP }, async () => {
  const html = await render({
    annotations: [
      mark('arrow', 50, 50, -20, -15),
      mark('box', 50, 50, -20, -15),
      mark('pin', 30, 30, 44, 44),
      { kind: 'nonsense', x: 1, y: 2, w: 3, h: 4 },
      mark('highlight', 10, 10, 12, 4),
    ],
  });
  const rows = attrJson(html, 'data-marks');
  assert.equal(rows.length, 5, 'every row must survive with its own index');
  assert.deepEqual(
    { x: rows[0].x, y: rows[0].y, w: rows[0].w, h: rows[0].h },
    { x: 50, y: 50, w: -20, h: -15 },
    'an arrow keeps its signed run to the point',
  );
  assert.deepEqual(
    { x: rows[1].x, y: rows[1].y, w: rows[1].w, h: rows[1].h },
    { x: 30, y: 35, w: 20, h: 15 },
    'a box folds a negative extent back into x/y',
  );
  assert.deepEqual({ w: rows[2].w, h: rows[2].h }, { w: 0, h: 0 }, 'a pin has no size');
  assert.equal(rows[3].kind, '', 'an unrecognised kind is blanked, not dropped');
  assert.equal(rows[4].kind, 'highlight', 'the row after an unrecognised one keeps its place');
  // Indices must address the same rows the sidebar shows, or a canvas edit
  // rewrites the wrong one.
  assert.ok(html.includes('data-idx="4"'), 'the last row did not draw at its own index');
});

// The step numbers the overlay actually drew, in document order.
const pinNumbers = (html: string) =>
  [...html.matchAll(/data-kind="pin">([\s\S]*?)<\/g>/g)]
    .map(g => /<text[^>]*>(\d+)<\/text>/.exec(g[1]!)?.[1]);

test('step pins number themselves from their position among the pins', { skip: SKIP }, async () => {
  const three = [
    mark('pin', 10, 10),
    mark('box', 30, 30, 10, 10),
    mark('pin', 50, 20),
    mark('arrow', 60, 60, 10, 10),
    mark('pin', 80, 40),
  ];
  const html = await render({ annotations: three });
  assert.deepEqual(pinNumbers(html), ['1', '2', '3'], 'the pins did not number themselves in order');
  // Taking the middle pin out renumbers the rest - the whole reason the number
  // is derived rather than typed.
  const gone = await render({ annotations: [three[0]!, three[1]!, three[3]!, three[4]!] });
  assert.deepEqual(pinNumbers(gone), ['1', '2'], 'a step number survived the pin it belonged to');
});

// Defect (review): the step number was published in data-marks, and the canvas
// commits that array straight back into `annotations`. A derived value has no
// business in the person's own rows - it rides in every shared link and goes
// stale the moment a pin above it is deleted.
test('the canvas write-back payload is the declared fields and nothing derived', { skip: SKIP }, async () => {
  const declared = new Set(
    ((tool.manifest.inputs as Array<any>).find(i => i.id === 'annotations').fields as Array<{ id: string }>)
      .map(f => f.id),
  );
  const html = await render({ annotations: [mark('pin', 10, 10), mark('box', 30, 30, 10, 10)] });
  const rows = attrJson(html, 'data-marks');
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert.deepEqual(
      Object.keys(row).filter(k => !declared.has(k)), [],
      `data-marks carries a field the blocks input never declared: ${JSON.stringify(row)}`,
    );
  }
  // The number is still drawn - it just lives in the overlay, not in the data.
  assert.deepEqual(pinNumbers(html), ['1']);
});

test('the spotlight dim is one evenodd path with a hole per row', { skip: SKIP }, async () => {
  const html = await render({
    strokeWidth: 4,
    annotations: [mark('spotlight', 44, 20, 30, 30), mark('spotlight', 10, 60, 20, 10)],
  });
  const d = /class="an-dim" d="([^"]+)"/.exec(html)?.[1] ?? '';
  assert.ok(d, 'no dim path was drawn');
  assert.ok(html.includes('fill-rule="evenodd"'), 'the holes are cut by evenodd, so it must be declared');
  assert.ok(d.startsWith(`M0 0H100V${VB_H}H0Z`), `the dim must start as the whole frame, got ${d.slice(0, 24)}`);
  // Percentages of the HEIGHT scale by the frame's own viewBox height; a corner
  // radius of sw * 1.2 (sw = strokeWidth * 0.25) opens each hole.
  assert.ok(d.includes(`M45.2 ${20 * VB_H / 100}`), 'the first hole is not at the row it names');
  assert.ok(d.includes(`M11.2 ${60 * VB_H / 100}`), 'the second hole is not at the row it names');
  assert.equal(d.split('A').length - 1, 8, 'each hole is a rounded rectangle: four arcs apiece');
});

test('the sketchy wobble is deterministic, and belongs to the row position', { skip: SKIP }, async () => {
  const rows = [mark('box', 20, 20, 30, 20), mark('box', 55, 50, 20, 15)];
  const a = await render({ annotations: rows, annotStyle: 'sketchy' });
  const b = await render({ annotations: rows, annotStyle: 'sketchy' });
  assert.equal(a, b, 'the same marks must wobble the same way every render');

  const solid = await render({ annotations: rows, annotStyle: 'solid' });
  assert.notEqual(solid, a, 'sketchy must actually differ from solid');
  assert.ok(!/L\d/.test(/data-kind="box">\s*<path d="([^"]+)"/.exec(solid)?.[1] ?? 'L1'),
    'a solid box is a rounded rectangle, not a polyline');

  // Same geometry, different position in the list: the seed is the row index,
  // so the second box must not repeat the first box's line.
  const swapped = await render({ annotations: [rows[1]!, rows[0]!], annotStyle: 'sketchy' });
  const first = (html: string) => /data-kind="box">\s*<path d="([^"]+)"/.exec(html)?.[1] ?? '';
  assert.notEqual(first(swapped), first(a), 'the wobble did not follow the row index');
});

test('a callout puts its words inside the box it was drawn', { skip: SKIP }, async () => {
  const html = await render({
    strokeWidth: 4,
    annotations: [mark('callout', 5, 5, 20, 8, 'A sentence long enough to need more than one line in there')],
  });
  const group = /data-kind="callout">([\s\S]*?)<\/g>/.exec(html)?.[1] ?? '';
  const sizes = [...group.matchAll(/font-size="([\d.]+)"/g)].map(m => Number(m[1]));
  assert.ok(sizes.length >= 1, 'the callout drew no words');
  assert.ok(sizes.every(s => s === sizes[0]), 'every line of one callout shares one size');
  // sw = strokeWidth * 0.25, padding = sw * 1.2 + 0.5, and 8% of the height is
  // 8 * 62.5 / 100 overlay units.
  const innerH = 8 * VB_H / 100 - (1 * 1.2 + 0.5) * 2;
  assert.ok(sizes.length * sizes[0]! * 1.25 <= innerH + 0.01,
    `the wrapped words (${sizes.length} lines at ${sizes[0]}) overflow the ${innerH} the box has`);
});

test('a junk accent falls back, and never becomes a fetch', { skip: SKIP }, async () => {
  for (const accent of ['url(https://example.invalid/x.png)', 'javascript:alert(1)', '', 'chartreuse']) {
    const html = await render({ accent, annotations: [mark('box', 10, 10, 20, 20)] });
    assert.ok(html.includes('stroke="#2563eb"'), `accent ${JSON.stringify(accent)} did not fall back`);
    assert.ok(!/url\(/.test(html), 'a colour must never reach the markup as a url()');
  }
  const good = await render({ accent: '#0d7a5f', annotations: [mark('box', 10, 10, 20, 20)] });
  assert.ok(good.includes('stroke="#0d7a5f"'), 'a real hex must reach the mark');
});

test('the text-anchor rail exists only where a reader does', { skip: SKIP }, async () => {
  // The label, not the attribute: the canvas script names the same hooks in the
  // handler it always ships.
  const bare = await render({ annotations: [] });
  assert.ok(!bare.includes('>Snap to text<'), 'no reader, so no Snap to text button');

  const withOcr = await render({ annotations: [] }, {
    ocr: { isAvailable: () => true, run: async () => ({ text: '', lines: [], lang: 'en' }) },
  });
  assert.ok(withOcr.includes('>Snap to text<'), 'a reader must publish the Snap to text button');
  assert.equal(attrJson(withOcr, 'data-anchors').length, 0,
    'an anchor is only ever produced by a read the person asked for');
});

// A 1x1 PNG. The decode is stubbed below, so the bytes only have to be a real
// file of the type the tool claims to accept.
const PNG_1X1 = Uint8Array.from(atob(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
), (c) => c.charCodeAt(0));

function fileValue(bytes: Uint8Array) {
  return { __file: true as const, name: 'grab.png', mime: 'image/png', size: bytes.length, bytes, url: null };
}

// The smallest surface exportFile actually uses: a drawing context that records
// nothing, and an encoder that hands back bytes. host.raster.decode stands in
// for both the picture and the overlay it rasterises over it.
function rasterStubs(out: Uint8Array) {
  const drawn: string[] = [];
  (globalThis as any).OffscreenCanvas = class {
    width: number;
    height: number;
    constructor(w: number, h: number) { this.width = w; this.height = h; }
    getContext() {
      return {
        drawImage: (src: any) => drawn.push(src && src.__overlay ? 'overlay' : 'picture'),
        getImageData: (_x: number, _y: number, w: number, h: number) =>
          ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
      };
    }
    convertToBlob() { return Promise.resolve(new Blob([out as BlobPart], { type: 'image/png' })); }
  };
  const raster = {
    canRaster: () => true,
    measure: async () => ({ width: 240, height: 160, mime: 'image/png' }),
    decode: async (src: unknown) => ({
      width: 240, height: 160,
      __overlay: !(src instanceof Uint8Array),
      close() { /* nothing to release in the stub */ },
    }),
  };
  return { raster, drawn };
}

test('exportFile hands back the annotated bytes', { skip: SKIP }, async () => {
  const { raster, drawn } = rasterStubs(Uint8Array.from([137, 80, 78, 71, 1, 2, 3]));
  const rt = await createRuntime(tool, baseHost({ raster }), {
    source: fileValue(PNG_1X1),
    annotations: [mark('arrow', 10, 10, 20, 15), mark('pin', 60, 40, 0, 0, 'One')],
  });
  const res: any = await rt.exportFile();
  assert.ok(res.bytes.length > 0, 'exportFile produced no bytes');
  assert.equal(res.mime, 'image/png', 'a PNG in must come back a PNG');
  assert.equal(res.filename, 'grab-annotated.png');
  assert.deepEqual(drawn, ['picture', 'overlay'], 'the marks must be drawn over the picture, in that order');
});

test('exportFile refuses rather than shipping an unannotated copy', { skip: SKIP }, async () => {
  const { raster } = rasterStubs(Uint8Array.from([1]));
  const noFile = await createRuntime(tool, baseHost({ raster }), { annotations: [mark('box', 10, 10, 20, 20)] });
  await assert.rejects(() => noFile.exportFile(), /Choose a picture first/);

  const noRaster = await createRuntime(tool, baseHost(), { source: fileValue(PNG_1X1), annotations: [] });
  await assert.rejects(() => noRaster.exportFile(), /browser canvas/);
});

test('the loaded picture\'s own aspect becomes the overlay space', { skip: SKIP }, async () => {
  // 240 x 160 is 1.5:1, so the viewBox is 100 wide by 66.67 tall and a mark at
  // 50% down sits at 33.33 - the mapping the exported file repeats at full size.
  const { raster } = rasterStubs(Uint8Array.from([1]));
  const html = await render({ source: fileValue(PNG_1X1), annotations: [mark('pin', 20, 50)] }, { raster });
  assert.ok(html.includes('viewBox="0 0 100 66.67"'), 'the overlay did not take the picture\'s aspect');
  assert.ok(html.includes('cy="33.33"'), 'a percentage of the height did not map through the aspect');
  assert.ok(html.includes('aspect-ratio: 240 / 160'), 'the frame did not take the picture\'s aspect');
  assert.ok(!html.includes('an-ph'), 'the placeholder must give way to a real picture');
});

// Defect (review): a mime read straight off an object literal answers
// 'constructor' with a function, and that function reached the encoder.
test('a junk file type encodes as PNG rather than whatever the prototype answers', { skip: SKIP }, async () => {
  for (const mime of ['constructor', 'toString', '__proto__', 'image/tiff', '']) {
    const { raster } = rasterStubs(Uint8Array.from([1, 2, 3]));
    const rt = await createRuntime(tool, baseHost({ raster }), {
      source: { ...fileValue(PNG_1X1), mime },
      annotations: [mark('box', 10, 10, 20, 20)],
    });
    const res: any = await rt.exportFile();
    assert.equal(res.mime, 'image/png', `file type ${JSON.stringify(mime)} did not fall back to PNG`);
    assert.equal(res.filename, 'grab-annotated.png');
  }
});

// Defect (review): shrink-to-fit only measured the stack of lines, so one word
// with nowhere to break - a URL, a long compound - drew straight out of the
// callout and across the picture.
test('a callout with one unbreakable word stays inside its box', { skip: SKIP }, async () => {
  const w = 20, h = 10;
  const word = 'https://example.com/a/very/long/path/that/never/breaks';
  const html = await render({ strokeWidth: 4, annotations: [mark('callout', 5, 5, w, h, word)] });
  const group = /data-kind="callout">([\s\S]*?)<\/g>/.exec(html)?.[1] ?? '';
  const size = Number(/font-size="([\d.]+)"/.exec(group)?.[1]);
  assert.ok(size > 0, 'the callout drew no words');
  // The same 0.55em estimate the wrap uses, against the padded inner width
  // (sw = strokeWidth * 0.25, padding = sw * 1.2 + 0.5).
  const innerW = w - (1 * 1.2 + 0.5) * 2;
  assert.ok(word.length * size * 0.55 <= innerW + 0.01,
    `the word draws ${word.length * size * 0.55} wide in a box of ${innerW}`);
  assert.ok(size >= 0.4, 'the shrink floor must still hold');
});

// Defect (review): the frame was width:100% + max-height:100%, which is exactly
// the case where CSS abandons the aspect ratio. The handles layer and the
// pointer-to-percent maths both measure this box, so on any picture taller than
// the viewport, every mark sat somewhere the person did not put it.
test('the frame keeps the picture ratio on both axes', { skip: SKIP }, async () => {
  const { raster } = rasterStubs(Uint8Array.from([1]));
  const shot = await render({ source: fileValue(PNG_1X1), annotations: [] }, { raster });
  assert.ok(shot.includes('aspect-ratio: 240 / 160; --an-ar: 1.5'),
    'the frame did not publish its ratio as a number for the width cap');
  const bare = await render({ annotations: [] });
  assert.ok(bare.includes('aspect-ratio: 1600 / 1000; --an-ar: 1.6'),
    'the placeholder frame did not publish its ratio');

  const css = await fetchFile('annotate/styles.css');
  const rule = /\.an-frame \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.ok(rule, '.an-frame lost its rule');
  assert.ok(/width:\s*min\(100%,\s*calc\(var\(--an-frameview[^)]*\)\s*\*\s*var\(--an-ar/.test(rule),
    'the frame must be capped by the live viewport height times its own ratio');
  assert.ok(!/max-height/.test(rule),
    'a max-height on the frame is what dropped the ratio; the width cap replaces it');
});

// Defect (review): drawing exempted arrows from the too-small rule and resizing
// did not, so a level arrow could be drawn once and never resized again. One
// predicate now, lifted out of the template and exercised here.
test('the too-small rule is one predicate, and a level arrow passes it', { skip: SKIP }, async () => {
  const tpl = await fetchFile('annotate/template.html');
  const src = /function tooSmall\(m\) \{[\s\S]*?\n    \}/.exec(tpl)?.[0];
  assert.ok(src, 'tooSmall is no longer a single extractable function');
  assert.ok((tpl.match(/tooSmall\(/g) ?? []).length >= 3,
    'both the draw and the resize guard must go through the one predicate');
  assert.ok(!/Math\.abs\(m\.[wh]\)[^\n]*\|\|/.test(tpl.replace(src, '')),
    'a size guard was written inline again instead of going through tooSmall');
  const tooSmall = new Function(`${src}; return tooSmall;`)() as (m: any) => boolean;

  assert.equal(tooSmall({ kind: 'arrow', w: 30, h: 0 }), false, 'a level arrow is a real arrow');
  assert.equal(tooSmall({ kind: 'arrow', w: 0, h: -22 }), false, 'a plumb arrow is a real arrow');
  assert.equal(tooSmall({ kind: 'arrow', w: 0.1, h: 0.1 }), true, 'an arrow with no run is nothing');
  assert.equal(tooSmall({ kind: 'box', w: 30, h: 0.2 }), true, 'a box with no height is a stray click');
  assert.equal(tooSmall({ kind: 'box', w: 30, h: 20 }), false);
  assert.equal(tooSmall({ kind: 'pin', w: 0, h: 0 }), false, 'a pin never has a size');
});

// Defect (review): the file key was name + size, so a leftover read request
// could be handed to a DIFFERENT picture saved under the same name at the same
// byte count. Nothing may be read that nobody asked about.
test('a leftover text-read request does not follow the next picture', { skip: SKIP }, async () => {
  const { raster } = rasterStubs(Uint8Array.from([1]));
  let runs = 0;
  const ocr = {
    isAvailable: () => true,
    run: async () => {
      runs += 1;
      return { text: 'Sign in', lang: 'en', lines: [{ text: 'Sign in', confidence: 0.9, box: { x: 24, y: 16, w: 96, h: 20 } }] };
    },
  };
  const nonce = 'leftover-nonce';
  const named = (url: string) => ({ ...fileValue(PNG_1X1), name: 'same.png', url });

  // ONE runtime, two files: the request nonce lives on an input, so it is still
  // sitting there when the second picture is dropped in.
  const rt = await createRuntime(tool, baseHost({ raster, ocr }), {
    source: named('blob:one'), annotations: [], ocr: nonce,
  });
  assert.equal(runs, 1, 'the request the person made was not read');
  assert.equal(attrJson(rt.getHydrated() as string, 'data-anchors').length, 1, 'the read produced no anchor');

  await rt.setInput('source', named('blob:two') as any);
  assert.equal(runs, 1, 'a leftover request read a picture nobody asked about');
  assert.equal(attrJson(rt.getHydrated() as string, 'data-anchors').length, 0,
    'a leftover request offered anchors on the wrong picture');
});

// Product: with nothing drawn there is nothing to download but a re-encoded
// copy of the person's own file - a quiet quality loss on a JPEG. Redact holds
// the same line with its bars.
test('the download waits for a mark', { skip: SKIP }, async () => {
  const { raster } = rasterStubs(Uint8Array.from([1]));
  const empty = await render({ source: fileValue(PNG_1X1), annotations: [] }, { raster });
  assert.ok(!empty.includes('data-export-file'), 'an empty drawing offered a download');
  assert.ok(empty.includes('Add a mark to download a copy'));

  const drawn = await render({ source: fileValue(PNG_1X1), annotations: [mark('box', 10, 10, 20, 20)] }, { raster });
  assert.ok(drawn.includes('data-export-file'), 'a drawn mark must offer the download');
});

test('every shipped example hydrates and draws', { skip: SKIP }, async () => {
  const ids = new Set((tool.manifest.inputs as Array<{ id: string }>).map(i => i.id));

  // The bare defaults first: what somebody sees before they touch anything.
  const bare = await render({});
  const defaults = (tool.manifest.inputs as Array<any>).find(i => i.id === 'annotations').default as unknown[];
  assert.equal((bare.match(/class="an-mark"/g) ?? []).length, defaults.length,
    'the default marks did not all draw');
  assert.ok(bare.includes('an-ph'), 'the defaults must draw on the generated placeholder');

  const examples = (tool.manifest.examples ?? []) as Array<{ label: string; values: Record<string, unknown> }>;
  assert.ok(examples.length >= 3, 'the tool ships too few examples to show its range');

  for (const { label, values } of examples) {
    for (const key of Object.keys(values)) {
      assert.ok(ids.has(key), `example "${label}" seeds "${key}", which is not an input`);
    }
    const html = await render(values);
    assert.ok(html.includes('an-stage'), `example "${label}" did not render`);
    assert.ok(html.includes('an-ph'), `example "${label}" lost the generated placeholder`);
    const rows = (values.annotations ?? []) as Array<{ kind: string }>;
    const drawn = rows.filter(r => r.kind !== 'spotlight').length;
    assert.equal((html.match(/class="an-mark"/g) ?? []).length, drawn,
      `example "${label}" drew the wrong number of marks`);
    if (rows.some(r => r.kind === 'spotlight')) {
      assert.ok(html.includes('an-dim'), `example "${label}" lost its spotlight`);
    }
  }
});
