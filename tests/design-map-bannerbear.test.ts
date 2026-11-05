// SPDX-License-Identifier: MPL-2.0
/**
 * A Bannerbear V5 image template mapped to Design rows. The fixture follows the
 * vendor's public V5 OpenAPI schema, read 2026-11-05. It was not recorded from a live
 * account, and no field in it is invented.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateDesignTool } from '../packages/core/src/design-tool-v1.ts';
import { isBannerbearTemplate, mapBannerbearTemplate } from '../engine/src/design-map-bannerbear.ts';
import { RESERVED } from '../engine/src/url-mode.ts';

const template = {
  uid: '6EZ9nQX0lzpWwqAgzB', name: 'Launch Card', description: null, tags: ['launch'], width: 1200, height: 630, responsive: false,
  preview: 'https://images.bannerbear.com/V5/previews/6EZ9nQX0lzpWwqAgzB.png', ui_write_access: 'team', api_write_access: 'team', created_at: '2026-03-15T04:51:17.550Z',
  config: { objects: [
    { id: 'l0', type: 'rectangle', name: 'background', left: 0, top: 0, width: 1200, height: 630, 'background-color': '#1a1a2e', 'box-shadow': '0 0 4px #000' },
    { id: 'l1', type: 'rectangle_image_container', name: 'photo', left: 600, top: 0, width: 600, height: 630, 'background-image': 'https://example.com/hero.jpg', 'background-size': 'cover', 'background-position': 'center', 'border-radius': 12 },
    { id: 'l2', type: 'text', name: 'Headline Text', left: 40, top: 60, width: 520, height: 200, rotate: 2, opacity: 0.5, text: 'Hello *World*', color: '#FF5733', 'font-family': 'Inter', 'font-size': 64, 'font-weight': 700, 'text-align': 'center', 'line-height': 1.2, 'letter-spacing': '-0.02em', 'text-fit': true, 'text-shadow': '1px 1px #000' },
    { id: 'l3', type: 'circle', name: 'badge', left: 40, top: 400, width: 100, height: 100, 'background-color': '#00ff00' },
    { id: 'l4', type: 'circle_image_container', name: 'avatar', left: 160, top: 400, width: 100, height: 100, 'background-image': 'https://example.com/a.jpg', 'background-size': 'contain' },
    { id: 'l5', type: 'svg_shape', name: 'mark', left: 300, top: 400, width: 80, height: 80, fill: '#123456', 'svg-url': 'https://example.com/m.svg' },
    { id: 'l6', type: 'qr_code', name: 'code', left: 400, top: 400, width: 100, height: 100 },
    { id: 'l7', type: 'lottie', name: 'motion', left: 0, top: 0, width: 10, height: 10 },
    { id: 'l8', type: 'group', name: 'wrap' },
    { id: 'l9', type: 'text', name: 'hidden one', left: 0, top: 0, width: 10, height: 10, text: 'x', hidden: true },
    { id: 'l10', type: 'text', name: 'anchored', left: '50%', top: 0, width: 10, height: 10, text: 'x' },
    { id: 'l11', type: 'text', name: 'format', left: 1, top: 1, width: 10, height: 10, text: 'reserved name' },
    { id: 'l12', type: 'text', name: 'format', left: 2, top: 2, width: 10, height: 10, text: 'same name' },
    { id: 'l13', type: 'text', left: 3, top: 3, width: 10, height: 10, text: 'no name, so its id' },
  ] },
};

const texts = (notes: Array<{ text: string }>): string => notes.map((note) => note.text).join('\n');

test('a V5 template becomes one frame of editable rows at the same places', () => {
  const { frames } = mapBannerbearTemplate(template);
  assert.equal(frames.length, 1);
  const [frame] = frames;
  assert.equal(frame!.name, 'Launch Card');
  assert.equal(frame!.width, 1200); assert.equal(frame!.height, 630);
  const box = (id: string) => frame!.boxes.find((item) => item.id === id)!;
  assert.deepEqual(frame!.boxes.map((item) => item.id), ['background_layer', 'photo', 'Headline_Text', 'badge', 'avatar', 'mark', 'format_layer', 'format_layer_2', 'l13'], 'layer order is paint order, and names become stable ids');
  assert.equal(box('background_layer').kind, 'box'); assert.equal(box('background_layer').bg, '#1a1a2e'); assert.equal(box('background_layer').w, 1200);
  const headline = box('Headline_Text');
  assert.equal(headline.kind, 'text'); assert.equal(headline.x, 40); assert.equal(headline.y, 60); assert.equal(headline.w, 520); assert.equal(headline.h, 200);
  assert.equal(headline.rot, 2); assert.equal(headline.opacity, 50);
  assert.equal(headline.fg, '#FF5733'); assert.equal(headline.fontSize, 64); assert.equal(headline.font, 'Inter', 'the source font name is kept');
  assert.equal(headline.weight, '700'); assert.equal(headline.align, 'center'); assert.equal(headline.lineHeight, 1.2);
  assert.equal(headline.tracking, -1.28, '-0.02em at 64px');
  assert.match(headline.text, /Hello \\\*World\\\*/, 'text stays literal');
  assert.equal(box('photo').kind, 'image'); assert.equal(box('photo').fit, 'cover'); assert.equal(box('photo').shape, 'rounded'); assert.equal(box('photo').radius, 12);
  assert.equal(box('photo').image, null, 'with no image function, a picture is listed and not stored');
  assert.equal(box('badge').shape, 'ellipse'); assert.equal(box('badge').bg, '#00ff00');
  assert.equal(box('avatar').kind, 'image'); assert.equal(box('avatar').shape, 'ellipse'); assert.equal(box('avatar').fit, 'contain');
  assert.equal(box('mark').kind, 'box'); assert.equal(box('mark').bg, '#123456');
});

test('nothing is lost quietly: every layer and property left out is named', () => {
  const { report } = mapBannerbearTemplate(template);
  const all = texts(report);
  assert.match(all, /not run against a live account/);
  assert.match(all, /code: type qr_code was left out, because its properties could not be confirmed/);
  assert.match(all, /motion: type lottie was left out/);
  assert.match(all, /wrap: type group was left out/);
  assert.match(all, /hidden one: a hidden layer was left out/);
  assert.match(all, /anchored: left out, because its position or size is not in pixels/);
  assert.match(all, /background: not carried over: box-shadow/);
  assert.match(all, /photo: not carried over: background-position/);
  assert.match(all, /Headline Text: not carried over: text-fit, text-shadow/);
  assert.match(all, /mark: an SVG shape became a plain box/);
  assert.match(all, /mark: artwork at https:\/\/example\.com\/m\.svg/);
  assert.match(all, /photo: picture at https:\/\/example\.com\/hero\.jpg was not stored/);
  assert.match(all, /Inter: add this face to the design system/);
  for (const note of report) assert.ok(['dropped', 'approximated', 'picture', 'font', 'assumption'].includes(note.kind));
});

test('a picture can be stored by the caller', () => {
  const urls: string[] = [];
  const { frames, report } = mapBannerbearTemplate(template, { image: (url) => { urls.push(url); return { id: 'asset-1', url: 'blob:x', type: 'raster' }; } });
  assert.deepEqual(urls, ['https://example.com/hero.jpg', 'https://example.com/a.jpg']);
  assert.deepEqual(frames[0]!.boxes.find((box) => box.id === 'photo')!.image, { id: 'asset-1', url: 'blob:x', type: 'raster' });
  assert.equal(texts(report).includes('picture at https://example.com/hero.jpg'), false);
});

test('the mapping and the design tool draft line up with the same layer names', () => {
  const { mapping, designTool, fields } = mapBannerbearTemplate(template);
  assert.equal(mapping.source, 'bannerbear-v5'); assert.equal(mapping.template, '6EZ9nQX0lzpWwqAgzB'); assert.equal(mapping.toolId, 'launch-card');
  assert.deepEqual(mapping.layers['Headline Text'], { text: 'Headline_Text' });
  assert.deepEqual(mapping.layers.photo, { 'background-image': 'photo' });
  assert.deepEqual(mapping.layers.background, { 'background-color': 'background_layer' }, 'Design keeps `background` for itself, and the mapping says what the input became');
  assert.deepEqual(mapping.layers.mark, { fill: 'mark' });
  assert.equal(mapping.layers.code, undefined, 'a layer left out has no mapping');
  for (const field of fields) assert.equal(RESERVED.has(field.input), false, `${field.input} would clash with a reserved URL name`);
  assert.deepEqual(mapping.layers.format, { text: 'format_layer_2' }, 'two layers with one name: the mapping can only hold the last, and the report keeps both layers');
  assert.deepEqual(new Set(designTool.inputs.map((input) => input.input.id)).size, designTool.inputs.length, 'input ids are unique');
  assert.deepEqual(designTool.inputs.find((input) => input.input.id === 'photo')!.targets, [{ variantId: 'default', layerId: 'photo', property: 'image' }]);
  assert.deepEqual(validateDesignTool(designTool, [...RESERVED]), [], 'the draft passes the Design tool rules');
});

test('input ids are not invented when a name has no usable characters, and a bad file is refused', () => {
  const { frames } = mapBannerbearTemplate({ uid: 'u1', name: '!!!', width: 100, height: 100, config: { objects: [{ type: 'text', name: '***', left: 0, top: 0, width: 5, height: 5, text: 'a' }] } });
  assert.equal(frames[0]!.boxes[0]!.id, 'layer_1');
  assert.equal(isBannerbearTemplate(template), true);
  assert.equal(isBannerbearTemplate({ uid: 'x' }), false);
  assert.equal(isBannerbearTemplate({ uuid: 'x', layers: [] }), false, 'a Placid template has no design');
  assert.equal(isBannerbearTemplate({ uid: 'x', available_modifications: [] }), false, 'a V2 template has no design');
  assert.throws(() => mapBannerbearTemplate({ uid: 'x' }), /not a Bannerbear V5 image template/);
  assert.throws(() => mapBannerbearTemplate({ uid: 'x', config: { objects: [] } }), /no usable width and height/);
  assert.throws(() => mapBannerbearTemplate({ uid: 'x', width: 10, height: 10, config: { objects: new Array(5001).fill({}) } }), /more than 5000 layers/);
  const unsafe = mapBannerbearTemplate({ uid: 'x', width: 10, height: 10, config: { objects: [{ type: 'rectangle', name: 'r', left: 0, top: 0, width: 5, height: 5, 'background-color': 'red;background:url(x)' }] } });
  assert.equal(unsafe.frames[0]!.boxes[0]!.bg.includes('url('), false, 'a value that could carry CSS is not kept');
});

test('lolly import writes the document and mapping, and refuses sources with no design', () => {
  const dir = mkdtempSync(join(tmpdir(), 'lolly-import-'));
  try {
    const input = join(dir, 'template.json');
    writeFileSync(input, JSON.stringify(template));
    const bin = fileURLToPath(new URL('../shells/cli/bin/lolly.ts', import.meta.url));
    const run = (...args: string[]) => spawnSync(process.execPath, [bin, 'import', ...args], { encoding: 'utf8' });
    const plain = run(input);
    assert.equal(plain.status, 0, plain.stderr);
    assert.match(plain.stdout, /Launch Card: 9 layers, 1200 x 630 px/);
    assert.match(plain.stdout, /dropped: code: type qr_code was left out/);
    const output = join(dir, 'design.json');
    const mapping = join(dir, 'mapping.json');
    assert.equal(run(input, `--output=${output}`, `--mapping=${mapping}`).status, 0);
    assert.equal(JSON.parse(readFileSync(output, 'utf8')).frames[0].boxes.length, 9);
    assert.equal(JSON.parse(readFileSync(mapping, 'utf8')).templates[0].source, 'bannerbear-v5');
    const placid = join(dir, 'placid.json');
    writeFileSync(placid, JSON.stringify({ uuid: 'p', title: 'P', layers: [{ name: 'a', type: 'text' }] }));
    const refused = run(placid);
    assert.notEqual(refused.status, 0);
    assert.match(refused.stderr + refused.stdout, /Bannerbear V2 and Placid return no design/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
