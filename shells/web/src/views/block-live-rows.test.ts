// SPDX-License-Identifier: MPL-2.0
/**
 * Block-row commits are built from LIVE rows, never this render's snapshot.
 *
 * renderInputs wires its handlers over `panelModel`, a closure snapshot of the
 * model at render time. Block typing defers panel rebuilds (canSkipInputsRebuild
 * returns true while a block text field holds focus), and the engine's
 * `updateInput` REPLACES model items - so consecutive edits across block fields
 * leave the snapshot several edits behind. Any handler that builds a rows array
 * from the snapshot and commits it silently reverts everything typed since the
 * last repaint: type a URL into row 1, edit row 2, and row 1's URL snaps back to
 * its default (the Jump Page "links get forgotten" bug, 2026-08-24).
 *
 * The fix is the `liveInput(id)` helper - the same live re-read the dropToAdd
 * committer, applyData and the table wiring already did - and every block-row
 * write path must go through it. A source scan, like block-row-id.test.ts, since
 * tool-inputs.ts can't be imported outside Vite (`.js` sibling specifiers).
 *
 * Run directly:  node --test shells/web/src/views/block-live-rows.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(import.meta.dirname, 'tool-inputs.ts'), 'utf8');

test('liveInput reads the runtime model first, snapshot only as fallback', () => {
  assert.match(SRC, /const liveInput = \(id: string \| undefined\)[\s\S]{0,240}?runtime\.getModel\(\)\.find\(\(?i\)? => i\.id === id\)\s*\?\?\s*panelModel\.find\(\(?i\)? => i\.id === id\)/,
    'liveInput must resolve against runtime.getModel() before the render-time snapshot');
});

test('no block-row handler resolves its input from the render-time snapshot', () => {
  // Every block handler used to open with this exact find; one surviving copy is
  // a handler that will commit stale rows once typing has deferred a rebuild.
  assert.equal(/panelModel\.find\(i => i\.id === blockId\)/.test(SRC), false,
    'a block-row handler must call liveInput(blockId), not panelModel.find - '
    + 'the snapshot lags the model whenever block typing deferred the rebuild');
  const calls = SRC.match(/\bliveInput\(/g) ?? [];
  assert.ok(calls.length >= 11,
    `expected the block-row write paths (field typing, colour field, add, remove, `
    + `copy/paste/clear via rowOf, asset set/clear/edit/rebake, drag-reorder) to go `
    + `through liveInput - found ${calls.length} calls`);
});

test('the block field typing commit itself reads live rows', () => {
  // The highest-traffic path: the [data-field-id] input listener. Pin that the
  // rows array it commits comes from liveInput's item, not the snapshot's.
  const wiring = SRC.slice(SRC.indexOf("// Block field changes"), SRC.indexOf('// Table inputs'));
  assert.ok(wiring.length > 0, 'the block field wiring block exists');
  assert.match(wiring, /const inp = liveInput\(blockId\)/,
    'the typing commit resolves its input live');
  assert.equal(/panelModel/.test(wiring), false,
    'the typing commit must not touch the snapshot at all');
});
