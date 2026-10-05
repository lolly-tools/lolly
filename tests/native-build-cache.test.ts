// SPDX-License-Identifier: MPL-2.0
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test, { type TestContext } from 'node:test';
import { cleanNativeCaches, nativeCachePaths } from '../scripts/lib/native-build-cache.ts';

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'lolly-native-cache-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', root]);
  writeFileSync(join(root, '.gitignore'), 'shells/**/target/\nshells/**/build/\nplans/\n');
  const paths = nativeCachePaths(root, 'mobile');
  for (const path of paths) mkdirSync(path, { recursive: true });
  writeFileSync(join(paths[0], 'CACHEDIR.TAG'), 'Signature: 8a477f597d28d172789f06886806bc55');
  mkdirSync(join(paths[0], 'aarch64-linux-android/release/deps'), { recursive: true });
  writeFileSync(join(paths[0], 'aarch64-linux-android/release/deps/liblolly_mobile_lib.rlib'), 'large regenerable library');
  mkdirSync(join(paths[0], 'release/bundle'), { recursive: true });
  writeFileSync(join(paths[0], 'release/bundle/release.dmg'), 'signed release');
  mkdirSync(join(paths[1], 'intermediates/jni'), { recursive: true });
  writeFileSync(join(paths[1], 'intermediates/jni/liblolly_mobile_lib.so'), 'native intermediate');
  mkdirSync(join(paths[1], 'outputs/apk'), { recursive: true });
  writeFileSync(join(paths[1], 'outputs/apk/release.apk'), 'signed android release');
  return { root, paths };
}

test('native cleanup previews without mutation, then keeps release packages and removes intermediate libraries', t => {
  const { root, paths } = fixture(t);
  const before = cleanNativeCaches(root, paths);
  assert.equal(before.length, 2); assert.ok(before.every(item => !item.removed && item.bytes > 0));
  assert.ok(existsSync(join(paths[1], 'intermediates/jni/liblolly_mobile_lib.so')));
  cleanNativeCaches(root, paths, true);
  assert.equal(readFileSync(join(paths[0], 'release/bundle/release.dmg'), 'utf8'), 'signed release');
  assert.equal(readFileSync(join(paths[1], 'outputs/apk/release.apk'), 'utf8'), 'signed android release');
  assert.equal(existsSync(join(paths[0], 'aarch64-linux-android')), false);
  assert.equal(existsSync(join(paths[1], 'intermediates')), false);
});

test('native cleanup refuses tracked cache content before deleting any cache', t => {
  const { root, paths } = fixture(t);
  const file = join(paths[1], 'intermediates/jni/liblolly_mobile_lib.so');
  execFileSync('git', ['-C', root, 'add', '-f', file]);
  assert.throws(() => cleanNativeCaches(root, paths, true), /tracked/);
  assert.ok(existsSync(join(paths[0], 'CACHEDIR.TAG')));
  assert.ok(existsSync(file));
});

test('native cleanup refuses symlinks, external targets and another build lock', t => {
  const { root, paths } = fixture(t);
  symlinkSync(join(paths[1], 'outputs'), join(paths[0], 'linked-output'), 'dir');
  assert.throws(() => cleanNativeCaches(root, paths, true), /symlink/);
  rmSync(join(paths[0], 'linked-output'));
  assert.throws(() => cleanNativeCaches(root, [tmpdir()], true), /inside this checkout/);
  mkdirSync(join(root, 'plans/.native-build.lock'), { recursive: true });
  writeFileSync(join(root, 'plans/.native-build.lock/pid'), '999999');
  assert.throws(() => cleanNativeCaches(root, paths, true), /owns this checkout/);
  assert.ok(existsSync(join(paths[0], 'CACHEDIR.TAG')));
});

test('packaging wrapper cleans only after success, forwards flags, and supports retaining incremental caches', t => {
  for (const mode of ['success', 'failed', 'retain', 'unbundled']) {
    const { root, paths } = fixture(t);
    mkdirSync(join(root, 'scripts/lib'), { recursive: true });
    for (const file of ['build-native.ts', 'lib/native-build-cache.ts']) {
      copyFileSync(fileURLToPath(new URL(`../scripts/${file}`, import.meta.url)), join(root, 'scripts', file));
    }
    const cliDir = join(root, 'shells/tauri-mobile/node_modules/@tauri-apps/cli');
    mkdirSync(cliDir, { recursive: true });
    writeFileSync(join(cliDir, 'tauri.js'), `require('node:fs').writeFileSync('invocation.json', JSON.stringify(process.argv.slice(2)));process.exit(${mode === 'failed' ? 7 : 0});`);
    if (mode === 'unbundled') {
      utimesSync(join(paths[1], 'outputs/apk/release.apk'), 0, 0);
      utimesSync(join(paths[0], 'release/bundle/release.dmg'), 0, 0);
    }
    const run = spawnSync(process.execPath, [join(root, 'scripts/build-native.ts'), 'mobile', 'android', '--target', 'aarch64'], {
      env: { ...process.env, LOLLY_KEEP_NATIVE_CACHE: mode === 'retain' ? '1' : '0' }, encoding: 'utf8',
    });
    assert.equal(run.status, mode === 'failed' ? 7 : 0, run.stderr);
    assert.deepEqual(JSON.parse(readFileSync(join(root, 'shells/tauri-mobile/invocation.json'), 'utf8')), ['android', 'build', '--target', 'aarch64']);
    assert.equal(existsSync(join(paths[1], 'intermediates/jni/liblolly_mobile_lib.so')), mode !== 'success');
    assert.equal(readFileSync(join(paths[1], 'outputs/apk/release.apk'), 'utf8'), 'signed android release');
    assert.equal(existsSync(join(root, 'plans/.native-build.lock')), false);
  }
});
