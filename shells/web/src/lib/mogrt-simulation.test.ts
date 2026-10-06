// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { readMogrt } from './mogrt.ts';
import { defaultMogrtSimulation, simulateMogrt } from './mogrt-simulation.ts';
const template = { name: 'LowerThird ROF 4k', video: null, poster: null, fonts: [], width: 3840, height: 2160, duration: 8,
  controls: [{ name: 'Name', type: 6, value: 'Name Here', fontSize: 100, font: 'SUSE-SemiBold' }, { name: 'Size', type: 2, value: '100', min: 80, max: 100 }] };
test('native lower-third keeps dimensions, timing and editable text; size respects source constraints', () => {
  const options = defaultMogrtSimulation(template); assert.equal(options.layout, 'right'); assert.equal(options.background, 'transparent');
  options.values = ['<script>still plain text</script>', '999'];
  const result = simulateMogrt(template, options), text = result.boxes[1]!;
  assert.equal(result.width, 3840); assert.equal(text.text, options.values[0]); assert.equal(text.align, 'right');
  assert.equal(text.weight, '600'); assert.equal(text.dur, 8); assert.equal(text.frame, result.boxes[0]!.id);
  const max = text.fontSize; options.values[1] = '100'; assert.equal(simulateMogrt(template, options).boxes[1]!.fontSize, max);
  assert.equal(template.controls[0]!.value, 'Name Here');
});
test('invalid settings cannot generate nonfinite geometry or inject styles', () => {
  const options = defaultMogrtSimulation(template); options.background = 'url(https://bad)'; options.foreground = 'red;display:none'; options.duration = NaN;
  const result = simulateMogrt({ ...template, width: Infinity, height: NaN }, options);
  assert.equal(result.boxes[0]!.bg, 'transparent'); assert.equal(result.boxes[1]!.fg, '#ffffff'); assert.equal(result.duration, 6);
  for (const box of result.boxes) for (const value of Object.values(box)) if (typeof value === 'number') assert.ok(Number.isFinite(value));
});
test('unsupported controls do not become misleading editable text layers', () => {
  const other = { ...template, controls: [{ name: 'Gradient Opacity', type: 2, value: '25' }, { name: 'Color', type: 4, value: '' }] };
  assert.equal(simulateMogrt(other, defaultMogrtSimulation(other)).boxes.length, 1);
});
// Optional local qualification against the downloaded provider examples (not required in CI).
if (process.env.LOLLY_MOGRT_FIXTURES) test('all local SUSE templates produce editable native layers', () => {
  const root = process.env.LOLLY_MOGRT_FIXTURES!;
  for (const file of readdirSync(root).filter(name => name.endsWith('.mogrt'))) {
    const parsed = readMogrt(new Uint8Array(readFileSync(`${root}/${file}`)));
    const result = simulateMogrt(parsed, defaultMogrtSimulation(parsed));
    assert.ok(result.boxes.length > 1, file);
    assert.equal(result.boxes.filter(box => box.kind === 'text').length, parsed.controls.filter(c => c.type === 6).length);
  }
});
