// SPDX-License-Identifier: MPL-2.0
/** Every browser engine must reproduce the pinned geometry revision, main realm and worker, through the actual installers. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const option = (name: string) => process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const output = resolve(repo, option('output') ?? 'plans/295-validation/geometry-engines');
mkdirSync(output, { recursive: true });
const engines = process.env.LOLLY_GEOMETRY_BROWSER ? [process.env.LOLLY_GEOMETRY_BROWSER] : ['chromium', 'firefox', 'webkit'];
const benchmark = process.argv.includes('--benchmark');
function run(args: string[], env: NodeJS.ProcessEnv = process.env): boolean {
  const result = spawnSync(process.execPath, args, { cwd: repo, stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) { process.exitCode = result.status ?? 1; return false; }
  return true;
}
for (const engine of engines) {
  const env = { ...process.env, LOLLY_GEOMETRY_REQUIRED: '1', LOLLY_GEOMETRY_BROWSER: engine,
    LOLLY_GEOMETRY_HOST_REPORT: join(output, `${engine}-host.json`),
    LOLLY_GEOMETRY_HOST_BENCH: benchmark ? '1' : '0', LOLLY_GEOMETRY_REVERSE: process.argv.includes('--reverse') ? '1' : '0' };
  const mounts: string[] = [];
  try {
    if (engine === 'firefox' && process.argv.includes('--isolated-firefox')) {
      if (process.platform !== 'darwin') throw Error('The isolated Firefox application-data option is for macOS qualification.');
      const identity = `LollyGeometryQualification${process.pid}`, root = join(output, identity), ini = join(root, 'application.ini');
      mkdirSync(root, { recursive: true });
      writeFileSync(ini, `[App]\nName=${identity}\nVendor=LollyGeometry\nProfile=${identity}\n`);
      // Fresh symlinks place this test identity's application data under the report folder.
      for (const [parent, leaf] of [['Application Support', 'data'], ['Caches', 'cache']]) {
        const target = join(root, leaf!), mount = join(homedir(), 'Library', parent!, identity);
        mkdirSync(target, { recursive: true }); symlinkSync(target, mount); mounts.push(mount);
      }
      Object.assign(env, { LOLLY_GEOMETRY_FIREFOX_OVERRIDE: ini });
    }
    if (!run(['--test', ...(!benchmark ? ['tests/geometry-portable-math.browser.test.ts'] : []), 'tests/geometry-host.browser.test.ts'], env)) break;
  } finally { for (const mount of mounts.reverse()) unlinkSync(mount); }
}
