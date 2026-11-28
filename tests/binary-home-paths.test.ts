// SPDX-License-Identifier: MPL-2.0
// scripts/check-binary-home-paths.ts: committed binaries hold no home-directory path.
// CI runs the script over every tracked file; these cases pin what counts as a home
// path and check the committed kernels, which carried one until they were rebuilt.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { findHomePaths, isScanned, looksBinary } from '../scripts/check-binary-home-paths.ts';

const bytes = (text: string) => new Uint8Array(Buffer.from(text, 'latin1'));
const paths = (text: string) => findHomePaths(bytes(text)).map(finding => finding.path);

test('macOS, Linux, Windows and root home paths are found, with the name masked', () => {
  assert.deepEqual(paths('\0panic at /Users/jo/.cargo/registry/src/x/lib.rs\0'), ['/Users/<name>/.cargo/registry/src/x/lib.rs']);
  assert.deepEqual(paths('xx/home/runner/work/lolly/src/a.c\0'), ['/home/<name>/work/lolly/src/a.c']);
  assert.deepEqual(paths('C:\\Users\\Jo Smith\\x'), [], 'a name with a space is not read as a path');
  assert.deepEqual(paths('C:\\Users\\jsmith\\src\\a.c'), ['C:\\Users\\<name>\\src\\a.c']);
  assert.deepEqual(paths('"D:\\\\Users\\\\jsmith\\\\src"'), ['D:\\\\Users\\\\<name>\\\\src"']);
  assert.deepEqual(paths('E:/Users/jsmith/src'), ['E:/Users/<name>/src']);
  assert.deepEqual(paths('/root/.cargo/registry/src/y.rs'), ['/root/.cargo/registry/src/y.rs']);
  assert.deepEqual(paths('HOME=/Users/jo\0'), ['/Users/<name>'], 'a bare home directory ending in NUL');
});

test('shared profile folders and paths with no user name are not home paths', () => {
  assert.deepEqual(paths('/Users/Shared/Lolly/fonts/a.ttf'), []);
  assert.deepEqual(paths('C:\\Users\\Public\\Documents\\a'), []);
  assert.deepEqual(paths('C:/Users/Default/AppData'), []);
  assert.deepEqual(paths('the /Users/ folder and /home/ on Linux'), []);
  assert.deepEqual(paths('/cargo/registry/src/index.crates.io-1949cf8c6b5b557f/itoa-1.0.18/src/lib.rs'), []);
  assert.deepEqual(paths('/lolly/packages/node-shell/wasm/dxf/src/lib.rs /root/bin'), []);
});

test('offsets point at the start of each path', () => {
  const findings = findHomePaths(bytes('ab/Users/jo/x\0cd/home/al/y'));
  assert.deepEqual(findings.map(finding => finding.offset), [2, 16]);
});

test('binaries, minified files, maps, kernels and api bundles are scanned; authored text is not', () => {
  assert.equal(looksBinary(bytes('\x89PNG\r\n\x1a\n\0\0')), true);
  assert.equal(looksBinary(bytes('export const a = 1;\n')), false);
  const text = bytes('const example = "/home/user/project";\n');
  assert.equal(isScanned('tests/state-dir.test.ts', text), false);
  for (const path of ['community/x/lib/three.min.js', 'shells/web/public/vendor/a.js.map', 'packages/node-shell/wasm/dxf/dxf.wasm', 'native/addon.node', 'api/mcp/[...path].js']) {
    assert.equal(isScanned(path, text), true, path);
  }
  assert.equal(isScanned('docs/shots/a.png', bytes('\x89PNG\0')), true);
});

test('no committed WebAssembly kernel holds a home-directory path', () => {
  const root = new URL('../packages/node-shell/wasm/', import.meta.url);
  const kernels: string[] = [];
  for (const dir of readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    for (const file of readdirSync(new URL(`${dir.name}/`, root))) if (file.endsWith('.wasm')) kernels.push(join(dir.name, file));
  }
  assert.ok(kernels.length >= 11, `found ${kernels.length} kernels`);
  const dirty = kernels.filter(kernel => findHomePaths(readFileSync(new URL(kernel, root))).length);
  assert.deepEqual(dirty, []);
});
