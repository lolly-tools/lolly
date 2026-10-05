// SPDX-License-Identifier: MPL-2.0
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanNativeCaches, hasFreshNativePackage, nativeCachePaths } from './lib/native-build-cache.ts';

const [shell, platform, ...args] = process.argv.slice(2);
if (shell !== 'mobile' && shell !== 'desktop') throw new Error('Choose mobile or desktop.');
if (shell === 'mobile' && platform !== 'android' && platform !== 'ios') throw new Error('Choose android or ios.');
if (shell === 'desktop' && platform !== 'build') throw new Error('Desktop uses build.');
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const lock = join(root, 'plans/.native-build.lock');
mkdirSync(dirname(lock), { recursive: true });
if (existsSync(lock)) {
  const pid = Number(readFileSync(join(lock, 'pid'), 'utf8'));
  if (!Number.isSafeInteger(pid) || pid < 1) throw new Error('Native build lock needs inspection.');
  try { process.kill(pid, 0); throw new Error('Another native build is running.'); }
  catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error; }
  rmSync(lock, { recursive: true });
}
mkdirSync(lock);
writeFileSync(join(lock, 'pid'), String(process.pid));
try {
  const startedAt = Date.now();
  const cwd = join(root, `shells/tauri-${shell}`);
  const cli = join(cwd, 'node_modules/@tauri-apps/cli/tauri.js');
  const command = platform === 'android' || platform === 'ios' ? [platform, 'build', ...args] : ['build', ...args];
  const child = spawn(process.execPath, [cli, ...command], { cwd, stdio: 'inherit' });
  const interrupt = () => child.kill('SIGINT');
  const terminate = () => child.kill('SIGTERM');
  process.on('SIGINT', interrupt); process.on('SIGTERM', terminate);
  const status = await new Promise<number>((resolveExit, reject) => { child.once('error', reject); child.once('exit', code => resolveExit(code ?? 1)); })
    .finally(() => { process.off('SIGINT', interrupt); process.off('SIGTERM', terminate); });
  process.exitCode = status;
  if (status === 0 && process.env.LOLLY_KEEP_NATIVE_CACHE !== '1') {
    try {
      const paths = nativeCachePaths(root, shell, process.env.CARGO_TARGET_DIR);
      if (args.includes('--no-bundle') || !hasFreshNativePackage(paths, startedAt)) throw new Error('No new packaged release found; intermediates retained.');
      const results = cleanNativeCaches(root, paths, true);
      console.log(`Native packaging complete. Cleaned ${(results.reduce((sum, item) => sum + item.bytes, 0) / 2 ** 30).toFixed(2)} GiB of build intermediates; packaged releases preserved.`);
    } catch (error) { console.warn(`Native packaging complete; cache cleanup postponed: ${(error as Error).message}`); }
  }
} finally { rmSync(lock, { recursive: true, force: true }); }
