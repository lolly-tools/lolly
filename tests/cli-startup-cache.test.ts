// SPDX-License-Identifier: MPL-2.0
// The terminal shells' compile cache (plans/371, M1.1): where the cache lives, when it
// stays off, and that `--version` and `--help` answer without loading the engine.
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { startupCacheChoice, type StartupCacheInputs } from '../shells/cli/src/startup-cache.ts';

const run = promisify(execFile);
const repo = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const entry = join(repo, 'shells/cli/bin/lolly.ts');

const published = (over: Partial<StartupCacheInputs> = {}): StartupCacheInputs => ({
  env: {}, platform: 'linux', home: '/home/pat', here: '/opt/app/node_modules/@lolly-tools/cli/dist',
  hasDir: () => false, packageVersion: () => '1.2.2', ...over,
});

test('a repository checkout keeps its cache inside its own node_modules', () => {
  const here = join('/work/lolly', 'shells', 'cli', 'src');
  const choice = startupCacheChoice(published({ here, hasDir: p => p === join('/work/lolly', 'node_modules') }));
  assert.deepEqual(choice, { dir: join('/work/lolly', 'node_modules', '.cache', 'lolly', 'compile-cache'), versioned: false });
});

test('a checkout with no node_modules falls back to the user cache directory', () => {
  const here = join('/work/lolly', 'shells', 'cli', 'src');
  const choice = startupCacheChoice(published({ here }));
  assert.deepEqual(choice, { dir: '/home/pat/.cache/lolly/compile-cache/1.2.2', versioned: true });
});

test('the published package uses the cache directory of each platform, by version', () => {
  assert.equal(startupCacheChoice(published())?.dir, '/home/pat/.cache/lolly/compile-cache/1.2.2');
  assert.equal(
    startupCacheChoice(published({ env: { XDG_CACHE_HOME: '/var/cache/pat' } }))?.dir,
    '/var/cache/pat/lolly/compile-cache/1.2.2',
  );
  assert.equal(
    startupCacheChoice(published({ env: { XDG_CACHE_HOME: 'relative/path' } }))?.dir,
    '/home/pat/.cache/lolly/compile-cache/1.2.2',
    'a relative XDG_CACHE_HOME is not valid and is ignored',
  );
  assert.equal(
    startupCacheChoice(published({ platform: 'darwin', home: '/Users/pat' }))?.dir,
    '/Users/pat/Library/Caches/lolly/compile-cache/1.2.2',
  );
  const windows = startupCacheChoice(published({ platform: 'win32', home: 'C:\\Users\\pat', env: { LOCALAPPDATA: 'C:\\Users\\pat\\AppData\\Local' } }));
  assert.ok(windows?.versioned);
  assert.ok(windows?.dir.includes('lolly'));
  assert.ok(windows?.dir.endsWith('1.2.2'));
});

test('the cache stays off when asked, when Node owns the choice and when there is nowhere to put it', () => {
  for (const value of ['0', 'off', 'false', 'no', 'OFF']) {
    assert.equal(startupCacheChoice(published({ env: { LOLLY_COMPILE_CACHE: value } })), null, `LOLLY_COMPILE_CACHE=${value}`);
  }
  assert.equal(startupCacheChoice(published({ env: { NODE_DISABLE_COMPILE_CACHE: '1' } })), null);
  assert.equal(startupCacheChoice(published({ env: { NODE_COMPILE_CACHE: '/tmp/somewhere' } })), null, 'Node already turned its own cache on');
  assert.equal(startupCacheChoice(published({ home: '' })), null, 'no home directory');
  assert.equal(startupCacheChoice(published({ packageVersion: () => null })), null, 'no readable version');
});

test('a version that is not a plain version string never becomes a folder name', () => {
  for (const version of ['../../etc', '1.2', 'v1.2.2', '1.2.2/..', '']) {
    assert.equal(startupCacheChoice(published({ packageVersion: () => version })), null, JSON.stringify(version));
  }
  assert.ok(startupCacheChoice(published({ packageVersion: () => '1.2.2-rc.1' })));
});

// A load hook that reports when Node loads the engine's public module. `--version` and
// `--help` must answer with that module unloaded; `list` is the control that shows the
// hook works.
const probe = 'data:text/javascript,' + encodeURIComponent(
  'import { registerHooks } from "node:module";'
  + 'registerHooks({ load(url, context, next) {'
  + ' if (url.endsWith("/engine/src/index.ts")) process.stderr.write("ENGINE-BARREL-LOADED\\n");'
  + ' return next(url, context); } });',
);
const env = { ...process.env, LOLLY_PROFILE: 'lolly-demo' };
const probed = (...args: string[]) => run(process.execPath, ['--import', probe, entry, ...args], { env, maxBuffer: 16 * 1024 * 1024 });

test('--version and --help answer without loading the engine', async () => {
  const version = await probed('--version');
  assert.match(version.stdout, /^lolly \d+\.\d+\.\d+\S* \(engine \d+\.\d+\.\d+\)\n$/);
  assert.ok(!version.stderr.includes('ENGINE-BARREL-LOADED'), '--version loaded the engine');
  const help = await probed('--help');
  assert.match(help.stdout, /^lolly - constraint-first asset generation/);
  assert.ok(!help.stderr.includes('ENGINE-BARREL-LOADED'), '--help loaded the engine');
  const list = await probed('list', '--json');
  assert.ok(list.stderr.includes('ENGINE-BARREL-LOADED'), 'the probe did not see the engine load for `list`, so the two checks above prove nothing');
});

test('a run in a checkout writes its compiled modules to the checkout cache', async () => {
  const plain: Record<string, string | undefined> = { ...env };
  delete plain.NODE_COMPILE_CACHE;
  delete plain.NODE_DISABLE_COMPILE_CACHE;
  delete plain.LOLLY_COMPILE_CACHE;
  await run(process.execPath, [entry, 'list', '--json'], { env: plain, maxBuffer: 16 * 1024 * 1024 });
  const dir = join(repo, 'node_modules', '.cache', 'lolly', 'compile-cache');
  assert.ok(existsSync(dir), `${dir} was not created`);
  const walk = (path: string): number => readdirSync(path, { withFileTypes: true })
    .reduce((n, e) => n + (e.isDirectory() ? walk(join(path, e.name)) : 1), 0);
  assert.ok(walk(dir) > 50, 'the cache holds compiled modules');
});
