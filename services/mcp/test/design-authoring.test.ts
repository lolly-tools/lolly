// SPDX-License-Identifier: MPL-2.0
/**
 * Design authoring keys through the MCP tools (plan 291 W5): `inputs.boxes` rows,
 * `$styles` beside them, `add.layer` and `set` carrying `$in`, `$style`, `$points` and
 * the macros are lowered to stored rows in `resolveInputs`, so lolly_check, validate,
 * compile and build_url all see ordinary rows in global canvas coordinates.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { CheckReportV1 } from '@lolly-tools/core';
import type { JsonRpcResponse } from '../src/protocol.ts';
import { dispatch } from '../src/server.ts';

let nextId = 41_900;
type Result = { content: Array<{ type: string; text?: string }>; structuredContent?: Record<string, unknown>; isError?: boolean };
async function call(name: string, args: Record<string, unknown>): Promise<Result> {
  const res = (await dispatch({ jsonrpc: '2.0', id: nextId++, method: 'tools/call', params: { name, arguments: args } })) as JsonRpcResponse;
  assert.ok(res && !res.error, JSON.stringify(res?.error));
  return res.result as Result;
}
const json = (r: Result): any => JSON.parse(r.content[0]!.text!);
type Row = Record<string, unknown>;

/** An artboard off the origin, a styled headline and a stack, all in artboard coordinates. */
const INPUTS = {
  $styles: { head: { fontSize: 64, weight: 600, lineHeight: 1.1, fg: '#202124' } },
  boxes: [
    { id: 'a', kind: 'frame', x: 2080, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
    { id: 'title', $in: 'a', $style: 'head', x: 120, y: 96, w: 1200, h: 80, text: 'Hello' },
    { id: 'list', $in: 'a', $stack: { x: 120, y: 260, w: 800, pitch: 70, item: [{ slot: 'text', kind: 'text', h: 50 }], items: ['One', 'Two', 'Three'] } },
  ],
};
const broken = (): typeof INPUTS => {
  const copy = structuredClone(INPUTS);
  (copy.boxes[2] as { $stack: Record<string, unknown> }).$stack.pitch = 'wide';
  return copy;
};

test('lolly_check with toolId design checks the rows the authoring keys lower to', async () => {
  const result = await call('lolly_check', { toolId: 'design', inputs: INPUTS, browser: 'off' });
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  const report = result.structuredContent as unknown as CheckReportV1;
  assert.equal(report.input.artboards, 1);
  assert.equal(report.families.structure.state, 'ran');
  const codes = report.findings.map((f) => f.code);
  assert.ok(!codes.includes('design.layer.kind-unknown'), 'no macro row reaches the structure check');
  assert.ok(!codes.includes('design.layer.outside-artboard'), 'artboard coordinates became canvas coordinates');
  assert.match(report.families.structure.reason ?? '', /Inspected 5 layers on 1 artboard/);
});

test('lolly_check refuses authoring it cannot lower, naming the key', async () => {
  const byInputs = await call('lolly_check', { toolId: 'design', inputs: broken(), browser: 'off' });
  assert.equal(byInputs.isError, true);
  assert.match(byInputs.content[0]!.text!, /\/boxes\/2\/\$stack\/pitch: expected a number/);
  // A document is read by the check itself: the failure is a structure finding with its pointer.
  const byDocument = await call('lolly_check', { document: broken(), browser: 'off' });
  const report = byDocument.structuredContent as unknown as CheckReportV1;
  assert.equal(report.outcome, 'refused');
  const finding = report.findings.find((f) => f.code === 'design.authoring.invalid');
  assert.ok(finding, JSON.stringify(report.findings));
  assert.equal(finding.path, '/boxes/2/$stack/pitch');
  assert.equal(finding.layerId, 'list');
  assert.equal(finding.origin.checker, 'design-authoring');
  assert.equal(report.families.verify.state, 'skipped');
});

test('an authoring document passed as document is lowered by the check and says so', async () => {
  const result = await call('lolly_check', { document: INPUTS, browser: 'off' });
  const report = result.structuredContent as unknown as CheckReportV1;
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  assert.match(report.families.structure.reason ?? '', /lowered first, to 5 stored rows/);
  assert.ok(!report.findings.some((f) => f.code === 'design.layer.outside-artboard'));
});

test('add.layer with $in and $points, and set with $style, compile to stored rows', async () => {
  const args = {
    toolId: 'design',
    inputs: { boxes: INPUTS.boxes.slice(0, 2), $styles: INPUTS.$styles },
    layerOperations: [{ op: 'add', layer: { id: 'tick', kind: 'path', $in: 'a', $points: [[100, 100], [300, 200], [500, 100]], stroke: '#112233', strokeW: 6 } }],
    layerPatches: [{ id: 'title', set: { $style: { fontSize: 40 }, text: 'Smaller' } }],
  };
  const validation = json(await call('lolly_validate', args));
  assert.equal(validation.ok, true, JSON.stringify(validation.errors));
  const compiled = json(await call('lolly_compile', args));
  const rows = compiled.document.values.boxes as Row[];
  const tick = rows.find((r) => r.id === 'tick')!;
  assert.deepEqual([tick.x, tick.y, tick.w, tick.h], [2180, 100, 400, 100]);
  assert.equal(tick.frame, 'a');
  assert.equal(typeof tick.path, 'string');
  const title = rows.find((r) => r.id === 'title')!;
  assert.equal(title.text, 'Smaller');
  assert.equal(title.x, 2200);
  assert.equal(Number(title.fontSize), 40, 'a style in a set writes the fields the set leaves out');
  for (const row of rows) assert.ok(Object.keys(row).every((k) => !k.startsWith('$')), JSON.stringify(row));
});

test('a multi-row add with an anchor is refused with the caller\'s own index', async () => {
  const result = await call('lolly_validate', {
    toolId: 'design',
    inputs: { boxes: INPUTS.boxes.slice(0, 2), $styles: INPUTS.$styles },
    layerOperations: [
      { op: 'add', layer: { id: 'one', kind: 'box', $in: 'a', x: 0, y: 0, w: 10, h: 10 } },
      { op: 'add', afterId: 'title', layer: { id: 'list', $in: 'a', $stack: { x: 0, y: 0, w: 10, h: 10, pitch: 20, item: [{ slot: 'text', kind: 'text' }], items: ['a', 'b'] } } },
    ],
  });
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text!, /\/layerOperations\/1\/afterId: this add expands to 2 rows/);
});

test('an editable link carries the lowered rows and no authoring key', async () => {
  const result = await call('lolly_build_url', { toolId: 'design', inputs: INPUTS });
  assert.ok(!result.isError, result.content[0]?.text ?? '');
  const url = /https?:\/\/\S+/.exec(result.content[0]!.text!)![0];
  assert.ok(!decodeURIComponent(url).includes('$'), 'no $ key reaches the URL');
});
