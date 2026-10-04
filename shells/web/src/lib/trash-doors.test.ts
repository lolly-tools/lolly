// SPDX-License-Identifier: MPL-2.0
/**
 * Which deletes go to the Trash, and which stay immediate (plan 277 P3, decided
 * 2026-09-27: "projects and user uploads can have a trash functionality if
 * invoked via the web UI, in all other instances delete means delete"), plus the
 * two consistency fixes of P10. Source-level guards, the same shape as the view
 * contract tests beside them: lib/trash.test.ts proves the model, this file proves
 * every door uses it and no other path does.
 *
 * Run directly:  node --test shells/web/src/lib/trash-doors.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { actionTile } from '../folder-tiles.ts';

const WEB = new URL('..', import.meta.url).pathname;           // shells/web/src/
const REPO = new URL('../../../../', import.meta.url).pathname;
const read = (rel: string): string => readFileSync(join(WEB, rel), 'utf8');
/** The source between two markers, so an assertion reads one function, not a file. */
function between(src: string, start: string, end: string): string {
  const a = src.indexOf(start);
  assert.ok(a >= 0, `marker not found: ${start}`);
  const b = src.indexOf(end, a + start.length);
  return src.slice(a, b < 0 ? undefined : b);
}

test('every web door that deletes a saved session moves it to the Trash', () => {
  const projects = read('views/projects.ts');
  assert.match(projects, /createTrash\(/);
  assert.doesNotMatch(between(projects, 'async function trashSessions', 'async function deleteFolderCascade'), /state\.delete\(/);

  const gallery = between(read('views/gallery.ts'), 'function showHistoryDialog(', '// ── Saved-session row');
  assert.match(gallery, /trash\.trashSessions\(/);
  assert.doesNotMatch(gallery, /state\.delete\(/, 'the gallery saved-sessions list no longer deletes for good');
  assert.doesNotMatch(gallery, /confirmDialog/, 'and asks no confirm: the Undo toast is the safety net');

  const storage = read('views/profile/storage.ts');
  const sessionDeletes = between(storage, 'async function deleteOneSession', 'function toggleSort');
  assert.match(sessionDeletes, /trash\.trashSessions\(/);
  assert.doesNotMatch(storage, /host\.state\.delete\(/, 'Settings → Storage deletes nothing for good');

  assert.match(between(read('folder-overlay.ts'), 'async function deleteItem', '// ── Folder export'), /trash\.trashSessions\(/);
  assert.match(between(read('pro/index.ts'), "querySelectorAll<HTMLElement>('[data-del]')", '// ── Project picker'), /trash\.trashSessions\(/);
});

test('every web door that deletes an upload moves it to the Trash', () => {
  const assets = between(read('views/assets/user-assets.ts'), 'export function softDeleteUploads', 'export async function deleteUserAsset');
  assert.match(assets, /trash\.trashAssets\(/);
  assert.doesNotMatch(assets, /_deleteUserAsset\(/, 'Assets → Your uploads no longer deletes when the toast expires');

  const storage = read('views/profile/storage.ts');
  assert.match(between(storage, "closest<HTMLButtonElement>('[data-delete-userimg]')", '// The Trash row'), /trash\.trashAssets\(/);
  assert.doesNotMatch(storage, /_deleteUserAsset!?\(/, 'My images deletes nothing for good');

  const picker = between(read('views/picker.ts'), "closest<HTMLElement>('[data-delete-id]')", '// Per-card "Upscale"');
  assert.match(picker, /trash\.trashAssets\(/);
  assert.doesNotMatch(picker, /_deleteUserAsset\(/);

  assert.match(between(read('folder-overlay.ts'), 'async function deleteItem', '// ── Folder export'), /trash\.trashAssets\(/);
});

test("the brand editor's font delete moves the family to the Trash", () => {
  const door = between(read('lib/brand-editor/compare-stage.ts'), "closest<HTMLButtonElement>('[data-del]')", '// ── Logos');
  assert.match(door, /trashUserFont\(/);
  assert.match(door, /showTrashUndoToast\(/);
  assert.doesNotMatch(door, /removeUserFont\(|confirmDialog\(/, 'no permanent removal and no confirm: the Undo toast is the safety net');
  // trashUserFont has one caller, the web UI door above; removeUserFont stays the
  // immediate delete for everything else.
  const callers: string[] = [];
  for (const file of sources(WEB)) {
    const rel = relative(WEB, file).replaceAll('\\', '/');
    if (rel !== 'user-fonts.ts' && /\btrashUserFont\(/.test(readFileSync(file, 'utf8'))) callers.push(rel);
  }
  assert.deepEqual(callers, ['lib/brand-editor/compare-stage.ts']);
});

/** Every .ts under a directory, skipping tests and node_modules. */
function sources(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    // Native build output (src-tauri, target) holds no app code and dangling links.
    if (['node_modules', 'dist', 'src-tauri', 'target', 'public'].includes(name) || name.startsWith('.')) continue;
    const abs = join(dir, name);
    let isDir: boolean;
    try { isDir = statSync(abs).isDirectory(); } catch { continue; }
    if (isDir) sources(abs, out);
    else if (/\.(ts|js|mjs)$/.test(name) && !/\.test\.(ts|js)$/.test(name)) out.push(abs);
  }
  return out;
}

test('deletes outside the web UI stay immediate: nothing but a web view imports the Trash', () => {
  const importsTrash = /(?:from|import\()\s*['"][^'"]*\/trash\.ts['"]/;
  const allowed = new Set([
    'shells/web/src/views/projects.ts',
    'shells/web/src/views/gallery.ts',
    'shells/web/src/views/picker.ts',
    'shells/web/src/views/assets/tiles.ts',
    'shells/web/src/views/assets/user-assets.ts',
    'shells/web/src/views/assets/wiring.ts',
    'shells/web/src/views/profile/storage.ts',
    'shells/web/src/components/trash-dialog.ts',
    'shells/web/src/folder-overlay.ts',
    'shells/web/src/pro/index.ts',
    // The font half: user-fonts.ts builds the entry (trashUserFont, called only
    // from the brand editor below) and supplies the restore hooks.
    'shells/web/src/user-fonts.ts',
    'shells/web/src/lib/brand-editor/compare-stage.ts',
  ]);
  const roots = ['shells', 'packages', 'services', 'engine/src', 'scripts'].map(r => join(REPO, r));
  const offenders: string[] = [];
  for (const root of roots) {
    for (const file of sources(root)) {
      const rel = relative(REPO, file).replaceAll('\\', '/');
      if (rel === 'shells/web/src/lib/trash.ts') continue;
      if (importsTrash.test(readFileSync(file, 'utf8')) && !allowed.has(rel)) offenders.push(rel);
    }
  }
  assert.deepEqual(offenders, [], 'the CLI, TUI, MCP, the bridges, backup import and sync keep deleting at once');
  // And the tool-facing host.state.delete still deletes: the bridge never learned the Trash.
  assert.doesNotMatch(read('bridge/state.ts'), /__trash__|TRASH_SLOT_PREFIX/);
});

test('the Trash is always visible and inspectable, in Projects and in Assets', () => {
  const projects = read('views/projects.ts');
  const tile = between(projects, 'const trashTile =', ';\n');
  assert.doesNotMatch(tile, /trashEntries\.length\s*\?\s*`/, 'the tile no longer waits for an entry');
  assert.match(tile, /actionTile\('trash'[\s\S]*trash:\s*true/);
  const rendered = actionTile('trash', '', 'Trash', 'Empty', { trash: true, openLabel: 'Open Trash' });
  assert.match(rendered, /data-open-trash/);
  assert.match(rendered, /aria-label="Open Trash"/);
  assert.doesNotMatch(rendered, /data-create/);
  const uploads = between(read('views/assets/filters.ts'), 'export function uploadsSectionHtml', 'export function assetsSectionHtml');
  assert.match(uploads, /data-open-trash/);
  const dialog = read('components/trash-dialog.ts');
  assert.match(dialog, /t\('The Trash is empty\.'\)/, 'an empty Trash says so');
  const emptyFlow = between(dialog, "el.closest('[data-trash-empty]')", 'export function showTrashUndoToast');
  assert.ok(emptyFlow.indexOf('confirmDialog(') >= 0 && emptyFlow.indexOf('confirmDialog(') < emptyFlow.indexOf('trash.empty()'), 'Empty Trash asks first');
});

test('P10: the Projects avatar menu opens Saved sessions exactly as the gallery does', () => {
  const projects = read('views/projects.ts');
  assert.match(projects, /profileMenu: \{ savedCount: entries\.length, onHistory: \(\) => \{ void openSavedSessionsDialog\(entries, toolName\); \} \}/);
  assert.match(between(read('views/gallery.ts'), 'async function openHistoryOverlay', 'historyFab?.addEventListener'), /openSavedSessionsDialog\(/);
});

test('P10: the gallery caption names the time it shows', () => {
  const gallery = read('views/gallery.ts');
  const caption = between(gallery, 'const sub = hasSession', ": '';");
  assert.match(caption, /latest!\.openedAt\s*\?\s*t\('Last opened · \{time\}', \{ time: relativeTime\(latest!\.openedAt\) \}\)/);
  assert.match(caption, /t\('Last modified · \{time\}', \{ time: relativeTime\(latest!\.updatedAt\) \}\)/);
  assert.doesNotMatch(caption, /'Last opened · \{time\}', \{ time: relativeTime\(latest!\.updatedAt\)/, 'never "Last opened" over the save time');
  // The web state bridge hands the recorded open to its readers.
  assert.match(read('bridge/state.ts'), /\.\.\.\(r\.openedAt \? \{ openedAt: r\.openedAt \} : \{\}\)/);
  // Projects shows the same field under the same name.
  assert.match(read('views/projects.ts'), /\[t\('Last opened'\), fmtIso\(e\.openedAt\)\]/);
});
