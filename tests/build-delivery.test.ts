// SPDX-License-Identifier: MPL-2.0
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync, rmSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import { precompressStaticDelivery, prepareStaticDelivery, prepareStaticDeliveryParallel, retainHashedRelease, nginxDeliveryMaps } from '../scripts/build-delivery.ts';
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
test('parallel compression writes byte for byte the files and validators of the serial pass', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lolly-delivery-parallel-'));
  const tree = (dir: string): Record<string, string> => Object.fromEntries(readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => { const path = join(entry.parentPath, entry.name); return [path.slice(dir.length), `${statSync(path).mtimeMs === 0 ? 'epoch' : 'written'} ${readFileSync(path).toString('base64')}`]; })
    .sort((x, y) => x[0]!.localeCompare(y[0]!)));
  try {
    const seed = (dir: string) => {
      mkdirSync(join(dir, '_app'), { recursive: true });
      mkdirSync(join(dir, 'info'), { recursive: true });
      for (let i = 0; i < 24; i++) writeFileSync(join(dir, '_app', `chunk-${i}.js`), `export const n${i} = ${JSON.stringify('lolly '.repeat(400 + i))};\n`);
      writeFileSync(join(dir, 'index.html'), '<!doctype html><title>x</title>'.repeat(80));
      writeFileSync(join(dir, 'info', 'index.html'), '<p>docs</p>'.repeat(300));
      writeFileSync(join(dir, 'random.wasm'), Buffer.from(Array.from({ length: 4096 }, (_, i) => (i * 7919) % 251)));
      writeFileSync(join(dir, 'small.json'), '{}');
    };
    const serial = join(root, 'serial'), parallel = join(root, 'parallel');
    seed(serial); seed(parallel);
    const one = prepareStaticDelivery(serial);
    const many = await prepareStaticDeliveryParallel(parallel);
    assert.deepEqual(many, one);
    assert.ok(one.compressed > 40);
    assert.deepEqual(tree(parallel), tree(serial));

    // A sibling made before the bytes changed is never used.
    const scratch = join(root, 'scratch'), stale = join(root, 'stale'), fresh = join(root, 'fresh');
    mkdirSync(scratch); seed(stale); seed(fresh);
    const made = await precompressStaticDelivery(stale, scratch, 3);
    assert.equal(made.size, 27);
    for (const dir of [stale, fresh]) writeFileSync(join(dir, '_app', 'chunk-3.js'), 'changed '.repeat(500));
    prepareStaticDelivery(stale, { precompressed: made });
    prepareStaticDelivery(fresh);
    assert.deepEqual(tree(stale), tree(fresh));
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
