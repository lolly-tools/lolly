// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { compileMountedModelDelivery, readReviewedModelJson, validateMountedModelFiles, verifyMountedModelVolume } from '../scripts/lib/mounted-model-delivery.ts';
import { prepareStaticDelivery } from '../scripts/build-delivery.ts';

const sha = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function manifest(bytes = 'current model', name = 'model.onnx') {
  const file = { url: `/models/depth/${name}`, size: Buffer.byteLength(bytes), sha256: sha(bytes) };
  const directorySha256 = sha(`${name}\0${file.size}\0${file.sha256}\n`);
  return [{ ...file, directorySha256, immutableUrl: `/models/depth@${directorySha256.slice(0, 16)}/${name}` }];
}

test('mounted validators bind complete full hash families and explicit legacy bytes deterministically', () => {
  const current = manifest('current bytes'), older = 'archive bytes';
  assert.equal(Buffer.byteLength(older), current[0]!.size);
  const archive = { version: 1, files: [{ url: current[0]!.url, size: older.length, sha256: sha(older) }] };
  const rows = compileMountedModelDelivery(current, archive);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows.find(row => row.url === current[0]!.url), archive.files[0]);
  assert.equal(rows.find(row => row.url === current[0]!.immutableUrl)!.sha256, current[0]!.sha256);
  assert.deepEqual(compileMountedModelDelivery(current), [{ url: current[0]!.immutableUrl, size: current[0]!.size, sha256: current[0]!.sha256 }]);
  assert.deepEqual(compileMountedModelDelivery([...current].reverse(), archive), rows);
  const previous = manifest('previous model');
  const historical = { url: previous[0]!.immutableUrl, size: previous[0]!.size, sha256: previous[0]!.sha256 };
  assert.equal(compileMountedModelDelivery(current, { version: 1, files: [...archive.files, historical] }).length, 3);
});

test('manifest/address/path/size tampering and incomplete retained families fail closed', () => {
  const current = manifest(), first = current[0]!;
  for (const patch of [
    { url: '/models/depth/../escape.onnx' }, { url: '/models/depth//model.onnx' },
    { immutableUrl: '/models/depth@0000000000000000/model.onnx' },
    { sha256: 'a'.repeat(16) }, { sha256: first.sha256.toUpperCase() },
    { directorySha256: 'b'.repeat(64) }, { size: first.size + 1 },
    { size: -1 }, { size: Number.MAX_SAFE_INTEGER + 1 }, { extra: true },
  ]) assert.throws(() => compileMountedModelDelivery([{ ...first, ...patch }]));
  assert.throws(() => compileMountedModelDelivery([...current, first]), /Duplicate/);
  assert.throws(() => compileMountedModelDelivery([]), /complete/);
  assert.throws(() => compileMountedModelDelivery(current, { version: 2, files: [] }), /archived/);
  const invalid = { url: '/models/depth@aaaaaaaaaaaaaaaa/model.onnx', size: first.size, sha256: first.sha256 };
  assert.throws(() => validateMountedModelFiles([invalid]), /Incomplete/);
  const collision = { url: first.immutableUrl, size: first.size, sha256: 'f'.repeat(64) };
  assert.throws(() => compileMountedModelDelivery(current, { version: 1, files: [collision] }));
  for (const url of ['/models/depth/.secret', '/models/depth/model.onnx?key=1', '/models/depth/%2e%2e/model', '/models/depth/model.onnx\n;', '/other/model.onnx']) {
    assert.throws(() => validateMountedModelFiles([{ ...invalid, url }]), /Unsafe/);
  }
});

test('the maintained model manifest is complete without reading any model bytes', () => {
  const current = JSON.parse(readFileSync(new URL('../shells/web/models-manifest.json', import.meta.url), 'utf8'));
  const rows = compileMountedModelDelivery(current);
  assert.equal(rows.length, current.length);
  assert.ok(rows.length > 0);
  assert.ok(rows.every(row => /@[0-9a-f]{16}\//.test(row.url)));
});

test('maintained generator and staged verifier CLIs require pins and reject release collisions', () => {
  const root = mkdtempSync(join(tmpdir(), 'lolly-model-cli-'));
  try {
    const bytes = 'current model', current = manifest(bytes), rows = compileMountedModelDelivery(current);
    const input = join(root, 'manifest.json'), text = JSON.stringify(current), site = join(root, 'site');
    mkdirSync(site); writeFileSync(input, text); writeFileSync(join(site, 'index.html'), 'static site');
    const cli = (script: string, args: string[]) => spawnSync(process.execPath, [new URL(script, import.meta.url).pathname, ...args], { encoding: 'utf8' });
    const args = ['--root', site, '--models-manifest', input, '--models-manifest-sha256', sha(text)];
    const result = cli('../scripts/build-delivery.ts', args);
    assert.equal(result.status, 0, result.stderr); assert.equal(JSON.parse(result.stdout).mountedModels, 1);
    const etags = readFileSync(join(site, '.delivery-etags.conf'));
    assert.match(etags.toString(), new RegExp(rows[0]!.sha256));
    args[args.length - 1] = '0'.repeat(64);
    assert.notEqual(cli('../scripts/build-delivery.ts', args).status, 0);
    assert.deepEqual(readFileSync(join(site, '.delivery-etags.conf')), etags);
    const volume = join(root, 'models'), path = join(volume, rows[0]!.url.slice('/models/'.length));
    mkdirSync(join(path, '..'), { recursive: true }); writeFileSync(path, bytes); utimesSync(path, 0, 0);
    const verified = cli('../scripts/lib/mounted-model-delivery.ts', ['--verify-root', volume, '--manifest', input, '--manifest-sha256', sha(text)]);
    assert.equal(verified.status, 0, verified.stderr); assert.equal(JSON.parse(verified.stdout).files, 1);
    const collision = join(site, rows[0]!.url.slice(1));
    mkdirSync(join(collision, '..'), { recursive: true }); writeFileSync(collision, bytes);
    assert.throws(() => prepareStaticDelivery(site, { mountedModels: rows }), /collides/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('reviewed input pins bind exact JSON and stage verification checks bytes, epoch, closure and symlinks', async () => {
  const root = mkdtempSync(join(tmpdir(), 'lolly-model-volume-'));
  try {
    const bytes = 'current model', current = manifest(bytes), rows = compileMountedModelDelivery(current);
    const input = join(root, 'reviewed.json'), json = JSON.stringify(current);
    writeFileSync(input, json);
    assert.deepEqual(readReviewedModelJson(input, sha(json)), current);
    assert.throws(() => readReviewedModelJson(input, '0'.repeat(64)), /pin mismatch/);
    assert.throws(() => readReviewedModelJson(input, sha(json).slice(0, 16)), /full reviewed/);
    const volume = join(root, 'models'), file = join(volume, rows[0]!.url.slice('/models/'.length));
    mkdirSync(join(file, '..'), { recursive: true }); writeFileSync(file, bytes); utimesSync(file, 0, 0);
    const first = await verifyMountedModelVolume(volume, rows);
    assert.deepEqual(first, await verifyMountedModelVolume(volume, rows));
    assert.equal(first.files, 1); assert.equal(first.bytes, Buffer.byteLength(bytes));
    utimesSync(file, 1, 1);
    await assert.rejects(verifyMountedModelVolume(volume, rows), /epoch mismatch/);
    writeFileSync(file, 'tampered data'); utimesSync(file, 0, 0);
    await assert.rejects(verifyMountedModelVolume(volume, rows), /bytes or epoch/);
    writeFileSync(file, bytes); utimesSync(file, 0, 0);
    writeFileSync(`${file}.gz`, 'unreviewed wire representation');
    await assert.rejects(verifyMountedModelVolume(volume, rows), /Unlisted/);
    rmSync(`${file}.gz`);
    writeFileSync(join(volume, 'models-release.json'), '{"operator":"receipt"}');
    assert.equal((await verifyMountedModelVolume(volume, rows)).files, 1);
    symlinkSync(file, join(volume, 'linked.onnx'));
    await assert.rejects(verifyMountedModelVolume(volume, rows), /symlink/);
    rmSync(join(volume, 'linked.onnx')); rmSync(file);
    await assert.rejects(verifyMountedModelVolume(volume, rows), /missing/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
