// SPDX-License-Identifier: MPL-2.0
/**
 * plans/277 P11: where Lolly keeps data, said per shell. In the web app everything Lolly
 * stores lives in this browser's storage for the site, so another browser or a private
 * window on the same device starts empty. The desktop and mobile apps store on the
 * device itself. Copy about where data is kept, saved, cleared, synced or imported says
 * "this browser" on the web and "this device" in the apps, as whole sentences chosen by
 * shell, never a spliced fragment, because every sentence is translated. Copy about work
 * done locally ("runs on this device", "nothing leaves this device") keeps "this device"
 * in both.
 *
 * The shell is switched the way the apps announce themselves: `window.__TAURI_INTERNALS__`
 * with an `invoke` function (lib/instance-choice.ts, isTauriShell).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/storage-place-wording.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/profile' });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.history = dom.window.history;
g.location = dom.window.location;
g.localStorage = dom.window.localStorage;
g.HTMLElement = dom.window.HTMLElement;
g.Element = dom.window.Element;
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;
g.requestAnimationFrame = (fn: () => void) => setTimeout(fn, 0);
const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const win = dom.window as unknown as { __TAURI_INTERNALS__?: { invoke: () => void } };
/** Run `fn` as the desktop or mobile app would see the page, then as the web app. */
function asApp<T>(fn: () => T): T {
  win.__TAURI_INTERNALS__ = { invoke() {} };
  try { return fn(); } finally { delete win.__TAURI_INTERNALS__; }
}

const { isTauriShell } = await import('./instance-choice.ts');
const { partRowState } = await import('../views/profile/offline-rows.ts');
const { syncChoicesFor } = await import('./sync-choices.ts');
const { showImportDialog } = await import('../views/profile/shared.ts');
const { promptSyncApply } = await import('./sync-apply-prompt.ts');

test('the switch: the web page is not an app until the app bridge is present', () => {
  assert.equal(isTauriShell(), false);
  assert.equal(asApp(() => isTauriShell()), true);
  assert.equal(isTauriShell(), false, 'and it is the web again afterwards');
});

test('Available offline: a part already fetched is "In this browser" on the web, "On this device" in the apps', () => {
  const ready = { allowed: true, available: true, stale: false, ready: true, planned: 0 };
  assert.equal(partRowState(ready).sub, 'In this browser');
  assert.equal(asApp(() => partRowState(ready)).sub, 'On this device');
});

test('Sync choices: a connected provider is connected in this browser, or on this device in the apps', () => {
  const facts = (shell: 'web-hosted' | 'web-self-hosted' | 'desktop' | 'android') => ({
    shell, mac: false, folderPicker: true,
    connected: new Set(['dropbox', 'webdav']), syncKinds: new Set(['dropbox', 'gdrive', 'o365', 'webdav', 's3']),
    mobileSignIn: new Set(['dropbox']),
  });
  const note = (shell: Parameters<typeof facts>[0], id: string) => syncChoicesFor(facts(shell)).find((c) => c.id === id)!.note;
  assert.equal(note('web-hosted', 'dropbox'), 'Connected in this browser.');
  assert.equal(note('web-self-hosted', 'webdav'), 'Connected in this browser.');
  assert.equal(note('desktop', 'dropbox'), 'Connected on this device.');
  assert.equal(note('desktop', 'webdav'), 'Connected on this device.');
  assert.equal(note('android', 'dropbox'), 'Connected on this device.');
});

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
async function until(check: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 400; i++) { if (check()) return; await settle(); }
  assert.fail(`timed out waiting for ${what}`);
}

/** Open the Import dialog, read its body, then cancel. */
async function importDialogBody(kind?: 'sync-copy'): Promise<string> {
  const done = showImportDialog(async () => {}, kind ? { kind } : {});
  await until(() => !!document.querySelector('dialog.clear-dialog'), 'the import dialog');
  const dlg = document.querySelector<HTMLDialogElement>('dialog.clear-dialog')!;
  const body = dlg.textContent ?? '';
  dlg.querySelector<HTMLButtonElement>('[data-scope="cancel"]')!.click();
  assert.equal(await done, false);
  return body;
}

test('the Import dialog says the data comes into this browser on the web, and onto this device in the apps', async () => {
  const web = await importDialogBody();
  assert.match(web, /saved file history to this browser, and deletes nothing/);
  assert.match(web, /Your details and settings in this browser stay as they are/);
  assert.doesNotMatch(web, /this device/);

  win.__TAURI_INTERNALS__ = { invoke() {} };
  try {
    const app = await importDialogBody();
    assert.match(app, /saved file history to this device, and deletes nothing/);
    assert.match(app, /Your details and settings on this device stay as they are/);
    assert.doesNotMatch(app, /this browser/);
    const appCopy = await importDialogBody('sync-copy');
    assert.match(appCopy, /to this device, and deletes nothing/);
  } finally { delete win.__TAURI_INTERNALS__; }

  const webCopy = await importDialogBody('sync-copy');
  assert.match(webCopy, /Import this sync copy\?/);
  assert.match(webCopy, /to this browser, and deletes nothing/);
  // plans/277 P7 review S1: a sync copy is merged like a backup, so the newer copy
  // of a session or asset on both sides is kept, not the copy's.
  assert.match(webCopy, /When a session or asset is on both, the copy saved more recently is kept\./);
  assert.doesNotMatch(webCopy, /updated from the copy/);
  assert.match(web, /When a session or asset is on both, the copy saved more recently is kept\./);
});

test('the sync apply prompt updates this browser on the web, and this device in the apps', async () => {
  const read = async (): Promise<string> => {
    let applied = false;
    const done = promptSyncApply(async () => { applied = true; });
    await until(() => !!document.querySelector('.modal-msg'), 'the apply prompt');
    const text = document.querySelector('.modal-msg')!.textContent ?? '';
    document.querySelector<HTMLElement>('[data-act="cancel"]')!.click();
    await done;
    assert.equal(applied, false, 'Cancel applies nothing');
    return text;
  };
  const web = await read();
  assert.match(web, /Applying them updates this browser to match/);
  assert.match(web, /A copy of this browser’s data is saved first/);
  win.__TAURI_INTERNALS__ = { invoke() {} };
  try {
    const app = await read();
    assert.match(app, /Applying them updates this device to match/);
    assert.match(app, /A copy of this device is saved first/);
  } finally { delete win.__TAURI_INTERNALS__; }
});

// Every other changed sentence is chosen the same way: `isTauriShell() ? t('…this device…')
// : t('…this browser…')`. A representative set across every surface the change covers,
// pinned in the source so a later edit cannot drop one half.
const src = (file: string): string => readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const PAIRS: Array<[file: string, device: string, browser: string]> = [
  ['views/profile/storage.ts', 'Storage on this device', 'Storage in this browser'],
  ['views/profile/storage.ts', 'On this device', 'In this browser'],
  ['views/profile/storage.ts', 'This removes everything Lolly keeps on this device, then restarts the app:', 'This removes everything Lolly keeps in this browser, then restarts the app:'],
  ['views/profile/storage.ts', 'Tools you pinned in the gallery to work offline - their files are kept on this device. Unpinning re-downloads them on demand.', 'Tools you pinned in the gallery to work offline - their files are kept in this browser. Unpinning re-downloads them on demand.'],
  ['components/history-panel.ts', 'All history on this device', 'All history in this browser'],
  ['components/history-panel.ts', 'These session checkpoints are temporary. Open a copy to keep one on this device.', 'These session checkpoints are temporary. Open a copy to keep one in this browser.'],
  ['views/history.ts', 'This device', 'This browser'],
  ['components/history-fidelity.ts', 'Saved file available on this device', 'Saved file available in this browser'],
  ['views/file-operation-history.ts', 'On this device', 'In this browser'],
  ['views/profile-sync.ts', 'Keep this device', 'Keep this browser'],
  ['views/profile-sync.ts', 'Bring it to this device', 'Bring it to this browser'],
  ['views/profile-sync.ts', 'Changes on this device are waiting to sync.', 'Changes in this browser are waiting to sync.'],
  ['views/profile-sync.ts', 'Left this device unchanged.', 'Left this browser unchanged.'],
  ['lib/sync-service.ts', 'Nothing was changed: this device could not be saved to your sync home first. {reason}', 'Nothing was changed: this browser’s data could not be saved to your sync home first. {reason}'],
  ['views/profile-connections.ts', 'Stay connected on this device', 'Stay connected in this browser'],
  ['views/profile/offline.ts', '{name} is removed from this device. You can download it again any time you are online.', '{name} is removed from this browser. You can download it again any time you are online.'],
  ['views/profile/shell.ts', 'How the app dresses for you - your preference, separate from your brand. Applied instantly and remembered on this device.', 'How the app dresses for you - your preference, separate from your brand. Applied instantly and remembered in this browser.'],
  ['lib/design-system/design-systems-card.ts', 'The design systems on this device. The active one is what every tool renders with.', 'The design systems in this browser. The active one is what every tool renders with.'],
  ['lib/drop-router.ts', 'The project was added to this device.', 'The project was added to this browser.'],
  ['views/rebrand/foot.ts', 'This device has no room left, so the change was not saved.', 'This browser has no room left, so the change was not saved.'],
  ['views/start/looks.ts', 'Saved on this device', 'Saved in this browser'],
  ['lib/s3-send.ts', 'Uploads this file straight to your own S3-compatible bucket with the keys you saved in Profile. They stay on this device - there is no server between you and your storage.', 'Uploads this file straight to your own S3-compatible bucket with the keys you saved in Profile. They stay in this browser - there is no server between you and your storage.'],
];

test('each storage sentence has its web twin, chosen by shell as a whole sentence', () => {
  for (const [file, device, browser] of PAIRS) {
    const pair = new RegExp(`isTauriShell\\(\\)\\s*\\?\\s*(?:t|tRaw)\\(\\s*'${esc(device)}'[\\s\\S]{0,200}?:\\s*(?:t|tRaw)\\(\\s*'${esc(browser)}'`);
    assert.match(src(file), pair, `${file}: "${device}" / "${browser}"`);
  }
});

// Work done locally is on the device in every shell, so these keep "this device" and get
// no browser twin.
const KEPT: Array<[file: string, sentence: string]> = [
  ['lib/stt-job.ts', 'Listens to this clip on this device and writes timed captions. Nothing is uploaded.'],
  ['components/rate-cards-manager.ts', 'Drop the rate card your printer gave you. Lolly multiplies its numbers by quantities it counted - it never invents a price. Nothing leaves this device.'],
  ['views/tsig-model-note.ts', 'Downloads the on-device detector once (~{mb} MB). The text never leaves this device.'],
  ['lib/upscale-job.ts', 'Upscaling isn’t available on this device.'],
  ['views/valid.ts', 'Search for a Lolly Imprint after cropping or resizing. Runs on this device.'],
  ['views/profile-sync.ts', 'Leave this empty unless you do not trust the place you sync to. With a passphrase, your data is encrypted on this device before upload, and every device needs the same passphrase. If it is lost, the synced copies cannot be opened.'],
  ['views/privacy-notice.ts', 'Your designs and files stay on this device - no tracking, no analytics.'],
];

test('sentences about work done locally keep "this device" in every shell', () => {
  for (const [file, sentence] of KEPT) {
    const code = src(file);
    assert.ok(code.includes(`'${sentence}'`), `${file} still says "${sentence}"`);
    assert.ok(!code.includes(sentence.replaceAll('this device', 'this browser')), `${file} has no browser twin for "${sentence}"`);
  }
});
