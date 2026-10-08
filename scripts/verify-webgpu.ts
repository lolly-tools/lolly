// SPDX-License-Identifier: MPL-2.0
/** GPU qualification refuses missing browsers/adapters rather than accepting a skipped test. */
import { spawnSync } from 'node:child_process';
import { mkdirSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = fileURLToPath(new URL('../', import.meta.url));
const report = resolve(repo, process.env.LOLLY_WEBGPU_REPORT ?? 'plans/295-validation/webgpu-lut-report.json');
const env: NodeJS.ProcessEnv = { ...process.env, LOLLY_WEBGPU_REQUIRED: '1', LOLLY_WEBGPU_REPORT: report };
const mounts: string[] = [];
try {
  if (process.argv.includes('--isolated-firefox')) {
    if (process.platform !== 'darwin' || env.LOLLY_WEBGPU_BROWSER !== 'firefox') {
      throw new Error('--isolated-firefox requires the macOS Firefox qualification target.');
    }
    // The maintained geometry qualification uses this same app-data override for
    // Playwright Firefox on macOS 27. It changes no personal profile or browser flag.
    const identity = `LollyWebGpuQualification${process.pid}`, root = join(dirname(report), identity);
    const ini = join(root, 'application.ini');
    mkdirSync(root, { recursive: true });
    writeFileSync(ini, `[App]\nName=${identity}\nVendor=LollyWebGpu\nProfile=${identity}\n`);
    for (const [parent, leaf] of [['Application Support', 'data'], ['Caches', 'cache']]) {
      const target = join(root, leaf!), mount = join(homedir(), 'Library', parent!, identity);
      mkdirSync(target, { recursive: true }); symlinkSync(target, mount); mounts.push(mount);
    }
    Object.assign(env, { LOLLY_WEBGPU_FIREFOX_OVERRIDE: ini });
  }
  const result = spawnSync(process.execPath, ['--import', './tests/browser-gpu.ts', '--test', 'tests/webgpu-lut.browser.test.ts'], {
    cwd: repo, stdio: 'inherit', env,
  });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally { for (const mount of mounts.reverse()) unlinkSync(mount); }
