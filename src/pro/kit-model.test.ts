// SPDX-License-Identifier: MPL-2.0
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyKit, boundValue, captureKitEdits, createKitRows, kitIssues, parseKitDefinition, restoreKit } from './kit-model.ts';
import { snapshotFromState } from './sessions.ts';
import type { ToolManifest } from '../../../../engine/src/loader.ts';

const read = (path: string) => JSON.parse(readFileSync(new URL(`../../../../community/${path}`, import.meta.url), 'utf8'));
const source = () => read('design/templates/event-kit.json').kit;
const manifests = () => new Map<string, ToolManifest>(['design', 'qr-code'].map(id => [id, read(`${id}/tool.json`)]));
const make = () => createKitRows(parseKitDefinition(source()), manifests());

test('one brief binds all outputs by stable ids, independent of row and box order', () => {
  const { kit, rows } = make();
  rows.reverse();
  for (const row of rows) if (Array.isArray(row.values.boxes)) row.values.boxes.reverse();
  kit.brief.title = 'September meetup'; kit.brief.url = 'https://example.org/event?q=a&b=c';
  applyKit(kit, rows);
  for (const o of kit.definition.outputs) {
    const row = rows.find(r => r.kitOutputId === o.id)!;
    for (const b of o.bindings) assert.deepEqual(boundValue(row, b), kit.brief[b.field]);
  }
  assert.deepEqual(rows.map(r => [r.kitOutputId, r.unit, r.outWidth, r.outHeight]).reverse(), [['poster', 'mm', 210, 297], ['social', 'px', 1080, 1080], ['qr', 'px', 512, 512]]);
});

test('an override survives new shared values and saved-batch round trip; relink restores it', () => {
  const { kit, rows } = make();
  const qr = rows.find(r => r.kitOutputId === 'qr')!;
  qr.values.url = 'https://example.org/local';
  captureKitEdits(kit, rows);
  kit.brief.url = 'https://example.org/shared'; applyKit(kit, rows);
  assert.equal(qr.values.url, 'https://example.org/local');
  const saved = snapshotFromState({ kit, rows, format: 'png', collapsed: [], colWidths: {} });
  const restored = restoreKit(JSON.parse(JSON.stringify(saved)).kit)!;
  assert.deepEqual(restored.detached.qr, ['url']);
  assert.equal(saved.rows.find(r => r.kitOutputId === 'qr')?.values.url, 'https://example.org/local');
  restored.detached.qr = []; applyKit(restored, rows);
  assert.equal(qr.values.url, 'https://example.org/shared');
  assert.equal('kit' in snapshotFromState({ rows: [], format: 'png', collapsed: [], colWidths: {} }), false);
});

test('unknown and duplicate targets fail before any row is partially changed', () => {
  const { kit, rows } = make();
  const before = structuredClone(rows.map(r => r.values));
  kit.brief.title = 'Must not partially apply';
  kit.definition.outputs[1]!.bindings[0]!.box = 'missing';
  assert.throws(() => applyKit(kit, rows), /Missing/);
  assert.deepEqual(rows.map(r => r.values), before);
  const raw = source(); raw.outputs[0].bindings.push(raw.outputs[0].bindings[0]);
  assert.throws(() => parseKitDefinition(raw), /same target/);
  raw.outputs = Array.from({ length: 100 }, () => raw.outputs[0]);
  assert.throws(() => parseKitDefinition(raw), /size|Unsupported/);
  const wrongType = source(); wrongType.fields[0].type = ['text'];
  assert.throws(() => parseKitDefinition(wrongType), /field/);
  const duplicate = make(); duplicate.rows.push({ ...duplicate.rows[0]! });
  assert.throws(() => applyKit(duplicate.kit, duplicate.rows), /duplicated/);
  const wrongTarget = make(); wrongTarget.kit.definition.outputs[0]!.bindings[0]!.property = 'x';
  assert.throws(() => applyKit(wrongTarget.kit, wrongTarget.rows), /Incompatible/);
});

test('invalid URLs and overlong text are reported, while explicit date text is preserved', () => {
  const { kit, rows } = make();
  kit.brief.url = 'javascript:alert(1)'; kit.brief.title = 'x'.repeat(101);
  assert.equal(kitIssues(kit).length, 2);
  kit.brief.url = 'https://example.com'; kit.brief.title = '交流会'; kit.brief.when = '24 September · 18:00 Europe/London';
  assert.deepEqual(kitIssues(kit), []); applyKit(kit, rows);
  const b = kit.definition.outputs[0]!.bindings.find(b => b.field === 'when')!;
  assert.equal(boundValue(rows[0]!, b), kit.brief.when);
  assert.throws(() => createKitRows(parseKitDefinition(source()), new Map()), /unavailable/);
});
