// SPDX-License-Identifier: MPL-2.0
/**
 * The tool view's wiring for Leave without saving (plan 277 P1). The behaviour
 * lives in views/tool-leave.ts and bridge/revision-discard.ts, each tested on its
 * own; this pins that the tool view actually routes through them:
 *
 *   1. the Unsaved changes dialog's "Leave without saving" (behind Home, the back
 *      pill and Bulk from rows) runs leaveWithoutSaving, never a bare navigation;
 *   2. leaveWithoutSaving discards, then waits for the dialog's Back entry to be
 *      popped, then rewrites the entry being left, and only then navigates;
 *   3. an edit present when the tool mounts (a creation not at its last save, or
 *      an entry that still carries unsaved edits) counts as unsaved;
 *   4. an edit marks its browser entry and a save clears the mark.
 *
 * WHY A SOURCE SCAN: mountTool cannot be imported outside Vite (see
 * views/tool-template-mount.test.ts). Reads the whole feature, views/tool.ts plus
 * views/tool/*.ts, so moving a function between modules does not break the guard.
 *
 * Run directly:  node --test shells/web/src/views/tool-leave-wiring.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const stripComments = (src: string): string => src.replace(/\/\*[\s\S]*?\*\//g, '')
  .split('\n').map(line => { const at = line.search(/(^|[^:])\/\//); return at === -1 ? line : line.slice(0, at === 0 ? 0 : at + 1); }).join('\n');
const feature = stripComments([join(HERE, 'tool.ts'), ...readdirSync(join(HERE, 'tool')).filter(f => f.endsWith('.ts') && !f.endsWith('.test.ts')).map(f => join(HERE, 'tool', f))]
  .map(file => readFileSync(file, 'utf8')).join('\n'));

/** The `{ … }` body that follows `head`, by brace matching. */
function bodyAfter(head: string): string {
  const at = feature.indexOf(head);
  assert.notEqual(at, -1, `expected \`${head}\` in the tool view`);
  const open = feature.indexOf('{', at);
  let depth = 0;
  for (let i = open; i < feature.length; i++) {
    if (feature[i] === '{') depth++;
    else if (feature[i] === '}' && --depth === 0) return feature.slice(open, i + 1);
  }
  throw new Error(`unbalanced body after ${head}`);
}

test('every Unsaved changes dialog leaves through leaveWithoutSaving', () => {
  for (const head of ['export function backPillIntercept(', 'export const openBulk = ']) {
    const body = bodyAfter(head);
    assert.match(body, /showUnsavedDialog\(/, head);
    assert.match(body, /void leaveWithoutSaving\(tview, go\)/, `${head} discards before it leaves`);
  }
});

test('leaveWithoutSaving discards, lets the dialog entry go, rewrites the left entry, then navigates', () => {
  const body = bodyAfter('export async function leaveWithoutSaving(');
  const steps = ['await discardUnsavedWork(', 'await historySettled()', 'rewriteLeftEntry(', 'go();'].map(step => {
    const at = body.lastIndexOf(step);
    assert.notEqual(at, -1, `missing ${step}`);
    return at;
  });
  assert.deepEqual([...steps].sort((a, b) => a - b), steps, 'in this order');
  assert.match(body, /if \(!isLocalDocument\(tview\)\) \{ go\(\); return; \}/, 'collaboration and shared mounts leave as before');
  assert.match(body, /mountLifecycle\.disposed/, 'a person who already left elsewhere is not navigated again');
});

test('the dialog says when leaving removes a never-saved creation, and a failed discard is told (recheck R2)', () => {
  const detail = bodyAfter('function historyKeepsEdits(');
  assert.match(detail, /history\.neverSaved\(\)/);
  assert.match(detail, /history\.keepsEdits\(\)/);
  const leave = bodyAfter('export async function leaveWithoutSaving(');
  assert.match(leave, /catch \(error\) \{[\s\S]*discardFailure\(error\)[\s\S]*showUndoToast\(/, 'a failed discard shows a toast');
});

test('an unsaved edit present at mount counts as unsaved, and edits and saves mark the entry', () => {
  const mount = bodyAfter('export function wireBackPill(');
  assert.match(mount, /openedSession\.cursor\?\.unsaved/);
  assert.match(mount, /entryHoldsUnsavedEdits\(tview\.toolId\)/);
  assert.match(mount, /tview\.session\.markSessionDirty\(\)/);
  assert.match(bodyAfter('export function markSessionDirty('), /rememberEntryEdits\(tview, true\)/);
  assert.match(bodyAfter('export function markSessionSaved('), /rememberEntryEdits\(tview, false\)/);
  assert.match(bodyAfter('export function rememberEntryEdits('), /syncEntryMark\(/, 'written again once a dialog entry is gone');
  assert.match(feature, /detail === 'save'\) tview\.session\.rememberEntryEdits\(false\)/, 'the export panel\'s Save clears the mark too');
});
