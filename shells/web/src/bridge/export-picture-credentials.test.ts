// SPDX-License-Identifier: MPL-2.0
/**
 * The pictures an export draws, recorded in its Content Credentials: the SVG and PDF
 * walkers read each `<img>` they inline through `inlinePicture`, and the still raster
 * routes read the page's pictures through `recordDrawnPictures`. Both record a
 * credentialed bitmap as one componentOf ingredient, with nothing added to what the
 * picture's own credential holds.
 *
 * jsdom lays nothing out, so each picture's box is given here.
 *
 * Run directly:
 *   node --import ./tests/css-stub.mjs --test shells/web/src/bridge/export-picture-credentials.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { GENERATED_SOURCE_TYPE, embedC2pa } from '../../../../engine/src/index.ts';
import { packPng } from '../../../../engine/src/png.ts';
import type { IngredientCredential } from '@lolly-tools/core/host-v1';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/' });
globalThis.window = dom.window as unknown as typeof globalThis.window;
globalThis.document = dom.window.document;
globalThis.getComputedStyle = dom.window.getComputedStyle.bind(dom.window);

const { inlinePicture, recordDrawnPictures } = await import('./export-picture-credentials.ts');

const dataUrl = (bytes: Uint8Array, mime: string): string => `data:${mime};base64,${Buffer.from(bytes).toString('base64')}`;
const png = (): Uint8Array => packPng(new Uint8Array(4 * 4 * 4).fill(200), { width: 4, height: 4 });
const signedPng = async (title: string, digitalSourceType?: string): Promise<string> => dataUrl(
  await embedC2pa(png(), 'png', { title, ...(digitalSourceType ? { actions: [{ action: 'c2pa.created', digitalSourceType }] } : {}) }),
  'image/png',
);
const signedSvg = async (): Promise<string> => dataUrl(
  await embedC2pa(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"><rect width="4" height="4"/></svg>'), 'svg', { title: 'Logo' }),
  'image/svg+xml',
);

/** A page of pictures, each with the box the browser would have laid out. */
function page(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.replaceChildren(root);
  for (const img of root.querySelectorAll('img')) {
    const size = img.hasAttribute('data-empty') ? 0 : 40;
    img.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: size, bottom: size, width: size, height: size, toJSON: () => ({}) });
  }
  return root;
}

test('inlinePicture records a signed picture once, as a component, and returns its bytes unchanged', async () => {
  const sky = await signedPng('Generated sky', GENERATED_SOURCE_TYPE);
  const sink: IngredientCredential[] = [];
  assert.equal(await inlinePicture(sky, sink), sky);
  await inlinePicture(sky, sink);
  assert.equal(sink.length, 1, 'the same manifest is one ingredient');
  assert.equal(sink[0]!.relationship, 'componentOf');
  assert.equal(sink[0]!.title, 'Generated sky');
  assert.equal(sink[0]!.digitalSourceType, GENERATED_SOURCE_TYPE, 'the AI source type the picture declared travels');
});

test('inlinePicture adds nothing for an unsigned picture or an export that is not stamped', async () => {
  const sink: IngredientCredential[] = [];
  await inlinePicture(dataUrl(png(), 'image/png'), sink);
  assert.deepEqual(sink, []);
  const plain = await signedPng('Photo');
  assert.equal(await inlinePicture(plain, undefined), plain, 'no sink: the picture is still inlined');
});

test('a PNG records the pictures the page draws, and leaves out what it does not draw', async () => {
  const shown = await signedPng('Harbour photo');
  const sky = await signedPng('Generated sky', GENERATED_SOURCE_TYPE);
  const root = page(`
    <img src="${shown}">
    <div style="display:none"><img src="${await signedPng('Hidden by its box')}"></div>
    <img style="visibility:hidden" src="${await signedPng('Hidden')}">
    <div style="opacity:0"><img src="${await signedPng('Transparent')}"></div>
    <img data-empty src="${await signedPng('No area')}">
    <details><summary>More</summary><img src="${await signedPng('In a closed details')}"></details>
    <img src="${await signedSvg()}">
    <img src="${sky}">
    <img src="${shown}">
  `);
  const sink: IngredientCredential[] = [];
  await recordDrawnPictures(root, 'png', sink);
  assert.deepEqual(sink.map((i) => `${i.title}/${i.relationship}`), ['Harbour photo/componentOf', 'Generated sky/componentOf'],
    'drawn bitmaps in document order, once each; an SVG source keeps its manifest in its own markup, as the walkers leave it');
  assert.equal(sink[1]!.digitalSourceType, GENERATED_SOURCE_TYPE);
});

test('a PNG reads a blob: picture from its bytes, as an upload is shown', async () => {
  const bytes = await embedC2pa(png(), 'png', { title: 'Uploaded photo' });
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'image/png' }));
  try {
    const sink: IngredientCredential[] = [];
    await recordDrawnPictures(page(`<img src="${url}">`), 'png', sink);
    assert.deepEqual(sink.map((i) => `${i.title}/${i.relationship}`), ['Uploaded photo/componentOf']);
  } finally { URL.revokeObjectURL(url); }
});

test('only the still raster formats read the page, and only when the export is stamped', async () => {
  const root = page(`<img src="${await signedPng('Photo')}">`);
  for (const format of ['svg', 'pdf', 'mp4', 'zip']) {
    const sink: IngredientCredential[] = [];
    await recordDrawnPictures(root, format, sink);
    assert.deepEqual(sink, [], `${format} records its pictures as it draws them, or not at all`);
  }
  for (const format of ['png', 'jpeg', 'webp', 'avif', 'tiff']) {
    const sink: IngredientCredential[] = [];
    await recordDrawnPictures(root, format, sink);
    assert.equal(sink.length, 1, format);
  }
  await recordDrawnPictures(root, 'png', undefined);
});

// D2 (2026-11-07): an animated or video export of the same page recorded none of its
// pictures. The frame source now records, at each captured frame's pose, the pictures
// that frame draws; a film records the pictures of each plate it draws in some exported
// frame.
test('a clip records each picture any of its frames draws, once, and only when stamped', async () => {
  const { recordFramePictures } = await import('./export-picture-credentials.ts');
  const early = await signedPng('Shown in the first frame');
  const late = await signedPng('Shown later', GENERATED_SOURCE_TYPE);
  const root = page(`<img id="a" src="${early}"><img id="b" style="opacity:0" src="${late}"><img id="c" style="display:none" src="${await signedPng('Never shown')}">`);
  await recordFramePictures(root, undefined);                  // an unstamped clip: nothing to record into
  const sink: IngredientCredential[] = [];
  await recordFramePictures(root, sink);                       // frame 1: only the first picture is drawn
  assert.deepEqual(sink.map((i) => i.title), ['Shown in the first frame']);
  (root.querySelector('#b') as HTMLElement).style.opacity = '1';
  await recordFramePictures(root, sink);                       // a later frame fades the second one in
  await recordFramePictures(root, sink);
  assert.deepEqual(sink.map((i) => i.title), ['Shown in the first frame', 'Shown later'], 'each picture once, in the order the clip shows them');
  assert.ok(sink.every((i) => i.relationship === 'componentOf'));
  assert.equal(sink[1]!.digitalSourceType, GENERATED_SOURCE_TYPE);
});

test('a film records the pictures its plates draw: drawn layers, their subtrees and the stage background', async () => {
  const { recordStagePictures } = await import('./export-picture-credentials.ts');
  const root = page(`
    <style>.seq-off { display: none }</style>
    <div id="stage">
      <img src="${await signedPng('On the stage background')}">
      <div id="drawn" class="lolly-box seq-off"><img src="${await signedPng('Drawn, off the playhead')}">
        <div id="nested" class="lolly-box"><img src="${await signedPng('Nested, in the parent plate')}"></div></div>
      <div id="slide" data-pdf-page data-t-start="0">
        <div class="lolly-box"><img src="${await signedPng('On the slide')}"></div>
        <div id="later" class="lolly-box"><img src="${await signedPng('Timed after every exported frame')}"></div></div>
      <div id="out" class="lolly-box"><img src="${await signedPng('Never in a frame')}"></div>
      <div id="loose" class="lolly-box"><img src="${await signedPng('A box the background hides')}"></div>
    </div>`);
  const el = (id: string): Element => root.querySelector(`#${id}`)!;
  const layers = [
    { el: el('drawn'), drawn: true },
    { el: el('nested'), drawn: false },
    { el: el('slide'), drawn: true, hidden: [el('later')] },
    { el: el('out'), drawn: false },
  ];
  const own = { offClass: 'seq-off', backgroundHides: '.lolly-box, [data-pdf-page][data-t-start]' };
  const sink: IngredientCredential[] = [];
  await recordStagePictures(el('stage'), layers, sink, own);
  assert.deepEqual(sink.map((i) => i.title), ['Drawn, off the playhead', 'Nested, in the parent plate', 'On the slide', 'On the stage background'],
    'a box the playhead hides is still in its plate, and a plate holds its whole subtree');
  assert.ok(el('drawn').classList.contains('seq-off'), 'the playhead class is put back');
  await recordStagePictures(el('stage'), layers, undefined, own);
  assert.equal(sink.length, 4, 'an unstamped film reads no picture');
});

test('posedFrame runs the record at the frame pose, whether or not it takes the frame itself', async () => {
  const { posedFrame } = await import('./frame-clock.ts');
  const order: string[] = [];
  const plain = document.createElement('div');
  assert.equal(await posedFrame(plain, 0, null, async () => 'clone', async () => { order.push('posed'); }), null);
  assert.equal(await posedFrame(plain, 0, async () => { order.push('shot'); return 'shot'; }, async () => 'clone', async () => { order.push('posed'); }), 'shot');
  assert.deepEqual(order, ['posed', 'posed', 'shot'], 'recorded before the caller or the screenshot takes the frame');
});

test('each member of a bundle keeps its own record, so one member\'s pictures never reach another\'s credential', async () => {
  const { memberIngredientOpts } = await import('./export-shared.ts');
  const given = { title: 'Given by the caller' } as IngredientCredential;
  const bundle = { c2pa: true, _ingredientSink: [given] };
  const first = memberIngredientOpts(bundle);
  const second = memberIngredientOpts(bundle);
  first._ingredientSink!.push({ title: 'Only in the MP4' } as IngredientCredential);
  assert.deepEqual(second._ingredientSink!.map((i) => i.title), ['Given by the caller'], 'each starts from what the caller gave');
  assert.equal(bundle._ingredientSink.length, 1);
  const { readFileSync } = await import('node:fs');
  const exp = readFileSync(new URL('./export.ts', import.meta.url), 'utf8');
  assert.match(exp, /renderFormat\(node, f, memberIngredientOpts\(memberOpts\)\)/, 'the ZIP renders each member with its own record');
});
