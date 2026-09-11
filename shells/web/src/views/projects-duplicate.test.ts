// SPDX-License-Identifier: MPL-2.0
/**
 * Projects "Duplicate" - the session context menu gained a Duplicate action that copies a
 * saved session's stored inputs into a FRESH, independent slot filed beside the original.
 *
 * WHY A SOURCE SCAN: `views/projects.ts` cannot be imported outside Vite - it pulls in view
 * chunks (featured-row, view-topbar, search-bar, …) and their stylesheets, and its runtime
 * needs a real host bridge. So this scans the source for the wiring, exactly the way
 * `views/projects-add-seed.test.ts` and `views/tool-template-mount.test.ts` do. The state
 * store's copy semantics are exercised behaviourally elsewhere; here we pin the view's wiring.
 *
 * Run directly:  node --test shells/web/src/views/projects-duplicate.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Source with comments removed, so a behaviour claim cannot be satisfied by prose that merely
 *  describes it. (Same helper, same reasoning, as views/projects-add-seed.test.ts.) */
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

test('the session context menu offers a Duplicate action (not the folder/image menus)', () => {
  const body = bodyAfter(CODE, 'function tileMenuHtml(kind: string, ref: string): string');
  assert.match(body, /menuItem\('duplicate-session', DUPLICATE_ICON, t\('Duplicate'\)\)/,
    'the single-session menu lists Duplicate');
  // It sits in the session branch only - the folder branch returns before the session items.
  const folderBranch = body.slice(body.indexOf("if (kind === 'folder')"), body.indexOf("if (kind === 'image')"));
  assert.doesNotMatch(folderBranch, /duplicate-session/, 'Duplicate is not offered on folders');
});

test('the menu dispatch routes duplicate-session to duplicateSession', () => {
  // Asserted on the whole source, not bodyAfter(onMenuAction): that signature's `target`
  // param type carries a `{`, which brace-matching would mistake for the function body.
  assert.match(CODE, /act === 'duplicate-session'\) duplicateSession\(ref\)/,
    'a picked Duplicate row calls duplicateSession with the tile ref');
});

const CORE_HEAD = 'async function duplicateSessionCore(slot: string, alsoTaken?: Set<string>): Promise<string | null>';

test('duplicateSessionCore copies the source into a fresh slot named "… copy"', () => {
  const body = bodyAfter(CODE, CORE_HEAD);
  assert.match(body, /const data = await \(host as ProjectsHost\)\.state\.load\(slot\)/,
    'it reads the source session data');
  assert.match(body, /if \(!data\) return null;/, 'a missing/unreadable source returns null, not throws');
  assert.match(body, /let name = t\('\{name\} copy', \{ name: base \}\)/,
    'the copy is named "<original> copy"');
});

test('the new slot is unique: timestamp for a single-tool session, name-keyed for a batch', () => {
  const body = bodyAfter(CODE, CORE_HEAD);
  assert.match(body, /const batch = isBatchSlot\(slot\);/, 'it branches on whether the source is a batch');
  assert.match(body, /batch \? BATCH_SLOT_PREFIX \+ name : `\$\{entry\.toolId\}:\$\{Date\.now\(\)\}`/,
    'single-tool slots are unique by timestamp; batch slots are keyed by their (unique) name');
  // The uniqueness loop consults BOTH the live entries and the slots minted earlier this bulk
  // run (alsoTaken), so a same-millisecond tie or a batch-name clash still resolves.
  assert.match(body, /const isTaken = \(s: string\): boolean => taken\.has\(s\) \|\| alsoTaken\?\.has\(s\) === true;/,
    'collision check spans live entries AND the current bulk run');
  assert.match(body, /for \(let n = 2; isTaken\(newSlot\); n\+\+\)/, 'it bumps to "copy 2/3…" until free');
  assert.match(body, /newSlot = batch \? BATCH_SLOT_PREFIX \+ name : `\$\{entry\.toolId\}:\$\{Date\.now\(\)\}-\$\{n\}`/,
    'a same-ms single-tool tie gets a -N suffix so bulk copies never overwrite each other');
});

test('it saves the copy with the source thumbnail and files it beside the original', () => {
  const body = bodyAfter(CODE, CORE_HEAD);
  // The LOADED data object is what gets saved - so referenced assets are shared, not re-encoded.
  assert.match(body, /state\.save\(newSlot, data, entry\.thumb \|\| ''\)/,
    'the copy reuses the source thumb and saves the same data (shared asset references)');
  assert.match(body, /const owner = ownerByRef\.get\(slot\);/, 'it looks up the source folder');
  assert.match(body, /if \(owner\) await store\.moveItem\(newSlot, owner\.id, 'session'\)/,
    'a filed session copies into the SAME folder; a loose one is left loose (no move)');
  assert.match(body, /alsoTaken\?\.add\(newSlot\)/, 'the new slot is recorded so the bulk loop sees it');
  assert.match(body, /return newSlot;/, 'it returns the new slot for the caller');
});

test('the single-tool export filename tracks the copy name; a batch keeps its label-keyed slot', () => {
  const body = bodyAfter(CODE, CORE_HEAD);
  assert.match(body, /data\.__label = name;/, 'the display label becomes the copy name');
  assert.match(body, /if \(!batch\) data\.__export_filename = name;/,
    'a single-tool session also tracks its export filename to the copy name; a batch does not');
});

test('duplicateSession wraps the core with one repaint + announce', () => {
  const body = bodyAfter(CODE, 'async function duplicateSession(slot: string): Promise<void>');
  assert.match(body, /await duplicateSessionCore\(slot\)/, 'delegates the copy to the shared core');
  assert.match(body, /await reload\(\); render\(\);/, 'repaints once');
  assert.match(body, /announce\(t\('Session duplicated'\)\)/, 'announces success');
});

test('bulk Duplicate copies every selected SESSION in one repaint', () => {
  const body = bodyAfter(CODE, 'async function duplicateSelection(): Promise<void>');
  assert.match(body, /filter\(\(\[, kind\]\) => kind === 'session'\)/, 'only sessions duplicate - folders/images are skipped');
  assert.match(body, /const made = new Set<string>\(\);/, 'a shared set threads slot-uniqueness across the loop');
  assert.match(body, /for \(const slot of slots\) if \(await duplicateSessionCore\(slot, made\)\) n\+\+;/,
    'each selected session runs through the core, sharing the made-set');
  assert.match(body, /await reload\(\); render\(\);/, 'ONE repaint after the whole batch');
  assert.match(body, /announce\(t\('\{n\} duplicated', \{ n \}\)\)/, 'announces the count');
});

test('the selection bar + bulk menu offer Duplicate, and the dispatch routes it', () => {
  // Selection bar action, shown only when the selection contains a session.
  assert.match(CODE, /id: 'duplicate', icon: DUPLICATE_ICON, label: \(\) => t\('Duplicate'\)[\s\S]{0,120}hidden: \(\) => !\[\.\.\.selected\.values\(\)\]\.includes\('session'\)/,
    'the bulk bar lists Duplicate, hidden unless a session is selected');
  assert.match(CODE, /\.\.\.\(\[\.\.\.selected\.values\(\)\]\.includes\('session'\) \? \[menuItem\('duplicate', DUPLICATE_ICON, t\('Duplicate'\)\)\] : \[\]\)/,
    'the right-click bulk menu lists Duplicate under the same condition');
  assert.match(CODE, /if \(action === 'duplicate'\) \{ duplicateSelection\(\); return; \}/,
    'handleBulk routes duplicate to duplicateSelection');
});
