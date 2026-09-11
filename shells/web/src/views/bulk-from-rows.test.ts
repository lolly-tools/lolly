// SPDX-License-Identifier: MPL-2.0
/**
 * "Bulk from rows" (plans/147 M1) - the tool view hands its template to /batch.
 *
 * The feature is one query param spelled in three files: the tool view mints
 * `#/batch?tool=<id>`, main.ts's batch route reads `tool` off the query and passes it
 * as `seedToolId`, and pro/index.ts seeds the grid with it. A rename in any one of the
 * three silently drops the preselect (the batch still opens, just empty), which is
 * exactly the kind of break a test has to catch, so the param name is pinned on all
 * three sides here.
 *
 * The second half pins the two HOMES of the action, because one layout having it and
 * another not is the failure this package exists to fix: the sidebar-header button for
 * the standard layouts, the Lolly-menu item for the chromeless editors.
 *
 * WHY A SOURCE SCAN: none of the four modules can be imported outside Vite - main.ts
 * boots the app, pro/index.ts and the two views pull in stylesheets and view chunks -
 * and mountTool needs a real loaded tool plus a host bridge. Same reasoning, and the
 * same stripComments helper, as views/projects-add-seed.test.ts.
 *
 * Run directly:  node --test shells/web/src/views/bulk-from-rows.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { canBatchTool } from '../capabilities.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Source with the LINE comments removed, so a claim cannot be satisfied by prose describing
 *  it. Block comments are left alone on purpose: a naive `/*…*\/` sweep also eats real code
 *  in these files (a string or regex literal that happens to hold the opening pair reopens
 *  the match and swallows everything to the next close), and every prose claim this file
 *  guards against lives in a `//` comment anyway. */
function stripComments(src: string): string {
  return src
    .split('\n')
    .map((line) => {
      const at = line.search(/(^|[^:])\/\//);
      return at === -1 ? line : line.slice(0, at === 0 ? 0 : at + 1);
    })
    .join('\n');
}

const read = (rel: string): string => stripComments(readFileSync(join(HERE, rel), 'utf8'));

const MAIN = read('../main.ts');
const PRO = read('../pro/index.ts');
// tool.ts is an orchestrator plus feature modules under tool/ (2026-09-09 split)
const TOOL = [read('./tool.ts'), ...readdirSync(join(HERE, 'tool')).filter((n) => n.endsWith('.ts')).sort().map((n) => read(`./tool/${n}`))].join('\n');
const CANVAS = [read('./free-canvas.ts'), ...readdirSync(join(HERE, 'free-canvas')).filter((n) => n.endsWith('.ts')).sort().map((n) => read(`./free-canvas/${n}`))].join('\n');

test('the tool view mints #/batch?tool=<id> and main.ts reads that exact param', () => {
  const minted = TOOL.match(/#\/batch\?(\w+)=\$\{encodeURIComponent\(toolId\)\}/);
  assert.ok(minted, 'views/tool.ts must navigate to #/batch?<param>=<encoded tool id>');
  const param = minted[1];
  assert.equal(param, 'tool', 'the batch deep-link param is `tool`');

  // main.ts reads it inside the batch route's own case, next to the `session` read.
  const proCase = MAIN.slice(MAIN.indexOf("const { mountPro }"));
  assert.match(proCase, new RegExp(`get\\('${param}'\\)`),
    'main.ts must read the same param name off the batch route query');
  assert.match(proCase, /seedToolId/, 'main.ts must hand the id to mountPro as seedToolId');
  assert.match(proCase, /mountPro\([^)]*\{[^}]*seedToolId/s, 'seedToolId must be in the mountPro options');
});

test('pro/index.ts seeds the grid from seedToolId without clobbering an opened session', () => {
  assert.match(PRO, /seedToolId\?: string;/, 'ProMountOpts must declare seedToolId');
  assert.match(PRO, /opts\.seedToolId \? await seedTool\(opts\.seedToolId\) : false/,
    'the mount must seed the tool through seedTool()');
  // The seed runs AFTER the session / sheet-selection branches, so it adds rather than replaces.
  const seedAt = PRO.indexOf('opts.seedToolId ? await seedTool');
  const sessionAt = PRO.indexOf('opts.sessionSlot');
  const refsAt = PRO.indexOf('opts.seedRefs');
  assert.ok(sessionAt !== -1 && refsAt !== -1);
  assert.ok(seedAt > sessionAt && seedAt > refsAt,
    'the seed must be applied after the session and sheet-selection deep links');
  // …and it fills the first EMPTY row, appending one only when there is none.
  assert.match(PRO, /state\.rows\.find\(r => !r\.toolId\)/,
    'seedTool must reuse the first empty row before appending one');
  // A seeded grid must not also pop the empty-row template search over the top.
  assert.match(PRO, /if \(!seededTool && !opts\.seedRefs\?\.length && !opts\.sessionSlot\) openFirstTemplateSearch\(\)/,
    'the template search is the fallback only when nothing was deep-linked');
});

test('the gate matches what /batch will actually admit', () => {
  const runnable = {
    inputs: [{ id: 'firstname' }],
    render: { formats: ['png', 'svg'] },
  };
  assert.equal(canBatchTool(runnable, ['network']), true);

  // The batch grid renders data → asset, so a tool with nothing to fill from a row,
  // or nothing to render, is never in its template list (build-catalog-index.ts
  // `exportable`, plus the obvious "there are fields").
  assert.equal(canBatchTool({ ...runnable, inputs: [] }, ['network']), false, 'no inputs, no row to fill');
  assert.equal(canBatchTool({ ...runnable, render: { formats: [] } }, ['network']), false, 'no format to render');
  assert.equal(canBatchTool({ ...runnable, render: { export: false, formats: ['png'] } }, ['network']), false,
    'a render-only tool exports itself, never through the batch');

  // And the half that was missing: /batch hides a tool whose capabilities this shell
  // cannot fulfil (`shellCanRun`), so offering Bulk for one would deep-link to an
  // empty grid. url-shot on a plain browser is the live case - the tool view mounts
  // it (toolSupport 'install'), the batch does not list it.
  const capture = { ...runnable, capabilities: ['capture'] };
  assert.equal(canBatchTool(capture, ['network', 'clipboard']), false, 'unmet capability, no Bulk');
  assert.equal(canBatchTool(capture, ['network', 'capture']), true, 'a shell that can capture gets it');
  // Absent host.capabilities means the host declared no set: gating is skipped, per
  // the HostV1 contract, exactly as the batch's own filter does.
  assert.equal(canBatchTool(capture, undefined), true, 'no declared set, no gating');
});

test('every tool layout can reach it: the sidebar header button and the Lolly menu item', () => {
  assert.match(TOOL, /const canBulk = canBatchTool\((?:tview\.)?tool\.manifest, (?:tview\.)?host\.capabilities\);/,
    'the tool view must gate on the shared canBatchTool, not a restated copy');

  // Home 1 - the standard sidebar layouts, beside "Make variants".
  assert.match(TOOL, /id="bulk-rows-btn"/, 'the sidebar header must render the Bulk button');
  assert.match(TOOL, /\$\{canBulk \? `<button[^`]*id="bulk-rows-btn"/, 'the button must be gated on canBulk');
  assert.match(TOOL, /#bulk-rows-btn'\)\?\.addEventListener\('click', (?:tview\.\w+\.)?openBulk\)/,
    'the sidebar button must be wired to openBulk');
  // It reuses the neighbouring control's class, so it needs no stylesheet of its own.
  assert.match(TOOL, /class="multi-edit-btn" id="bulk-rows-btn"/,
    'the Bulk button should reuse .multi-edit-btn rather than add a new style');

  // Home 2 - the chromeless editors, which have no sidebar header at all. The MENU
  // half is a real behavioural test (free-canvas-rail.test.ts, on the jsdom harness);
  // all that is left to pin here is that the view hands the action over.
  assert.match(TOOL, /bulk:\s*(?:tview\.)?canBulk\s*\?\s*\(\)\s*=>\s*\{\s*(?:tview\.\w+\.)?openBulk\(\);\s*\}\s*:\s*undefined/,
    'the editor rail must be handed the same action');
  assert.match(CANVAS, /bulk\?\(\): void;/, 'ToolbarActions must declare the optional bulk action');
});

test('unsaved single-tool work is offered a save before the batch takes over', () => {
  // The batch starts from rows, so the current design does not travel; leaving with
  // unsaved edits must make the same offer the back pill makes. A session whose
  // latest edits went out as an export counts as resolved, not unsaved (audit 167
  // F-A2 - exportedSinceEdit), so the guard stands down for it too.
  const fn = TOOL.slice(TOOL.indexOf('const openBulk'), TOOL.indexOf('const openBulk') + 700);
  assert.match(fn, /if \(!(?:tview\.)?hasInputs \|\| !(?:tview\.)?userHasMadeChanges \|\| (?:tview\.)?exportedSinceEdit\)\s*\{\s*go\(\);\s*return;\s*\}/,
    'a clean or export-resolved session leaves straight away');
  assert.match(fn, /showUnsavedDialog\(/, 'a dirty session gets the shared unsaved dialog');
});
