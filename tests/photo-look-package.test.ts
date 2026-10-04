// SPDX-License-Identifier: MPL-2.0
/**
 * A photo look on a packaged picture (plan 291 W7): `lolly package` carries the
 * picture once by its base id and keeps each row's `?treatment=<lookId>` on the
 * row's ref, whichever way the row points at the picture (a key, an upload hash, or a
 * hash-prefix placeholder). Before W7 the look made the picture unresolvable.
 *
 * Run with: node --test tests/photo-look-package.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

import { packageDesign, type DesignPackageOptions } from '../packages/node-shell/src/design-lolly.ts';
import { readLollyFile } from '../packages/node-shell/src/lolly-file.ts';

const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 7, 9, 8, 7]);
const HEX = createHash('sha256').update(JPG).digest('hex');
const OPTS: DesignPackageOptions = { catalog: { profile: 'test', assets: [] }, toolVersion: '9.9.9', exportedAt: '2026-10-03T08:00:00.000Z' };

test('a look rides on the row while the picture travels once', async () => {
  const rows = [
    { id: 'f', kind: 'frame', x: 0, y: 0, w: 1920, h: 1080, bg: '#ffffff' },
    { id: 'keyed', kind: 'image', frame: 'f', x: 0, y: 0, w: 1920, h: 1080, image: 'photo:hero?treatment=tone' },
    { id: 'plain', kind: 'image', frame: 'f', x: 0, y: 0, w: 960, h: 540, image: 'photo:hero' },
    { id: 'upload', kind: 'image', frame: 'f', x: 0, y: 0, w: 960, h: 540, image: `user/media/${HEX}?treatment=brand-grade` },
    { id: 'prefix', kind: 'image', frame: 'f', x: 0, y: 0, w: 960, h: 540, image: `photo:${HEX.slice(0, 12)}?treatment=pine-mint` },
  ];
  const { bytes, report } = await packageDesign(rows, { ...OPTS, assets: [{ key: 'photo:hero', bytes: JPG, name: 'hero.jpg' }] });
  const read = readLollyFile(bytes);
  const boxes = read.session.boxes as Array<{ id: string; image?: { id: string; source: string } }>;
  const ids = Object.fromEntries(boxes.filter(b => b.image).map(b => [b.id, b.image!.id]));
  assert.deepEqual(ids, {
    keyed: `user/media/${HEX}?treatment=tone`,
    plain: `user/media/${HEX}`,
    upload: `user/media/${HEX}?treatment=brand-grade`,
    prefix: `user/media/${HEX}?treatment=pine-mint`,
  });
  assert.ok(boxes.filter(b => b.image).every(b => b.image!.source === 'user'));
  const media = (read.manifest.assets ?? []).map(a => a.id);
  assert.deepEqual(media, [`user/media/${HEX}`], 'the picture is carried once, under its base id');
  assert.equal(report.readback.media, 1);
});
