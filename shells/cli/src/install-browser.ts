// SPDX-License-Identifier: MPL-2.0
/**
 * `lolly install-browser` - download Chromium for the CLI's Tier-B render path
 * (HTML-layout raster, jpg/webp, pdf, video). This is the ONE explicit step that pulls
 * a browser: it drives the `playwright-core` we already depend on - NOT the full
 * `playwright` package - so a plain `pnpm install` never downloads one.
 *
 *   lolly install-browser                 # Chromium → <repo>/.browsers
 *   lolly install-browser --with-deps      # + OS system deps (Linux containers)
 *   lolly install-browser --force          # reinstall
 *
 * The install target is the CLI's own scoped dir (INSTALL_BROWSERS_DIR); an explicit
 * PLAYWRIGHT_BROWSERS_PATH in the environment overrides it. No download is needed at
 * all if you set LOLLY_BROWSER_CHANNEL=chrome to use an already-installed Chrome/Edge.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { INSTALL_BROWSERS_DIR } from '@lolly-tools/node-shell/browsers';

export async function installBrowserCli(passthrough: string[] = []): Promise<number> {
  const require = createRequire(import.meta.url);
  // Resolve the playwright-core CLI via its package.json (always resolvable) - cli.js is
  // its sibling. Avoids depending on the subpath `exports` for './cli.js'.
  const cli = join(dirname(require.resolve('playwright-core/package.json')), 'cli.js');

  process.env.PLAYWRIGHT_BROWSERS_PATH ??= INSTALL_BROWSERS_DIR;

  const args = [cli, 'install', 'chromium', ...passthrough];
  process.stderr.write(`Installing Chromium into ${process.env.PLAYWRIGHT_BROWSERS_PATH} …\n`);
  const r = spawnSync(process.execPath, args, { stdio: 'inherit', env: process.env });
  if (r.error) { process.stderr.write(`${r.error.message}\n`); return 1; }
  if ((r.status ?? 1) === 0) {
    process.stderr.write(
      '✓ Chromium installed. Raster/PDF/video export now works ' +
      '(build the web shell too if you have not: `pnpm run build:web`).\n',
    );
  }
  return r.status ?? 1;
}
