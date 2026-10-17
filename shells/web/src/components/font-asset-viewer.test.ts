// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountFontAssetViewer } from './font-asset-viewer.ts';
import { NOTO_HEBREW, OUTFIT, packCollection, sfntFace } from '../lib/font-collection.test-utils.ts';
import type { AssetViewerSource } from '../lib/asset-viewer-source.ts';

class FakeFontFace {
  static created: FakeFontFace[] = [];
  /** Load time in milliseconds by creation order, so a test can make an earlier choice finish last. */
  static delays: number[] = [];
  readonly family: string; readonly style: string; readonly bytes: Uint8Array;
  constructor(family: string, source: ArrayBuffer, descriptors: { style?: string }) { this.family = family; this.style = descriptors.style ?? 'normal'; this.bytes = new Uint8Array(source); FakeFontFace.created.push(this); }
  load(): Promise<this> { return new Promise(resolve => setTimeout(() => resolve(this), FakeFontFace.delays[FakeFontFace.created.indexOf(this)] ?? 5)); }
}

function setup() {
  const dom = new JSDOM('<div id="root"></div>', { url: 'https://lolly.tools' }), fonts = new Set<FakeFontFace>();
  Object.defineProperty(dom.window.document, 'fonts', { value: { add: (face: FakeFontFace) => fonts.add(face), delete: (face: FakeFontFace) => fonts.delete(face) } });
  Object.assign(globalThis, { document: dom.window.document, Event: dom.window.Event, FontFace: FakeFontFace });
  FakeFontFace.created = []; FakeFontFace.delays = [];
  return { dom, fonts, root: dom.window.document.querySelector<HTMLElement>('#root')! };
}
const source = (format: string, name: string): AssetViewerSource => ({ id: name, groupId: name, fileId: null, revision: '', format, kind: 'font', originalUrl: `/${name}`, name });
const detail = (root: HTMLElement, label: string) => [...root.querySelectorAll('dt')].find(term => term.textContent === label)?.nextElementSibling?.textContent;
const settle = () => new Promise(resolve => setTimeout(resolve, 30));
const tag = (bytes: Uint8Array) => String.fromCharCode(...bytes.subarray(0, 4));

test('a collection opens on its first face with a chooser, and choosing another face swaps the loaded face', async () => {
  const { dom, fonts, root } = setup();
  try {
    const dispose = await mountFontAssetViewer(root, packCollection([sfntFace(OUTFIT), sfntFace(NOTO_HEBREW)]), source('ttc', 'pair.ttc'), new AbortController().signal);
    const select = root.querySelector<HTMLSelectElement>('.asset-viewer-toolbar select')!;
    assert.deepEqual([...select.options].map(option => option.textContent?.startsWith('Noto Sans Hebrew') ? 'Noto' : option.textContent), ['Outfit Thin', 'Noto']);
    assert.equal(fonts.size, 1); const [first] = fonts; assert.notEqual(tag(first!.bytes), 'ttcf');
    assert.equal(detail(root, 'Collection face'), '1 / 2'); assert.equal(detail(root, 'Family'), 'Outfit Thin');
    select.value = '1'; select.dispatchEvent(new dom.window.Event('change')); await settle();
    assert.equal(fonts.size, 1); assert.equal(fonts.has(first!), false);
    assert.equal(detail(root, 'Collection face'), '2 / 2'); assert.match(detail(root, 'Family') ?? '', /Noto Sans Hebrew/);
    assert.equal(root.querySelector('.asset-viewer-toolbar select'), select);
    dispose(); assert.equal(fonts.size, 0);
  } finally { dom.window.close(); }
});

test('a quick change of face leaves only the last choice loaded', async () => {
  const { dom, fonts, root } = setup();
  try {
    FakeFontFace.delays = [5, 60, 5];
    const dispose = await mountFontAssetViewer(root, packCollection([sfntFace(OUTFIT), sfntFace(NOTO_HEBREW)]), source('ttc', 'pair.ttc'), new AbortController().signal);
    const select = root.querySelector<HTMLSelectElement>('select')!;
    select.value = '1'; select.dispatchEvent(new dom.window.Event('change'));
    select.value = '0'; select.dispatchEvent(new dom.window.Event('change')); await new Promise(resolve => setTimeout(resolve, 100));
    assert.equal(fonts.size, 1); assert.equal(detail(root, 'Collection face'), '1 / 2');
    assert.equal(root.querySelectorAll('.asset-font-content').length, 1);
    dispose(); assert.equal(fonts.size, 0);
  } finally { dom.window.close(); }
});

test('a damaged face is listed but cannot be chosen, and the first readable face opens', async () => {
  const { dom, fonts, root } = setup();
  try {
    const pair = packCollection([sfntFace(NOTO_HEBREW), sfntFace(OUTFIT)]), data = new DataView(pair.buffer);
    data.setUint32(data.getUint32(12), 0x12345678);
    const dispose = await mountFontAssetViewer(root, pair, source('ttc', 'pair.ttc'), new AbortController().signal);
    const select = root.querySelector<HTMLSelectElement>('.asset-viewer-toolbar select')!;
    assert.deepEqual([...select.options].map(option => [option.textContent, option.disabled]), [['Face 1 (damaged)', true], ['Outfit Thin', false]]);
    assert.equal(select.value, '1'); assert.equal(detail(root, 'Collection face'), '2 / 2'); assert.equal(fonts.size, 1);
    dispose(); assert.equal(fonts.size, 0);
  } finally { dom.window.close(); }
});

test('a Type 1 font is described with an unsupported note and never loaded as a face', async () => {
  const { dom, fonts, root } = setup();
  try {
    const text = new TextEncoder().encode('%!PS-AdobeFont-1.0: ExampleSans-Regular 001.000\n/FamilyName (Example Sans) readonly def\n/Weight (Regular) readonly def\n/FontName /ExampleSans-Regular def\ncurrentfile eexec\n');
    const pfb = new Uint8Array(6 + text.length + 2); pfb.set([0x80, 0x01]); new DataView(pfb.buffer).setUint32(2, text.length, true); pfb.set(text, 6); pfb.set([0x80, 0x03], 6 + text.length);
    await mountFontAssetViewer(root, pfb, source('pfb', 'example.pfb'), new AbortController().signal);
    assert.match(root.querySelector('.asset-viewer-status')!.textContent!, /Type 1 fonts \(PFA and PFB\) cannot be previewed/);
    assert.equal(detail(root, 'Family'), 'Example Sans'); assert.equal(detail(root, 'PostScript name'), 'ExampleSans-Regular'); assert.equal(detail(root, 'Format'), 'Type 1 (PFB)');
    assert.equal(FakeFontFace.created.length, 0); assert.equal(fonts.size, 0);
  } finally { dom.window.close(); }
});
