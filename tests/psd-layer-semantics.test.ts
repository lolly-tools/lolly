// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/psd-layer-semantics.ts: what a Photoshop layer is beyond its pixels
 * (plans/289 item 1, M3 step 2).
 *
 * Run with: node --test tests/psd-layer-semantics.test.ts
 *
 * Fixtures come from tests/helpers/psd-fixtures.ts, encoded from the published
 * format. A real Photoshop file is still owed (plan 289 section 7.1).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFontName, readLayerSemantics, readVectorPath } from '../engine/src/psd-layer-semantics.ts';
import { D, effects, origination, solidColor, strokeSettings, typeLayer, vectorFill, vectorMask, versioned, type TypeFixture } from './helpers/psd-fixtures.ts';

const CANVAS = { w: 800, h: 600 };
const blocks = (o: Record<string, Uint8Array>) => new Map(Object.entries(o));
const text = (fixture: TypeFixture, pixels = { x: 40, y: 30, w: 120, h: 30 }) => readLayerSemantics(blocks({ TySh: typeLayer(fixture) }), pixels, CANVAS)!;

test('font names: family, weight and italic from the PostScript name', () => {
  assert.deepEqual(readFontName('Helvetica-BoldOblique'), { family: 'Helvetica', weight: 700, italic: true });
  assert.deepEqual(readFontName('TimesNewRomanPS-BoldMT'), { family: 'Times New Roman', weight: 700, italic: false });
  assert.deepEqual(readFontName('TimesNewRomanPSMT'), { family: 'Times New Roman', weight: 400, italic: false });
  assert.deepEqual(readFontName('ArialMT'), { family: 'Arial', weight: 400, italic: false });
  assert.deepEqual(readFontName('Inter-SemiBold'), { family: 'Inter', weight: 600, italic: false });
  assert.deepEqual(readFontName('SourceSansPro-Light'), { family: 'Source Sans Pro', weight: 300, italic: false });
  assert.deepEqual(readFontName('Montserrat-ExtraBoldItalic'), { family: 'Montserrat', weight: 800, italic: true });
  assert.deepEqual(readFontName('ArialBold'), { family: 'Arial', weight: 700, italic: false });
  assert.deepEqual(readFontName('Roboto-Black'), { family: 'Roboto', weight: 900, italic: false });
  assert.deepEqual(readFontName('Roboto-Medium'), { family: 'Roboto', weight: 500, italic: false });
});

test('point text: content, font, size, colour, tracking and alignment', () => {
  const s = text({ text: 'Hello\rworld', font: 'Helvetica-Bold', size: 24, color: '#30ba78', tracking: 50, justification: 2 });
  const t = s.text!;
  assert.equal(t.text, 'Hello\nworld');
  assert.equal(t.family, 'Helvetica');
  assert.equal(t.postScriptName, 'Helvetica-Bold');
  assert.equal(t.weight, 700);
  assert.equal(t.italic, false);
  assert.equal(t.size, 24);
  assert.equal(t.color, '#30ba78');
  assert.equal(t.tracking, 1.2, '50 thousandths of a 24 px em');
  assert.equal(t.align, 'center');
  assert.equal(t.lineHeight, 1.2, 'auto leading');
  assert.equal(t.paragraph, false);
  assert.equal(t.box.h, 57.6, 'two line boxes tall (2 x 24 x 1.2)');
  assert.ok(Math.abs(t.box.x + t.box.w / 2 - 100) < 0.01, 'centred on the rendered pixels');
  assert.deepEqual(s.notes, []);
});

test('point text: a left edge stays where Photoshop drew it, and the box has room to spare', () => {
  const t = text({ justification: 0 }).text!;
  assert.ok(Math.abs(t.box.x - (40 - 24 * 0.05)) < 0.01);
  assert.ok(t.box.w > 120, `wider than the rendered pixels (${t.box.w})`);
  const r = text({ justification: 1 }).text!;
  assert.ok(Math.abs(r.box.x + r.box.w - (160 + 24 * 0.05)) < 0.01, 'a right edge stays put');
});

test('scale and leading: a transform scales the size, and a fixed leading becomes a line height', () => {
  const t = text({ size: 20, leading: 30, transform: [2, 0, 0, 2, 40, 50] }).text!;
  assert.equal(t.size, 40);
  assert.equal(t.lineHeight, 1.5, '30 pt leading on 20 pt type, both scaled');
});

test('paragraph text: the frame becomes the box', () => {
  const t = text({ bounds: { left: 0, top: 0, right: 300, bottom: 100 }, glyphBounds: { left: 0, top: 0, right: 120, bottom: 30 }, transform: [1, 0, 0, 1, 100, 200] }).text!;
  assert.equal(t.paragraph, true);
  assert.deepEqual(t.box, { x: 100, y: 200, w: 300, h: 100 });
});

test('rotation: a rotated layer keeps its angle and an unrotated box around the same centre', () => {
  const c = Math.cos(Math.PI / 6), s = Math.sin(Math.PI / 6);
  const t = text({ transform: [c, -s, s, c, 40, 50] }, { x: 100, y: 100, w: 200, h: 120 }).text!;
  assert.equal(t.rotation, 30);
  assert.ok(Math.abs(t.box.x + t.box.w / 2 - 200) < 0.01 && Math.abs(t.box.y + t.box.h / 2 - 160) < 0.01);
});

test('what a text box cannot hold is kept as pixels, and said', () => {
  const vertical = text({ vertical: true });
  assert.equal(vertical.text, undefined);
  assert.match(vertical.notes.join(' '), /Vertical text is kept as pixels/);
  const shear = text({ transform: [1, 0.5, 0, 1, 0, 0] });
  assert.equal(shear.text, undefined);
  assert.match(shear.notes.join(' '), /sheared or stretched/);
  const uneven = text({ transform: [2, 0, 0, 1, 0, 0] });
  assert.equal(uneven.text, undefined);
});

test('what a text box keeps only in part is said', () => {
  assert.match(text({ warp: true }).notes.join(' '), /warp was dropped/);
  assert.match(text({ secondSize: 48 }).notes.join(' '), /mixes sizes or spacing/);
  assert.match(text({ justification: 3 }).notes.join(' '), /Justified text/);
  assert.equal(text({ justification: 3 }).text!.align, 'left');
});

test('faux bold and faux italic are kept as weight and italic', () => {
  const t = text({ fauxBold: true, fauxItalic: true }).text!;
  assert.equal(t.weight, 700);
  assert.equal(t.italic, true);
  assert.equal(text({ fauxBold: true }).notes.length, 0, 'nothing is dropped, so nothing is said');
});

test('style runs: italic, weight, colour, underline and strikethrough stay with their words', () => {
  const t = text({
    text: 'Big news today\r',
    fonts: ['Inter-Regular', 'Inter-Italic', 'Inter-Bold'],
    runs: [
      { length: 4, font: 0 },
      { length: 4, font: 1, color: '#ff0000', underline: true },
      { length: 1, font: 0 },
      { length: 6, font: 2, strike: true },
    ],
  }).text!;
  assert.deepEqual(t.runs.map(r => [r.text, r.weight, r.italic, r.color, r.underline, r.strike]), [
    ['Big ', 400, false, '#000000', false, false],
    ['news', 400, true, '#ff0000', true, false],
    [' ', 400, false, '#000000', false, false],
    ['today', 700, false, '#000000', false, true],
  ], 'the trailing return is not text, and the last run ends with the text');
  assert.equal(t.runs.map(r => r.text).join(''), t.text);
  assert.equal(t.italic, false, 'the box takes the first run');
});

test('style runs: neighbours of one style join, and lengths that do not fit give one run', () => {
  const joined = text({ text: 'ab', fonts: ['Inter-Regular'], runs: [{ length: 1 }, { length: 1 }] }).text!;
  assert.deepEqual(joined.runs.map(r => r.text), ['ab']);
  const families = text({ text: 'ab', fonts: ['Inter-Regular', 'Georgia'], runs: [{ length: 1, font: 0 }, { length: 1, font: 1 }] });
  assert.match(families.notes.join(' '), /mixes font families/);
  const noLengths = text({ text: 'ab', secondSize: 30 }).text!;
  assert.deepEqual(noLengths.runs.map(r => r.text), ['ab'], 'no RunLengthArray: one run in the first style');
});

test('without EngineData the text still reads, at Photoshop\'s 12 pt default', () => {
  const t = text({ noEngine: true, text: 'Plain' }).text!;
  assert.equal(t.text, 'Plain');
  assert.equal(t.size, 12);
  assert.equal(t.family, null);
});

test('shapes: rectangle, rounded rectangle and ellipse, with fill and stroke', () => {
  const box = { left: 10, top: 20, right: 110, bottom: 70 };
  const rect = readLayerSemantics(blocks({ SoCo: solidColor('#ff0000'), vogk: origination(1, box) }), { x: 0, y: 0, w: 0, h: 0 }, CANVAS)!;
  assert.deepEqual(rect.shape, { kind: 'rect', box: { x: 10, y: 20, w: 100, h: 50 }, radius: 0, fill: '#ff0000', stroke: null });
  const rounded = readLayerSemantics(blocks({ SoCo: solidColor('#00ff00'), vogk: origination(2, box, 12) }), { x: 0, y: 0, w: 0, h: 0 }, CANVAS)!;
  assert.equal(rounded.shape!.kind, 'rounded');
  assert.equal(rounded.shape!.radius, 12);
  const ellipse = readLayerSemantics(blocks({ SoCo: solidColor('#0000ff'), vogk: origination(5, box), vstk: strokeSettings({ fill: true, stroke: true, width: 4, color: '#000000' }) }), { x: 0, y: 0, w: 0, h: 0 }, CANVAS)!;
  assert.equal(ellipse.shape!.kind, 'ellipse');
  assert.deepEqual(ellipse.shape!.stroke, { color: '#000000', width: 4, cap: 'butt', join: 'miter', align: 'center' });
  const uneven = readLayerSemantics(blocks({ SoCo: solidColor('#00ff00'), vogk: origination(2, box, [4, 4, 12, 4]) }), { x: 0, y: 0, w: 0, h: 0 }, CANVAS)!;
  assert.equal(uneven.shape!.radius, 12);
  assert.match(uneven.notes.join(' '), /corners differ/);
  const strokeOnly = readLayerSemantics(blocks({ SoCo: solidColor('#00ff00'), vogk: origination(1, box), vstk: strokeSettings({ fill: false, stroke: true, width: 2, color: '#123456' }) }), { x: 0, y: 0, w: 0, h: 0 }, CANVAS)!;
  assert.equal(strokeOnly.shape!.fill, null);
  assert.deepEqual(strokeOnly.shape!.stroke, { color: '#123456', width: 2, cap: 'butt', join: 'miter', align: 'center' });
});

test('paths: a sharp four-corner path is a rectangle; anything else stays a vector path', () => {
  const sq = vectorMask(800, 600, [[{ at: [100, 100] }, { at: [300, 100] }, { at: [300, 200] }, { at: [100, 200] }]]);
  const rect = readLayerSemantics(blocks({ SoCo: solidColor('#ff0000'), vmsk: sq }), { x: 0, y: 0, w: 0, h: 0 }, CANVAS)!;
  assert.deepEqual(rect.shape!.box, { x: 100, y: 100, w: 200, h: 100 });
  const tri = vectorMask(800, 600, [[{ at: [100, 500] }, { at: [400, 100] }, { at: [700, 500], in: [650, 450], out: [700, 550] }]]);
  const path = readLayerSemantics(blocks({ SoCo: solidColor('#ff0000'), vmsk: tri }), { x: 0, y: 0, w: 0, h: 0 }, CANVAS)!;
  assert.equal(path.shape, undefined);
  assert.equal(path.path!.subpaths.length, 1);
  assert.equal(path.path!.subpaths[0]!.closed, true);
  assert.deepEqual(path.path!.subpaths[0]!.knots[2], { x: 700, y: 500, inX: 650, inY: 450, outX: 700, outY: 550 });
  assert.equal(path.path!.fill, '#ff0000');
  const two = readVectorPath(vectorMask(800, 600, [[{ at: [0, 0] }, { at: [10, 0] }, { at: [10, 10] }], [{ at: [20, 20] }, { at: [30, 20] }, { at: [30, 30] }]], true), 800, 600);
  assert.equal(two.length, 2);
  assert.equal(two[0]!.closed, false);
});

test('fills, fill opacity, adjustments, effects and smart objects', () => {
  const fill = readLayerSemantics(blocks({ SoCo: solidColor('#336699') }), { x: 0, y: 0, w: 0, h: 0 }, CANVAS)!;
  assert.equal(fill.fill, '#336699');
  const faded = readLayerSemantics(blocks({ iOpa: Uint8Array.from([128, 0, 0, 0]) }), { x: 0, y: 0, w: 0, h: 0 }, CANVAS)!;
  assert.equal(faded.fillOpacity, 0.5);
  const levels = readLayerSemantics(blocks({ levl: new Uint8Array(10) }), { x: 0, y: 0, w: 0, h: 0 }, CANVAS)!;
  assert.equal(levels.adjustment, 'Levels');
  assert.match(levels.notes.join(' '), /Levels adjustment layer was not applied/);
  assert.match(readLayerSemantics(blocks({ lfx2: new Uint8Array(4) }), { x: 0, y: 0, w: 0, h: 0 }, CANVAS)!.notes.join(' '), /Layer effects/);
  assert.match(readLayerSemantics(blocks({ PlLd: new Uint8Array(4) }), { x: 0, y: 0, w: 0, h: 0 }, CANVAS)!.notes.join(' '), /Smart object/);
  assert.equal(readLayerSemantics(blocks({}), { x: 0, y: 0, w: 10, h: 10 }, CANVAS), null, 'a plain pixel layer has nothing to add');
});

// ── what files saved by Photoshop CS6 and later do (found on psd-tools' fixtures) ──

const NONE = { x: 0, y: 0, w: 0, h: 0 };
const triangle = [{ at: [100, 100] as [number, number] }, { at: [200, 100] as [number, number] }, { at: [150, 180] as [number, number] }];

test('newer files keep the shape fill in vscg, not SoCo', () => {
  const s = readLayerSemantics(blocks({ vscg: vectorFill('SoCo', '#b3d465'), vogk: origination(5, { left: 10, top: 20, right: 110, bottom: 80 }) }), NONE, CANVAS)!;
  assert.deepEqual(s.shape, { kind: 'ellipse', box: { x: 10, y: 20, w: 100, h: 60 }, radius: 0, fill: '#b3d465', stroke: null });
  const pattern = readLayerSemantics(blocks({ vscg: vectorFill('PtFl'), vmsk: vectorMask(800, 600, [triangle]) }), NONE, CANVAS)!;
  assert.equal(pattern.path, undefined, 'a pattern fill stays pixels');
  assert.match(pattern.notes.join(' '), /Pattern fill kept as pixels/);
  const off = readLayerSemantics(blocks({ vscg: vectorFill('PtFl'), vstk: strokeSettings({ fill: false, stroke: true, width: 2, color: '#000000' }), vmsk: vectorMask(800, 600, [triangle]) }), NONE, CANVAS)!;
  assert.ok(off.path, 'with the fill switched off, the stroke alone draws the shape');
  assert.equal(off.notes.length, 0);
});

test('several shapes in one layer: combined they are one path; subtracted they stay pixels', () => {
  const two = [triangle, triangle.map(k => ({ at: [k.at[0] + 300, k.at[1]] as [number, number] }))];
  const combined = readLayerSemantics(blocks({ vscg: vectorFill('SoCo', '#009944'), vsms: vectorMask(800, 600, two, false, [1, 1]) }), NONE, CANVAS)!;
  assert.equal(combined.path!.subpaths.length, 2);
  assert.deepEqual(combined.path!.subpaths.map(sp => sp.op), [1, 1]);
  const subtracted = readLayerSemantics(blocks({ vscg: vectorFill('SoCo', '#009944'), vsms: vectorMask(800, 600, two, false, [2, 2]) }), NONE, CANVAS)!;
  assert.equal(subtracted.path, undefined);
  assert.match(subtracted.notes.join(' '), /subtract, intersect or exclude are kept as pixels/);
  // Two ellipses in one origin record are not one Design ellipse: the outline decides.
  const ellipse = (left: number) => D.objc([['keyOriginType', D.long(5)], ['keyOriginShapeBBox', D.objc([['Top ', D.untf('#Pxl', 100)], ['Left', D.untf('#Pxl', left)], ['Btom', D.untf('#Pxl', 180)], ['Rght', D.untf('#Pxl', left + 80)]])]]);
  const vogk = new Uint8Array([0, 0, 0, 1, ...versioned([['keyDescriptorList', D.list([ellipse(100), ellipse(400)])]])]);
  const pair = readLayerSemantics(blocks({ vscg: vectorFill('SoCo', '#009944'), vogk, vsms: vectorMask(800, 600, two) }), NONE, CANVAS)!;
  assert.equal(pair.shape, undefined);
  assert.equal(pair.path!.subpaths.length, 2);
});

test('a dashed or dotted stroke keeps its pattern, cap and join; dashes scale by the width', () => {
  const dotted = readLayerSemantics(blocks({
    vscg: vectorFill('SoCo', '#b3d465'), vogk: origination(5, { left: 10, top: 20, right: 110, bottom: 80 }),
    vstk: strokeSettings({ fill: true, stroke: true, width: 2, color: '#00561f', dash: [0, 2], cap: 'strokeStyleRoundCap', join: 'strokeStyleRoundJoin' }),
  }), NONE, CANVAS)!;
  assert.deepEqual(dotted.shape!.stroke, { color: '#00561f', width: 2, cap: 'round', join: 'round', align: 'center', dash: [0, 4] });
  const solid = readLayerSemantics(blocks({ SoCo: solidColor('#ffffff'), vstk: strokeSettings({ fill: true, stroke: true, width: 3, color: '#000000' }), vmsk: vectorMask(800, 600, [triangle]) }), NONE, CANVAS)!;
  assert.deepEqual(solid.path!.stroke, { color: '#000000', width: 3, cap: 'butt', join: 'miter', align: 'center' }, 'Photoshop\'s defaults: butt caps, mitred corners, no dashes');
});

test('a gradient or pattern stroke keeps the shape as pixels, and says so', () => {
  const stroke = versioned([
    ['strokeStyleVersion', D.long(2)], ['fillEnabled', D.bool(true)], ['strokeEnabled', D.bool(true)],
    ['strokeStyleLineWidth', D.untf('#Pxl', 2)], ['strokeStyleContent', D.objc([['Grad', D.objc([['Nm  ', D.text('Fade')]])]])],
  ]);
  const s = readLayerSemantics(blocks({ SoCo: solidColor('#ff0000'), vstk: stroke, vmsk: vectorMask(800, 600, [triangle]) }), NONE, CANVAS)!;
  assert.equal(s.path, undefined);
  assert.match(s.notes.join(' '), /stroke is a gradient or pattern/);
});

test('layer effects: named when on, silent when every one is off', () => {
  const on = readLayerSemantics(blocks({ lfx2: effects({ DrSh: true, FrFX: true, OrGl: false }) }), NONE, CANVAS)!;
  assert.match(on.notes.join(' '), /Layer effects were dropped: drop shadow, stroke\./);
  assert.equal(readLayerSemantics(blocks({ lfx2: effects({ DrSh: false, GrFl: false }) }), { x: 0, y: 0, w: 10, h: 10 }, CANVAS), null, 'all off: nothing to say');
  assert.equal(readLayerSemantics(blocks({ lfx2: effects({ DrSh: true }, false) }), { x: 0, y: 0, w: 10, h: 10 }, CANVAS), null, 'the master switch off: nothing to say');
});

test('garbage in any block is never an exception', () => {
  const junk = Uint8Array.from({ length: 200 }, (_, i) => (i * 37 + 11) & 255);
  for (const k of ['TySh', 'vogk', 'vmsk', 'vscg', 'SoCo', 'vstk', 'iOpa', 'lfx2']) {
    assert.doesNotThrow(() => readLayerSemantics(blocks({ [k]: junk }), { x: 0, y: 0, w: 10, h: 10 }, CANVAS), k);
    assert.doesNotThrow(() => readLayerSemantics(blocks({ [k]: junk.subarray(0, 3) }), { x: 0, y: 0, w: 10, h: 10 }, CANVAS), k);
  }
});

// ── through readPsd ──────────────────────────────────────────────────────────

test('readPsd attaches what each layer is, and leaves a plain pixel layer alone', async () => {
  const { writePsd } = await import('../engine/src/psd-write.ts');
  const { readPsd } = await import('../engine/src/psd.ts');
  const px = (w: number, h: number) => new Uint8Array(w * h * 4).fill(200);
  const bytes = writePsd({
    width: 400, height: 300,
    layers: [
      { name: 'Background', x: 0, y: 0, width: 400, height: 300, pixels: px(400, 300) },
      { name: 'Card', x: 20, y: 30, width: 200, height: 100, pixels: px(200, 100),
        extraBlocks: [['SoCo', solidColor('#30ba78')], ['vogk', origination(2, { left: 20, top: 30, right: 220, bottom: 130 }, 16)]] },
      { name: 'Headline', x: 40, y: 50, width: 150, height: 30, pixels: px(150, 30),
        extraBlocks: [['TySh', typeLayer({ text: 'Big news', font: 'Inter-SemiBold', size: 28 })]] },
    ],
  });
  const doc = readPsd(bytes);
  const [bg, card, head] = doc.layers;
  assert.equal(bg!.psd, undefined);
  assert.equal(card!.psd!.shape!.kind, 'rounded');
  assert.deepEqual(card!.psd!.shape!.box, { x: 20, y: 30, w: 200, h: 100 });
  assert.equal(head!.psd!.text!.text, 'Big news');
  assert.equal(head!.psd!.text!.family, 'Inter');
  assert.equal(head!.psd!.text!.weight, 600);
  assert.equal(head!.pixels.length, 150 * 30 * 4, 'the pixels are still decoded, for the conversion report and a fallback');
});

test('readPsd keeps an empty adjustment block: Invert says everything by being there', async () => {
  const { writePsd } = await import('../engine/src/psd-write.ts');
  const { readPsd } = await import('../engine/src/psd.ts');
  const bytes = writePsd({ width: 4, height: 4, layers: [{ name: 'Invert 1', x: 0, y: 0, width: 0, height: 0, pixels: new Uint8Array(0), extraBlocks: [['nvrt', new Uint8Array(0)]] }] });
  const layer = readPsd(bytes).layers.find(l => l.name === 'Invert 1')!;
  assert.equal(layer.psd?.adjustment, 'Invert');
});

test('readPsd keeps semantic blocks within a budget, and says when one is dropped', async () => {
  const { writePsd } = await import('../engine/src/psd-write.ts');
  const { readPsd } = await import('../engine/src/psd.ts');
  const huge = new Uint8Array((8 << 20) + 16);
  const warnings: string[] = [];
  const bytes = writePsd({ width: 4, height: 4, layers: [{ name: 'L', x: 0, y: 0, width: 4, height: 4, pixels: new Uint8Array(64), extraBlocks: [['TySh', huge]] }] });
  const doc = readPsd(bytes, { onWarn: (code) => warnings.push(code) });
  assert.equal(doc.layers[0]!.psd, undefined);
  assert.ok(warnings.includes('layer.semantics'));
});
