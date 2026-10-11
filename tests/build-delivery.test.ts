// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import { prepareStaticDelivery, retainHashedRelease, nginxDeliveryMaps } from '../scripts/build-delivery.ts';
import { publicStaticDeliveryClass } from '../packages/core/src/delivery-v1.ts';

test('build compression preserves decoded bytes and yields deterministic wire validators', () => {
  const root = mkdtempSync(join(tmpdir(), 'lolly-delivery-'));
  try {
    const text = '/* Unicode Ελληνικά */\n'.repeat(500);
    writeFileSync(join(root, 'app.js'), text);
    writeFileSync(join(root, 'small.txt'), 'small');
    const first = prepareStaticDelivery(root);
    assert.equal(first.compressed, 2);
    assert.equal(gunzipSync(readFileSync(join(root, 'app.js.gz'))).toString(), text);
    assert.equal(brotliDecompressSync(readFileSync(join(root, 'app.js.br'))).toString(), text);
    const etags = readFileSync(join(root, '.delivery-etags.conf'));
    const wire = readFileSync(join(root, 'app.js.gz'));
    prepareStaticDelivery(root);
    assert.deepEqual(readFileSync(join(root, '.delivery-etags.conf')), etags);
    assert.deepEqual(readFileSync(join(root, 'app.js.gz')), wire);
    assert.match(etags.toString(), /app\.js:gzip/);
    writeFileSync(join(root, 'app.js'), 'small now');
    prepareStaticDelivery(root);
    assert.equal(existsSync(join(root, 'app.js.gz')), false);
    assert.equal(existsSync(join(root, 'app.js.br')), false);
    writeFileSync(join(root, 'Outfit-latin[wght].woff2'), 'font');
    prepareStaticDelivery(root);
    assert.match(readFileSync(join(root, '.delivery-etags.conf'), 'utf8'), /Outfit-latin\[wght\]/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('previous hash families survive a release and collisions cannot overwrite published bytes', () => {
  const root = mkdtempSync(join(tmpdir(), 'lolly-retain-'));
  try {
    const old = join(root, 'old'), next = join(root, 'next');
    mkdirSync(join(old, '_app'), { recursive: true }); mkdirSync(next);
    writeFileSync(join(old, '_app/old.js'), 'published'); writeFileSync(join(old, 'index.html'), 'old shell');
    assert.equal(retainHashedRelease(next, old), 1);
    assert.equal(readFileSync(join(next, '_app/old.js'), 'utf8'), 'published');
    writeFileSync(join(next, '_app/old.js'), 'different');
    assert.throws(() => retainHashedRelease(next, old), /collision/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
test('generated cache maps make errors private while covering immutable addressed families', () => {
  const maps = nginxDeliveryMaps();
  assert.match(maps, /default "private, no-store, max-age=0, no-transform"/);
  assert.match(maps, /\(200\|206\|304\)/);
  assert.match(maps, /s-maxage=31536000, immutable, no-transform/);
  assert.equal(publicStaticDeliveryClass('/models/depth@0123456789abcdef/model.onnx'), 'public-immutable');
  assert.equal(publicStaticDeliveryClass('/models/depth/model.onnx'), 'public-revalidate');
  assert.equal(publicStaticDeliveryClass('/catalog/tools/index.0123456789abcdef.json'), 'public-immutable');
  assert.equal(publicStaticDeliveryClass('/file.png?dt=secret'), 'person-private');
});
