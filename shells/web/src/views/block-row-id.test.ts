// SPDX-License-Identifier: MPL-2.0
/**
 * Every `blocks` row is minted in ONE place, and the legacy migration runs in ONE
 * place - a source scan, not a mount.
 *
 * Plan 100 section 3 makes a row's id a property of its birth: `newBlockRow` (tool-inputs.ts)
 * builds the declared defaults AND the stable id together, so a row cannot exist without
 * one. That guarantee is only as good as the number of places that build a row, and the
 * sidebar has four (the "+ Add" button and its typed menu, drop-to-add, Markdown paste,
 * CSV/JSON import) - a fifth written the old way (`for (const f of fields) row[f.id] =
 * blockFieldDefault(f)`) would silently reintroduce id-less rows.
 *
 * The migration of rows saved BEFORE ids existed is the other half, and where it runs is
 * a correctness property, not a preference: `renderInputs` also draws `/multi`'s shared
 * card against a fan-out runtime whose model is the LEAD session's and whose `setInput`
 * writes to every sibling session declaring that id, so a migration from there would
 * overwrite each sibling's rows with the lead's - and mark them dirty - on mount. It
 * belongs to a mounted session (views/tool.ts), through the engine's `applyPatch`, which
 * records no undo step.
 *
 * A scan because tool-inputs.ts cannot be imported outside Vite (it resolves sibling
 * modules with `.js` specifiers) - the same reason multi-edit-crash-guard.test.ts scans
 * rather than mounts. The migration and ULID behaviour themselves are covered for real in
 * lib/row-id.test.ts and views/free-canvas-ids.test.ts.
 *
 * Run directly:  node --test shells/web/src/views/block-row-id.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(import.meta.dirname, 'tool-inputs.ts'), 'utf8');
// both views are an orchestrator plus feature modules under a dir of the same name (2026-09-09 split)
const featureSrc = (view: string): string => [readFileSync(resolve(import.meta.dirname, `${view}.ts`), 'utf8'), ...readdirSync(resolve(import.meta.dirname, view)).filter((n) => n.endsWith('.ts')).sort().map((n) => readFileSync(resolve(import.meta.dirname, view, n), 'utf8'))].join('\n');
const TOOL_SRC = featureSrc('tool');
const CANVAS_SRC = featureSrc('free-canvas');

test('blockFieldDefault is called only by newBlockRow - no hand-rolled row anywhere', () => {
  const calls = SRC.match(/(?<!function )blockFieldDefault\(/g) ?? [];
  assert.equal(calls.length, 1,
    'a blocks row is built ONLY by newBlockRow (which is the only caller of blockFieldDefault) - '
    + 'a new creation site must call newBlockRow so the row is born with its stable id');
  assert.match(SRC, /function newBlockRow\([^)]*\)[\s\S]{0,400}?blockFieldDefault\(/,
    'and that one call is inside newBlockRow');
});

test('a new row gets its id from the ONE shared rowIdField', () => {
  assert.match(SRC, /row\[rowIdField\(inp\)\] = ulid\(\);/,
    'newBlockRow stamps the id field this input keys on');
  assert.match(SRC, /import \{[^}]*\browIdField\b[^}]*\} from '(?:\.\.\/)+lib\/row-id\.ts';/,
    'and takes that field name from lib/row-id.ts - a second local copy could drift, '
    + 'and a row minted under one name but addressed under another resolves to nothing');
  assert.equal(/function rowIdField\(/.test(SRC), false, 'no local re-definition');
});

test('the legacy migration runs at MOUNT, never from the panel renderer (/multi fan-out)', () => {
  // renderInputs is also driven by /multi's fan-out runtime (lead session's model,
  // writes fanned to every sibling), so a migration there is silent data loss.
  assert.equal(/\b(ensureRowIds|migrateBlockRowIds)\(/.test(SRC), false,
    'tool-inputs.ts must not migrate rows - see this file\'s header');
  assert.match(TOOL_SRC, /import \{[^}]*\bmigrateBlockRowIds\b[^}]*\} from '(?:\.\.\/)+lib\/row-id\.ts';/);
  assert.match(TOOL_SRC, /void migrateBlockRowIds\(runtime\);/,
    'mountTool owns the migration for the one session it mounted');
});

test('neither migration records an undo step (setInputNoHistory / applyPatch)', () => {
  // In mountTool `runtime.setInput` is the undo-history wrapper, so stamping ids
  // through it would arm ↶ before the user has made a single edit - and on a canvas
  // tool, undoing it restores an id-less array where every row answers to ''.
  assert.match(TOOL_SRC, /runtime\.setInputNoHistory = baseSetInput;/, 'the quiet setter still exists');
  // The migration id-stamps AND (plan 112) assigns spatial frame membership before the
  // commit - `let next = withIds(loaded)`, then `if (frameCfg) next = assignFrames(...)`,
  // then commits through `quiet` (the setInputNoHistory alias). Bound the block at the
  // trailing renderChrome() so the assertions don't depend on a fixed char window.
  const mStart = CANVAS_SRC.search(/let next = (?:fc\.\w+\.)?withIds\((?:fc, )?loaded\);/);
  const migration = CANVAS_SRC.slice(mStart, CANVAS_SRC.indexOf('renderChrome();', mStart));
  assert.match(migration, /setInputNoHistory/,
    'free-canvas\'s load-time migration uses the history-free setter');
  assert.match(migration, /\bquiet\(blockId, next\)/,
    'free-canvas\'s migration commits through the quiet setter, never runtime.setInput');
  assert.equal(/runtime\.setInput\(blockId, next\)/.test(CANVAS_SRC), false);
});
