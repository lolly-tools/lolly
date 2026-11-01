// SPDX-License-Identifier: MPL-2.0
/**
 * Which separation a web print export uses (lib/cmyk-separation.ts).
 *
 * The rule: the user's own profile when the Colour profile control picks one,
 * the bundled FOGRA39-fitted profile when the press condition resolves to Coated
 * FOGRA39 (the default), and the device formula otherwise. The refusals matter
 * as much as the routes: an own profile that cannot drive a separation must not
 * quietly become FOGRA39, and a failed download must not stick.
 *
 * DOM-free. The bundled bytes come from disk through a stand-in fetch.
 * Run directly:  node --test shells/web/src/lib/cmyk-separation.test.ts
 */
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { pressProfileBytes } from '../../../../tests/helpers/icc-fixture.ts';
import { ingestProfile, isIngestFailure, _resetProfileCache } from './color-profiles.ts';
import type { ColorProfilesHost, ProfileEntry } from './color-profiles.ts';
import { _resetEmbedCache } from './press-profile-embed.ts';
import { separationForExport, separationLogLine, bundledSeparation, _resetBundledSeparation } from './cmyk-separation.ts';

const BUNDLED = new Uint8Array(readFileSync(new URL('../../../../packages/node-shell/icc/craft-coated-fogra39.icc', import.meta.url)));

/** A fetch that serves the bundled profile, and records what it was asked for. */
function diskFetch(status = 200, body: Uint8Array = BUNDLED): typeof fetch & { urls: string[] } {
  const urls: string[] = [];
  const f = (async (input: RequestInfo | URL) => {
    urls.push(String(input));
    return new Response(status === 200 ? (body as unknown as BodyInit) : null, { status });
  }) as typeof fetch & { urls: string[] };
  f.urls = urls;
  return f;
}

interface Stored { id: string; type: string; format: string; blob: Blob; meta?: Record<string, unknown> }
function fakeHost(): ColorProfilesHost {
  const store = new Map<string, Stored>();
  return {
    assets: {
      async _uploadUserAsset(rec) { store.set(rec.id, rec as Stored); },
      async _deleteUserAsset(id) { store.delete(id); },
      async _listUserAssets() { return [...store.values()].map(r => ({ id: r.id, type: r.type, meta: r.meta })); },
      async _getBlob(id) { return store.get(id)?.blob ?? null; },
    },
  };
}
async function add(host: ColorProfilesHost, bytes: Uint8Array, name: string): Promise<ProfileEntry> {
  const r = await ingestProfile(host, new File([bytes as unknown as BlobPart], name, { type: 'application/vnd.iccprofile' }), {});
  assert.ok(!isIngestFailure(r), `fixture must ingest: ${JSON.stringify(r)}`);
  return r as ProfileEntry;
}

beforeEach(() => { _resetBundledSeparation(); _resetProfileCache(); _resetEmbedCache(); });

test('Coated FOGRA39, the default and an opted-out value all use the bundled profile', async () => {
  for (const value of ['fogra39', undefined, 'srgb', 'none', 'not-a-condition']) {
    _resetBundledSeparation();
    const f = diskFetch();
    const r = await separationForExport(value, null, f);
    assert.equal(r.source, 'bundled', `value ${String(value)}`);
    assert.equal(r.sep.profile, 'Coated FOGRA39 (fitted, craft-cms)');
    assert.equal(f.urls.length, 1);
    assert.match(f.urls[0]!, /packages\/node-shell\/icc\/craft-coated-fogra39\.icc$/);
  }
});

test('the bundled profile is fetched once and reused', async () => {
  const f = diskFetch();
  await separationForExport('fogra39', null, f);
  await separationForExport('fogra39', null, f);
  assert.equal(f.urls.length, 1);
});

test('a condition with no shippable profile keeps the device formula, and says why', async () => {
  for (const value of ['fogra51', 'swop', 'gracol']) {
    const r = await separationForExport(value, null, diskFetch());
    assert.equal(r.source, 'device', value);
    assert.equal(r.why, 'no-profile');
    assert.match(separationLogLine(r), /device formula, because no profile is loaded for this press condition/);
  }
});

test('a failed download falls back to the formula and is retried next time', async () => {
  const failed = await separationForExport('fogra39', null, diskFetch(404));
  assert.equal(failed.source, 'device');
  assert.equal(failed.why, 'bundled-unavailable');
  const truncated = await separationForExport('fogra39', null, diskFetch(200, BUNDLED.slice(0, 1000)));
  assert.equal(truncated.source, 'device', 'bytes of the wrong length are refused');
  const recovered = await separationForExport('fogra39', null, diskFetch());
  assert.equal(recovered.source, 'bundled');
});

/** The bundled tables declared as ICC 4.2: the export panel only offers own rows a
 *  PDF/X-4 output intent may embed (2.x to 4.2), and the bundled file is 4.3. */
function asV42(bytes: Uint8Array): Uint8Array {
  const out = bytes.slice();
  out[9] = 0x20;
  return out;
}

test('the user\'s own profile drives the separation when it is selected', async () => {
  const host = fakeHost();
  const entry = await add(host, asV42(BUNDLED), 'my-press.icc');
  const f = diskFetch();
  const r = await separationForExport(`own:${entry.digest}`, host, f);
  assert.equal(r.source, 'own');
  assert.equal(f.urls.length, 0, 'the bundled profile is not fetched');
  assert.match(separationLogLine(r), /^CMYK separation: Coated FOGRA39 \(fitted, craft-cms\) \(relative colorimetric/);
});

test('an own profile that cannot drive a separation is not replaced by FOGRA39', async () => {
  const host = fakeHost();
  const flat = await add(host, pressProfileBytes(), 'flat.icc');
  const r = await separationForExport(`own:${flat.digest}`, host, diskFetch());
  assert.equal(r.source, 'device');
  assert.equal(r.why, 'own-unavailable');
  const missing = await separationForExport('own:0123456789abcdef', host, diskFetch());
  assert.equal(missing.why, 'own-unavailable');
  const noHost = await separationForExport('own', null, diskFetch());
  assert.equal(noHost.why, 'own-unavailable');
  assert.match(separationLogLine(r), /the selected profile could not be read/);
});

test('bundledSeparation keeps black on K', async () => {
  const sep = await bundledSeparation(diskFetch());
  assert.deepEqual(sep!.separate(0, 0, 0), [0, 0, 0, 1]);
});
