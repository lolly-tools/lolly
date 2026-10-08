// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { readCameraRawPreset } from '../engine/src/camera-raw-preset.ts';
import { readPremiereXml, writePremiereXml, premiereSequenceValues, framesToSeconds } from '../engine/src/premiere-xml.ts';
import { readAdobeXml, escapeAdobeXml } from '../engine/src/adobe-xml.ts';
import { exportDesignIdml } from '../engine/src/design-idml.ts';
import { exportDesignPremiere } from '../engine/src/design-premiere.ts';
import { parseIdmlSpreads } from '../shells/web/src/views/idml-import.ts';
import { readZip } from '../engine/src/zip.ts';
import { packPng } from '../engine/src/png.ts';
import type { HostV1, AssetRef } from '../packages/core/src/host-v1.ts';

const dom = new JSDOM(''), parse = (s: string) => new dom.window.DOMParser().parseFromString(s, 'application/xml');
const fixture = (name: string) => readFileSync(new URL(`./fixtures/adobe/${name}`, import.meta.url), 'utf8');
const crs = 'http://ns.adobe.com/camera-raw-settings/1.0/';
const host = { assets: {}, log() {} } as unknown as HostV1;
const snapshot = (boxes: object[]) => ({ sourceDocument: { toolId: 'design', values: { boxes, projectFps: '30' } } });

test('XMP namespace, present controls and unmapped RAW settings are preserved in the report', () => {
  const preset = readCameraRawPreset(fixture('preset.xmp'), parse);
  assert.deepEqual(preset.values, { exposure: 0.75, contrast: 12, saturation: 80, highlights: -35 });
  assert.equal(preset.name, 'Studio & shade'); assert.deepEqual(preset.unmapped, ['Temperature', 'CameraProfile']);
  assert.ok(preset.notes.some(s => s.includes('AlreadyApplied'))); assert.equal(preset.approximate, true);
  assert.deepEqual(readCameraRawPreset(fixture('preset.xmp'), parse), preset);
  assert.throws(() => readCameraRawPreset(`<p xmlns:q="${crs}" q:Exposure2012="NaN"/>`, parse), /number/);
  assert.throws(() => readCameraRawPreset(`<p xmlns:q="${crs}" q:Exposure2012="1"><q:Exposure2012>2</q:Exposure2012></p>`, parse), /Repeated/);
  assert.equal(readCameraRawPreset(`<p xmlns:q="${crs}" q:Exposure2012="12"/>`, parse).values.exposure, 3);
  assert.throws(() => readCameraRawPreset('s = { os.execute("bad") }', parse), /never executed/);
});
test('XML refuses declarations, malformed data and excessive depth', () => {
  assert.throws(() => readAdobeXml('<!DOCTYPE x [<!ENTITY e SYSTEM "file:///tmp/x">]><x/>', parse), /declaration/);
  assert.throws(() => readAdobeXml('<x>', parse), /malformed/);
  assert.throws(() => readAdobeXml('<x>'.repeat(65) + '</x>'.repeat(65), parse), /structure/);
  assert.throws(() => readAdobeXml('<x/>', parse, 2), /byte limit/);
  assert.throws(() => escapeAdobeXml('invalid\u0000text'), /unsupported character/);
});
test('independent Premiere fixture retains rational rates, tracks and file references', async () => {
  const seq = readPremiereXml(fixture('premiere.xml'), parse);
  assert.deepEqual(seq.rate, { numerator: 30000, denominator: 1001 }); assert.equal(seq.clips.length, 4);
  assert.equal(seq.clips[1]!.path, seq.clips[0]!.path); assert.equal(seq.clips[2]!.track, 1);
  assert.equal(framesToSeconds(150, seq.rate), 5.005); assert.ok(seq.notes.some(s => s.includes('effects')));
  const copy = readPremiereXml(writePremiereXml(seq), parse);
  assert.throws(() => writePremiereXml({ ...seq, width: NaN }), /width/);
  assert.deepEqual(copy.clips, seq.clips); assert.deepEqual(copy.rate, seq.rate);
  const result = await premiereSequenceValues(seq); const boxes = result.values.boxes as Record<string, unknown>[];
  assert.equal(boxes[1]!.start, 5.005); assert.equal(result.values.projectFps, '30'); assert.equal(boxes[0]!.kind, 'text');
  assert.equal(boxes[0]!.opacity, 100);
  const manifest = JSON.parse(readFileSync(new URL('../community/design/tool.json', import.meta.url), 'utf8'));
  const declared = new Set(manifest.inputs.map((input: { id: string }) => input.id));
  for (const key of Object.keys(result.values)) assert.ok(declared.has(key), `unknown Design input ${key}`);
  assert.ok(result.notes.some(s => s.includes('missing media')));
  assert.throws(() => readPremiereXml(fixture('premiere.xml').replace('<end>150</end>', '<end>0</end>'), parse), /interval/);
});
test('IDML emits deterministic multi-spread geometry, editable runs and bundled images', async () => {
  const image: AssetRef = { source: 'user', id: 'user/image', type: 'raster', format: 'png', url: 'unused', width: 1, height: 1 };
  const png = packPng(new Uint8Array([255, 0, 0, 255]), { width: 1, height: 1, channels: 4 });
  const imageHost = { ...host, assets: { bytes: async () => png }, tokens: { resolve: async (ref: string) => ref === '{font.brand}' ? 'Studio Sans' : undefined } } as unknown as HostV1;
  const boxes = [ { id: 'a', kind: 'frame', x: 200, y: 100, w: 600, h: 800 }, { id: 't', kind: 'text', frame: 'a', x: 230, y: 150, w: 200, h: 90, text: '**Hello** & *world*', fg: '#000000', font: 'display', weight: 400, fontSize: 18, align: 'left', valign: 'top', opacity: 100 }, { id: 'oval', kind: 'box', shape: 'ellipse', frame: 'a', x: 300, y: 300, w: 100, h: 60, bg: '#ff0000', opacity: 100 }, { id: 'b', kind: 'frame', x: 1000, y: 100, w: 400, h: 300 }, { id: 'i', kind: 'image', frame: 'b', x: 1010, y: 120, w: 40, h: 50, image, opacity: 100 } ];
  const first = new Uint8Array(await (await exportDesignIdml(snapshot(boxes), imageHost)).arrayBuffer());
  const second = new Uint8Array(await (await exportDesignIdml(snapshot(boxes), imageHost)).arrayBuffer()); assert.deepEqual(second, first);
  assert.equal(new TextDecoder().decode(first.subarray(30, 38)), 'mimetype');
  const files = Object.fromEntries(readZip(first).map(p => [p.name, p.bytes]));
  assert.match(new TextDecoder().decode(files['Stories/Story_story-1.xml']), /<AppliedFont type="string">Studio Sans<\/AppliedFont>/);
  assert.doesNotMatch(new TextDecoder().decode(files['lolly-interchange.json']), /font weight/);
  const spread = readAdobeXml(new TextDecoder().decode(files['Spreads/Spread_1.xml']), parse);
  const anchors = Array.from(spread.getElementsByTagName('Oval')[0]!.getElementsByTagName('PathPointType'));
  assert.deepEqual(anchors.map(point => point.getAttribute('Anchor')), ['50 0', '100 30', '50 60', '0 30']);
  assert.notEqual(anchors[0]!.getAttribute('RightDirection'), anchors[0]!.getAttribute('Anchor'));
  for (const [path, bytes] of Object.entries(files)) if (path.endsWith('.xml')) readAdobeXml(new TextDecoder().decode(bytes), parse, 8 * 1024 * 1024);
  const previous = globalThis.DOMParser; globalThis.DOMParser = dom.window.DOMParser;
  try {
    const frames = await parseIdmlSpreads(files, { storeImage: async (_path, bytes) => { assert.deepEqual(bytes, png); return image; } });
    assert.deepEqual(frames.map(f => [f.width, f.height]), [[600, 800], [400, 300]]);
    const text = frames[0]!.boxes[0] as Record<string, unknown>; assert.equal(text.x, 30); assert.equal(text.y, 50); assert.equal(text.text, '**Hello** & *world*');
    assert.equal((frames[1]!.boxes[0] as Record<string, unknown>).kind, 'image');
  } finally { globalThis.DOMParser = previous; }
  await assert.rejects(exportDesignIdml(snapshot([{ kind: 'box', id: 'blur', blur: 2 }]), host), /blur/);
  await assert.rejects(exportDesignIdml(snapshot([{ kind: 'box', opacity: 50 }]), host), /transparency/);
});
test('IDML independent page bounds include empty margins and every spread', async () => {
  const encode = (s: string) => new TextEncoder().encode(s), point = (x: number, y: number) => `<PathPointType Anchor="${x} ${y}"/>`;
  const spread = `<idPkg:Spread xmlns:idPkg="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"><Spread><Page GeometricBounds="0 0 700 500" ItemTransform="1 0 0 1 -500 -350"/><Rectangle ItemTransform="1 0 0 1 -450 -300" FillColor="Color/Black"><Properties><PathGeometry>${point(0, 0)}${point(80, 40)}</PathGeometry></Properties></Rectangle></Spread></idPkg:Spread>`;
  const files = { 'designmap.xml': encode('<Document xmlns:p="http://ns.adobe.com/AdobeInDesign/idml/1.0/packaging"><p:Spread src="Spreads/a.xml"/><p:Spread src="Spreads/b.xml"/></Document>'), 'Spreads/a.xml': encode(spread), 'Spreads/b.xml': encode(spread) };
  const previous = globalThis.DOMParser; globalThis.DOMParser = dom.window.DOMParser;
  try { const frames = await parseIdmlSpreads(files); assert.equal(frames.length, 2); assert.equal(frames[0]!.width, 500); assert.equal(frames[0]!.height, 700); assert.equal((frames[0]!.boxes[0] as Record<string, unknown>).x, 50); }
  finally { globalThis.DOMParser = previous; }
});
test('Premiere package includes original media and reports unsupported canvas placement', async () => {
  const image: AssetRef = { source: 'user', id: 'user/video', type: 'video', format: 'mp4', url: 'unused', width: 1920, height: 1080 };
  const media = new Uint8Array([1, 2, 3]), h = { ...host, assets: { bytes: async () => media } } as unknown as HostV1;
  const blob = await exportDesignPremiere(snapshot([{ id: 'v', kind: 'image', image, start: 1, dur: 2, clipIn: 3, lane: 'seq', mute: true, opacity: 100 }]), h);
  const files = Object.fromEntries(readZip(new Uint8Array(await blob.arrayBuffer())).map(p => [p.name, p.bytes]));
  assert.deepEqual(files['Media/source-1.mp4'], media); const seq = readPremiereXml(new TextDecoder().decode(files['sequence.xml']), parse);
  assert.equal(seq.clips[0]!.start, 30); assert.equal(seq.clips[0]!.in, 90); assert.equal(seq.clips[0]!.out, 150);
  assert.match(new TextDecoder().decode(files['lolly-interchange.json']), /placement/);
  await assert.rejects(exportDesignPremiere(snapshot([{ id: 't', kind: 'text', text: 'A title' }]), h), /render titles/);
  await assert.rejects(exportDesignPremiere(snapshot([{ id: 'v', kind: 'image', image, opacity: 50 }]), h), /opacity/);
});
