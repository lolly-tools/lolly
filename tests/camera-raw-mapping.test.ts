// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { readCameraRawPreset } from '../engine/src/camera-raw-preset.ts';

const dom = new JSDOM(''), parse = (s: string) => new dom.window.DOMParser().parseFromString(s, 'application/xml');
const crs = 'http://ns.adobe.com/camera-raw-settings/1.0/';
const read = (attrs: string) => readCameraRawPreset(`<p xmlns:q="${crs}" ${attrs}/>`, parse);
const manifest = JSON.parse((await import('node:fs')).readFileSync(new URL('../community/darkroom/tool.json', import.meta.url), 'utf8'));
const declared = new Map<string, { type: string; min?: number; max?: number }>(manifest.inputs.map((i: { id: string; type: string; min?: number; max?: number }) => [i.id, i]));

// [Camera Raw field, written value, Darkroom input, expected value]
const table: Array<[string, string, string, number | boolean]> = [
  ['IncrementalTemperature', '25', 'temperature', 25],
  ['IncrementalTemperature', '-250', 'temperature', -100],
  ['IncrementalTint', '-40', 'tint', -40],
  ['Sharpness', '75', 'sharpen', 50],
  ['Sharpness', '150', 'sharpen', 100],
  ['GrainAmount', '35', 'grain', 35],
  ['GrainSize', '0', 'grainSize', 1],
  ['GrainSize', '50', 'grainSize', 2.5],
  ['GrainSize', '100', 'grainSize', 4],
  ['ConvertToGrayscale', 'True', 'bwMode', true],
  ['ConvertToGrayscale', 'False', 'bwMode', false],
  ['PostCropVignetteAmount', '-30', 'vignette', 30],
  ['PostCropVignetteAmount', '-100', 'vignette', 100],
];
for (const band of ['Red', 'Orange', 'Yellow', 'Green', 'Aqua', 'Blue', 'Purple', 'Magenta']) {
  table.push([`HueAdjustment${band}`, '-12', `hslHue${band}`, -12], [`SaturationAdjustment${band}`, '30', `hslSat${band}`, 30], [`LuminanceAdjustment${band}`, '-100', `hslLum${band}`, -100]);
}

for (const [field, written, id, expected] of table) {
  test(`${field}=${written} maps to Darkroom ${id}`, () => {
    const preset = read(`q:${field}="${written}"`);
    assert.deepEqual(preset.values, { [id]: expected });
    assert.deepEqual(preset.unmapped, []);
    const input = declared.get(id);
    assert.ok(input, `Darkroom declares ${id}`);
    if (typeof expected === 'number') assert.ok(expected >= (input.min ?? -Infinity) && expected <= (input.max ?? Infinity), `${id} stays in Darkroom's range`);
    else assert.equal(input.type, 'boolean');
  });
}

test('Kelvin white balance maps only against the as-shot white written beside it', () => {
  assert.deepEqual(read('q:Temperature="6500" q:AsShotTemperature="6500"').values, { temperature: 0 });
  const warm = read('q:Temperature="8000" q:AsShotTemperature="6500"').values.temperature as number;
  const cool = read('q:Temperature="5000" q:AsShotTemperature="6500"').values.temperature as number;
  assert.ok(warm > 0 && cool < 0, `${warm} ${cool}`);
  assert.equal(warm, Math.round((1e6 / 6500 - 1e6 / 8000) / 0.8 * 100) / 100);
  assert.equal(read('q:Temperature="50000" q:AsShotTemperature="2000"').values.temperature, 100);
  const bare = read('q:Temperature="5200" q:Exposure2012="1"');
  assert.deepEqual(bare.values, { exposure: 1 }); assert.deepEqual(bare.unmapped, ['Temperature']);
  assert.deepEqual(read('q:Temperature="0" q:AsShotTemperature="5000" q:Exposure2012="1"').unmapped, ['Temperature']);
});
test('Tint maps from the -150 to 150 scale against the as-shot tint', () => {
  assert.deepEqual(read('q:Tint="30" q:AsShotTint="0"').values, { tint: 20 });
  assert.deepEqual(read('q:Tint="10" q:AsShotTint="25"').values, { tint: -10 });
  assert.deepEqual(read('q:Tint="150" q:AsShotTint="-150"').values, { tint: 100 });
  assert.deepEqual(read('q:Tint="30" q:Exposure2012="1"').unmapped, ['Tint']);
});
test('relative white balance wins over Kelvin and the Kelvin field is still named', () => {
  const p = read('q:IncrementalTemperature="10" q:Temperature="9000" q:AsShotTemperature="6500"');
  assert.deepEqual(p.values, { temperature: 10 }); assert.deepEqual(p.unmapped, ['Temperature']);
});
test('white balance presets other than As Shot and Custom are named as unmapped', () => {
  assert.deepEqual(read('q:WhiteBalance="Daylight" q:Exposure2012="1"').unmapped, ['WhiteBalance']);
  assert.deepEqual(read('q:WhiteBalance="Custom" q:Exposure2012="1"').unmapped, []);
  assert.deepEqual(read('q:WhiteBalance="As Shot" q:Exposure2012="1"').unmapped, []);
});
test('a lightening vignette has no Darkroom control and is named', () => {
  const p = read('q:PostCropVignetteAmount="40" q:Exposure2012="1"');
  assert.deepEqual(p.values, { exposure: 1 }); assert.deepEqual(p.unmapped, ['PostCropVignetteAmount']);
});
test('controls without a Darkroom input are named in the report, in file order', () => {
  const p = read('q:Whites2012="10" q:Blacks2012="-5" q:Clarity2012="20" q:Texture="5" q:GrayMixerRed="10" q:SplitToningShadowHue="210" q:ToneCurveName2012="Linear" q:Exposure2012="0.5"');
  assert.deepEqual(p.values, { exposure: 0.5 });
  assert.deepEqual(p.unmapped, ['Whites2012', 'Blacks2012', 'Clarity2012', 'Texture', 'GrayMixerRed', 'SplitToningShadowHue', 'ToneCurveName2012']);
  assert.ok(p.notes.some(n => n.includes('Whites2012')));
});
test('invalid flag and number values are refused', () => {
  assert.throws(() => read('q:ConvertToGrayscale="maybe"'), /flag/);
  assert.throws(() => read('q:Tint="x" q:AsShotTint="0"'), /number/);
  assert.throws(() => read('q:PostCropVignetteAmount="NaN"'), /number/);
});
