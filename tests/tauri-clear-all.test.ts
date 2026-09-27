// SPDX-License-Identifier: MPL-2.0
/**
 * "Clear all my data" on the desktop and mobile apps (plan 277 P2). The web clear
 * (shells/web/src/lib/clear-all-data.ts) empties the WebView's storage; the Tauri
 * shells also keep copies in their app-data folder, which a clear must remove or
 * the next launch would bring them back:
 *
 *   - saved sessions, as `saved-state/<slot>.json` files, through the state
 *     bridge's `_clearAll` (shells/tauri-shared/bridge-overrides/state-fs.ts);
 *   - the mobile upload mirror (`user-assets/`), through a clearer the mobile
 *     assets override registers (tests/user-assets-fs.test.ts drives the removal);
 *   - a loaded brand pack (`pack-store/`), through clearInstancePack, which runs
 *     over whichever pack backend the shell installed;
 *   - on the desktop, the capture sign-in browser profile (its cookies) and the
 *     Reword model files, through clearers the desktop override registers, each
 *     calling one narrow native command (review S6).
 *
 * Run directly:  node --test tests/tauri-clear-all.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createFsStateAPI, type StateFs } from '../shells/tauri-shared/bridge-overrides/state-fs.ts';

function fakeStateFs() {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  const fs: StateFs = {
    exists: async (path) => files.has(path) || dirs.has(path),
    mkdirRecursive: async (path) => { dirs.add(path); },
    readTextFile: async (path) => { const v = files.get(path); if (v === undefined) throw new Error(`missing ${path}`); return v; },
    writeTextFile: async (path, text) => { files.set(path, text); },
    readDirNames: async (path) => [...files.keys()].filter(k => k.startsWith(`${path}/`)).map(k => k.slice(path.length + 1)),
    remove: async (path) => { files.delete(path); },
  };
  return { fs, files };
}

test('the Tauri state bridge clears every saved-session file, Trash records included', async () => {
  const { fs, files } = fakeStateFs();
  const state = createFsStateAPI(fs);
  await state.save('qr-code:1', { __toolId: 'qr-code', __label: 'One' });
  await state.save('Q3 Report', { __toolId: 'chart', __label: 'Q3' });
  await state.save('__trash__:qr-code:2', { __toolId: 'qr-code', __label: 'Two' });
  assert.equal((await state.list()).length, 3);
  assert.ok(state._clearAll, 'the filesystem bridge implements _clearAll');
  await state._clearAll!();
  assert.deepEqual(await state.list(), []);
  assert.deepEqual([...files.keys()].filter(k => k.endsWith('.json')), [], 'no saved-state file is left');
  // Saving after a clear works as on a first run.
  await state.save('qr-code:3', { __toolId: 'qr-code', __label: 'Three' });
  assert.deepEqual((await state.list()).map(r => r.slot), ['qr-code:3']);
});

test('the mobile assets override registers the upload-mirror clearer', () => {
  const src = readFileSync(new URL('../shells/tauri-mobile/bridge-overrides/assets.ts', import.meta.url), 'utf8');
  assert.match(src, /registerDeviceDataClearer\('user-assets-fs', \(\) => clearUserAssetsFs\(appDataFs\)\)/);
});

test('the clear reaches the pack store through its backend, so a Tauri pack folder goes too', () => {
  const src = readFileSync(new URL('../shells/web/src/lib/clear-all-data.ts', import.meta.url), 'utf8');
  assert.match(src, /clearInstancePack\(\)/);
  assert.match(src, /opts\.state\?\._clearAll/);
});

test('the desktop clear also removes the capture sign-in profile and the Reword model, through narrow native commands', () => {
  const read = (rel: string): string => readFileSync(new URL(rel, import.meta.url), 'utf8');
  const clearers = read('../shells/tauri-desktop/bridge-overrides/device-clearers.ts');
  assert.match(clearers, /registerDeviceDataClearer\('capture-profile', async \(\) => \{ await invoke\('capture_clear_session'\); \}\)/);
  assert.match(clearers, /registerDeviceDataClearer\('reword-model', async \(\) => \{ await invoke\('reword_clear'\); \}\)/);
  // Loaded on every boot, before anyone can open the dialog.
  assert.match(read('../shells/tauri-desktop/bridge-overrides/capabilities-provided.ts'), /^import '\.\/device-clearers\.ts';$/m);

  const lib = read('../shells/tauri-desktop/src-tauri/src/lib.rs');
  assert.match(lib, /capture::capture_clear_session,/);
  assert.match(lib, /reword::reword_clear,/);
  // reword_clear removes the model folder and nothing wider: the only recursive
  // removal is of model_root, and its parents go only when empty (remove_dir).
  const reword = read('../shells/tauri-desktop/src-tauri/src/reword.rs');
  const body = reword.slice(reword.indexOf('pub async fn reword_clear'), reword.indexOf('pub async fn reword_generate'));
  assert.match(body, /let root = model_root\(&app\)\?;/);
  assert.equal((body.match(/remove_dir_all\(/g) ?? []).length, 1);
  assert.match(body, /remove_dir_all\(&root\)/);
  assert.match(body, /std::fs::remove_dir\(dir\)/);
  // No filesystem permission was widened for this (tests/tauri-security.test.ts pins the scope).
  const caps = read('../shells/tauri-desktop/src-tauri/capabilities/default.json');
  assert.doesNotMatch(caps, /models|capture-profile/);
});
