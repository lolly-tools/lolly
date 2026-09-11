// SPDX-License-Identifier: MPL-2.0
/**
 * SURFACE 2 - the Projects add-picker's "pick a tool → a variation, or the default".
 *
 * Quick-adding a tool to a project used to seed its RESOLVED defaults unconditionally. Now,
 * when the tool has saved user templates/variations, a tiny chooser (choiceDialog) offers the
 * default OR one of those variations, and the pick seeds the new session from that template's
 * `values` instead of the defaults. A tool with no saved templates quick-adds the default
 * exactly as before - no extra step.
 *
 * WHY A SOURCE SCAN: `views/projects.ts` cannot be imported outside Vite - it pulls in view
 * chunks (featured-row, view-topbar, search-bar, folder-overlay, …) and their stylesheets, and
 * its runtime seeding needs a real loaded tool + host bridge. The same reason `views/tool-
 * template-mount.test.ts`, `views/tool-collab-mount.test.ts` and `views/block-row-id.test.ts`
 * scan the source rather than importing; this file follows them. The store the seed comes from
 * is covered behaviourally by `lib/user-templates.test.ts`.
 *
 * Run directly:  node --test shells/web/src/views/projects-add-seed.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Source with comments removed, so a behaviour claim cannot be satisfied by prose that merely
 *  describes it. (Same helper, same reasoning, as views/tool-template-mount.test.ts.) */
function stripComments(src: string): string {
  const noBlocks = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlocks
    .split('\n')
    .map((line) => {
      const at = line.search(/(^|[^:])\/\//);
      return at === -1 ? line : line.slice(0, at === 0 ? 0 : at + 1);
    })
    .join('\n');
}

/** The `{ … }` body that follows `head`, extracted by brace matching. */
function bodyAfter(src: string, head: string): string {
  const at = src.indexOf(head);
  assert.notEqual(at, -1, `expected to find \`${head}\` in projects.ts`);
  // Search for the body brace AFTER the head, since a head can itself carry a `{` (a
  // `Promise<{ … }>` return type), which would otherwise be mistaken for the body.
  const open = src.indexOf('{', at + head.length);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  assert.fail(`unbalanced braces while extracting \`${head}\``);
}

const CODE = stripComments(readFileSync(join(HERE, 'projects.ts'), 'utf8'));
// The chooser itself moved out of the mount closure with plans/226 WP-4: the view calls it,
// views/projects-templates-wiring.ts holds it.
const WIRING = stripComments(readFileSync(join(HERE, 'projects-templates-wiring.ts'), 'utf8'));
const PICKER = stripComments(readFileSync(join(HERE, 'picker.ts'), 'utf8'));

test('addDefaultSession takes an optional seed and hands it to the runtime', () => {
  assert.match(CODE, /async function addDefaultSession\(toolId: string, seedValues\?: Record<string, unknown>\)/,
    'the signature grew an optional seedValues');
  const body = bodyAfter(CODE, 'async function addDefaultSession(toolId: string, seedValues?: Record<string, unknown>)');
  assert.match(body, /createRuntime\(tool, host, \(seedValues \?\? \{\}\) as/,
    'the seed (or {} for the default) is what the runtime is born with - not a hardcoded {}');
  assert.match(body, /runtime\.getModel\(\)\.map/,
    'the saved session is still built from the resolved model values');
});

test('quick-add offers the variation chooser and seeds from the pick', () => {
  const body = bodyAfter(CODE, 'onQuickAddTool: async (toolId) =>');
  assert.match(body, /const choice = await chooseAddSeed\(tpl, toolId, profile, \{ toolName, closeMenu \}\);/,
    'quick-add first runs the blank-or-a-template chooser, over the collection and the '
    + 'profile the view already read');
  assert.match(body, /if \(choice\.cancelled\) return \{ ok: false, silent: true \};/,
    'a dismissed chooser returns a SILENT result so no ✓/✗ flashes');
  assert.match(body, /await addDefaultSession\(toolId, choice\.values\);/,
    'the chosen seed (undefined for the default) is threaded into addDefaultSession');
});

// The chooser's LIST moved to views/projects-templates.ts with plans/226 WP-4: it now
// offers the shipped templates too (minus the hidden ones) and leads with the tool's
// "Start with". What that list holds is covered behaviourally in
// views/projects-templates.test.ts; this file keeps pinning the view's wiring.
test('a tool with no templates at all skips the chooser entirely (no extra step)', () => {
  assert.match(WIRING, /export async function chooseAddSeed\(/, 'the chooser is the wiring module\'s');
  const body = bodyAfter(WIRING, '): Promise<AddSeedPick>');
  assert.match(body, /const choices = await tpl\.addSeedChoices\(toolId, profile\);/,
    'the choices come from the Templates collection, over the same profile the view read');
  const guardAt = body.indexOf('if (choices.length < 2) return { cancelled: false };');
  assert.notEqual(guardAt, -1, 'nothing but "Blank" → resolve to the default with cancelled:false');
  const choiceAt = body.indexOf('choiceDialog(');
  assert.ok(choiceAt === -1 || guardAt < choiceAt,
    'that early return sits BEFORE the dialog is ever opened');
  assert.match(body, /message: t\('Start blank, or from a template\.'\)/, 'the message names both answers');
  assert.match(body, /if \(chosen === ADD_SEED_BLANK\) return \{ cancelled: false \};/,
    'the blank row still resolves to the tool defaults');
  assert.match(body, /return \{ cancelled: false, values: await tpl\.seedForRef\(chosen, toolId\) \};/,
    'and any other pick is resolved through the shared template resolver (a shipped seed is fetched)');
});

test('the picker suppresses the flash for a silent quick-add result', () => {
  assert.match(PICKER, /export interface CollectResult \{ ok: boolean; label\?: string; silent\?: boolean \}/,
    'CollectResult carries the silent opt-out');
  const handler = PICKER.slice(PICKER.indexOf("closest<HTMLElement>('[data-quickadd-tool]')"));
  assert.match(handler, /if \(!\(typeof r === 'object' && r\.silent\)\) flashCard\(quick, r\);/,
    'a silent result skips flashCard so a cancel shows nothing');
});

// ── SURFACE 3 (parts 3-4): the user's own saved tools appear in the add-picker ──
// Folded in LOCAL to this picker's tool list (never the shared window.__toolIndex, which
// ~17 other readers consume), and opened through their BASE tool seeded with the saved
// values via the existing in-memory pending seed - so no other reader has to become
// user-tool-aware and the mount path is untouched.

test('the add-picker folds in the user\'s own saved tools as LOCAL cards', () => {
  const body = bodyAfter(CODE, 'async function openAddPicker(): Promise<void>');
  assert.match(body, /createUserToolStore\([\s\S]{0,200}?\)\.list\(\)/, 'loads the user tools from their store');
  assert.match(body, /projectUserTool\(ut\)/, 'projects each into a listing entry');
  assert.match(body, /tools\.push\(\{ id: p\.id, name: p\.name/, 'and appends them to the picker tool list');
  assert.match(body, /const tools = \(\(w\.__toolIndex\?\.tools \?\? \[\]\)[\s\S]*?\)\.filter\(/,
    'that list is a FILTERED COPY of the index - pushing to it never mutates the shared __toolIndex');
});

test('opening a user tool seeds its base tool via the in-memory pending seed', () => {
  const body = bodyAfter(CODE, 'onOpenTool: async (toolId) =>');
  assert.match(body, /const ut = userToolById\.get\(toolId\);/, 'recognises a user-tool id');
  assert.match(body, /const openId = ut \? ut\.userTool\.baseToolId : toolId;/, 'routes to the base tool');
  assert.match(body, /setPendingToolSeed\(openId, ut\.userTool\.values\)/, 'stashes the saved values as the mount seed');
  assert.match(body, /window\.location\.hash = '#\/tool\/' \+ openId;/, 'navigates to the base tool, not the synthetic id');
});

test('quick-adding a user tool seeds its base tool without the variation chooser', () => {
  const body = bodyAfter(CODE, 'onQuickAddTool: async (toolId) =>');
  assert.match(body, /const ut = userToolById\.get\(toolId\);/, 'recognises a user-tool id');
  assert.match(body, /if \(ut\) \{ await addDefaultSession\(ut\.userTool\.baseToolId, ut\.userTool\.values\); return \{ ok: true \}; \}/,
    'a user tool seeds directly through addDefaultSession - no default-or-variation step');
});
