// SPDX-License-Identifier: MPL-2.0
/** Emit the official, executable-scoped userns exception for an ephemeral CI runner. */
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/** No wildcard or profile-language input may expand the executable attachment. */
export function chromiumUsernsProfile(binary: string, browsersRoot: string): string {
  if (!isAbsolute(binary) || !isAbsolute(browsersRoot) || !/^\/[A-Za-z0-9_./-]+$/.test(binary))
    throw new Error('Expected a safe absolute Chromium executable path');
  const path = relative(browsersRoot, binary);
  if (!path || path === '..' || path.startsWith(`..${sep}`) || isAbsolute(path))
    throw new Error('Chromium must remain within the owned runner browser directory');
  if (!/^chromium-[0-9]+\/chrome-linux64\/chrome$/.test(path))
    throw new Error('Expected the exact installed Chromium executable');
  // Chromium documents this exception for Ubuntu's AppArmor userns restriction.
  // It preserves the runner's existing unconfined execution and changes only
  // this binary's userns permission; Chromium's own sandbox stays enabled.
  return `abi <abi/4.0>,\ninclude <tunables/global>\nprofile lolly-ci-chromium ${binary} flags=(unconfined) {\n  userns,\n}\n`;
}

export function main(): void {
  if (process.platform !== 'linux') throw new Error('This runner profile is Linux-only');
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const ownedRoot = realpathSync(resolve(root, '.browsers'));
  if (realpathSync(process.env.PLAYWRIGHT_BROWSERS_PATH || '') !== ownedRoot)
    throw new Error('The browser must use this checkout’s scoped CI installation');
  const require = createRequire(resolve(root, 'services/mcp/scripts/install-browser.ts'));
  const version = require('playwright-core/package.json').version as string;
  if (
    !/^\d+\.\d+\.\d+$/.test(version) ||
    !readFileSync(resolve(root, 'pnpm-lock.yaml'), 'utf8').includes(`  playwright-core@${version}:`)
  )
    throw new Error('Installed Chromium driver does not match the frozen lockfile');
  const binary = realpathSync(require('playwright-core').chromium.executablePath());
  const info = statSync(binary);
  if (!info.isFile() || !(info.mode & 0o111)) throw new Error('Chromium executable is missing');
  process.stdout.write(
    `# Locked playwright-core ${version}; actual executable ${binary}\n${chromiumUsernsProfile(binary, ownedRoot)}`
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
