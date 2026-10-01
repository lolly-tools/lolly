// SPDX-License-Identifier: MPL-2.0
/**
 * engine/src/psd-descriptor.ts: Photoshop's Action Descriptor and EngineData
 * readers (plans/289 item 1, M3 step 1).
 *
 * Run with: node --test tests/psd-descriptor.test.ts
 *
 * Both read attacker bytes, so most of this is about limits: nesting, counts,
 * truncation, unknown types and keys that would be special in a plain object.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  descBool, descChild, descColor, descData, descEnum, descList, descNumber, descText,
  engineBool, engineList, engineNumber, engineString, engineWalk, parseEngineData,
  readDescriptor, readVersionedDescriptor,
} from '../engine/src/psd-descriptor.ts';
import { D, descriptor, typeLayer, versioned } from './helpers/psd-fixtures.ts';

const latin1 = (s: string) => Uint8Array.from([...s].map(c => c.charCodeAt(0) & 255));

test('descriptor: every item type reads back', () => {
  const bytes = descriptor([
    ['doub', D.doub(1.5)], ['Wdth', D.untf('#Pxl', 320)], ['long', D.long(-7)], ['bool', D.bool(true)],
    ['Txt ', D.text('Grüße')], ['Ornt', D.enumv('Ornt', 'Hrzn')], ['data', D.raw(Uint8Array.from([1, 2, 3]))],
    ['kids', D.list([D.long(1), D.objc([['a', D.long(2)]])])],
    ['Clr ', D.objc([['Rd  ', D.doub(255)], ['Grn ', D.doub(128)], ['Bl  ', D.doub(0)]])],
    ['aLongKeyName', D.long(9)],
  ]);
  const r = readDescriptor(bytes)!;
  assert.equal(r.end, bytes.length);
  const v = r.value;
  assert.equal(descNumber(v, 'doub'), 1.5);
  assert.equal(descNumber(v, 'Wdth'), 320);
  assert.equal(descNumber(v, 'long'), -7);
  assert.equal(descBool(v, 'bool'), true);
  assert.equal(descText(v, 'Txt '), 'Grüße');
  assert.equal(descEnum(v, 'Ornt'), 'Hrzn');
  assert.equal(descText(v, 'Ornt'), null, 'an enum is never read as text');
  assert.deepEqual([...descData(v, 'data')!], [1, 2, 3]);
  const kids = descList(v, 'kids')!;
  assert.equal(kids[0], 1);
  assert.equal(descNumber(kids[1] as never, 'a'), 2);
  assert.equal(descColor(descChild(v, 'Clr ')), '#ff8000');
  assert.equal(descNumber(v, 'aLongKeyName'), 9);
  assert.equal(descChild(v, 'Ornt'), null, 'an enum is not a child descriptor');
});

test('colour: 0..1 from older writers and 0..255 from newer read the same', () => {
  const unit = readDescriptor(descriptor([['Rd  ', D.doub(1)], ['Grn ', D.doub(0.5)], ['Bl  ', D.doub(0)]]))!.value;
  assert.equal(descColor(unit), '#ff8000');
  assert.equal(descColor(readDescriptor(descriptor([['Rd  ', D.doub(1)]]))!.value), null, 'an incomplete colour is no colour');
});

test('versioned: only version 16 reads', () => {
  assert.ok(readVersionedDescriptor(versioned([['a', D.long(1)]])));
  const wrong = versioned([['a', D.long(1)]]);
  wrong[3] = 15;
  assert.equal(readVersionedDescriptor(wrong), null);
  assert.equal(readVersionedDescriptor(new Uint8Array(2)), null);
});

test('limits: truncation, unknown types, absurd counts and deep nesting all read as nothing', () => {
  const ok = descriptor([['a', D.text('hello')]]);
  for (let cut = 1; cut < ok.length; cut++) assert.equal(readDescriptor(ok.subarray(0, cut)), null, `cut at ${cut}`);
  const unknown = descriptor([['a', { type: 'zzzz', body: new Uint8Array(4) }]]);
  assert.equal(readDescriptor(unknown), null);
  const huge = descriptor([]);
  new DataView(huge.buffer).setUint32(huge.length - 4, 4_000_000_000);
  assert.equal(readDescriptor(huge), null);
  let item = D.long(1);
  for (let i = 0; i < 40; i++) item = D.objc([['n', item]]);
  assert.equal(readDescriptor(descriptor([['deep', item]])), null, 'nesting past 32 levels is refused');
  let shallow = D.long(1);
  for (let i = 0; i < 20; i++) shallow = D.objc([['n', shallow]]);
  assert.ok(readDescriptor(descriptor([['deep', shallow]])), '20 levels is fine');
});

test('a key named like an object property stays an ordinary key', () => {
  const v = readDescriptor(descriptor([['__proto__', D.long(5)], ['constructor', D.long(6)]]))!.value;
  assert.equal(descNumber(v, '__proto__'), 5);
  assert.equal(descNumber(v, 'constructor'), 6);
  assert.equal(({} as Record<string, unknown>).polluted, undefined);
  assert.equal(descNumber(v, 'toString'), null, 'inherited names are not keys');
});

test('EngineData: a real type layer\'s dictionary reads, text and styles included', () => {
  const block = typeLayer({ text: 'Héllo (world)\r', font: 'Helvetica-Bold', size: 36, color: '#30ba78', justification: 2, tracking: 50 });
  // The EngineData sits inside the TySh descriptor; read it the way the semantics module will.
  const desc = readVersionedDescriptor(block, 2 + 48 + 2)!.value;
  const engine = parseEngineData(descData(desc, 'EngineData')!)!;
  assert.equal(engineString(engineWalk(engine, 'EngineDict', 'Editor', 'Text')), 'Héllo (world)\r');
  const run = engineList(engineWalk(engine, 'EngineDict', 'StyleRun', 'RunArray'))[0]!;
  assert.equal(engineNumber(engineWalk(run, 'StyleSheet', 'StyleSheetData', 'FontSize')), 36);
  assert.equal(engineBool(engineWalk(run, 'StyleSheet', 'StyleSheetData', 'AutoLeading')), true);
  assert.equal(engineNumber(engineWalk(run, 'StyleSheet', 'StyleSheetData', 'Tracking')), 50);
  const font = engineList(engineWalk(engine, 'ResourceDict', 'FontSet'))[0]!;
  assert.equal(engineString(engineWalk(font, 'Name')), 'Helvetica-Bold');
  const para = engineList(engineWalk(engine, 'EngineDict', 'ParagraphRun', 'RunArray'))[0]!;
  assert.equal(engineNumber(engineWalk(para, 'ParagraphSheet', 'Properties', 'Justification')), 2);
});

test('EngineData: hex strings, comments, escapes and booleans', () => {
  const v = parseEngineData(latin1('<< /A <FEFF00480069> % a comment\n /B (a\\(b\\)\\n) /C [ 1 -2.5 3e2 ] /D true /E false /F null >>'))!;
  assert.equal(engineString(engineWalk(v, 'A')), 'Hi');
  assert.equal(engineString(engineWalk(v, 'B')), 'a(b)\n');
  assert.deepEqual(engineList(engineWalk(v, 'C')), [1, -2.5, 300]);
  assert.equal(engineBool(engineWalk(v, 'D')), true);
  assert.equal(engineBool(engineWalk(v, 'E')), false);
  assert.equal(engineString(engineWalk(v, 'F')), '');
});

test('EngineData: malformed, unterminated and over-deep input reads as nothing', () => {
  for (const bad of ['no dictionary here', '<< /A (unterminated >>', '<< /A [ 1 2 >>', '<< A 1 >>', '<< /A >']) {
    assert.equal(parseEngineData(latin1(bad)), null, bad);
  }
  assert.equal(parseEngineData(latin1('<< /A '.repeat(70) + '1' + ' >>'.repeat(70))), null, 'nesting past 64 is refused');
  assert.ok(parseEngineData(latin1('<< /A '.repeat(30) + '1' + ' >>'.repeat(30))));
  assert.equal(engineWalk(parseEngineData(latin1('<< /__proto__ 1 >>')), '__proto__'), 1);
});
