// SPDX-License-Identifier: MPL-2.0
/**
 * plans/277 P13: a copy Sync wrote to the person's storage (`snapshot.lolly`,
 * `day-N.lolly`, `before-apply.lolly`) opens by hand and is imported the way a backup
 * is. Every copy here is made by the sync engine's own writer (`buildSnapshot`, the
 * bytes a push uploads), plain and encrypted, and read back through the engine's own
 * decoder (`openSnapshot`, via `importSnapshotFile`), so the test cannot drift from the
 * format Sync writes.
 *
 * Covered: a plain and an encrypted copy import and merge (nothing on the device is
 * removed); a wrong or missing passphrase is refused with nothing written; a damaged
 * copy fails cleanly with nothing written; a design .lolly is refused by this door and
 * keeps its own route; and the import dialog, in jsdom, asks for the passphrase in
 * place, keeps the dialog open after a wrong one, and imports after the right one.
 *
 * Run directly:  node --import ./tests/css-stub.mjs --test shells/web/src/lib/data-import.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { strToU8, zipSync } from 'fflate';

// jsdom before the dialog modules load: the import dialog is a native <dialog>, and
// jsdom has the element but neither showModal() nor close().
const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://lolly.tools/#/profile' });
const g = globalThis as unknown as Record<string, unknown>;
g.window = dom.window;
g.document = dom.window.document;
g.history = dom.window.history;
g.location = dom.window.location;
g.localStorage = dom.window.localStorage;
g.HTMLElement = dom.window.HTMLElement;
// The theme repaint dispatches a CustomEvent on window, which jsdom accepts only from its own realm.
g.Event = dom.window.Event;
g.CustomEvent = dom.window.CustomEvent;
g.requestAnimationFrame = (fn: () => void) => setTimeout(fn, 0);
const dialogProto = dom.window.HTMLDialogElement.prototype as unknown as Record<string, unknown>;
dialogProto.showModal = function showModal(this: { open: boolean }): void { this.open = true; };
dialogProto.close = function close(this: { open: boolean }): void { this.open = false; };

const { buildSnapshot, importSnapshotFile, openSnapshot, SnapshotPassphraseError } = await import('./sync-engine.ts');
const { isEncryptedSnapshot } = await import('./snapshot-crypto.ts');
const {
  describeDataImportFile, importDataFile, importDialogOptions, runDataImport, wrongPassphraseText,
} = await import('./data-import.ts');
// Open and Import data… hand the .lolly readers in (lib/data-import.ts, LollyReaders).
const intake = await import('./lolly-intake.ts');

// A minimal in-memory BackupHost + storage: the surface exportBackup and importBackup
// touch (profile, state list/load/save, user assets). Same shape as sync-engine.test.ts.
function makeHost(seed: {
  profile?: Record<string, unknown>;
  sessions?: Record<string, unknown>;
  assets?: string[];
} = {}) {
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
  /** Everything this device holds, for "nothing was written" comparisons. */
  const snapshot = () => JSON.stringify({
    profile,
    sessions: [...sessions.entries()].sort(([a], [b]) => a.localeCompare(b)),
    assets: assets.map((a) => a.id).sort(),
    store: [...store.entries()].sort(),
  });
  return { host, storage, profile, sessions, assets, snapshot };
}
const deps = (h: ReturnType<typeof makeHost>) => ({ host: h.host as never, storage: h.storage });

/** The laptop that pushed: its copy is what the phone downloads from the storage. */
const laptop = () => makeHost({
  profile: { firstname: 'Ada', city: 'London', favourites: ['chart'], folders: [{ id: 'f-laptop', name: 'Laptop folder', items: [{ kind: 'session', ref: 'a1' }] }] },
  sessions: { a1: { tool: 'chart', v: 1 }, a2: { tool: 'qr-code', v: 2 } },
  assets: ['user/laptop-logo'],
});
/** The phone the copy is imported onto: it already has work of its own. */
const phone = () => makeHost({
  profile: { firstname: 'Grace', favourites: ['qr-code'], folders: [{ id: 'f-phone', name: 'Phone folder', items: [{ kind: 'session', ref: 'p1' }] }] },
  sessions: { p1: { tool: 'filter', v: 9 } },
  assets: ['user/phone-photo'],
});

/** Assert the phone gained the laptop's copy and kept everything it had. */
function assertMerged(p: ReturnType<typeof makeHost>): void {
  assert.deepEqual([...p.sessions.keys()].sort(), ['a1', 'a2', 'p1'], 'the copy’s sessions are added, the phone’s own stays');
  assert.deepEqual(p.sessions.get('p1')!.data, { tool: 'filter', v: 9 });
  assert.deepEqual(p.assets.map((a) => a.id).sort(), ['user/laptop-logo', 'user/phone-photo']);
  assert.equal(p.profile.firstname, 'Grace', 'this device’s details stay');
  assert.equal(p.profile.city, 'London', 'an empty detail is filled from the copy');
  assert.deepEqual(p.profile.favourites, ['qr-code', 'chart'], 'favourites are a union, this device first');
  assert.deepEqual((p.profile.folders as Array<{ id: string }>).map((f) => f.id).sort(), ['f-laptop', 'f-phone']);
}

const lollyFile = (bytes: Uint8Array, name: string): File =>
  new File([bytes as BlobPart], name, { type: 'application/vnd.lolly+zip' });

test('the engine writer makes the copies these tests read: plain is a zip, encrypted is LSE1', async () => {
  const plain = (await buildSnapshot(deps(laptop()))).bytes;
  const locked = (await buildSnapshot(deps(laptop()), { passphrase: 'correct horse' })).bytes;
  assert.deepEqual([...plain.subarray(0, 2)], [0x50, 0x4b], 'a plain copy is the backup zip itself');
  assert.equal(isEncryptedSnapshot(locked), true);
  // The one decoder: plain bytes pass through unchanged, encrypted ones open with the passphrase.
  assert.equal(await openSnapshot(plain), plain);
  assert.deepEqual([...(await openSnapshot(locked, 'correct horse')).subarray(0, 2)], [0x50, 0x4b]);
});

test('a plain sync copy imports like a backup: it adds and merges, and deletes nothing', async () => {
  const copy = (await buildSnapshot(deps(laptop()))).bytes;
  const p = phone();
  const summary = await importSnapshotFile(deps(p), copy);
  assert.equal(summary.sessions, 2);
  assert.equal(summary.userAssets, 1);
  assert.equal(summary.removed, undefined, 'a hand import never runs the sync removal step');
  assertMerged(p);
  // A second import of the same copy changes nothing further.
  const after = p.snapshot();
  await importSnapshotFile(deps(p), copy);
  assert.equal(p.snapshot(), after);
});

test('an encrypted sync copy imports with the sync passphrase and merges the same way', async () => {
  const copy = (await buildSnapshot(deps(laptop()), { passphrase: 'correct horse' })).bytes;
  const p = phone();
  await importSnapshotFile(deps(p), copy, { passphrase: 'correct horse' });
  assertMerged(p);
});

test('a wrong or missing passphrase is refused and nothing is written', async () => {
  const copy = (await buildSnapshot(deps(laptop()), { passphrase: 'correct horse' })).bytes;
  const p = phone();
  const before = p.snapshot();
  await assert.rejects(importSnapshotFile(deps(p), copy, { passphrase: 'wrong horse' }),
    (err: unknown) => err instanceof SnapshotPassphraseError && err.reason === 'wrong');
  await assert.rejects(importSnapshotFile(deps(p), copy, {}),
    (err: unknown) => err instanceof SnapshotPassphraseError && err.reason === 'missing');
  assert.equal(p.snapshot(), before, 'the phone is untouched');
  // Through the door the person uses, the reason is plain words the dialog shows as given.
  const source = await describeDataImportFile(lollyFile(copy, 'snapshot.lolly'), intake);
  await assert.rejects(importDataFile(deps(p), lollyFile(copy, 'snapshot.lolly'), source, 'wrong horse'),
    { message: wrongPassphraseText() });
  await assert.rejects(importDataFile(deps(p), lollyFile(copy, 'snapshot.lolly'), source, ''),
    /Enter your sync passphrase/);
  assert.equal(p.snapshot(), before);
});

test('a damaged copy fails cleanly and writes nothing', async () => {
  const plain = (await buildSnapshot(deps(laptop()))).bytes;
  const locked = (await buildSnapshot(deps(laptop()), { passphrase: 'correct horse' })).bytes;
  const p = phone();
  const before = p.snapshot();

  // Cut short in transit: the zip can no longer be read.
  await assert.rejects(importSnapshotFile(deps(p), plain.slice(0, Math.floor(plain.length / 2))), Error);
  // Not a Lolly file at all.
  await assert.rejects(importSnapshotFile(deps(p), strToU8('hello, this is not a backup')), /valid backup|couldn’t be unzipped|couldn't be unzipped/);
  // One byte of the ciphertext flipped: AES-GCM refuses the copy, reported as a wrong
  // passphrase because the two cannot be told apart.
  const flipped = locked.slice();
  flipped[flipped.length - 20]! ^= 0xff;
  await assert.rejects(importSnapshotFile(deps(p), flipped, { passphrase: 'correct horse' }),
    (err: unknown) => err instanceof SnapshotPassphraseError && err.reason === 'wrong');
  assert.equal(p.snapshot(), before, 'the phone is untouched after every failure');

  // Through the door: a damaged .lolly is refused before any bytes are imported.
  const cut = lollyFile(plain.slice(0, 40), 'day-3.lolly');
  const source = await describeDataImportFile(cut, intake);
  assert.ok(source.refusal, 'a copy whose manifest cannot be read is refused');
  await assert.rejects(importDataFile(deps(p), cut, source), { message: source.refusal! });
  assert.equal(p.snapshot(), before);
});

test('a design .lolly is not a copy of anyone’s data: this door refuses it and writes nothing', async () => {
  const design = zipSync({
    'manifest.json': strToU8(JSON.stringify({ format: 'lolly-share', kind: 'session', counts: { assets: 0 }, tool: { id: 'chart' } })),
    'session.json': strToU8('{}'),
  });
  const p = phone();
  const before = p.snapshot();
  await assert.rejects(importSnapshotFile(deps(p), design), /doesn't look like a Lolly data backup/);
  const file = lollyFile(design, 'poster.lolly');
  const source = await describeDataImportFile(file, intake);
  assert.match(source.refusal ?? '', /shared design or design system, not a copy of your data/);
  assert.deepEqual(importDialogOptions(file, source, intake), {}, 'a refused file gets the plain dialog, never the sync-copy wording');
  await assert.rejects(importDataFile(deps(p), file, source), /not a copy of your data/);
  assert.equal(p.snapshot(), before);
});

test('Import data… reads what each file is: backup zip, plain copy, encrypted copy', async () => {
  const { blob } = await (await import('../data-transfer.ts')).exportBackup(deps(laptop()));
  const zip = new File([await blob.arrayBuffer()], 'LollyTools-Ada-2026-09-27-1.zip', { type: 'application/zip' });
  assert.deepEqual(await describeDataImportFile(zip, intake), { kind: 'backup', encrypted: false, exportedAt: null, refusal: null });
  assert.deepEqual(importDialogOptions(zip, await describeDataImportFile(zip, intake), intake), {}, 'a backup keeps the backup wording');

  const plain = lollyFile((await buildSnapshot(deps(laptop()))).bytes, 'lolly-sync.lolly');
  const plainSource = await describeDataImportFile(plain, intake);
  assert.equal(plainSource.kind, 'sync-copy');
  assert.equal(plainSource.encrypted, false);
  assert.ok(plainSource.exportedAt && !Number.isNaN(Date.parse(plainSource.exportedAt)), 'the manifest’s date is read');
  const plainOpts = importDialogOptions(plain, plainSource, intake);
  assert.equal(plainOpts.kind, 'sync-copy');
  assert.equal(plainOpts.passphrase, false);
  assert.match(plainOpts.lead ?? '', /“lolly-sync\.lolly” \(.+\) is a copy of your Lolly data that Sync saved on /);

  // Encrypted, and with its extension lost on the way: the LSE1 header alone is enough.
  const locked = new File([(await buildSnapshot(deps(laptop()), { passphrase: 'pw' })).bytes as BlobPart], 'before-apply', { type: 'application/octet-stream' });
  const lockedSource = await describeDataImportFile(locked, intake);
  assert.deepEqual(lockedSource, { kind: 'sync-copy', encrypted: true, exportedAt: null, refusal: null });
  const lockedOpts = importDialogOptions(locked, lockedSource, intake);
  assert.equal(lockedOpts.passphrase, true);
  assert.match(lockedOpts.lead ?? '', /encrypted: enter your sync passphrase/);

  // The backup .zip still imports through the same call, unchanged.
  const p = phone();
  await importDataFile(deps(p), zip, await describeDataImportFile(zip, intake));
  assertMerged(p);
});

test('the lolly.txt inside a backup and a Sync copy points at Settings → Storage', async () => {
  const { unzipSync, strFromU8 } = await import('fflate');
  const { blob } = await (await import('../data-transfer.ts')).exportBackup(deps(laptop()));
  for (const bytes of [new Uint8Array(await blob.arrayBuffer()), (await buildSnapshot(deps(laptop()))).bytes]) {
    const readme = strFromU8(unzipSync(bytes)['lolly.txt']!);
    assert.match(readme, /Settings → Storage → “Import data…”/);
    assert.doesNotMatch(readme, /Profile → Storage/);
    assert.match(readme, /choose this file/, 'a Sync copy is a .lolly, so the readme no longer says .zip');
  }
});

// ── The dialog, as both doors show it ─────────────────────────────────────────────

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));
async function until(check: () => boolean, what: string): Promise<void> {
  for (let i = 0; i < 400; i++) { if (check()) return; await settle(); }
  assert.fail(`timed out waiting for ${what}`);
}
const dialog = (): HTMLDialogElement | null => document.querySelector('dialog.clear-dialog');

test('the dialog asks for the passphrase in place, keeps the dialog open after a wrong one, then imports', async () => {
  const copy = (await buildSnapshot(deps(laptop()), { passphrase: 'correct horse' })).bytes;
  const p = phone();
  const before = p.snapshot();
  let afterImportRan = 0;
  const done = runDataImport(lollyFile(copy, 'snapshot.lolly'), p.host, intake, { afterImport: () => { afterImportRan++; } });

  await until(() => !!dialog(), 'the import dialog');
  const dlg = dialog()!;
  assert.match(dlg.querySelector('h3')!.textContent ?? '', /Import this sync copy\?/);
  assert.match(dlg.textContent ?? '', /deletes nothing/);
  assert.match(dlg.textContent ?? '', /Nothing is uploaded/);
  const field = dlg.querySelector<HTMLInputElement>('input.import-passphrase');
  assert.ok(field, 'an encrypted copy shows the passphrase field');
  assert.equal(field!.type, 'password');
  assert.equal(document.activeElement, field, 'the field has focus first');

  // A wrong passphrase: the reason shows in place, the dialog stays, nothing is written.
  field!.value = 'wrong horse';
  field!.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  const error = dlg.querySelector<HTMLElement>('.import-error')!;
  await until(() => !error.hidden, 'the wrong-passphrase message');
  assert.equal(error.textContent, wrongPassphraseText());
  assert.equal(error.getAttribute('role'), 'alert');
  assert.equal(dlg.isConnected, true, 'the dialog stays open for another try');
  assert.equal(field!.disabled, false);
  assert.equal(document.activeElement, field, 'focus is back in the field');
  assert.equal(p.snapshot(), before, 'nothing was written');
  assert.equal(afterImportRan, 0);

  // The right one: the copy is imported and the dialog closes.
  field!.value = 'correct horse';
  dlg.querySelector<HTMLButtonElement>('[data-scope="import"]')!.click();
  const summary = await done;
  assert.ok(summary, 'runDataImport resolves the summary');
  assert.equal(summary!.sessions, 2);
  assert.equal(afterImportRan, 1);
  assert.equal(dialog(), null, 'the dialog is gone');
  assertMerged(p);
});

test('Cancel closes the dialog, imports nothing and resolves null', async () => {
  const copy = (await buildSnapshot(deps(laptop()), { passphrase: 'correct horse' })).bytes;
  const p = phone();
  const before = p.snapshot();
  const done = runDataImport(lollyFile(copy, 'day-2.lolly'), p.host, intake);
  await until(() => !!dialog(), 'the import dialog');
  dialog()!.querySelector<HTMLButtonElement>('[data-scope="cancel"]')!.click();
  assert.equal(await done, null);
  assert.equal(dialog(), null);
  assert.equal(p.snapshot(), before);
});

test('a plain copy shows no passphrase field and imports on Import', async () => {
  const copy = (await buildSnapshot(deps(laptop()))).bytes;
  const p = phone();
  const done = runDataImport(lollyFile(copy, 'day-5.lolly'), p.host, intake);
  await until(() => !!dialog(), 'the import dialog');
  const dlg = dialog()!;
  assert.equal(dlg.querySelector('input.import-passphrase'), null);
  assert.equal(document.activeElement, dlg.querySelector('[data-scope="import"]'), 'Import has focus');
  dlg.querySelector<HTMLButtonElement>('[data-scope="import"]')!.click();
  assert.ok(await done);
  assertMerged(p);
});
