// SPDX-License-Identifier: MPL-2.0
/**
 * plans/277 P11: a backup .zip that Export my data wrote, dropped on Lolly or picked
 * with Open, opens the Import dialog (the one a Sync copy gets), merges, deletes
 * nothing and opens Projects afterwards. Any other zip keeps the archive route.
 *
 * Every backup here is made by the app's own writer (`exportBackup`), so the test
 * cannot drift from the format Export my data writes. The manifest is read the way the
 * drop sniff reads it, through the zip's central directory (`peekBackupZip`).
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/backup-zip-open.test.ts
 */
/// <reference path="../vendor.d.ts" />
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { deflateSync, strToU8, zipSync } from 'fflate';

// jsdom before the dialog modules load: the import dialog is a native <dialog>, and
// jsdom has the element but neither showModal() nor close().
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/' });
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

const { exportBackup } = await import('../data-transfer.ts');
const { peekBackupZip } = await import('./lolly-intake.ts');
const { sniffFile, dropChooserChoices, openDropChooser } = await import('./drop-router.ts');

// The in-memory BackupHost + storage exportBackup and importBackup touch. Same shape as
// data-import.test.ts.
function makeHost(seed: { profile?: Record<string, unknown>; sessions?: Record<string, unknown>; assets?: string[] } = {}) {
  const profile: Record<string, unknown> = structuredClone(seed.profile ?? {});
  const sessions = new Map<string, { data: unknown; thumb?: string | null }>(
    Object.entries(seed.sessions ?? {}).map(([slot, data]) => [slot, { data }]),
  );
  const assets: Array<Record<string, unknown>> = (seed.assets ?? []).map((id) => ({ id, type: 'image', format: 'png' }));
  const store = new Map<string, string>();
  const host = {
    profile: {
      async get() { return structuredClone(profile); },
      async set(p: Record<string, unknown>) { for (const k of Object.keys(profile)) delete profile[k]; Object.assign(profile, structuredClone(p)); },
    },
    state: {
      async list() { return [...sessions.keys()].map((slot) => ({ slot })); },
      async load(slot: string) { return sessions.get(slot)?.data ?? null; },
      async save(slot: string, data: unknown, thumb?: string | null) { sessions.set(slot, { data, thumb }); },
      async delete(slot: string) { sessions.delete(slot); },
    },
    assets: {
      async _exportUserAssets() { return assets; },
      async _importUserAsset(rec: Record<string, unknown>) {
        const at = assets.findIndex((a) => a.id === rec.id);
        if (at >= 0) assets[at] = rec; else assets.push(rec);
      },
      async _listUserAssets() { return assets.map((a) => ({ id: String(a.id) })); },
      async _deleteUserAsset(id: string) { const at = assets.findIndex((a) => a.id === id); if (at >= 0) assets.splice(at, 1); },
    },
    log() { /* silent in tests */ },
  };
  const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  return { host, storage, profile, sessions, assets };
}

/** A backup .zip exactly as Export my data writes it, from a laptop with two sessions. */
async function backupZip(name = 'LollyTools-Ada-2026-09-27.zip'): Promise<File> {
  const laptop = makeHost({
    profile: { firstname: 'Ada', city: 'London' },
    sessions: { a1: { tool: 'chart', v: 1 }, a2: { tool: 'qr-code', v: 2 } },
    assets: ['user/laptop-logo'],
  });
  const { blob } = await exportBackup({ host: laptop.host as never, storage: laptop.storage });
  return new File([await blob.arrayBuffer()], name, { type: 'application/zip' });
}

const zipFile = (entries: Record<string, Uint8Array>, name: string): File =>
  new File([zipSync(entries) as BlobPart], name, { type: 'application/zip' });
const plainZip = (): File => zipFile({ 'notes.txt': strToU8('hello'), 'pics/one.svg': strToU8('<svg xmlns="http://www.w3.org/2000/svg"/>') }, 'holiday.zip');
const picker = { isPptxUpload: () => false, isPdfUpload: () => false };

test('the writer makes a zip whose manifest.json sits near the end, past any head read', async () => {
  const file = await backupZip();
  const bytes = new Uint8Array(await file.arrayBuffer());
  assert.deepEqual([...bytes.subarray(0, 4)], [0x50, 0x4b, 0x03, 0x04], 'a backup is a plain zip');
  const at = Buffer.from(bytes).indexOf('manifest.json');
  assert.ok(at > 0, 'it carries manifest.json');
  assert.ok(Buffer.from(bytes).indexOf('profile.json') < at, 'the manifest is written after the parts it describes');
});

test('peekBackupZip reads a backup’s manifest from the central directory', async () => {
  const preview = await peekBackupZip(await backupZip());
  assert.ok(preview, 'a backup zip is recognised');
  assert.equal(preview!.kind, 'backup');
  assert.equal(preview!.format, 'lolly-backup');
  assert.equal(preview!.encrypted, false);
  assert.equal(preview!.sessions, 2);
  assert.equal(preview!.userAssets, 1);
  assert.equal(preview!.label, 'LollyTools-Ada-2026-09-27');
  assert.match(preview!.exportedAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
});

test('peekBackupZip answers null for every zip that is not a backup, and for damaged ones', async () => {
  assert.equal(await peekBackupZip(plainZip()), null, 'no manifest.json');
  assert.equal(await peekBackupZip(zipFile({ 'manifest.json': strToU8('{"format":"lolly-share"}') }, 'shared.zip')), null, 'another format');
  assert.equal(await peekBackupZip(zipFile({ 'manifest.json': strToU8('{"version":"1.0","animations":[]}'), 'animations/a.json': strToU8('{}') }, 'dot.zip')), null, 'a dotLottie manifest');
  assert.equal(await peekBackupZip(zipFile({ 'manifest.json': strToU8('not json') }, 'odd.zip')), null, 'an unreadable manifest');
  // A manifest that inflates past the 1 MB limit is refused while inflating.
  const huge = strToU8(`{"format":"lolly-backup","pad":"${' '.repeat(2 * 1024 * 1024)}"}`);
  assert.ok(deflateSync(huge).length < 1024 * 1024, 'the compressed bytes alone are small');
  assert.equal(await peekBackupZip(zipFile({ 'manifest.json': huge }, 'big.zip')), null, 'an oversized manifest');
  // A backup cut short loses its central directory, and with it the verdict.
  const whole = new Uint8Array(await (await backupZip()).arrayBuffer());
  assert.equal(await peekBackupZip(new File([whole.subarray(0, whole.length - 40) as BlobPart], 'cut.zip')), null, 'a truncated backup');
  assert.equal(await peekBackupZip(new File([strToU8('PK\u0003\u0004 not really a zip') as BlobPart], 'fake.zip')), null, 'bytes that only start like a zip');
});

test('the drop sniff marks a backup zip as a backup, and no zip route claims it', async () => {
  const s = await sniffFile(await backupZip(), true, picker);
  assert.equal(s.backup, true);
  assert.equal(s.archive, false, 'not offered as an archive to unpack');
  assert.equal(s.design, false);
  assert.equal(s.designSystem, false);
  assert.equal(s.tool, false);
  assert.equal(s.lolly, false, 'a .zip is not a .lolly');
  // The name does not matter: the manifest decides.
  const renamed = await sniffFile(await backupZip('from-my-phone.zip'), true, picker);
  assert.equal(renamed.backup, true);
});

test('an ordinary zip keeps the archive route, led by Unpack', async () => {
  const s = await sniffFile(plainZip(), true, picker);
  assert.equal(s.backup, false);
  assert.equal(s.archive, true);
  const choices = dropChooserChoices(s, { single: true, count: 1, allIngestable: false, has: () => true });
  assert.equal(choices[0]?.id, 'unpack');
  assert.equal(choices[0]?.primary, true);
  // A zip whose manifest is some other format keeps the archive route too.
  const other = await sniffFile(zipFile({ 'manifest.json': strToU8('{"format":"lolly-share"}'), 'a.txt': strToU8('a') }, 'other.zip'), true, picker);
  assert.equal(other.backup, false);
  assert.equal(other.archive, true);
});

test('Open routes a backup zip to the import before the chooser, then opens Projects', () => {
  const src = readFileSync(new URL('./drop-router.ts', import.meta.url), 'utf8');
  const chooser = src.slice(src.indexOf('export async function openDropChooser('));
  const route = chooser.indexOf('if (s.backup) { await importBackupZipDrop(first, host); return; }');
  assert.ok(route > 0, 'openDropChooser has the backup route');
  assert.ok(route > chooser.indexOf('if (s.lolly)'), 'after the .lolly intake');
  assert.ok(route < chooser.indexOf('dropChooserChoices('), 'before any zip route is offered');
  assert.ok(route < chooser.indexOf('choiceDialog('), 'and before the chooser opens');
  const handler = src.slice(src.indexOf('async function importBackupZipDrop('));
  assert.match(handler.slice(0, 600), /await openDataCopy\(file, host\)/, 'the same import a Sync copy gets');
  const copy = src.slice(src.indexOf('async function openDataCopy('));
  assert.match(copy.slice(0, 800), /import\('\.\/data-import\.ts'\)/);
  assert.match(copy.slice(0, 800), /routeToConsumer\('#\/p'/);
});

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
async function until(check: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 2000; i++) { if (check()) return; await settle(); }
  assert.fail(`timed out waiting for ${what}`);
}
const dialog = (): HTMLDialogElement | null => document.querySelector('dialog.clear-dialog');

test('dropping a backup zip opens the Import dialog; Import merges, deletes nothing and opens Projects', async () => {
  const phone = makeHost({
    profile: { firstname: 'Grace' },
    sessions: { p1: { tool: 'filter', v: 9 } },
    assets: ['user/phone-photo'],
  });
  location.hash = '#/';
  const done = openDropChooser([await backupZip()], phone.host as never);
  await until(() => !!dialog(), 'the import dialog');
  const dlg = dialog()!;
  assert.match(dlg.querySelector('h3')!.textContent ?? '', /^Import data\?$/, 'the backup wording, as Import data… shows');
  assert.match(dlg.textContent ?? '', /deletes nothing/);
  assert.equal(document.querySelector('[data-dialog-tag="drop-chooser"]'), null, 'no "What should Lolly do" chooser');
  assert.doesNotMatch(document.body.textContent ?? '', /What should Lolly do|Unpack archive/);
  dlg.querySelector<HTMLButtonElement>('[data-scope="import"]')!.click();
  await done;
  assert.deepEqual([...phone.sessions.keys()].sort(), ['a1', 'a2', 'p1'], 'the backup’s sessions are added, the phone’s own stays');
  assert.deepEqual(phone.assets.map((a) => a.id).sort(), ['user/laptop-logo', 'user/phone-photo']);
  assert.equal(phone.profile.firstname, 'Grace', 'this device’s details stay');
  assert.equal(phone.profile.city, 'London', 'an empty detail is filled from the backup');
  assert.equal(location.hash, '#/p', 'Projects opens after the import');
});

test('dropping an ordinary zip opens the usual chooser with Unpack first, and no Import dialog', async () => {
  const host = makeHost();
  const done = openDropChooser([plainZip()], host.host as never);
  const chooser = (): HTMLElement | null => document.querySelector<HTMLElement>('[data-dialog-tag="drop-chooser"]');
  await until(() => !!chooser(), 'the drop chooser');
  assert.match(chooser()!.textContent ?? '', /What should Lolly do with this file\?/);
  const first = chooser()!.querySelector('[data-choice]');
  assert.equal(first?.getAttribute('data-choice'), 'unpack', 'Unpack leads');
  assert.match(first?.textContent ?? '', /Unpack archive to your library/);
  assert.equal(dialog(), null, 'no Import dialog');
  chooser()!.querySelector<HTMLElement>('[data-act="cancel"]')!.click();
  await done;
  assert.equal(host.sessions.size, 0, 'nothing was imported');
});
