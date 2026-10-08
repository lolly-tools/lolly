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

test('the video clip line keys on a recorded take, not on any stored size (plan 302)', () => {
  // Every upload carries meta.bytes since plan 302, so reading it here would
  // tell a person with an uploaded photo that their session includes a video clip.
  const body = bodyAfter('export function backPillIntercept(');
  assert.match(body, /recordedClipBytes\(runtime\.getModel\(\)\.map\(/);
  assert.doesNotMatch(body, /meta\?\.bytes|meta\.bytes/);
});

test('a team document: Save, Cmd-S and the leave prompt reach the document scope (plan 75 G1)', () => {
  const saving = stripComments(readFileSync(join(HERE, 'tool-actions', 'saving.ts'), 'utf8'));
  // Every save path (the export panel's Save, the render pill and Cmd-S through it, the
  // dialog's Save & leave) arrives in performSave, which asks the scope first.
  assert.match(saving, /const scoped = opts\?\.device \? null : saveInDocumentScope\(manifest\.id\);\s*if \(scoped\) return saveInScope\(ta, btn, scoped\);/);
  assert.match(saving, /exportCompleted\(ta, 'save'\);\s*return true;\s*\}/, 'a scoped save stands the leave guard down like a local one');
  // The view announces each mount to the scope seam and takes it down with the mount.
  assert.match(feature, /const stopScope = mountDocumentScope\(\{ toolId, view: viewEl,/);
  assert.match(bodyAfter('viewEl._cleanup = () =>'), /stopScope\(\);/);
  // The Unsaved changes dialog asks the scope's question when there is one.
  const dialog = bodyAfter('export function showUnsavedDialog(');
  assert.match(dialog, /const scoped = leaveQuestion\(\);/);
  assert.match(dialog, /scoped \? escapeText\(scoped\) : t\('Unsaved changes'\)/, 'the question is escaped into the heading');
  assert.match(dialog, /scoped \? t\('Stay'\) : t\('Cancel'\)/);
  // The draft is kept only where that question was asked: a viewer's team document gets
  // the ordinary dialog, and its Leave without saving discards, as the dialog says.
  const leave = stripComments(readFileSync(join(HERE, 'tool-leave.ts'), 'utf8'));
  assert.match(leave, /if \(opts\.keep \?\? documentLeavePrompt\(\) !== null\) return \{ outcome: 'unchanged', kept: slot \};/);
  assert.doesNotMatch(leave, /documentScopeClaimed/, 'claiming the document is not enough to keep its draft');
});
