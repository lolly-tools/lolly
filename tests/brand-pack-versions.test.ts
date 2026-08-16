// SPDX-License-Identifier: MPL-2.0
/**
 * Brand packs carry published design-system versions (plans/97 section 6a).
 *
 * A version is permanent and addressable, so moving one between devices is not a
 * copy - it is a merge with two rules that cannot be softened, and both are
 * pinned here:
 *
 *   1. **a slug already published locally is never overwritten.** Two teams' "v2"
 *      are different design systems; the incoming one is skipped and counted.
 *   2. **the pack's active version is adopted only when nothing is active here.**
 *      Loading someone's pack must not change what every tool on this device
 *      renders against.
 *
 * Plus the byte-identity rule the whole milestone is measured against: a pack from
 * a system that never published carries none of the new parts, and imports exactly
 * as it did before they existed.
 *
 * Run with: node --test tests/brand-pack-versions.test.ts
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unzipSync } from 'fflate';
import {
  exportBrandPack, importBrandPack,
} from '../shells/web/src/brand-transfer.ts';
import type { BrandTransferHost } from '../shells/web/src/brand-transfer.ts';
import { readVersionIndex, withVersionIndex } from '../engine/src/index.ts';
import type { VersionEntry } from '../engine/src/index.ts';

const HEAD_ID = 'user/tokens/brand';
const LOGO_ID = 'user/logo/horizontal-primary';
const FROZEN_ID = 'user/frozen/aabbccddeeff';

type Rec = { id: string; type: string; format?: string; blob?: Blob; version?: string; meta?: Record<string, unknown> };

function memoryHost(): BrandTransferHost & { store: Map<string, Rec> } {
  const store = new Map<string, Rec>();
  return {
    store,
    assets: {
      async _uploadUserAsset(record: Rec) { store.set(record.id, record); },
      async _deleteUserAsset(id: string) { store.delete(id); },
      async _exportUserAssets() { return [...store.values()]; },
      async _getBlob(id: string) { return store.get(id)?.blob ?? null; },
      async _findMetaByType() { return null; },
    } as unknown as BrandTransferHost['assets'],
    profile: { async get() { return { firstname: 'Bilbo' }; } },
  };
}

const memoryStorage = (seed: Record<string, string> = {}) => {
  const m = new Map(Object.entries(seed));
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => { m.set(k, v); },
  };
};

const tokensDoc = (primary: string): Record<string, unknown> => ({
  color: { semantic: { primary: { $type: 'color', $value: primary } } },
  asset: { logo: { primary: { $type: 'asset', $value: LOGO_ID } } },
});

const entry = (slug: string, over: Partial<VersionEntry> = {}): VersionEntry => ({
  slug,
  label: slug.toUpperCase(),
  date: `2026-0${slug === 'v1' ? 1 : 2}-01T00:00:00.000Z`,
  checksum: `checksum-${slug}`,
  ...over,
});

const json = (doc: unknown): Blob => new Blob([JSON.stringify(doc)], { type: 'application/json' });

async function put(host: BrandTransferHost, rec: Rec): Promise<void> {
  await host.assets._uploadUserAsset(rec as Parameters<BrandTransferHost['assets']['_uploadUserAsset']>[0]);
}

/** A device that published v1 (pinning the logo, whose bytes have since been
 *  replaced, so v1's copy is frozen) and then v2. */
async function publishedHost(): Promise<BrandTransferHost & { store: Map<string, Rec> }> {
  const host = memoryHost();
  const v1 = entry('v1', {
    assets: [{ id: LOGO_ID, version: '1.0.0', sha256: 'a'.repeat(64), frozenId: FROZEN_ID }],
  });
  const head = withVersionIndex(tokensDoc('#333333'), { versions: [v1, entry('v2')], active: 'v2' });
  await put(host, { id: HEAD_ID, type: 'tokens', format: 'json', blob: json(head) });
  await put(host, { id: `${HEAD_ID}/v1`, type: 'tokens', format: 'json', blob: json(tokensDoc('#111111')) });
  await put(host, { id: `${HEAD_ID}/v2`, type: 'tokens', format: 'json', blob: json(tokensDoc('#222222')) });
  await put(host, {
    id: LOGO_ID, type: 'vector', format: 'svg',
    blob: new Blob([new Uint8Array([9, 9])], { type: 'image/svg+xml' }),
    meta: { format: 'svg', variant: 'horizontal-primary', identity: 'default', kind: 'logo' },
  });
  await put(host, {
    id: FROZEN_ID, type: 'vector', format: 'svg',
    blob: new Blob([new Uint8Array([1, 2])], { type: 'image/svg+xml' }),
    version: '1.0.0',
    meta: { kind: 'frozen', originalId: LOGO_ID, sha256: 'a'.repeat(64) },
  });
  return host;
}

const ledgerOf = async (host: { store: Map<string, Rec> }): Promise<ReturnType<typeof readVersionIndex>> =>
  readVersionIndex(JSON.parse(await host.store.get(HEAD_ID)!.blob!.text()));

test('export → import round-trip carries versions and their preserved files', async () => {
  const src = await publishedHost();
  const { blob, summary } = await exportBrandPack({ host: src, storage: memoryStorage() });
  assert.equal(summary.versions, 2);
  assert.equal(summary.frozen, 1);

  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  assert.ok(files['versions.json'], 'the ledger travels');
  assert.ok(files['versions/v1.json'] && files['versions/v2.json'], 'each version ships its own payload');
  assert.ok(files['frozen.json'] && files['frozen/aabbccddeeff.svg'], 'pinned bytes travel with the version that pins them');
  // A version never carries a ledger: the list belongs to the head.
  assert.equal(readVersionIndex(JSON.parse(new TextDecoder().decode(files['versions/v1.json']!))).versions.length, 0);

  const dst = memoryHost();
  const imported = await importBrandPack({ host: dst, storage: memoryStorage() }, await blob.arrayBuffer());
  assert.equal(imported.versions, 2);
  assert.equal(imported.frozen, 1);
  assert.equal(imported.versionsSkipped, 0);
  assert.equal(imported.skipped, 0, 'versions/ and frozen/ are known parts');

  const v1 = JSON.parse(await dst.store.get(`${HEAD_ID}/v1`)!.blob!.text());
  assert.equal(v1.color.semantic.primary.$value, '#111111');
  assert.deepEqual(
    new Uint8Array(await dst.store.get(FROZEN_ID)!.blob!.arrayBuffer()),
    new Uint8Array([1, 2]),
    'the preserved bytes arrive byte for byte, or the version they pin is a lie',
  );
  const ledger = await ledgerOf(dst);
  assert.deepEqual(ledger.versions.map(v => v.slug), ['v1', 'v2']);
  assert.equal(ledger.versions[0]!.assets?.[0]?.frozenId, FROZEN_ID, 'the pin still points at the preserved copy');
  assert.equal(ledger.active, 'v2', 'nothing was active here, so the pack’s choice stands');
});

test('a slug already published here is kept, not overwritten', async () => {
  const src = await publishedHost();
  const { blob } = await exportBrandPack({ host: src, storage: memoryStorage() });

  // The receiver published its OWN v1 - a different design system under the same
  // name. A published version is permanent, so it must survive the import.
  const dst = memoryHost();
  await put(dst, {
    id: HEAD_ID, type: 'tokens', format: 'json',
    blob: json(withVersionIndex(tokensDoc('#999999'), { versions: [entry('v1')], active: null })),
  });
  await put(dst, { id: `${HEAD_ID}/v1`, type: 'tokens', format: 'json', blob: json(tokensDoc('#abcdef')) });

  const imported = await importBrandPack({ host: dst, storage: memoryStorage() }, await blob.arrayBuffer());
  assert.equal(imported.versionsSkipped, 1);
  assert.equal(imported.versions, 1, 'v2 was new, so it landed');

  const mine = JSON.parse(await dst.store.get(`${HEAD_ID}/v1`)!.blob!.text());
  assert.equal(mine.color.semantic.primary.$value, '#abcdef', 'my v1 is still my v1');
  const ledger = await ledgerOf(dst);
  assert.deepEqual(ledger.versions.map(v => v.slug), ['v1', 'v2']);
  assert.equal(ledger.versions[0]!.label, 'V1');
  assert.equal(ledger.versions[0]!.checksum, 'checksum-v1', 'the LOCAL entry survives, not the pack’s');
});

test('the pack’s active version never overrides one that is already active', async () => {
  const src = await publishedHost(); // active: 'v2'
  const { blob } = await exportBrandPack({ host: src, storage: memoryStorage() });

  const dst = memoryHost();
  await put(dst, {
    id: HEAD_ID, type: 'tokens', format: 'json',
    blob: json(withVersionIndex(tokensDoc('#999999'), { versions: [entry('mine')], active: 'mine' })),
  });
  await put(dst, { id: `${HEAD_ID}/mine`, type: 'tokens', format: 'json', blob: json(tokensDoc('#abcdef')) });

  await importBrandPack({ host: dst, storage: memoryStorage() }, await blob.arrayBuffer());
  const ledger = await ledgerOf(dst);
  assert.equal(ledger.active, 'mine', 'what this device renders against is this device’s decision');
  assert.deepEqual(ledger.versions.map(v => v.slug).sort(), ['mine', 'v1', 'v2']);
});

test('byte identity: a pack from a system that never published gains no new parts', async () => {
  const plain = memoryHost();
  await put(plain, { id: HEAD_ID, type: 'tokens', format: 'json', blob: json(tokensDoc('#444444')) });

  const { blob, summary } = await exportBrandPack({ host: plain, storage: memoryStorage() });
  assert.equal(summary.versions, 0);
  assert.equal(summary.frozen, 0);
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  for (const part of Object.keys(files)) {
    assert.ok(!part.startsWith('versions'), `${part} should not be in an unversioned pack`);
    assert.ok(!part.startsWith('frozen'), `${part} should not be in an unversioned pack`);
  }

  const dst = memoryHost();
  const imported = await importBrandPack({ host: dst, storage: memoryStorage() }, await blob.arrayBuffer());
  assert.equal(imported.versions, 0);
  assert.equal(imported.versionsSkipped, 0);
  assert.equal(imported.skipped, 0);
  // The document lands verbatim - no ledger key appears where there was none.
  assert.deepEqual(JSON.parse(await dst.store.get(HEAD_ID)!.blob!.text()), tokensDoc('#444444'));
});

test('a pin whose preserved bytes did not travel falls back to the live asset', async () => {
  const src = await publishedHost();
  // The preserved copy is gone from the source device, so the pack cannot carry
  // it - but the ledger still names it.
  src.store.delete(FROZEN_ID);
  const { blob, summary } = await exportBrandPack({ host: src, storage: memoryStorage() });
  assert.equal(summary.frozen, 0);

  const dst = memoryHost();
  await importBrandPack({ host: dst, storage: memoryStorage() }, await blob.arrayBuffer());
  const ledger = await ledgerOf(dst);
  const pin = ledger.versions.find(v => v.slug === 'v1')!.assets![0]!;
  assert.equal(pin.id, LOGO_ID, 'the pin itself survives — it still records what v1 published with');
  assert.ok(!('frozenId' in pin), 'a reference to bytes nobody has is repaired away, not carried');
});

test('a pack with no versions.json still imports the versions its document lists', async () => {
  const src = await publishedHost();
  const { blob } = await exportBrandPack({ host: src, storage: memoryStorage() });
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']!));
  delete manifest.integrity; // dropping a part invalidates the map
  delete files['versions.json'];
  files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));

  const { zipSync } = await import('fflate');
  const dst = memoryHost();
  const imported = await importBrandPack({ host: dst, storage: memoryStorage() }, zipSync(files));
  // The head document carries the same list, so the payloads sitting in
  // versions/ are not silently left behind.
  assert.equal(imported.versions, 2);
});

test('a pack with version payloads but NO tokens.json still records them in a ledger', async () => {
  // `readPackLedger` already anticipates a pack whose ledger part is missing, so
  // the reverse - payloads present, head document absent - is reachable too. It
  // used to install the version assets, count them in the summary, and then never
  // write the merged ledger, leaving orphans nothing on the device lists.
  const src = await publishedHost();
  const { blob } = await exportBrandPack({ host: src, storage: memoryStorage() });
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']!));
  delete manifest.integrity;             // dropping a part invalidates the map
  delete files['tokens.json'];
  files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
  const { zipSync } = await import('fflate');
  const bytes = zipSync(files);

  // The receiver has a design system of its own for the ledger to live on.
  const dst = memoryHost();
  await put(dst, { id: HEAD_ID, type: 'tokens', format: 'json', blob: json(tokensDoc('#999999')) });
  const imported = await importBrandPack({ host: dst, storage: memoryStorage() }, bytes);
  assert.equal(imported.versions, 2);
  assert.equal(imported.tokens, false, 'there was no document to install');
  const ledger = await ledgerOf(dst);
  assert.deepEqual(ledger.versions.map(v => v.slug), ['v1', 'v2'],
    'the versions that landed are listed, or nothing on this device can reach them');
  assert.equal(ledger.active, 'v2');
  assert.deepEqual(
    JSON.parse(await dst.store.get(HEAD_ID)!.blob!.text()).color,
    tokensDoc('#999999').color,
    'and the local document itself is otherwise untouched',
  );
});

test('…and with no design system on either side, orphan versions are reported, not claimed', async () => {
  const src = await publishedHost();
  const { blob } = await exportBrandPack({ host: src, storage: memoryStorage() });
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  const manifest = JSON.parse(new TextDecoder().decode(files['manifest.json']!));
  delete manifest.integrity;
  delete files['tokens.json'];
  files['manifest.json'] = new TextEncoder().encode(JSON.stringify(manifest));
  const { zipSync } = await import('fflate');

  const dst = memoryHost();
  const imported = await importBrandPack({ host: dst, storage: memoryStorage() }, zipSync(files));
  assert.equal(imported.versions, 0, 'a summary must not claim versions no ledger lists');
  assert.equal(imported.versionsSkipped, 2);
});
