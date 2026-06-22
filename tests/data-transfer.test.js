/**
 * Portable user-data bundle — export on one install, import on another.
 *
 * The module reads/writes everything through the capability bridge (`host`), so the
 * whole round-trip runs headlessly here against an in-memory bridge: seed a "source
 * device", export to a zip Blob, then import into a fresh "target device" and assert
 * everything came back byte-for-byte — profile, sessions (incl. data-URL thumbnails),
 * the uploaded image blobs + their MIME, and the prefs — while the re-syncable
 * catalog cache is left behind.
 *
 * Because the bridge is the only seam, this same module produces a byte-identical
 * package on the web PWA (IndexedDB) and the Tauri shells (filesystem) — only the
 * bridge implementation behind `host.state` differs.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { exportBackup, importBackup, BACKUP_FORMAT } from '../shells/web/src/data-transfer.js';

// Crack a bundle Blob open to its flat path→bytes map (to inspect or tamper with a
// part), and re-seal a mutated map back into the raw bytes importBackup accepts.
async function bundleFiles(blob) {
  return unzipSync(new Uint8Array(await blob.arrayBuffer()));
}
function reseal(files) {
  return new Uint8Array(zipSync(files));
}

// Minimal in-memory stand-in for the capability bridge. Mirrors the real method
// shapes: state.save re-derives toolId/label from data.__* and stamps updatedAt;
// state.list returns metadata + thumbnail; assets export/import carry the Blob.
function makeHost() {
  const profileBox = { value: null };
  const sessions = new Map();   // slot → full record
  const assets = new Map();     // id → record (with Blob)
  return {
    _peek: { profileBox, sessions, assets },
    profile: {
      async get() { return profileBox.value ?? {}; },
      async set(p) { profileBox.value = p; },
      bust() {},
    },
    state: {
      async list() {
        return [...sessions.values()].map(r => ({
          slot: r.slot, toolId: r.toolId, toolVersion: r.toolVersion,
          label: r.label, thumb: r.thumb ?? null, updatedAt: r.updatedAt,
        }));
      },
      async load(slot) { return sessions.get(slot)?.data ?? null; },
      async save(slot, data, thumb = null) {
        sessions.set(slot, {
          slot, toolId: data.__toolId, toolVersion: data.__toolVersion, label: data.__label,
          data, thumb, updatedAt: new Date().toISOString(),
        });
      },
    },
    assets: {
      async _exportUserAssets() { return [...assets.values()]; },
      async _importUserAsset(rec) { assets.set(rec.id, rec); },
    },
  };
}

function makeStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
  };
}

async function seedSource() {
  const host = makeHost();
  await host.profile.set({
    firstname: 'Ada', lastname: 'Lovelace', email: 'ada@analytical.engine', useDetails: true,
    headshot: { source: 'user', id: 'user/headshot', format: 'webp', version: '123' },
    flags: { 'cat-designer': false },
  });

  await host.state.save(
    'my-qr',
    { url: 'https://suse.com', __toolId: 'qr-code', __toolVersion: '1.0.0', __label: 'Conference QR' },
    'data:image/png;base64,iVBORw0KGgoAAAA',
  );
  await host.state.save(
    'chart-1',
    { title: 'Revenue', __toolId: 'chart-creator', __toolVersion: '2.0.0', __label: 'Q3' },
    null,
  );

  const headBytes = new Uint8Array([1, 2, 3, 4, 5]);
  const picBytes = new Uint8Array([255, 216, 255, 224]);
  await host.assets._importUserAsset({
    id: 'user/headshot', type: 'raster', format: 'webp', blob: new Blob([headBytes], { type: 'image/webp' }),
    width: 512, height: 512, version: '123', meta: { name: 'headshot.webp', tags: ['headshot'] },
  });
  await host.assets._importUserAsset({
    id: 'user/upload/1700-pic.jpg', type: 'raster', format: 'webp', blob: new Blob([picBytes], { type: 'image/webp' }),
    width: 100, height: 80, version: '1.0.0', meta: { name: 'pic.webp' },
  });

  const storage = makeStorage({
    theme: 'dark', sidebarWidth: '300', 'ct-metrics': '{"toolOpens":5,"filesRendered":12}',
    'sbt-tool-index': 'RESYNCABLE-CACHE', // catalog cache — must NOT travel
  });
  return { host, storage, headBytes, picBytes };
}

test('export → import reproduces all user data on a fresh device', async () => {
  const src = await seedSource();
  const { blob, summary } = await exportBackup({ host: src.host, storage: src.storage });

  assert.equal(summary.profile, true);
  assert.equal(summary.sessions, 2);
  assert.equal(summary.userAssets, 2);
  assert.ok(blob.size > 0);

  // Fresh, empty "other device".
  const dst = { host: makeHost(), storage: makeStorage() };
  const isum = await importBackup(dst, await blob.arrayBuffer());
  assert.deepEqual(isum, { profile: true, sessions: 2, userAssets: 2, prefs: 3, skipped: 0 });

  // Profile.
  const profile = await dst.host.profile.get();
  assert.equal(profile.firstname, 'Ada');
  assert.equal(profile.email, 'ada@analytical.engine');
  assert.equal(profile.headshot.id, 'user/headshot');
  assert.equal(profile.flags['cat-designer'], false);

  // Sessions — including the data-URL thumbnail and the null-thumb case.
  const qrList = (await dst.host.state.list()).find(s => s.slot === 'my-qr');
  assert.equal(qrList.label, 'Conference QR');
  assert.equal(qrList.thumb, 'data:image/png;base64,iVBORw0KGgoAAAA');
  assert.equal((await dst.host.state.load('my-qr')).url, 'https://suse.com');
  const chartList = (await dst.host.state.list()).find(s => s.slot === 'chart-1');
  assert.equal(chartList.thumb, null);

  // Uploaded images — blob bytes + MIME round-trip exactly.
  const restored = await dst.host.assets._exportUserAssets();
  const head = restored.find(a => a.id === 'user/headshot');
  assert.ok(head.blob instanceof Blob);
  assert.equal(head.blob.type, 'image/webp');
  assert.deepEqual([...new Uint8Array(await head.blob.arrayBuffer())], [...src.headBytes]);
  assert.equal(head.meta.name, 'headshot.webp');
  const pic = restored.find(a => a.id === 'user/upload/1700-pic.jpg');
  assert.deepEqual([...new Uint8Array(await pic.blob.arrayBuffer())], [...src.picBytes]);

  // Prefs travel; the catalog cache does not.
  assert.equal(dst.storage.getItem('theme'), 'dark');
  assert.equal(dst.storage.getItem('sidebarWidth'), '300');
  assert.equal(dst.storage.getItem('ct-metrics'), '{"toolOpens":5,"filesRendered":12}');
  assert.equal(dst.storage.getItem('sbt-tool-index'), null);
});

test('backup filename is named for the profile, with a per-day sequence', async () => {
  const src = await seedSource(); // profile: Ada Lovelace
  const today = new Date().toISOString().slice(0, 10);

  const first = await exportBackup({ host: src.host, storage: src.storage });
  assert.equal(first.filename, `LollyTools-Ada-Lovelace-${today}-1.zip`);

  // Same day, same device → the counter increments so repeat exports don't collide.
  const second = await exportBackup({ host: src.host, storage: src.storage });
  assert.equal(second.filename, `LollyTools-Ada-Lovelace-${today}-2.zip`);
});

test('backup filename omits absent name parts and sanitises the rest', async () => {
  const host = makeHost();
  const storage = makeStorage();
  const today = new Date().toISOString().slice(0, 10);

  // No profile at all → just the app prefix, date and sequence.
  assert.equal((await exportBackup({ host, storage })).filename, `LollyTools-${today}-1.zip`);

  // First name only, with stray spaces/punctuation stripped to a safe token.
  await host.profile.set({ firstname: ' Bil bo! ' });
  assert.equal((await exportBackup({ host, storage })).filename, `LollyTools-Bilbo-${today}-2.zip`);
});

test('import merges without wiping unrelated existing data', async () => {
  const src = await seedSource();
  const { blob } = await exportBackup({ host: src.host, storage: src.storage });

  // Target already has its own session + a colliding slot.
  const dst = { host: makeHost(), storage: makeStorage() };
  await dst.host.state.save('local-only', { keep: true, __toolId: 'meeting-planner' }, null);
  await dst.host.state.save('my-qr', { url: 'OLD', __toolId: 'qr-code', __label: 'stale' }, null);

  await importBackup(dst, await blob.arrayBuffer());

  const all = await dst.host.state.list();
  assert.equal(all.length, 3); // local-only + my-qr + chart-1
  assert.equal((await dst.host.state.load('local-only')).keep, true); // untouched
  assert.equal((await dst.host.state.load('my-qr')).url, 'https://suse.com'); // overwritten
});

test('rejects files that are not Lolly backups', async () => {
  const dst = { host: makeHost(), storage: makeStorage() };
  await assert.rejects(
    () => importBackup(dst, new Uint8Array([1, 2, 3, 4, 5])),
    /valid backup/i,
  );
});

test('manifest declares the stable format id, reader version, and per-part integrity', async () => {
  const src = await seedSource();
  const { blob } = await exportBackup({ host: src.host, storage: src.storage });
  const files = await bundleFiles(blob);
  const manifest = JSON.parse(strFromU8(files['manifest.json']));

  assert.equal(manifest.format, 'lolly-backup');
  assert.equal(BACKUP_FORMAT, 'lolly-backup');
  assert.equal(manifest.minReader, 1); // forward-compat gate readers check

  // Every non-manifest part is covered by an SHA-256; the manifest never self-refs.
  assert.ok(manifest.integrity['profile.json'].startsWith('sha256-'));
  assert.ok(manifest.integrity['sessions.json'].startsWith('sha256-'));
  assert.ok(Object.keys(manifest.integrity).some(k => k.startsWith('assets/blobs/')));
  assert.ok(!('manifest.json' in manifest.integrity));
});

test('rejects a bundle whose contents were tampered with after signing', async () => {
  const src = await seedSource();
  const { blob } = await exportBackup({ host: src.host, storage: src.storage });
  const files = await bundleFiles(blob);
  // Swap the profile bytes; the manifest's recorded SHA-256 no longer matches.
  files['profile.json'] = strToU8(JSON.stringify({ firstname: 'Mallory' }));
  await assert.rejects(
    () => importBackup({ host: makeHost(), storage: makeStorage() }, reseal(files)),
    /integrity|corrupt/i,
  );
});

test('rejects a bundle missing a part the manifest vouches for', async () => {
  const src = await seedSource();
  const { blob } = await exportBackup({ host: src.host, storage: src.storage });
  const files = await bundleFiles(blob);
  const blobPart = Object.keys(files).find(p => p.startsWith('assets/blobs/'));
  delete files[blobPart];
  await assert.rejects(
    () => importBackup({ host: makeHost(), storage: makeStorage() }, reseal(files)),
    /incomplete|missing/i,
  );
});

test('imports a forward-compatible bundle, skipping parts it does not understand', async () => {
  const src = await seedSource();
  const { blob } = await exportBackup({ host: src.host, storage: src.storage });
  const files = await bundleFiles(blob);

  // A newer writer bumped the layout (formatVersion) but kept the change additive
  // (minReader stays 1) and shipped a part this build has never heard of.
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  manifest.formatVersion = 99;
  manifest.minReader = 1;
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  files['tokens.json'] = strToU8(JSON.stringify({ color: { brand: { $value: '#30ba78' } } }));

  const dst = { host: makeHost(), storage: makeStorage() };
  const isum = await importBackup(dst, reseal(files));

  assert.equal(isum.profile, true);   // known parts still restored
  assert.equal(isum.sessions, 2);
  assert.equal(isum.skipped, 1);      // tokens.json left for a future build
  assert.equal((await dst.host.profile.get()).firstname, 'Ada');
});

test('refuses a bundle that requires a newer reader', async () => {
  const src = await seedSource();
  const { blob } = await exportBackup({ host: src.host, storage: src.storage });
  const files = await bundleFiles(blob);
  const manifest = JSON.parse(strFromU8(files['manifest.json']));
  manifest.minReader = 999; // a breaking format this build can't safely read
  files['manifest.json'] = strToU8(JSON.stringify(manifest));
  await assert.rejects(
    () => importBackup({ host: makeHost(), storage: makeStorage() }, reseal(files)),
    /newer version/i,
  );
});
