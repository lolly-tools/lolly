// SPDX-License-Identifier: MPL-2.0

import assert from 'node:assert/strict';
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { inspectModels, stageModels, verifyModels } from '../scripts/model-release.ts';

const commit = 'a'.repeat(40);
async function fixture(t: test.TestContext) {
  const root = await mkdtemp(join(tmpdir(), 'lolly-model-release-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'source'),
    manifest = join(root, 'manifest.json');
  await mkdir(join(source, 'vision'), { recursive: true });
  await writeFile(join(source, 'vision', 'model.onnx'), Buffer.from([0, 1, 2, 3]));
  await writeFile(manifest, JSON.stringify([{ url: '/models/vision/model.onnx', size: 4 }]));
  return { root, source, manifest, output: join(root, 'release') };
}
test('model release survives source changes and verifies exact bytes and approved identity', async (t) => {
  const f = await fixture(t),
    record = await stageModels(f.manifest, [f.source], commit, f.output);
  await writeFile(join(f.source, 'vision', 'model.onnx'), Buffer.from([4, 5, 6, 7]));
  assert.equal((await verifyModels(f.output, f.manifest, record.release)).release, record.release);
  assert.deepEqual(
    await readFile(join(f.output, 'vision', 'model.onnx')),
    Buffer.from([0, 1, 2, 3])
  );
  await assert.rejects(
    verifyModels(f.output, f.manifest, 'models-' + '0'.repeat(64)),
    /identity differs/
  );
});
test('model release refuses traversal, encoded paths, hidden files, duplicate and unsafe sizes', async (t) => {
  const f = await fixture(t);
  for (const entry of [
    { url: '/models/../key', size: 4 },
    { url: '/models/%2e/key', size: 4 },
    { url: '/models/.secret', size: 4 },
    { url: '/models/vision/model.onnx', size: -1 },
    { url: '/models/vision/model.onnx', size: 9 * 1024 ** 3 },
  ]) {
    await writeFile(f.manifest, JSON.stringify([entry]));
    await assert.rejects(inspectModels(f.manifest, [f.source], commit));
  }
  await writeFile(
    f.manifest,
    JSON.stringify(Array(2).fill({ url: '/models/vision/model.onnx', size: 4 }))
  );
  await assert.rejects(inspectModels(f.manifest, [f.source], commit), /duplicate/);
});
test('model release refuses symbolic links and files with incorrect byte counts', async (t) => {
  const f = await fixture(t),
    file = join(f.source, 'vision', 'model.onnx');
  await rm(file);
  await symlink(f.manifest, file);
  await assert.rejects(inspectModels(f.manifest, [f.source], commit), /symbolic link/);
  await rm(file);
  await writeFile(file, 'wrong size');
  await assert.rejects(inspectModels(f.manifest, [f.source], commit), /source size differs/);
});
test('model release preserves existing output and refuses output inside a source', async (t) => {
  const f = await fixture(t);
  await mkdir(f.output);
  await writeFile(join(f.output, 'keep'), 'saved');
  await assert.rejects(stageModels(f.manifest, [f.source], commit, f.output), /EEXIST/);
  assert.equal(await readFile(join(f.output, 'keep'), 'utf8'), 'saved');
  await assert.rejects(
    stageModels(f.manifest, [f.source], commit, join(f.source, 'release')),
    /separate/
  );
});
test('model verification rejects extra files and altered bytes or release inventory', async (t) => {
  const f = await fixture(t),
    record = await stageModels(f.manifest, [f.source], commit, f.output);
  const extra = join(f.output, 'unexpected.txt');
  await writeFile(extra, 'extra');
  await assert.rejects(verifyModels(f.output, f.manifest, record.release), /unexpected/);
  await rm(extra);
  const file = join(f.output, 'vision', 'model.onnx');
  await chmod(file, 0o644);
  await writeFile(file, Buffer.from([9, 8, 7, 6]));
  await assert.rejects(verifyModels(f.output, f.manifest, record.release), /checksum differs/);
});
test('model inspection combines explicitly reviewed roots in order and requires a source commit', async (t) => {
  const f = await fixture(t),
    metadataRoot = join(f.root, 'metadata');
  await mkdir(metadataRoot);
  const one = await inspectModels(f.manifest, [metadataRoot, f.source], commit),
    two = await inspectModels(f.manifest, [f.source], commit);
  assert.equal(one.record.release, two.record.release);
  await assert.rejects(
    inspectModels(f.manifest, [f.source], 'main'),
    /exact reviewed source commit/
  );
  await writeFile(f.manifest, JSON.stringify([{ url: '/models/missing.onnx', size: 4 }]));
  await assert.rejects(inspectModels(f.manifest, [f.source], commit), /missing/);
});

test('model inventory symbolic links are refused before reading their contents', async (t) => {
  const f = await fixture(t),
    record = await stageModels(f.manifest, [f.source], commit, f.output);
  const inventory = join(f.output, '.lolly-model-release.json');
  await rm(inventory);
  await symlink(f.manifest, inventory);
  await assert.rejects(verifyModels(f.output, f.manifest, record.release), /symbolic link/);
});
