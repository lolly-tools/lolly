// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { loadTool } from '../engine/src/loader.ts';
import { createRuntime } from '../engine/src/runtime.ts';
import { parseKf, evaluateKf } from '../engine/src/keyframes.ts';
import { buildInputModel } from '../engine/src/inputs.ts';
import { serializeUrlState, parseUrlState } from '../engine/src/url-mode.ts';
import { baseHost } from './helpers/host.ts';
import { parseTemplateMotion } from '../shells/web/src/lib/template-motion.ts';

const ids = ['launch-editorial', 'launch-snap', 'launch-cascade', 'launch-loop'];
const root = new URL('../community/', import.meta.url);
const tool = await loadTool('design', p => readFile(new URL(p, root), 'utf8'));
type Box = Record<string, unknown> & { id: string; kf?: string; dur?: number; group?: string; locked?: boolean };

for (const id of ids) test(`${id}: portable, token-based, articulated and readable in every pace`, async () => {
  const file = JSON.parse(await readFile(new URL(`design/templates/${id}.json`, root), 'utf8'));
  assert.ok(parseTemplateMotion(file.motion));
  const declared = new Set(tool.manifest.inputs.map(i => i.id));
  const fields = new Set(tool.manifest.inputs.find(i => i.id === 'boxes')!.fields!.map(f => f.id));
  for (const values of [file.values, ...file.presets.map((p: { values: object }) => ({ ...file.values, ...p.values }))]) {
    for (const key of Object.keys(values)) assert.ok(declared.has(key), `unknown input ${key}`);
    const rows = values.boxes as Box[];
    assert.equal(new Set(rows.map(b => b.id)).size, rows.length);
    for (const row of rows) {
      for (const key of Object.keys(row)) assert.ok(fields.has(key), `unknown box field ${key}`);
      for (const key of ['bg', 'fg']) if (row[key] && row[key] !== 'transparent') assert.match(String(row[key]), /^var\(--brand-/);
      if (row.kind === 'text') assert.ok(['sans', 'display', 'mono'].includes(String(row.font)));
    }
    const moving = rows.filter(b => b.kf);
    assert.ok(moving.length >= 7);
    assert.ok(new Set(moving.map(b => b.kf)).size >= 5, 'layers need distinct timing');
    for (const row of moving) {
      const track = parseKf(row.kf!);
      const middle = evaluateKf(track, row.dur! * 500);
      assert.ok(track.length >= 4, 'arrival, settling and hold must remain editable');
      assert.equal(middle.o, 1, `${row.id} is readable at the poster`);
      assert.equal(middle.x ?? 0, 0); assert.equal(middle.y ?? 0, 0);
      if (id === 'launch-loop') assert.deepEqual(evaluateKf(track, 0), evaluateKf(track, row.dur! * 1000), 'loop closes exactly');
      if (row.group) for (const sibling of moving.filter(b => b.group === row.group)) assert.equal(sibling.kf, row.kf, 'card content moves with its surface');
    }
    const errors: unknown[] = [];
    const host = baseHost(); host.log = (level: string, message: string) => { if (level === 'error') errors.push(message); };
    const runtime = await createRuntime(tool, host, values);
    assert.equal(errors.length, 0, String(errors));
    assert.match(runtime.getHydrated(), /data-t-kf=/);
    for (const row of rows) assert.ok(runtime.getHydrated().includes(`data-box-id="${row.id}"`), row.id);
    const query = serializeUrlState(runtime.getModel());
    const decoded = parseUrlState(query, tool.manifest);
    const model = buildInputModel(tool.manifest, { initial: decoded.values });
    const decodedRows = model.find(i => i.id === 'boxes')!.value as Box[];
    assert.equal(decodedRows.length, rows.length);
    for (const row of rows) {
      const decoded = decodedRows.find(b => b.id === row.id)!;
      for (const [key, value] of Object.entries(row)) assert.equal(String(decoded[key]), String(value), `${row.id}.${key} survives URL mode`);
    }
    runtime.destroy();
  }
});

test('motion metadata rejects unbounded or non-finite playback', () => {
  const valid = { collection: 'Launch', recipe: 'snap', durationMs: 6000, posterMs: 3000, beats: ['Arrive', 'Hold'] };
  assert.ok(parseTemplateMotion(valid));
  for (const patch of [{ durationMs: Infinity }, { durationMs: 50 }, { posterMs: 6000 }, { beats: ['x'.repeat(161)] }]) assert.equal(parseTemplateMotion({ ...valid, ...patch }), undefined);
});
