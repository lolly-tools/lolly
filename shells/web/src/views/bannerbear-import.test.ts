// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importBannerbear, readBannerbearTemplate } from './bannerbear-import.ts';

const encode = (value: unknown): Uint8Array => new TextEncoder().encode(JSON.stringify(value));
const template = { uid: 'u', name: 'Card', width: 100, height: 50, config: { objects: [{ type: 'text', name: 'title', left: 1, top: 2, width: 50, height: 20, text: 'Hi' }, { type: 'lottie', name: 'motion' }] } };

test('only a V5 template is read, so every other file reaches its own importer', () => {
  assert.deepEqual(readBannerbearTemplate(encode(template)), template);
  assert.equal(readBannerbearTemplate(encode({ uuid: 'p', layers: [] })), null);
  assert.equal(readBannerbearTemplate(encode([1, 2])), null);
  assert.equal(readBannerbearTemplate(new TextEncoder().encode('{ not json')), null);
  assert.equal(readBannerbearTemplate(new TextEncoder().encode('<svg/>')), null);
  assert.equal(readBannerbearTemplate(new Uint8Array([0x25, 0x50, 0x44, 0x46])), null);
});

test('import gives one frame, and tells the person what was left out', () => {
  const notes: string[] = [];
  const { frame } = importBannerbear(template, { warn: (note) => notes.push(note) });
  assert.equal(frame.width, 100); assert.equal(frame.boxes.length, 1); assert.equal(frame.boxes[0]!.id, 'title');
  assert.ok(notes.some((note) => /motion: type lottie was left out/.test(note)));
  assert.ok(notes.some((note) => /not run against a live account/.test(note)));
});
