// SPDX-License-Identifier: MPL-2.0
import { execFileSync } from 'node:child_process';
import { existsSync, lstatSync, readdirSync, readFileSync, realpathSync, rmSync, statSync } from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

export interface NativeCacheResult { path: string; bytes: number; removed: boolean }

/** Build caches only. Packaged releases stay in bundle and outputs directories. */
export function nativeCachePaths(root: string, shell: 'mobile' | 'desktop', customTarget?: string): string[] {
  const crate = join(root, `shells/tauri-${shell}/src-tauri`);
  const paths = [customTarget ? resolve(crate, customTarget) : join(crate, 'target')];
  if (shell === 'mobile') paths.push(join(crate, 'gen/android/app/build'));
  return paths;
}

export function nativeBuildIsRunning(): boolean {
  try {
    const processes = execFileSync('ps', ['-axo', 'comm'], { encoding: 'utf8' });
    if (processes.split('\n').some(line => /^(cargo|rustc|xcodebuild|clang|clang\+\+|swiftc|gradle|gradlew|tauri)$/.test(basename(line.trim())))) return true;
    const java = execFileSync('ps', ['-axo', 'pid,comm'], { encoding: 'utf8' }).split('\n')
      .filter(line => basename(line.trim().replace(/^\d+\s+/, '')) === 'java');
    return java.some(line => {
      const pid = line.trim().split(/\s+/)[0];
      const args = execFileSync('ps', ['-p', pid, '-o', 'args='], { encoding: 'utf8' });
      return /org\.gradle\.(?:launcher\.(?:daemon\.bootstrap\.GradleDaemon|GradleMain)|wrapper\.GradleWrapperMain)/.test(args);
    });
  } catch { return true; }
}

export function hasFreshNativePackage(paths: string[], startedAt: number): boolean {
  function packaged(path: string): boolean {
    if (!existsSync(path)) return false;
    for (const entry of readdirSync(path, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) continue;
      const file = join(path, entry.name);
      if (entry.isDirectory()) {
        if (packaged(file)) return true;
      } else if (/\.(?:apk|aab|ipa|dmg|msi|exe|deb|rpm|AppImage)$/.test(entry.name) && statSync(file).mtimeMs >= startedAt - 1000) return true;
      else if (path.split(sep).some(part => part.endsWith('.app')) && statSync(file).mtimeMs >= startedAt - 1000) return true;
    }
    return false;
  }
  return paths.some(path => {
    if (!existsSync(path)) return false;
    if (packaged(join(path, 'outputs')) || packaged(join(path, 'release/bundle'))) return true;
    return readdirSync(path, { withFileTypes: true }).some(entry => entry.isDirectory() && !entry.isSymbolicLink() && packaged(join(path, entry.name, 'release/bundle')));
  });
}

function assertCache(root: string, path: string): void {
  const rel = relative(root, path);
  if (!rel || rel === '..' || rel.startsWith(`..${sep}`) || resolve(root, rel) !== path) throw new Error('Cache must be inside this checkout.');
  for (let dir = path; dir !== root; dir = dirname(dir)) {
    if (existsSync(dir) && lstatSync(dir).isSymbolicLink()) throw new Error(`Refusing a cache reached through a symlink: ${rel}`);
  }
  if (!lstatSync(path).isDirectory()) throw new Error(`Cache is not a directory: ${rel}`);
  const tracked = execFileSync('git', ['-C', root, 'ls-files', '--', rel], { encoding: 'utf8' });
  if (tracked.trim()) throw new Error(`Refusing tracked files in ${rel}`);
  try { execFileSync('git', ['-C', root, 'check-ignore', '-q', rel], { stdio: 'ignore' }); }
  catch { throw new Error(`Refusing a cache that Git does not ignore: ${rel}`); }
  const android = rel.endsWith('src-tauri/gen/android/app/build');
  if (!android && !existsSync(join(path, 'CACHEDIR.TAG')) && !existsSync(join(path, '.rustc_info.json'))) {
    throw new Error(`Rust cache markers missing: ${rel}`);
  }
}

function contents(path: string, apply: boolean): number {
  let bytes = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.name === 'bundle' || entry.name === 'outputs' || entry.name === 'CACHEDIR.TAG' || entry.name === '.rustc_info.json') continue;
    if (entry.isSymbolicLink()) throw new Error(`Refusing a symlink inside the cache: ${file}`);
    if (entry.isDirectory()) bytes += contents(file, apply);
    else { bytes += statSync(file).size; if (apply) rmSync(file); }
    if (apply && entry.isDirectory() && readdirSync(file).length === 0) rmSync(file, { recursive: true });
  }
  return bytes;
}

export function cleanNativeCaches(rootPath: string, paths: string[], apply = false): NativeCacheResult[] {
  const root = realpathSync(rootPath);
  const lock = join(root, 'plans/.native-build.lock/pid');
  if (apply && existsSync(lock) && Number(readFileSync(lock, 'utf8')) !== process.pid) throw new Error('A native build owns this checkout; cleanup postponed.');
  if (apply && nativeBuildIsRunning()) throw new Error('A native compiler is running; cleanup postponed.');
  const present = paths.filter(existsSync).map(path => {
    const rel = relative(resolve(rootPath), resolve(path));
    if (!rel || rel === '..' || rel.startsWith(`..${sep}`)) throw new Error('Cache must be inside this checkout.');
    return resolve(root, rel);
  });
  for (const path of present) { assertCache(root, path); contents(path, false); }
  return present.map(path => ({ path: relative(root, path), bytes: contents(path, apply), removed: apply }));
}
